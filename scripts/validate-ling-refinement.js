import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Real browser inference; recorded Gemma data only at the HTTP boundary.
export default async function validateLingRefinement(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const fixture = JSON.parse((await readFile(new URL('./fixtures/discovery-ui-replay.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''))
  const original = fixture.scene
  const description = id => original.evidence.find(item => item.id === id)?.description ?? ''
  const projection = { scene_description: original.description, visible_objects: original.objects.filter(item => item.source === 'gemma').map(item => ({ name: item.name, evidence: item.evidenceIds.map(description).join(' ') })), object_affordances: [], visible_issues: [], potential_improvements: [], matches: [], relationships: [], uncertainty_notes: original.uncertainty }
  const report = { checks: [], requests: [], external: [], errors: [] }
  let heldScene, heldIntent
  let notifyIntent
  const nextIntentRoute = () => new Promise(resolve => { notifyIntent = resolve })
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const images = body.messages.flatMap(item => item.images ?? []).length
    report.requests.push({ images, prompt: body.messages[1].content })
    if (images) heldScene = route
    else { heldIntent = route; notifyIntent?.(route); notifyIntent = undefined }
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const fulfill = (route, content) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }) })
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
  const boxes = () => tab.locator('.image-preview svg rect').evaluateAll(nodes => nodes.map(node => ['x', 'y', 'width', 'height'].map(key => node.getAttribute(key))))
  try {
    await tab.goto('http://localhost:5173')
    await tab.getByRole('button', { name: 'Tap anywhere to continue', exact: true }).click()
    await tab.locator('.ling-story').waitFor()
    assert.equal(await tab.locator('video, input[type=file]').count(), 0, 'Story does not ask for camera or a file')
    await tab.getByRole('button', { name: 'Next', exact: true }).click()
    await tab.getByRole('button', { name: 'Next', exact: true }).click()
    assert((await tab.locator('.ling-story h1').textContent()).includes('small print'))
    await tab.getByRole('button', { name: 'Story 4', exact: true }).click()
    await tab.screenshot({ path: 'test-results/ling-story-desktop.png', fullPage: true, animations: 'disabled' })
    await tab.setViewportSize({ width: 390, height: 844 })
    assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await tab.screenshot({ path: 'test-results/ling-story-mobile.png', fullPage: true, animations: 'disabled' })
    await tab.getByRole('button', { name: 'Next', exact: true }).click()
    await tab.getByRole('button', { name: 'Let’s discover', exact: true }).click()
    await tab.reload()
    await tab.getByRole('button', { name: 'Tap anywhere to continue', exact: true }).click()
    await tab.locator('.welcome').waitFor()
    assert.equal(await tab.locator('.ling-story').count(), 0, 'Completed introduction stays skipped')
    await tab.getByRole('button', { name: 'Meet Ling again', exact: true }).click()
    await tab.getByRole('button', { name: 'Skip intro', exact: true }).click()
    report.checks.push('Tap-gated splash and five-step story: Next, direct step navigation, finish, remembered preference, replay and skip; mobile fits')
    await tab.setViewportSize({ width: 1280, height: 900 })
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await ready()
    const before = await boxes()
    assert.equal(before.length, 4)
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Correct this label', exact: true }).click()
    await tab.getByLabel('What is this object?').fill('pet dog')
    await tab.getByRole('button', { name: 'Save label', exact: true }).click()
    assert.equal(await tab.locator('.object-detail-card h2').textContent(), 'Pet dog')
    assert((await tab.locator('.object-read').textContent()).includes('AI originally guessed dog'))
    assert((await tab.locator('.detection-hotspot').first().getAttribute('aria-label')).includes('named by you'))
    assert.deepEqual(await boxes(), before)
    assert.equal(report.requests.length, 0, 'Manual label edit does not start inference')
    const sceneSent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await sceneSent
    await tab.getByRole('progressbar').waitFor()
    assert(Number(await tab.getByRole('progressbar').getAttribute('aria-valuenow')) < 100)
    assert((await tab.locator('.thinking-status').innerText()).includes('Estimated progress'))
    await tab.screenshot({ path: 'test-results/ling-progress.png', fullPage: true, animations: 'disabled' })
    const nextRequest = nextIntentRoute()
    await fulfill(heldScene, projection)
    await nextRequest
    const savedContext = JSON.parse(/Shared scene \(data\): ([\s\S]*?)\nRecent same-scene/.exec(report.requests[1].prompt)[1])
    assert.equal(savedContext.objects[0].name, 'dog')
    assert.equal(savedContext.objects[0].userLabel, 'pet dog')
    assert.equal(savedContext.evidence.find(item => item.id === 'U-mp-0').source, 'user')
    await fulfill(heldIntent, fixture.turn.response)
    await tab.locator('.intent-result').waitFor()
    const sceneId = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    assert.equal(await tab.locator('.viewfinder .scene-summary').count(), 1)
    assert.equal(await tab.locator('.viewfinder .intent-choices').count(), 0)
    for (const width of [1280, 390, 320]) {
      await tab.setViewportSize({ width, height: 900 })
      const positions = await tab.evaluate(() => ({ photo: document.querySelector('.image-preview').getBoundingClientRect().bottom, controls: document.querySelector('.photo-actions').getBoundingClientRect().bottom, summary: document.querySelector('.scene-summary').getBoundingClientRect(), card: document.querySelector('.viewfinder').getBoundingClientRect().bottom, choices: document.querySelector('.intent-choices').getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth + 1 }))
      assert(!positions.overflow)
      assert(positions.summary.top >= positions.controls && positions.summary.top >= positions.photo && positions.summary.bottom <= positions.card + 1)
      assert(positions.choices >= positions.card)
      await tab.screenshot({ path: `test-results/ling-layout-${width}.png`, fullPage: true, animations: 'disabled' })
    }
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Edit your label', exact: true }).click()
    await tab.getByLabel('What is this object?').fill('family pet')
    await tab.getByRole('button', { name: 'Save label', exact: true }).click()
    assert.equal(await tab.locator('.discovery-answer').count(), 0, 'Old answer is invalidated after correction')
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('data-scene-id'), sceneId, 'Correction reuses image analysis')
    assert.equal(await tab.locator('.intent-result').count(), 0, 'Old question history does not contradict the new label')
    const intentSent = nextIntentRoute()
    assert.equal(await tab.locator('#scene-goal').inputValue(), '')
    await tab.locator('#scene-goal').fill('Explain what is visible about this family pet.')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await intentSent
    assert.deepEqual(report.requests.map(item => item.images), [1, 0, 0])
    assert(report.requests[2].prompt.includes('"userLabel":"family pet"'))
    await tab.getByRole('button', { name: 'Cancel analysis', exact: true }).click()
    await heldIntent.abort().catch(() => {})
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Edit your label', exact: true }).click()
    await tab.getByRole('button', { name: 'Use AI label', exact: true }).click()
    assert.equal(await tab.locator('.object-detail-card h2').textContent(), 'Dog 1')
    const fileChooser = tab.waitForEvent('filechooser')
    await tab.getByRole('button', { name: 'Upload a clearer photo', exact: true }).click()
    await (await fileChooser).setFiles('test-images/blank.png')
    await ready()
    assert.equal(await tab.locator('.detection-hotspot, .scene-summary').count(), 0)
    report.checks.push('Real detections retain exact boxes and original labels; user correction shows provenance and reaches local intent context', 'Correction clears stale answers/history, reuses the scene for text-only follow-up, can be undone and resets on clearer-photo upload', 'Pending percentage is explicitly estimated; summary is below controls inside photo card, modes outside at 1280/390/320px')
    assert.equal(report.external.length, 0)
    assert.equal(report.errors.length, 0)
    return report
  } catch (error) { return { ...report, failure: String(error), text: await tab.locator('body').innerText() } }
  finally { await context.close() }
}
