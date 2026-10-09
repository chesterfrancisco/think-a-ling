import { dismissStory } from './dismiss-story.js'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Actual browser inference/timing. Only Gemma HTTP is held or replayed from a
// recorded result to prove progressive UI behavior without a long model run.
export default async function validateProgressive(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  const tab = await context.newPage()
  const report = { checks: [], timings: [], requests: [], external: [], errors: [] }
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  const pending = []
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const images = route.request().postDataJSON().messages.flatMap(item => item.images ?? []).length
    report.requests.push({ images })
    if (!images) { pending.push(route); return }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(fixture.scene) } }) })
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const ready = title => tab.waitForFunction(title => document.querySelector('.viewfinder')?.dataset[title === 'detection-title' ? 'detectionStatus' : 'ocrStatus'] === 'done', title)
  async function upload(file) {
    const start = performance.now()
    await tab.locator('input[type=file]').setInputFiles('test-images/' + file)
    await tab.locator('.image-preview').waitFor()
    const [detectionMs, ocrMs] = await Promise.all([
      ready('detection-title').then(() => performance.now() - start),
      ready('ocr-title').then(() => performance.now() - start),
    ])
    report.timings.push({ file, detectionMs, ocrMs })
  }
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    assert(await tab.getByRole('button', { name: 'Use camera', exact: true }).isVisible())
    for (const width of [1280, 390, 320]) {
      await tab.setViewportSize({ width, height: 900 })
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await tab.screenshot({ path: `test-results/everyday-home-${width}.png`, fullPage: true, animations: 'disabled' })
    }
    await tab.setViewportSize({ width: 1280, height: 900 })
    await upload('cats-and-dogs.jpg')
    assert.equal(await tab.locator('.detection-hotspot').count(), 4)
    assert.equal(report.requests.length, 0, 'Upload should not wait for or start Gemma')
    await tab.screenshot({ path: 'test-results/everyday-auto-detection.png', fullPage: true, animations: 'disabled' })
    await upload('ocr-test.png')
    assert((await tab.locator('#recognized-text').inputValue()).includes('Invoice 12345'))
    assert.equal(report.requests.length, 0)
    report.checks.push('Camera/upload immediately available after dismissing the introduction; 1280/390/320px home fits', 'Real automatic detection and OCR complete without any Gemma request')
    await upload('desk.jpg')
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    assert.equal(await tab.locator('.intent-choices').count(), 0, 'Modes wait for scene analysis')
    await tab.locator('#scene-goal').fill('What is visible?')
    const sent = tab.waitForRequest(request => request.url().endsWith('/local-ollama/api/chat') && !request.postDataJSON().messages.some(item => item.images?.length))
    await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    assert((await tab.locator('.scene-summary').innerText()).includes(fixture.scene.scene_description))
    await sent
    assert(await tab.locator('.scene-summary').isVisible(), 'First interpretation remains usable during slower follow-up')
    await tab.getByRole('button', { name: 'Close panel', exact: true }).click()
    assert(await tab.getByRole('button', { name: 'Read text', exact: true }).isVisible(), 'Local text remains available while Gemma works')
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    await tab.getByRole('button', { name: 'Cancel analysis', exact: true }).click()
    for (const route of pending) await route.abort().catch(() => {})
    assert.equal(await tab.locator('.shared-scene').count(), 1)
    assert.deepEqual(report.requests.map(item => item.images), [1, 0])
    report.checks.push('Recorded scene is displayed before held intent answer; progress/cancel available, browser results accessible, saved scene preserved')
    await tab.getByRole('button', { name: 'Think-a-ling home', exact: true }).click()
    assert.equal(await tab.locator('.shared-scene').count(), 0)
    assert.equal(await tab.locator('.image-preview').count(), 0)
    assert(await tab.locator('.welcome').isVisible())
    // Hold a real model asset on a fresh page to test cancellation during init.
    await tab.reload()
    await dismissStory(tab)
    const modelPattern = '**/models/efficientdet_lite0.tflite'
    let heldModel
    await context.route(modelPattern, route => { heldModel = route })
    const loadingModel = tab.waitForRequest(modelPattern)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await loadingModel
    await tab.getByRole('button', { name: 'Cancel scan', exact: true }).click()
    assert((await tab.locator('.photo-actions').innerText()).includes('cancelled'))
    if (heldModel) await heldModel.abort().catch(() => {})
    await context.unroute(modelPattern)
    await tab.getByRole('button', { name: 'Detect objects', exact: true }).click()
    await ready('detection-title')
    assert.equal(await tab.locator('.detection-hotspot').count(), 4)
    report.checks.push('Home clears previous image/scene; cancelling model initialization ignores stale completion and permits a real detection retry')
    assert.equal(report.external.length, 0)
    assert.equal(report.errors.length, 0)
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
