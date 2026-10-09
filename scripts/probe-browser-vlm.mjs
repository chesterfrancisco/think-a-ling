// Development-only real model probe; no mocked predictions or answers.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href)
import { readFile, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER', msg.text().slice(0, 500)) })
  await page.route('http://localhost:5173/probe', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local model probe</title>' }))
  await page.goto('http://localhost:5173/probe')
  console.log('GPU', await page.evaluate(async () => { const gpu = await navigator.gpu?.requestAdapter(); return gpu ? { info: gpu.info, features: [...gpu.features] } : null }))
  await page.evaluate(() => {
    window.vlm = new Worker('/src/services/browserVision.worker.ts', { type: 'module' })
    window.messages = []
    window.vlm.onmessage = ({ data }) => { if (data.type !== 'token') window.messages.push(data) }
    window.vlm.onerror = event => window.messages.push({ type: 'error', message: event.message })
    window.vlm.postMessage({ type: 'load' })
  })
  await page.waitForFunction(() => window.messages.some(x => ['ready', 'error'].includes(x.type)), null, { timeout: 180_000 })
  const loaded = await page.evaluate(() => window.messages.find(x => ['ready', 'error'].includes(x.type)))
  console.log('LOAD', loaded)
  if (loaded.type === 'error') throw new Error(loaded.message)
  const report = []
  for (const file of ['cats-and-dogs.jpg', 'desk.jpg', 'blank.png']) {
    const bytes = [...await readFile('test-images/' + file)]
    await page.evaluate(({ bytes }) => { window.messages = []; window.vlm.postMessage({ type: 'generate', image: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), prompt: 'Describe only what is visible in this image in two short sentences. Do not guess identities, hidden details or safety. If the image is empty, say so.', maxTokens: 120 }) }, { bytes })
    await page.waitForFunction(() => window.messages.some(x => ['result', 'error'].includes(x.type)), null, { timeout: 120_000 })
    const result = { file, ...await page.evaluate(() => window.messages.find(x => ['result', 'error'].includes(x.type))) }
    console.log(JSON.stringify(result)); report.push(result)
  }
  // Can this small model follow a compact JSON schema or use text-only context?
  await page.evaluate(() => { window.messages = []; window.vlm.postMessage({ type: 'generate', prompt: 'Photo notes: two cats and two dogs are sitting together. Question: What animals are in the photo? Answer briefly using only these notes.', maxTokens: 80 }) })
  await page.waitForFunction(() => window.messages.some(x => ['result', 'error'].includes(x.type)), null, { timeout: 120_000 })
  report.push({ textOnly: await page.evaluate(() => window.messages.at(-1)) })
  console.log(JSON.stringify(report.at(-1)))
  await writeFile('test-results/browser-vlm-probe.json', JSON.stringify(report, null, 2))
} finally { await browser.close() }
