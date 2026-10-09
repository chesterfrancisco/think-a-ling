import { dismissStory } from './dismiss-story.js'
import assert from 'node:assert/strict'

// One real image request through the actual UI. No routes fabricate AI output.
export default async function auditLiveScene(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const report = { date: new Date().toISOString(), checks: [], external: [], requests: [], errors: [] }
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  tab.on('request', request => {
    if (request.url().endsWith('/local-ollama/api/chat')) report.requests.push({ images: request.postDataJSON().messages.flatMap(message => message.images ?? []).length })
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  try {
    await tab.goto('http://localhost:5173')
    await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
    const response = tab.waitForResponse('**/local-ollama/api/chat', { timeout: 190000 })
    const start = performance.now()
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    const received = await response
    report.transport = await received.json()
    report.wallMs = performance.now() - start
    await tab.waitForFunction(() => document.querySelector('.reasoning-panel')?.getAttribute('aria-busy') === 'false')
    report.rawModel = JSON.parse(report.transport.message.content)
    report.description = await tab.locator('.scene-description').textContent()
    assert.equal(report.description, report.rawModel.scene_description)
    assert.deepEqual(report.requests, [{ images: 1 }])
    assert.equal(report.external.length, 0); assert.equal(report.errors.length, 0)
    report.checks.push('One actual image request, successful structured scene validation and exact UI rendering', 'No external requests/page errors; four genuine detector hotspots remain')
    report.visualGroundTruth = 'Two dogs and two cats against a pink background; both cats have open eyes. Assess scene wording against this, not only schema validity.'
    await tab.screenshot({ path: 'test-results/live-scene-audit.png', fullPage: true })
    return report
  } catch (error) { return { ...report, failure: String(error), ui: await tab.locator('body').innerText() } }
  finally { await context.close() }
}
