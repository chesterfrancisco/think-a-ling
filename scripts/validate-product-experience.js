import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dismissStory } from './dismiss-story.js'

// Recorded real Gemma results exercise UI behavior only; not a new accuracy test.
// All browser detection/OCR execute normally. No replay is imported by the app.
export default async function validateProductExperience(page) {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const report = { checks: [], requests: [], external: [], errors: [], kind: fixture.provenance }
  let responseMode = 'IMPROVE'
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const images = body.messages.flatMap(item => item.images ?? []).length
    report.requests.push({ images })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, message: { content: JSON.stringify(images ? fixture.scene : fixture.turns.find(turn => turn.mode === responseMode).response) } }) })
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done', null, { timeout: 60_000 })
  const latest = () => tab.locator('.shared-scene > .intent-result')
  try {
    await tab.goto('http://localhost:5173')
    assert.match(await tab.title(), /Think-a-ling!/)
    await dismissStory(tab)
    assert.match(await tab.locator('.page-intro').innerText(), /figure out today/)
    assert.equal(await tab.locator('body').innerText().then(text => /thing-a-ling/i.test(text)), false)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await ready()
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    for (const name of ['Explore', 'Find', 'Fix', 'Improve']) assert.equal(await tab.getByRole('button', { name, exact: true }).count(), 1)
    await tab.getByRole('button', { name: 'Improve', exact: true }).click()
    await tab.locator('#scene-goal').fill('Make this desk useful for study.')
    await tab.getByRole('button', { name: 'Ask scene' }).click()
    await latest().waitFor()
    assert.equal(await latest().getByRole('checkbox').count(), 0, 'Steps must be optional')
    await latest().getByRole('button', { name: 'Turn into steps', exact: true }).click()
    const box = latest().getByRole('checkbox', { name: 'Organize Study Materials', exact: true })
    assert.equal(await box.isChecked(), false)
    assert.match(await latest().locator('.ling-steps').innerText(), /Arrange your books and papers neatly/)
    assert.match(await latest().locator('.ling-steps').innerText(), /The arrangement is a suggestion\./)
    await box.check()
    assert.match(await latest().locator('.steps-count').innerText(), /1 of 1 marked done by you/)
    assert.match(await latest().locator('.steps-disclosure').first().innerText(), /not verified any physical changes/)
    await latest().getByText('Why this step?', { exact: true }).click()
    assert.match(await latest().locator('.steps-content details').innerText(), /Observed by AI/)
    await latest().getByRole('button', { name: 'Hide steps', exact: true }).click()
    await latest().getByRole('button', { name: 'Turn into steps', exact: true }).click()
    assert.equal(await box.isChecked(), true)
    await tab.getByRole('button', { name: 'Close panel', exact: true }).click()
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    assert.equal(await box.isChecked(), true)
    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: 900 })
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await box.uncheck(); await box.check()
      await latest().locator('.ling-steps').screenshot({ path: `test-results/ling-steps-${width}.png` })
    }
    assert.deepEqual(report.requests.map(item => item.images), [1, 0], 'Opening/ticking steps must not request inference')
    report.checks.push('Rebrand and four mode names; optional steps retain verbatim recommendations, caveats and evidence; manual checkboxes work at 1280/390/320px with no new inference')
    responseMode = 'FIX'
    await tab.getByRole('button', { name: 'Fix', exact: true }).click()
    await tab.locator('#scene-goal').fill('What should I check first?')
    await tab.getByRole('button', { name: 'Ask scene' }).click()
    await tab.waitForFunction(() => document.querySelector('.shared-scene > .intent-result')?.dataset.mode === 'FIX')
    assert.equal(await latest().locator('.ling-steps').count(), 0, 'A result without supported recommendations must not gain tasks')
    await tab.getByText('Earlier questions', { exact: true }).click()
    assert.equal(await tab.getByRole('checkbox', { name: 'Organize Study Materials', exact: true }).isChecked(), true)
    assert.deepEqual(report.requests.map(item => item.images), [1, 0, 0])
    await tab.locator('input[type=file]').setInputFiles('test-images/blank.png')
    await ready()
    assert.equal(await tab.locator('.ling-steps').count(), 0)
    report.checks.push('Same-scene follow-up uses text only; no invented tasks for empty checks; previous completion retained only with its answer; changing photo clears steps')
    // Context-sensitive reading can be exercised with a user correction without
    // fabricating a detector class. The original measured box is preserved.
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await ready()
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Correct this label', exact: true }).click()
    await tab.locator('#corrected-label').fill('document')
    await tab.getByRole('button', { name: 'Save label', exact: true }).click()
    const card = tab.getByRole('complementary', { name: 'Detected object details' })
    assert.equal(await card.getByRole('button', { name: 'Study', exact: true }).count(), 0)
    await card.getByRole('button', { name: 'Read text', exact: true }).click()
    assert.equal(await tab.getByRole('dialog', { name: 'Text in your photo' }).isVisible(), true)
    assert.equal(report.requests.length, 3)
    report.checks.push('Document action without OCR offers reading, not invented study content; Read text opens the real whole-photo OCR dialog')
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, [])
  } catch (error) { report.failure = error.stack }
  finally { await context.close() }
  return report
}
