import { fileURLToPath } from 'node:url'
import { dismissStory } from './dismiss-story.js'
// Browser integration test. Pass a Playwright Page to this exported function.
// Uses the production preview at :4173 and fixtures in test-images/.
export default async function validateMilestone1(page) {
  const origin = 'http://127.0.0.1:4173'
  const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '')
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' })
  const requests = []
  const external = []
  const errors = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    external.push(url.href)
    return route.abort()
  })
  context.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  const test = await context.newPage()
  test.on('pageerror', error => errors.push(error.message))
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const upload = name => test.locator('input[type=file]').setInputFiles(root + '/test-images/' + name)
  async function detect() {
    await test.getByRole('button', { name: 'Detect objects', exact: true }).click()
    await test.waitForFunction(() => ['done', 'error'].includes(document.querySelector('.viewfinder').dataset.detectionStatus), null, { timeout: 60_000 })
    return (await test.locator('.photo-actions').innerText()) + '\n' + (await test.locator('.image-preview svg rect').count()) + ' object(s) detected.'
  }
  async function ocr() {
    await test.getByRole('button', { name: 'Read text', exact: true }).click()
    await test.getByRole('button', { name: 'Read again', exact: true }).click()
    await test.waitForFunction(() => ['done', 'error'].includes(document.querySelector('.viewfinder').dataset.ocrStatus), null, { timeout: 60_000 })
    const text = await test.locator('.text-dialog').innerText()
    await test.getByRole('button', { name: 'Close text', exact: true }).click()
    return text
  }
  const report = { browser: page.context().browser().version(), checks: [] }
  try {
    await test.goto(origin)
    await dismissStory(test)
    assert(await test.getByRole('button', { name: 'Detect objects', exact: true }).count() === 0, 'No-image scan controls must be absent')
    await upload('cats-and-dogs.jpg')
    report.detection = await detect()
    assert(report.detection.includes('4 object(s) detected.'), 'Expected actual four animal detections')
    assert(await test.locator('.image-preview svg rect').count() === 4, 'Expected four bounding boxes')
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await test.setViewportSize(viewport)
      const aligned = await test.evaluate(() => {
        const image = document.querySelector('.image-preview img')
        const box = image.getBoundingClientRect()
        const svg = document.querySelector('.image-preview svg').getBoundingClientRect()
        if (Math.abs(box.width - svg.width) > 1 || Math.abs(box.height - svg.height) > 1) return false
        return [...document.querySelectorAll('.image-preview svg rect')].every(rect => {
          const bounds = rect.getBoundingClientRect()
          const scale = box.width / image.naturalWidth
          return Math.abs(bounds.x - box.x - Number(rect.getAttribute('x')) * scale) < 1 &&
            Math.abs(bounds.y - box.y - Number(rect.getAttribute('y')) * scale) < 1 &&
            Math.abs(bounds.width - Number(rect.getAttribute('width')) * scale) < 1 &&
            Math.abs(bounds.height - Number(rect.getAttribute('height')) * scale) < 1
        })
      })
      assert(aligned, 'Bounding boxes must track native pixels at width ' + viewport.width)
    }
    await test.setViewportSize({ width: 1280, height: 900 })
    await test.screenshot({ path: root + '/test-results/detection.png', fullPage: true })
    await upload('ocr-test.png')
    await ocr()
    report.ocr = await test.locator('textarea').inputValue()
    assert(report.ocr.includes('Read this text without internet.') && report.ocr.includes('Invoice 12345 Total 250.00'), 'OCR must read fixture text')
    await test.screenshot({ path: root + '/test-results/ocr.png', fullPage: true })
    report.checks.push('Cold production load and both engines with all external requests blocked', 'Responsive bounding-box coordinate mapping at 1280px and 390px')

    // All networking, including localhost, is now unavailable. Engines are warm.
    const warmRequestCount = requests.length
    await context.setOffline(true)
    await upload('cats-and-dogs.jpg')
    assert((await detect()).includes('4 object(s) detected.'), 'Warm offline detection failed')
    await upload('ocr-test.png')
    await ocr()
    assert((await test.locator('textarea').inputValue()).includes('Invoice 12345'), 'Warm offline OCR failed')
    report.warmOfflineRequests = requests.length - warmRequestCount
    assert(report.warmOfflineRequests === 0, 'Warm offline inference must not request assets')
    await context.setOffline(false)
    report.checks.push('New uploads and both inference engines in full browser offline mode after initialization')

    await upload('blank.png')
    assert((await detect()).includes('No objects found'), 'Expected empty detection state')
    assert((await ocr()).includes('No readable text found.'), 'Expected empty OCR state')
    await upload('desk.jpg')
    report.desk = await detect()
    await test.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
    assert((await test.getByRole('alert').innerText()).includes('Choose a JPEG'), 'Expected unsupported-format error')
    await test.locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') })
    await test.getByRole('alert').waitFor()
    assert((await test.getByRole('alert').innerText()).includes('could not be decoded'), 'Expected corrupt-image error')
    report.checks.push('Blank-image empty states, original desk image, unsupported and corrupt uploads')

    await upload('blank.png')
    await test.reload()
    await dismissStory(test)
    await test.waitForTimeout(200)
    assert(test.workers().length === 0, 'Releasing OCR must terminate both parent and child workers')
    const modelPattern = '**/models/efficientdet_lite0.tflite'
    await context.route(modelPattern, route => route.fulfill({ status: 404, body: 'missing test model' }))
    await upload('cats-and-dogs.jpg')
    assert((await detect()).includes('Try scanning again.'), 'Expected missing-model error')
    await context.unroute(modelPattern)
    assert((await detect()).includes('4 object(s) detected.'), 'Detection retry failed')

    const languagePattern = '**/eng.traineddata.gz'
    // Uploads now scan both engines automatically. Release the already-warm
    // OCR worker before testing a missing language asset during initialization.
    await test.reload()
    await dismissStory(test)
    await context.route(languagePattern, route => route.fulfill({ status: 404, body: 'missing test language' }))
    await upload('ocr-test.png')
    report.missingLanguage = await ocr()
    assert(await test.locator('.viewfinder').getAttribute('data-ocr-status') === 'error' && await test.locator('.text-dialog [role=alert]').count() === 1, 'Expected a visible missing-language error: ' + report.missingLanguage)
    await test.waitForTimeout(200)
    assert(test.workers().length === 0, 'Failed OCR initialization must terminate worker tree')
    await context.unroute(languagePattern)
    await ocr()
    assert((await test.locator('textarea').inputValue()).includes('Invoice 12345'), 'OCR retry failed')
    await test.reload()
    await dismissStory(test)
    await test.waitForTimeout(200)
    assert(test.workers().length === 0, 'OCR workers remain after release')
    report.checks.push('Engine disposal/reinitialization, missing model/language failures and successful retries')

    assert(external.length === 0, 'Unexpected external network requests: ' + external.join(', '))
    assert(requests.every(request => request.method === 'GET'), 'Unexpected outbound non-GET request')
    assert(errors.length === 0, 'Unexpected browser errors: ' + errors.join('; '))
    assert(requests.some(request => request.url.includes('eng.traineddata.gz')), 'Language file was not requested locally')
    assert(requests.some(request => request.url.includes('vision_wasm_internal.wasm')), 'Detection WASM was not requested locally')
    report.externalRequests = external
    report.pageErrors = errors
    report.requests = requests
    report.checks.push('Only same-origin GET requests; no image uploads or external inference calls')
    return report
  } finally {
    await context.close()
  }
}
