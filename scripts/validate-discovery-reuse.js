import { dismissStory } from './dismiss-story.js'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Real recorded animal scene/response, HTTP replay ONLY. Browser detection/OCR
// are real. This checks UI state/provenance, not a fresh model's answer quality.
export default async function validateDiscoveryReuse(page) {
  const fixture = JSON.parse((await readFile(new URL('./fixtures/discovery-ui-replay.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''))
  const original = fixture.scene
  const description = id => original.evidence.find(item => item.id === id)?.description ?? ''
  const projection = {
    scene_description: original.description,
    visible_objects: original.objects.filter(item => item.source === 'gemma').map(item => ({ name: item.name, evidence: item.evidenceIds.map(description).join(' ') })),
    object_affordances: [], visible_issues: [], potential_improvements: [], matches: [], relationships: [], uncertainty_notes: original.uncertainty,
  }
  const report = { kind: fixture.provenance, checks: [], requests: [], external: [], errors: [] }
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const images = body.messages.flatMap(message => message.images ?? []).length
    report.requests.push({ images })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(images ? projection : fixture.turn.response) } }) })
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await tab.getByRole('button', { name: 'Detect objects', exact: true }).click()
    await tab.waitForFunction(() => document.querySelectorAll('.detection-hotspot').length === 4)
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await tab.locator('.shared-scene > .intent-result').waitFor()
    await tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false')
    const sceneId = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    assert.deepEqual(report.requests.map(item => item.images), [1, 0])
    await tab.getByRole('button', { name: 'View Dog 1 discovery', exact: true }).click()
    assert((await tab.locator('.discovery-answer').innerText()).includes(fixture.turn.response.answer), 'Card must show verbatim recorded response')
    assert.equal(await tab.locator('.discovery-evidence').getAttribute('open'), null)
    await tab.screenshot({ path: 'test-results/discovery-saved-answer-desktop.png', fullPage: true, animations: 'disabled' })
    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: 844 })
      assert(await tab.locator('.object-detail-card').evaluate(node => node.scrollHeight <= node.clientHeight + 1), 'Mobile card must not have an inner scrollbar')
      await tab.locator('.discovery-evidence summary').click()
      assert(await tab.locator('.object-detail-card').evaluate(node => node.scrollHeight <= node.clientHeight + 1), 'Expanded evidence must scroll with the page')
      await tab.locator('.discovery-evidence summary').click()
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await tab.screenshot({ path: `test-results/discovery-saved-answer-${width}.png`, fullPage: true, animations: 'disabled' })
    }
    await tab.getByRole('button', { name: 'Close object details', exact: true }).click()
    await tab.locator('.detection-hotspot').nth(2).click() // Another dog, same label, different box.
    assert.equal(await tab.locator('.discovery-answer').count(), 0, 'A different dog must not inherit the response')
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('data-scene-id'), sceneId)
    assert.equal(await tab.locator('#scene-goal').inputValue(), '')
    assert.equal(await tab.locator('#scene-goal').getAttribute('placeholder'), 'Ask about Dog 2 in this photo…')
    assert.equal(report.requests.length, 2, 'Card changes must not trigger image/model requests')
    await tab.locator('input[type=file]').setInputFiles('test-images/blank.png')
    assert.equal(await tab.locator('.discovery-answer').count(), 0)
    assert.equal(await tab.locator('.shared-scene').count(), 0)
    assert.equal(report.errors.length, 0)
    assert.equal(report.external.length, 0)
    report.checks.push('Actual detection/OCR with recorded HTTP replay: one image build, one text-only action; saved answer shown only on its originating box', 'Same-name object separation, new-image reset, scene reuse and collapsed evidence', '320/390px card and expanded evidence have no inner scrollbar or horizontal page overflow')
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
