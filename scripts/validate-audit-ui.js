import { dismissStory } from './dismiss-story.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export default async function validateAuditUi(page) {
  const fixture = JSON.parse((await readFile('scripts/fixtures/discovery-ui-replay.json', 'utf8')).replace(/^\uFEFF/, ''))
  const scene = fixture.scene
  const projection = { scene_description: scene.description, visible_objects: scene.objects.filter(item => item.source === 'gemma').map(item => ({ name: item.name, evidence: item.evidenceIds.map(id => scene.evidence.find(entry => entry.id === id)?.description ?? '').join(' ') })), object_affordances: [], visible_issues: [], potential_improvements: [], matches: [], relationships: [], uncertainty_notes: scene.uncertainty }
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const report = { checks: [], requests: [], external: [], errors: [] }
  let held
  const fulfill = content => held.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }) })
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const data = route.request().postDataJSON()
    report.requests.push({ images: data.messages[1].images?.length ?? 0, prompt: data.messages[1].content })
    held = route
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    // Synthetic INPUT layout, two copies of the known portrait. The detector
    // still runs for real. These are box ordinals, not different identities.
    const base64 = (await readFile('test-images/portrait.jpg')).toString('base64')
    const pair = await tab.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/jpeg;base64,' + data; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width * 2; canvas.height = image.height
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); ctx.drawImage(image, image.width, 0)
      return canvas.toDataURL('image/jpeg', .95).split(',')[1]
    }, base64)
    await tab.locator('input[type=file]').setInputFiles({ name: 'portrait-pair-test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(pair, 'base64') })
    await ready()
    for (const number of [1, 2]) {
      await tab.getByRole('button', { name: `Ask about Person ${number}, AI prediction`, exact: true }).click()
      assert.equal(await tab.locator('.object-detail-card h2').textContent(), `Person ${number}`)
      await tab.getByRole('button', { name: 'Ask about the photo', exact: true }).click()
      assert.equal(await tab.locator('.object-chat-context strong').textContent(), `Person ${number}`)
      assert.equal(await tab.locator('#scene-goal').inputValue(), '')
      assert.equal(await tab.locator('#scene-goal').getAttribute('placeholder'), `Ask about Person ${number} in this photo…`)
      await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    }
    report.checks.push('Real detector on a two-copy portrait input: Person 1/Person 2 agree across hotspot, card and chat; empty question values, placeholder only; no inference requested')
    assert.equal(report.requests.length, 0)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await ready()
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    await tab.locator('.image-stage:fullscreen .detection-hotspot').first().click()
    await tab.waitForFunction(() => !document.fullscreenElement)
    assert.equal(await tab.locator('.object-detail-card h2').textContent(), 'Dog 1')
    await tab.getByRole('button', { name: 'Close object details', exact: true }).click()
    await tab.getByRole('button', { name: 'Hide object markers', exact: true }).click()
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    assert.equal(await tab.locator('.image-stage:fullscreen .detection-hotspot').count(), 0)
    await tab.getByRole('button', { name: 'Show fullscreen markers', exact: true }).click()
    assert.equal(await tab.locator('.image-stage:fullscreen .detection-hotspot').count(), 4)
    await tab.getByRole('button', { name: 'Exit fullscreen photo', exact: true }).click()
    await tab.evaluate(() => { Element.prototype.requestFullscreen = undefined })
    await tab.setViewportSize({ width: 390, height: 844 })
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    await tab.getByRole('button', { name: 'Hide fullscreen markers', exact: true }).click()
    assert.equal(await tab.locator('.picture-dialog .detection-hotspot').count(), 0)
    await tab.getByRole('button', { name: 'Show fullscreen markers', exact: true }).click()
    const aligned = await tab.locator('.picture-dialog .image-preview').evaluate(node => {
      const photo = node.querySelector('img').getBoundingClientRect(), svg = node.querySelector('svg').getBoundingClientRect()
      return Math.abs(photo.width - svg.width) < 1 && Math.abs(photo.height - svg.height) < 1
    })
    assert(aligned)
    await tab.screenshot({ path: 'test-results/fullscreen-markers-mobile.png', animations: 'disabled' })
    await tab.locator('.picture-dialog .detection-hotspot').nth(2).click()
    assert.equal(await tab.getByRole('dialog', { name: 'Fullscreen photo' }).isVisible(), false)
    assert.equal(await tab.locator('.object-detail-card h2').textContent(), 'Dog 2')
    await tab.getByRole('button', { name: 'Close object details', exact: true }).click()
    report.checks.push('Native fullscreen hotspot exits into the correct card; hidden-marker choice retained; mobile fallback has aligned markers, toggle and working hotspot')
    await tab.setViewportSize({ width: 1280, height: 900 })
    await tab.clock.install()
    let sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await sent
    assert.equal(await tab.locator('.object-chat-context').count(), 0, 'Photo-level analysis must not keep an old selected-object heading')
    const initial = Number(await tab.getByRole('progressbar').getAttribute('aria-valuenow'))
    assert(initial < 10)
    await tab.clock.runFor(2_000)
    const moved = Number(await tab.getByRole('progressbar').getAttribute('aria-valuenow'))
    assert(moved > initial)
    await tab.clock.runFor(120_000)
    assert.equal(await tab.getByRole('progressbar').getAttribute('aria-valuenow'), '95')
    assert.equal(await tab.locator('.scene-summary').count(), 0)
    assert((await tab.locator('.analysis-progress').innerText()).includes('Estimated progress'))
    await tab.screenshot({ path: 'test-results/estimated-progress-audit.png', fullPage: true, animations: 'disabled' })
    await fulfill(projection)
    await tab.locator('.scene-summary').waitFor()
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').first().click()
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await sent
    assert.equal(await tab.locator('#scene-goal').inputValue(), '')
    assert(Number(await tab.getByRole('progressbar').getAttribute('aria-valuenow')) < 10)
    await tab.getByRole('button', { name: 'Cancel analysis', exact: true }).click()
    await held.abort().catch(() => {})
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Retry question', exact: true }).click()
    await sent
    assert.equal(report.requests[1].prompt, report.requests[2].prompt, 'Retry must retain the actual instruction despite the empty question field')
    await fulfill(fixture.turn.response)
    await tab.locator('.intent-result .answer-ready').waitFor()
    assert((await tab.locator('.intent-result .answer-ready').innerText()).includes('100%'))
    assert.equal(await tab.getByRole('progressbar').count(), 0)
    // A newly selected contextual action is a new request, even after a
    // cancellation on this same measured object; it must not stay stuck.
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').first().click()
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Use', exact: true }).click()
    await sent
    await tab.getByRole('button', { name: 'Cancel analysis', exact: true }).click()
    await held.abort().catch(() => {})
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').first().click()
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await sent
    assert.deepEqual(report.requests.map(item => item.images), [1, 0, 0, 0, 0])
    await fulfill(fixture.turn.response)
    await tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false')
    report.checks.push('Estimated progress begins near zero, increases, holds at 95 while pending, resets for the next request and reaches 100 only after validated reply; empty-field automatic-action cancellation/retry works')
    report.checks.push('New action after cancelling another action on the same object starts immediately from the saved scene')
    assert.equal(report.external.length, 0); assert.equal(report.errors.length, 0)
    return report
  } catch (error) { return { ...report, failure: String(error), stack: error.stack, text: await tab.locator('body').innerText() } }
  finally { await context.close() }
}
