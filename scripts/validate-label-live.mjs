import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const scene = JSON.parse(await readFile('test-results/interactions-live.json', 'utf8')).scene
if (!scene) throw new Error('Actual recorded scene required')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { kind: 'Actual local Gemma text-only response to a user label, using the previously measured real animal scene', requests: [], external: [] }
try {
  const page = await browser.newPage()
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  page.on('request', request => { if (request.url().endsWith('/local-ollama/api/chat')) report.requests.push({ images: request.postDataJSON().messages.flatMap(item => item.images ?? []).length }) })
  await page.goto('http://localhost:5173')
  const start = performance.now()
  report.result = await page.evaluate(async scene => {
    const { applyLabelCorrections } = await import('/src/services/labelCorrections.ts')
    const { answerIntent } = await import('/src/services/intentEngine.ts')
    const object = scene.objects.find(item => item.source === 'mediapipe')
    const updated = applyLabelCorrections(scene, [{ originalLabel: object.name, box: object.boundingBox, label: 'pet dog' }])
    return answerIntent(updated, { mode: 'EXPLORE', goal: 'What name did I give object mp-0? Distinguish my name from the original detector prediction.' }, [], new AbortController().signal)
  }, scene)
  report.elapsedMs = performance.now() - start
  if (!/pet dog/i.test(report.result.response.answer)) throw new Error('Response did not use the supplied name')
  if (report.requests.length !== 1 || report.requests[0].images !== 0 || report.external.length) throw new Error('Unexpected inference request')
} catch (error) { report.failure = String(error); process.exitCode = 1 }
finally {
  await writeFile('test-results/label-live.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
