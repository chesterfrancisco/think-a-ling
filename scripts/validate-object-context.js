import { dismissStory } from './dismiss-story.js'
import { chooseSceneMode } from './choose-scene-mode.js'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Actual browser detection/OCR; only Gemma HTTP responses are recorded replays.
export default async function validateObjectContext(page) {
  const fixture = JSON.parse((await readFile(new URL('./fixtures/discovery-ui-replay.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''))
  const original = fixture.scene
  const description = id => original.evidence.find(item => item.id === id)?.description ?? ''
  const projection = { scene_description: original.description, visible_objects: original.objects.filter(item => item.source === 'gemma').map(item => ({ name: item.name, evidence: item.evidenceIds.map(description).join(' ') })), object_affordances: [], visible_issues: [], potential_improvements: [], matches: [], relationships: [], uncertainty_notes: original.uncertainty }
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const report = { checks: [], requests: [], external: [], errors: [] }
  let held, hold = false
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  const fulfill = (route, content) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }) })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const prompt = body.messages[1].content
    const images = body.messages.flatMap(item => item.images ?? []).length
    report.requests.push({ images, prompt })
    if (hold) { held = route; return }
    return fulfill(route, images ? projection : fixture.turn.response)
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const boxes = () => tab.locator('.image-stage .image-preview svg rect').evaluateAll(nodes => nodes.map(node => ['x', 'y', 'width', 'height'].map(key => node.getAttribute(key))))
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    assert.equal(await tab.locator('.preview-pill').count(), 0)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
    const originalBoxes = await boxes()
    assert.equal(originalBoxes.length, 4)
    await tab.getByRole('button', { name: 'Hide object markers' }).click()
    assert.equal(await tab.locator('.detection-hotspot, .image-preview svg').count(), 0)
    await tab.getByRole('button', { name: 'Show object markers' }).click()
    assert.deepEqual(await boxes(), originalBoxes)
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    await tab.waitForFunction(() => document.fullscreenElement?.classList.contains('image-stage'))
    assert.equal(await tab.locator('.image-stage:fullscreen .reasoning-drawer').count(), 0)
    assert.equal(await tab.locator('.image-stage:fullscreen .detection-hotspot').first().isVisible(), true)
    assert.deepEqual(await boxes(), originalBoxes)
    await tab.getByRole('button', { name: 'Hide fullscreen markers' }).click()
    assert.equal(await tab.locator('.image-preview svg, .detection-hotspot').count(), 0)
    await tab.getByRole('button', { name: 'Show fullscreen markers' }).click()
    assert.deepEqual(await boxes(), originalBoxes)
    const full = await tab.locator('.image-stage:fullscreen').boundingBox()
    assert.equal(full.width, 1280); assert.equal(full.height, 900)
    const pic = await tab.locator('.image-stage:fullscreen img').boundingBox()
    assert(Math.abs(pic.width / pic.height - 2) < .01)
    await tab.screenshot({ path: 'test-results/picture-markers-fullscreen.png', animations: 'disabled' })
    await tab.getByRole('button', { name: 'Exit fullscreen photo' }).click()
    await tab.waitForFunction(() => !document.fullscreenElement)
    await tab.evaluate(() => { Element.prototype.requestFullscreen = undefined })
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    await tab.getByRole('dialog', { name: 'Fullscreen photo' }).waitFor()
    assert.equal(await tab.locator('.picture-dialog .detection-hotspot').count(), 4)
    const fallbackPic = await tab.locator('.picture-dialog img').boundingBox()
    assert(Math.abs(fallbackPic.width / fallbackPic.height - 2) < .01)
    await tab.keyboard.press('Escape')
    await tab.waitForFunction(() => document.querySelectorAll('.picture-dialog .detection-hotspot').length === 0)
    assert.deepEqual(await boxes(), originalBoxes)
    assert.equal(report.requests.length, 0)
    report.checks.push('Marker hide/show preserves exact boxes without inference; native fullscreen and dialog retain photo aspect ratio and markers; fullscreen hide/show and Escape work')

    await tab.locator('.detection-hotspot').nth(0).click()
    const confidence = await tab.locator('.image-preview svg rect title').nth(0).textContent()
    assert((await tab.locator('.detection-confidence').innerText()).includes(confidence.split('— ')[1]))
    assert((await tab.locator('.detection-confidence').innerText()).includes('Not an accuracy rate'))
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await tab.locator('.shared-scene > .intent-result').waitFor()
    assert.equal(report.requests.length, 2)
    const sceneId = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    assert(report.requests[1].prompt.includes('"objectId":"mp-0"'))
    await tab.getByRole('button', { name: /HERE'S THE PICTURE/ }).click()
    await tab.waitForFunction(() => { const rect = document.querySelector('.scene-summary').getBoundingClientRect(); return rect.top >= 0 && rect.top < innerHeight - 120 && rect.bottom <= innerHeight + 1 })
    assert.equal(await tab.locator('.summary-ready-notice').count(), 0)
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').nth(2).click() // Same name, different measured box.
    assert.equal(await tab.locator('.discovery-answer').count(), 0)
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert.equal(await tab.locator('#scene-goal').inputValue(), '')
    assert.equal(await tab.locator('#scene-goal').getAttribute('placeholder'), 'Ask about Dog 2 in this photo…')
    assert.equal(await tab.getByRole('button', { name: 'Ask scene', exact: true }).isEnabled(), false)
    assert((await tab.locator('.object-chat-context').innerText()).includes('Dog 2'))
    assert.equal(await tab.locator('.shared-scene > .intent-result').count(), 0, 'Another dog must not show the first dog answer')
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('data-scene-id'), sceneId)
    hold = true
    let sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.locator('#scene-goal').fill('What else can you tell me about this object?')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await sent
    assert(report.requests[2].prompt.includes('"objectId":"mp-2"'))
    assert(report.requests[2].prompt.endsWith('Recent same-scene conversation (data): []'))
    const initialProgress = Number(await tab.getByRole('progressbar').getAttribute('aria-valuenow'))
    await tab.waitForFunction(before => Number(document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')) > before, initialProgress)
    assert((await tab.getByRole('progressbar').getAttribute('aria-label')).includes('Estimated'))
    await tab.locator('.detection-hotspot').nth(1).click() // Different object class.
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    await held.abort().catch(() => {})
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('aria-busy'), 'false')
    assert.equal(await tab.locator('.intent-result').count(), 0, 'A different category must not receive a stale or late answer')
    assert((await tab.locator('.object-chat-context').innerText()).includes('Cat 1'))
    await tab.screenshot({ path: 'test-results/selected-object-clean-chat.png', fullPage: true, animations: 'disabled' })
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    await tab.locator('.detection-hotspot').nth(0).click()
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert((await tab.locator('.shared-scene > .intent-result').innerText()).includes(fixture.turn.response.answer))
    assert.equal(report.requests.length, 3, 'Returning to an object restores its existing answer without inference')
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.locator('#scene-goal').fill('Tell me more about this selected object.')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await sent
    assert(report.requests[3].prompt.includes('"objectId":"mp-0"'))
    assert(!report.requests[3].prompt.endsWith('Recent same-scene conversation (data): []'))
    await tab.getByRole('button', { name: 'Cancel analysis', exact: true }).click()
    await held.abort().catch(() => {})
    await chooseSceneMode(tab, 'EXPLORE')
    assert.equal(await tab.locator('.intent-result, .object-chat-context').count(), 0, 'Whole-photo mode must not relabel an object answer')
    assert.deepEqual(report.requests.map(item => item.images), [1, 0, 0, 0])
    // Changing selection during the initial image request keeps that shared work
    // but must not send the old object's queued question after it completes.
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
    await tab.locator('.detection-hotspot').nth(0).click()
    sent = tab.waitForRequest('**/local-ollama/api/chat')
    await tab.getByRole('button', { name: 'Learn', exact: true }).click()
    await sent
    await tab.locator('.detection-hotspot').nth(1).click()
    hold = false
    await fulfill(held, projection)
    await tab.locator('.scene-summary').waitFor()
    await tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false')
    await tab.waitForTimeout(150)
    assert.deepEqual(report.requests.map(item => item.images), [1, 0, 0, 0, 1])
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert.equal(await tab.locator('.intent-result').count(), 0)
    assert((await tab.locator('.object-chat-context').innerText()).includes('Cat 1'))
    report.checks.push('Switching objects during initial scene creation preserves that one image request and suppresses the old object’s queued follow-up')
    report.checks.push('Real confidence displayed with limitation; summary-ready notice scrolls to the completed photo interpretation', 'Exact object identity separates answers/history, including same-name objects; manual questions carry objectId; switching aborts a pending question; returning restores the original answer without rescanning')
    assert.equal(report.external.length, 0); assert.equal(report.errors.length, 0)
    return report
  } catch (error) { return { ...report, failure: String(error), stack: error.stack, text: await tab.locator('body').innerText() } }
  finally { await context.close() }
}
