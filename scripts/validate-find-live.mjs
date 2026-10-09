import { dismissStory } from './dismiss-story.js'
// Reuses a real captured scene from validate-camera --live-gemma; no image rerun.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const root = fileURLToPath(new URL('../', import.meta.url))
const source = JSON.parse(await readFile(root + 'test-results/camera-live-gemma-initial.json', 'utf8'))
const scene = source.browsers[0].scene
if (!scene) throw new Error('Run the real captured-scene validation first.')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  let imageRequests = 0, requests = 0
  page.on('request', request => {
    if (request.url().endsWith('/local-ollama/api/chat')) {
      requests++
      if (request.postDataJSON().messages.some(message => message.images?.length)) imageRequests++
    }
  })
  await page.goto('http://localhost:5173/')
  await dismissStory(page)
  const turn = await page.evaluate(async scene => {
    const { answerIntent } = await import('/src/services/intentEngine.ts')
    return answerIntent(scene, { mode: 'FIND', goal: 'Find something in this scene that can charge my phone. If nothing supports this, say so; do not assume unseen equipment.' }, [], new AbortController().signal)
  }, scene)
  const report = { actualLocalInference: true, sceneId: scene.id, requests, imageRequests, turn }
  await writeFile(root + 'test-results/find-grounding-live.json', JSON.stringify(report, null, 2))
  if (requests !== 1 || imageRequests !== 0 || turn.response.suggestions.length || !/no|none|not|cannot|missing/i.test(turn.response.answer)) throw new Error('Unsupported capability or repeated image analysis')
  console.log(JSON.stringify({ seconds: turn.elapsedMs / 1000, requests, imageRequests, response: turn.response }))
} finally { await browser.close() }
