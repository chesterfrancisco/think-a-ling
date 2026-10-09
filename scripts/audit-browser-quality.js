import { dismissStory } from './dismiss-story.js'
import assert from 'node:assert/strict'

// Small, declared fixture set; these results are NOT a general accuracy score.
const expectedText = {
  'ocr-test.png': 'THING A LING LOCAL AI Read this text without internet. Invoice 12345 Total 250.00',
  'study-notes.png': 'STUDY NOTES Photosynthesis uses light to make food. Plants take in carbon dioxide and release oxygen. Chlorophyll gives leaves their green color.',
  'product-label.png': 'DESK CLEANER Surface cleaner WARNING: Keep out of reach of children. Do not mix with bleach. Use in a well-ventilated area.',
}
const words = value => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
function wordErrors(expected, actual) {
  let row = actual.map((_, i) => i + 1)
  row.unshift(0)
  expected.forEach((word, i) => {
    const next = [i + 1]
    actual.forEach((other, j) => next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(word !== other))))
    row = next
  })
  return row.at(-1)
}
export default async function auditBrowserQuality(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const report = { date: new Date().toISOString(), cases: [], checks: [], external: [], pageErrors: [], inferenceRequests: 0 }
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  tab.on('request', request => { if (request.url().includes('/local-ollama/')) report.inferenceRequests++ })
  tab.on('pageerror', error => report.pageErrors.push(error.message))
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    await tab.evaluate(() => {
      window.auditLongTasks = []
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.auditLongTasks.push(entry.duration) }).observe({ type: 'longtask', buffered: false })
    })
    for (const file of ['cats-and-dogs.jpg', 'portrait.jpg', 'blank.png', 'desk.jpg', ...Object.keys(expectedText), 'cats-and-dogs.jpg']) {
      const start = performance.now()
      await tab.locator('input[type=file]').setInputFiles('test-images/' + file)
      const [detectionMs, ocrMs] = await Promise.all([
        tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done').then(() => performance.now() - start),
        tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done').then(() => performance.now() - start),
      ])
      const detections = await tab.locator('.image-preview svg rect').evaluateAll(nodes => nodes.map(node => ({ prediction: node.textContent, box: ['x', 'y', 'width', 'height'].map(key => Number(node.getAttribute(key))) })))
      await tab.getByRole('button', { name: 'Read text', exact: true }).click()
      const text = await tab.locator('#recognized-text').count() ? await tab.locator('#recognized-text').inputValue() : ''
      await tab.getByRole('button', { name: 'Close text', exact: true }).click()
      const entry = { file, detectionMs, ocrMs, detections, text }
      if (expectedText[file]) {
        entry.expectedWords = words(expectedText[file]).length
        entry.wordErrors = wordErrors(words(expectedText[file]), words(text))
        entry.normalizedWordErrorRate = entry.wordErrors / entry.expectedWords
      }
      report.cases.push(entry)
      if (file === 'cats-and-dogs.jpg') assert.deepEqual(detections.map(item => item.prediction.split(' — ')[0]).sort(), ['cat', 'cat', 'dog', 'dog'])
      if (file === 'portrait.jpg') assert.deepEqual(detections.map(item => item.prediction.split(' — ')[0]).sort(), ['person', 'tie'])
      if (file === 'blank.png') { assert.equal(detections.length, 0); assert.equal(text, '') }
      console.log(`${file}: detections ${Math.round(detectionMs)}ms, OCR ${Math.round(ocrMs)}ms`)
    }
    report.longTasksMs = await tab.evaluate(() => window.auditLongTasks)
    assert.equal(report.external.length, 0)
    assert.equal(report.pageErrors.length, 0)
    assert.equal(report.inferenceRequests, 0)
    report.checks.push('Actual MediaPipe and Tesseract on seven distinct images; repeat animals measures warm end-to-end UI latency', '2 cats + 2 dogs, one person and blank-image class counts checked against known input', 'Normalized word-error measurement on three declared printed-text fixtures; no general accuracy extrapolation')
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
