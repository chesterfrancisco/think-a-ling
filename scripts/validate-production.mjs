// Local static-build smoke test. Applies the configured Vercel headers; no AI
// predictions, OCR results or reasoning responses are mocked. No deployment.
// npm run test:production -- C:/path/to/playwright/index.mjs
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dismissStory } from './dismiss-story.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(dist, 'ai/manifest.json'), 'utf8'))
const { chromium } = process.argv[2] ? await import(pathToFileURL(resolve(process.argv[2])).href) : await import('playwright')
const report = { checks: [], predictions: [], externalRequests: [], nonReadRequests: [], pageErrors: [] }
await mkdir(resolve(root, 'test-results'), { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.gz': 'application/gzip' }
const server = createServer(async (request, response) => {
  for (const { key, value } of config.headers.find(rule => rule.source === '/(.*)').headers) response.setHeader(key, value)
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(dist + sep) || !['GET', 'HEAD'].includes(request.method)) throw new Error('Not a static file')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': body.length })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch { response.writeHead(404); response.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
let browser
try {
  // Verify the actual served files, including scalar/SIMD variants and language.
  for (const asset of manifest.assets) {
    const response = await fetch(origin + '/ai/' + asset.file)
    assert.equal(response.status, 200, asset.file)
    const body = Buffer.from(await response.arrayBuffer())
    assert.equal(body.length, asset.bytes, asset.file)
    assert.equal(createHash('sha256').update(body).digest('hex'), asset.sha256, asset.file)
    if (asset.file.endsWith('.wasm')) assert.equal(response.headers.get('content-type'), 'application/wasm')
  }
  assert.equal((await fetch(origin + '/ai/missing.wasm')).status, 404)
  assert.equal((await fetch(origin + '/local-ollama/api/chat', { method: 'POST', body: '{}' })).status, 404)
  report.assetBytes = manifest.assets.reduce((total, item) => total + item.bytes, 0)
  report.checks.push('All 17 served AI assets match manifest hashes; WASM MIME; no missing-asset SPA fallback or Ollama route')

  // Generate a deterministic video source from a real photo; the detector runs normally.
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const prep = await browser.newPage()
  const rgba = await prep.evaluate(async data => {
    const image = new Image(); image.src = 'data:image/jpeg;base64,' + data; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 640, 320)
    return Array.from(ctx.getImageData(0, 0, 640, 320).data)
  }, (await readFile(resolve(root, 'test-images/cats-and-dogs.jpg'))).toString('base64'))
  const y = Buffer.alloc(640 * 320), u = Buffer.alloc(640 * 320 / 4), v = Buffer.alloc(640 * 320 / 4)
  const clamp = number => Math.max(0, Math.min(255, Math.round(number)))
  for (let row = 0; row < 320; row++) for (let col = 0; col < 640; col++) {
    const offset = (row * 640 + col) * 4, r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2]
    y[row * 640 + col] = clamp(16 + .257 * r + .504 * g + .098 * b)
    if (row % 2 === 0 && col % 2 === 0) { const i = row / 2 * 320 + col / 2; u[i] = clamp(128 - .148 * r - .291 * g + .439 * b); v[i] = clamp(128 + .439 * r - .368 * g - .071 * b) }
  }
  const fixture = resolve(root, 'test-results/production-camera.y4m')
  await writeFile(fixture, Buffer.concat([Buffer.from('YUV4MPEG2 W640 H320 F10:1 Ip A1:1 C420jpeg\nFRAME\n'), y, u, v]))
  await browser.close()
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + fixture] })
  report.browser = browser.version()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera'], serviceWorkers: 'block' })
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue()
    report.externalRequests.push(route.request().url()); return route.abort()
  })
  context.on('request', request => {
    if (/^https?:/.test(request.url()) && !['GET', 'HEAD'].includes(request.method())) report.nonReadRequests.push(request.url())
  })
  await context.addInitScript(() => {
    window.testStreams = []
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await getUserMedia(constraints); window.testStreams.push(stream); return stream }
  })
  const page = await context.newPage()
  page.on('pageerror', error => report.pageErrors.push(error.message))
  page.setDefaultTimeout(15_000)
  const response = await page.goto(origin)
  assert.match(response.headers()['content-security-policy'], /connect-src 'self'/)
  await dismissStory(page)
  assert.equal(await page.evaluate(() => window.testStreams.length), 0)
  assert.match(await page.locator('.runtime-strip').innerText(), /optional on-device AI answers/i)
  const ready = () => page.waitForFunction(() => {
    const stage = document.querySelector('.viewfinder')
    return stage?.dataset.detectionStatus === 'done' && stage?.dataset.ocrStatus === 'done'
  }, null, { timeout: 60_000 })
  const upload = async name => {
    await page.locator('input[type=file]').setInputFiles(resolve(root, 'test-images', name))
    await ready()
  }
  const start = Date.now()
  await upload('cats-and-dogs.jpg')
  report.coldDetectionAndOcrMs = Date.now() - start
  assert.equal(await page.locator('.image-preview svg rect').count(), 4)
  report.predictions = await page.locator('.detection-hotspot').allTextContents()
  assert.equal(await page.getByRole('button', { name: 'Explore this photo', exact: true }).isDisabled(), false)
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(await page.evaluate(() => {
      const image = document.querySelector('.image-preview img'), svg = document.querySelector('.image-preview svg')
      const a = image.getBoundingClientRect(), b = svg.getBoundingClientRect(), scale = a.width / image.naturalWidth
      return document.documentElement.scrollWidth <= innerWidth + 1 && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1 && [...svg.querySelectorAll('rect')].every(rect => {
        const bounds = rect.getBoundingClientRect()
        return Math.abs(bounds.x - a.x - Number(rect.getAttribute('x')) * scale) < 1 && Math.abs(bounds.y - a.y - Number(rect.getAttribute('y')) * scale) < 1
      })
    }), true, 'Boxes align at width ' + width)
    await page.locator('.detection-hotspot').first().click()
    const card = page.getByRole('complementary', { name: 'Detected object details' })
    assert.equal(await card.isVisible(), true)
    assert.equal(await card.locator('.action-grid button:not([disabled])').count(), 0)
    assert.match(await card.locator('.object-action-note').last().innerText(), /local app with Ollama/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    if (width === 390) await page.screenshot({ path: resolve(root, 'test-results/production-object-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Close object details' }).click()
  }
  report.checks.push('Actual upload detection, four measured boxes, hotspots and object cards at 1280/390/320px; unavailable object actions disabled')
  await page.getByRole('button', { name: 'Ask This Space', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Build shared scene' }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Enable on-device AI', exact: true }).isVisible(), true)
  assert.match(await page.locator('.browser-ai-setup').innerText(), /Experimental SmolVLM/)
  assert.equal(await page.locator('.reasoning-panel').getAttribute('aria-busy'), 'false')
  await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await upload('ocr-test.png')
  await page.getByRole('button', { name: 'Read text', exact: true }).click()
  report.ocr = await page.locator('#recognized-text').inputValue()
  assert.match(report.ocr, /Read this text without internet\./)
  assert.match(report.ocr, /Invoice 12345 Total 250\.00/)
  assert.equal(await page.getByRole('button', { name: 'Explain this text' }).isDisabled(), true)
  await page.screenshot({ path: resolve(root, 'test-results/production-ocr.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close text', exact: true }).click()
  report.checks.push('Actual OCR reads known fixture; explanation disabled before opt-in; public chat offers optional browser AI without automatically downloading it')
  await upload('blank.png')
  assert.equal(await page.locator('.detection-hotspot').count(), 0)
  assert.match(await page.locator('.photo-hint').innerText(), /No objects found/)

  await page.getByRole('button', { name: 'Back to start' }).click()
  await page.getByRole('button', { name: 'Use camera', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('.live-camera')?.dataset.detectionCount) >= 2, null, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Expand camera', exact: true }).click()
  await page.waitForFunction(() => document.fullscreenElement?.classList.contains('viewfinder'))
  assert.equal(await page.getByRole('button', { name: 'Capture photo', exact: true }).isVisible(), true)
  assert.equal(await page.evaluate(() => {
    const a = document.querySelector('.video-preview video').getBoundingClientRect()
    const b = document.querySelector('.video-preview svg').getBoundingClientRect()
    return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1 && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1
  }), true, 'Live fullscreen boxes align')
  await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
  await page.locator('.live-camera[data-phase=review]').waitFor()
  assert.equal(await page.getByRole('img', { name: 'Captured photo preview' }).isVisible(), true)
  await page.getByRole('button', { name: 'Exit fullscreen camera', exact: true }).click()
  await page.waitForFunction(() => !document.fullscreenElement)
  assert.equal(await page.evaluate(() => window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), true)
  await page.getByRole('button', { name: 'Retake photo' }).click()
  await page.locator('.live-camera[data-phase=live]').waitFor()
  await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
  await page.locator('.live-camera[data-phase=review]').waitFor()
  await page.getByRole('button', { name: 'Analyze photo', exact: true }).click()
  await ready()
  assert.ok(await page.locator('.detection-hotspot').count() > 0)
  assert.equal(await page.locator('.reasoning-drawer').isVisible(), false)
  assert.equal(await page.evaluate(() => window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), true)
  report.checks.push('Production getUserMedia, fullscreen live detection with aligned boxes, fullscreen capture preview, exit, retake, confirm and track cleanup (file-backed camera)')

  await context.setOffline(true)
  await upload('ocr-test.png')
  assert.match(await page.locator('#recognized-text').inputValue(), /Invoice 12345/)
  await upload('cats-and-dogs.jpg')
  assert.equal(await page.locator('.image-preview svg rect').count(), 4)
  report.checks.push('New images run detection and OCR with all browser networking offline after initialization; no offline reload claim')
  assert.deepEqual(report.externalRequests, [])
  assert.deepEqual(report.nonReadRequests, [])
  assert.deepEqual(report.pageErrors, [])
  report.checks.push('Zero external requests, zero image/API POSTs, zero page errors; no Gemma inference')
} catch (error) { report.failure = error.stack; process.exitCode = 1 }
finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await writeFile(resolve(root, 'test-results/production-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
