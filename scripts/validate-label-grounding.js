import { dismissStory } from './dismiss-story.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Replays the actual answer that omitted citations in the live audit. OCR is
// real. This validates the new deterministic source-text display, not Gemma.
export default async function validateLabelGrounding(page) {
  const fixture = JSON.parse((await readFile('scripts/fixtures/label-audit-replay.json', 'utf8')).replace(/^\uFEFF/, ''))
  const context = await page.context().browser().newContext()
  const tab = await context.newPage()
  const report = { kind: fixture.provenance, checks: [], external: [], requests: [] }
  const scene = fixture.scene
  const projection = { scene_description: scene.description, visible_objects: scene.objects.filter(item => item.source === 'gemma').map(item => ({ name: item.name, evidence: item.evidenceIds.map(id => scene.evidence.find(entry => entry.id === id)?.description ?? '').join(' ') })), object_affordances: [], visible_issues: [], potential_improvements: [], matches: [], relationships: [], uncertainty_notes: scene.uncertainty }
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const images = route.request().postDataJSON().messages[1].images?.length ?? 0
    report.requests.push({ images })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(images ? projection : fixture.response) } }) })
  })
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/product-label.png')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    await tab.locator('#scene-goal').fill('Explain the label warnings.')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.locator('.intent-result').waitFor()
    assert((await tab.locator('.intent-result').innerText()).includes(fixture.response.answer))
    await tab.getByText('What supports this answer?', { exact: true }).click()
    const text = await tab.locator('.answer-text-matches').innerText()
    for (const line of ['WARNING: Keep out of reach of children.', 'Do not mix with bleach.', 'Use in a well-ventilated area.']) assert(text.includes(line))
    assert(text.includes('do not verify the rest'))
    assert.equal(fixture.response.observations.length, 0)
    assert.deepEqual(report.requests, [{ images: 1 }, { images: 0 }])
    assert.equal(report.external.length, 0)
    await tab.screenshot({ path: 'test-results/label-text-matches.png', fullPage: true })
    report.checks.push('Unchanged genuine model answer with zero model observation citations; all three warning lines matched to real OCR and shown under supporting details', 'Exact text matches explicitly do not verify other claims; no extra model request')
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
