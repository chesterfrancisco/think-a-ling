// Capability check only: no recording, model installation or audio upload.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:5173/')
  const result = await page.evaluate(async () => {
    const Speech = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Speech) return { supported: false, reason: 'No SpeechRecognition API' }
    const result = { localProperty: 'processLocally' in Speech.prototype, availableMethod: typeof Speech.available, installMethod: typeof Speech.install, languages: {} }
    if (result.localProperty && Speech.available) for (const lang of ['en-US', 'fil-PH']) {
      try { result.languages[lang] = await Speech.available({ langs: [lang], processLocally: true }) }
      catch (error) { result.languages[lang] = error.message }
    }
    return result
  })
  console.log(JSON.stringify(result, null, 2))
  await writeFile('test-results/local-speech-capability.json', JSON.stringify(result, null, 2))
} finally { await browser.close() }
