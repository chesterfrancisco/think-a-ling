import { dismissStory } from './dismiss-story.js'
import { observeReasoning } from './observe-reasoning.js'
// Real camera API + real MediaPipe. Fixture mode supplies an image as video input;
// predictions are never mocked. Physical mode uses the installed laptop camera.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const physical = process.argv.includes('--physical')
const liveGemma = process.argv.includes('--live-gemma')
const root = fileURLToPath(new URL('../', import.meta.url))
await mkdir(root + 'test-results', { recursive: true })
const report = { input: physical ? 'physical laptop camera' : 'file-backed browser camera with real MediaPipe inference', browsers: [] }
const fixturePath = root + 'test-results/camera-fixture.y4m'
if (!physical) {
  const prep = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await prep.newPage()
    const data = (await readFile(root + 'test-images/cats-and-dogs.jpg')).toString('base64')
    const rgba = await page.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/jpeg;base64,' + data; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 640, 320)
      return Array.from(ctx.getImageData(0, 0, 640, 320).data)
    }, data)
    const width = 640, height = 320, y = Buffer.alloc(width * height), u = Buffer.alloc(width * height / 4), v = Buffer.alloc(width * height / 4)
    const clamp = n => Math.max(0, Math.min(255, Math.round(n)))
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const offset = (row * width + col) * 4, r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2]
      y[row * width + col] = clamp(16 + .257 * r + .504 * g + .098 * b)
      if (row % 2 === 0 && col % 2 === 0) { const i = row / 2 * width / 2 + col / 2; u[i] = clamp(128 - .148 * r - .291 * g + .439 * b); v[i] = clamp(128 + .439 * r - .368 * g - .071 * b) }
    }
    await writeFile(fixturePath, Buffer.concat([Buffer.from('YUV4MPEG2 W640 H320 F10:1 Ip A1:1 C420jpeg\nFRAME\n'), y, u, v]))
  } finally { await prep.close() }
}
for (const channel of liveGemma ? ['chrome'] : ['chrome', 'msedge']) {
  const entry = { channel, checks: [], external: [], pageErrors: [], ollamaRequests: 0 }
  report.browsers.push(entry)
  let browser
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--use-fake-ui-for-media-stream', ...(physical ? [] : ['--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + fixturePath])] })
    entry.version = browser.version()
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera'], serviceWorkers: 'block' })
    const page = await context.newPage()
    const capture = observeReasoning(page)
    const origin = physical ? 'http://127.0.0.1:4173' : 'http://localhost:5173'
    await context.addInitScript(() => {
      window.cameraTestStreams = []
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); window.cameraTestStreams.push(stream); return stream }
    })
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue()
      entry.external.push(route.request().url()); return route.abort()
    })
    // Stop captured-frame Gemma at a controlled unavailable error: no fake success.
    await context.route('**/local-ollama/api/chat', route => {
      const body = route.request().postDataJSON()
      entry.ollamaRequests++
      entry.captureHasImage = body.messages.some(message => message.images?.[0]?.startsWith('/9j/'))
      if (liveGemma) return route.continue()
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Intentional camera pipeline test: generation not started' }) })
    })
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const start = async () => {
      await page.getByRole('button', { name: 'Use camera', exact: true }).click()
      await page.waitForFunction(() => ['live', 'error'].includes(document.querySelector('.live-camera')?.getAttribute('data-phase')), null, { timeout: 20000 })
      assert(await page.locator('.live-camera').getAttribute('data-phase') === 'live', await page.locator('.live-camera-status').innerText())
    }
    const ended = () => page.evaluate(() => window.cameraTestStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))
    await page.goto(origin)
    await dismissStory(page)
    assert(await page.evaluate(() => window.cameraTestStreams.length) === 0, 'Page load must not request camera')
    await start()
    assert(await page.locator('.intent-choices').count() === 0, 'Live camera must not show post-analysis modes')
    const time = Date.now()
    await page.waitForFunction(() => Number(document.querySelector('.live-camera').getAttribute('data-detection-count')) >= 3, null, { timeout: 30000 })
    entry.threeSamplesMs = Date.now() - time
    assert(entry.threeSamplesMs >= 1000, 'Detection loop is not throttled')
    assert(entry.ollamaRequests === 0, 'Gemma must never run on live frames')
    entry.preview = await page.evaluate(() => { const v = document.querySelector('video'); return { width: v.videoWidth, height: v.videoHeight, mirror: getComputedStyle(v).transform, labels: [...document.querySelectorAll('.video-preview .box-label')].map(node => node.textContent) } })
    if (!physical) assert(entry.preview.labels.some(label => /dog|cat/.test(label)), 'Actual detector must find fixture animals')
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const aligned = await page.evaluate(() => {
        const video = document.querySelector('video'), svg = document.querySelector('.video-preview svg')
        const vr = video.getBoundingClientRect(), sr = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal
        return Math.abs(vr.width / vr.height - video.videoWidth / video.videoHeight) < .01 && Math.abs(vr.width - sr.width) < 1 && Math.abs(vr.height - sr.height) < 1 && [...svg.querySelectorAll('rect')].every(rect => {
          const r = rect.getBoundingClientRect(), scale = vr.width / vb.width
          return Math.abs(r.x - vr.x - Number(rect.getAttribute('x')) * scale) < 1 && Math.abs(r.y - vr.y - Number(rect.getAttribute('y')) * scale) < 1
        })
      })
      assert(aligned, 'Live box/aspect alignment failed at ' + width)
    }
    if (!physical) await page.screenshot({ path: root + 'test-results/camera-' + channel + '-fixture.png', fullPage: true, animations: 'disabled' })
    entry.checks.push('Actual getUserMedia, real throttled detections, unmirrored aspect-correct preview and responsive boxes; no live Gemma')
    await page.getByLabel('Camera selection', { exact: true }).selectOption('user')
    await page.waitForFunction(() => document.querySelector('.live-camera')?.getAttribute('data-phase') === 'live')
    assert(await page.evaluate(() => window.cameraTestStreams.slice(0, -1).every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), 'Camera switch leaked old tracks')
    // Hold the completion of real PNG encoding to reproduce the reported blank
    // frame interval, and verify that a delayed callback cannot undo Retake.
    await page.evaluate(() => {
      window.cameraDelayEncoding = true
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
        return original.call(this, blob => {
          if (window.cameraDelayEncoding) window.finishCameraEncoding = () => callback(blob)
          else callback(blob)
        }, ...args)
      }
    })
    await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
    await page.waitForFunction(() => !!window.finishCameraEncoding)
    assert(await page.locator('.captured-preview').isVisible(), 'Frozen pixels must remain visible during encoding')
    assert(await page.locator('.live-camera').getAttribute('data-phase') === 'capturing', 'Expected encoding stage')
    assert(await ended(), 'Tracks must stop immediately after freezing the frame')
    assert(await page.getByRole('button', { name: 'Analyze photo', exact: true }).isDisabled(), 'Analysis must wait for a complete file')
    const previewPixels = await page.locator('.captured-preview').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      return { width: canvas.width, height: canvas.height, nonblank: pixels.some((value, index) => index % 4 < 3 && value > 20) }
    })
    assert(previewPixels.nonblank, 'Frozen canvas is blank')
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const frame = await page.locator('.captured-preview').boundingBox()
      assert(Math.abs(frame.width / frame.height - previewPixels.width / previewPixels.height) < .01, 'Review must preserve full frame aspect')
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Review horizontal overflow')
    }
    if (!physical) await page.screenshot({ path: root + 'test-results/camera-' + channel + '-encoding-preview.png', fullPage: true, animations: 'disabled' })
    assert(entry.ollamaRequests === 0, 'Capture/review must not start Gemma')
    await page.getByRole('button', { name: 'Retake photo', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.live-camera')?.dataset.phase === 'live')
    await page.evaluate(() => { window.cameraDelayEncoding = false; window.finishCameraEncoding() })
    await page.waitForTimeout(100)
    assert(await page.locator('.live-camera').getAttribute('data-phase') === 'live', 'Late encoded frame replaced the retaken camera')
    assert(await page.getByLabel('Camera selection', { exact: true }).inputValue() === 'user', 'Retake must retain selected camera')
    await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.live-camera')?.dataset.phase === 'review')
    assert(entry.ollamaRequests === 0, 'Review must wait for confirmation')
    await page.getByRole('button', { name: 'Back to start', exact: true }).click()
    assert(await ended(), 'Back leaked camera tracks')
    assert(await page.locator('.welcome').isVisible(), 'Back must restore source selection')
    assert(await page.locator('.captured-preview, .image-preview').count() === 0, 'Back kept a stale preview')
    await start()
    await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.live-camera')?.dataset.phase === 'review')
    assert(await page.locator('.captured-preview').isVisible())
    assert(await ended(), 'Review must not keep the camera active')
    assert(entry.ollamaRequests === 0, 'Reopening camera must not reuse old analysis')
    await page.getByRole('button', { name: 'Discard photo', exact: true }).click()
    assert(await page.locator('.welcome').isVisible(), 'Discard must return to source selection')
    await start()
    await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.live-camera')?.dataset.phase === 'review')
    const originalPixels = await page.locator('.captured-preview').evaluate(canvas => canvas.toDataURL())
    if (!physical) await page.screenshot({ path: root + 'test-results/camera-' + channel + '-review.png', fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: 'Analyze photo', exact: true }).click()
    await page.locator('.image-preview img').waitFor()
    const confirmedPixels = await page.locator('.image-preview img').evaluate(async image => {
      await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      canvas.getContext('2d').drawImage(image, 0, 0)
      return canvas.toDataURL()
    })
    assert(confirmedPixels === originalPixels, 'Analyze must receive the exact reviewed pixels')
    assert(await ended(), 'Capture did not stop camera tracks')
    assert(await page.locator('.live-camera').count() === 0, 'Live loop survived capture')
    if (liveGemma) {
      const sceneStart = Date.now()
      await page.locator('.shared-scene').waitFor({ timeout: 210000 })
      entry.sceneDescription = await page.locator('.scene-description').textContent()
      entry.captureToSceneWaitMs = Date.now() - sceneStart
      assert(entry.ollamaRequests === 1 && entry.captureHasImage, 'Capture must send one actual image to Gemma')
      await page.getByRole('button', { name: 'Find', exact: true }).click()
      await page.locator('#scene-goal').fill('Find something in this scene that can charge my phone. If nothing supports this, say so; do not assume unseen equipment.')
      const intentStart = Date.now()
      const intentResponse = capture.next()
      await page.getByRole('button', { name: 'Ask scene', exact: true }).click()
      await page.locator('.shared-scene > .intent-result').waitFor({ timeout: 190000 })
      entry.intentMs = Date.now() - intentStart
      const result = await intentResponse
      entry.findResponse = await capture.read(result)
      entry.sceneContext = capture.context(result)
      assert(entry.ollamaRequests === 2 && !entry.captureHasImage, 'Follow-up must reuse scene without pixels')
      assert(entry.findResponse.suggestions.length === 0 && /no|none|not|cannot|missing/i.test(entry.findResponse.answer), 'Phone charging goal must not invent an animal-scene capability')
      entry.checks.push('Actual local Gemma captured-image scene and text-only FIND; no unsupported charging capability invented')
    } else if (!physical) {
      await page.locator('.reasoning-panel [role=alert]').waitFor({ timeout: 30000 })
      assert(entry.ollamaRequests === 1 && entry.captureHasImage, 'Capture must pass actual frozen pixels to exactly one scene request')
      assert(await page.getByRole('button', { name: 'Retry scene' }).isEnabled(), 'Captured-scene error must permit retry')
    }
    entry.checks.push('Frozen preview remains visible while encoding; review fits 1280/390/320px; Retake ignores late encoding and keeps camera selection; Back/Discard/reopen reset cleanly', 'Capture stops tracks without inference; explicit Analyze sends exact reviewed pixels once into existing scene pipeline')
    await start()
    await page.locator('input[type=file]').setInputFiles(root + 'test-images/desk.jpg')
    await page.waitForFunction(() => !document.querySelector('.live-camera'))
    assert(await ended(), 'Uploading a photo leaked camera tracks')
    await start()
    await page.getByRole('button', { name: 'Stop camera' }).click()
    assert(await ended(), 'Stop camera leaked tracks')
    await start()
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    assert(await ended(), 'Leaving page leaked tracks')
    assert(await page.locator('.live-camera').getAttribute('data-phase') === 'paused', 'Page hide must pause camera')
    entry.checks.push('Upload source switch, Stop and pagehide release all tracks')
    assert(entry.external.length === 0 && entry.pageErrors.length === 0, 'External request or browser error')
    await context.close()
  } catch (error) { entry.failure = String(error); process.exitCode = 1 }
  finally { await browser?.close() }
  console.log(JSON.stringify(entry))
  await writeFile(root + 'test-results/camera-' + (liveGemma ? 'live-gemma' : physical ? 'physical' : 'fixture') + '.json', JSON.stringify(report, null, 2))
}
