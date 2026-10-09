import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
export default async function validateBrowserAi(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const origin = 'http://127.0.0.1:4173'
  const report = { checks: [], external: [], posts: [], errors: [], responses: [] }
  await context.route('**/*', route => {
    const request = route.request()
    if (!['GET', 'HEAD'].includes(request.method())) report.posts.push(request.url())
    if (new URL(request.url()).origin === origin) return route.continue()
    report.external.push(request.url()); return route.abort()
  })
  await tab.addInitScript(() => {
    window.aiMessages = []
    const original = Worker.prototype.postMessage
    Worker.prototype.postMessage = function(data, ...rest) { if (['load', 'generate'].includes(data?.type)) window.aiMessages.push({ type: data.type, image: !!data.image }); return original.call(this, data, ...rest) }
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
  try {
    await tab.goto(origin); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg'); await ready()
    assert.deepEqual(await tab.evaluate(() => window.aiMessages), [], 'No model download before consent')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    const started = Date.now()
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.browser-ai-setup')?.textContent.includes('On-device AI ready'), null, { timeout: 180_000 })
    report.loadMs = Date.now() - started
    report.checks.push('Explicit opt-in; real pinned model download, cache and WebGPU initialization')
    let time = Date.now()
    await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
    await tab.locator('.scene-summary').waitFor({ timeout: 100_000 })
    const description = await tab.locator('.scene-description').innerText()
    report.responses.push({ phase: 'image', text: description, ms: Date.now() - time })
    assert.match(description, /desk|table/i)
    assert.equal(await tab.locator('.intent-choices button').count(), 4)
    await tab.locator('#scene-goal').fill('What could this desk be used for?')
    time = Date.now(); await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.locator('.shared-scene > .intent-result').waitFor({ timeout: 100_000 })
    report.responses.push({ phase: 'follow-up', text: await tab.locator('.shared-scene > .intent-result > p').allTextContents(), ms: Date.now() - time })
    const messages = await tab.evaluate(() => window.aiMessages)
    assert.deepEqual(messages.filter(item => item.type === 'generate').map(item => item.image), [true, false])
    assert.equal(await tab.getByRole('button', { name: 'Turn into steps', exact: true }).count(), 0)
    report.checks.push('Real image interpretation; real text-only follow-up reuses scene; no fabricated evidence or checklists')
    await tab.setViewportSize({ width: 390, height: 844 })
    assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await tab.screenshot({ path: 'test-results/browser-ai-mobile.png', fullPage: true })
    await tab.setViewportSize({ width: 1280, height: 900 })
    await tab.locator('input[type=file]').setInputFiles('test-images/blank.png'); await ready()
    const before = (await tab.evaluate(() => window.aiMessages)).length
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.reasoning-panel [role=alert]').waitFor()
    assert.match(await tab.locator('.reasoning-panel [role=alert]').innerText(), /too little visible detail/)
    assert.equal((await tab.evaluate(() => window.aiMessages)).length, before)
    assert.equal(await tab.locator('.scene-summary').count(), 0)
    await tab.getByRole('button', { name: 'Remove downloaded model', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.browser-ai-setup')?.textContent.includes('Saved AI model removed'))
    assert.deepEqual(await tab.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('think-browser-ai-'))), [])
    report.checks.push('Mobile layout; blank image rejected before inference; remove model clears dedicated cache and disables runtime')
    assert.deepEqual(report.external, []); assert.deepEqual(report.posts, []); assert.deepEqual(report.errors, [])
    report.checks.push('Zero external requests, image/API POSTs and page errors')
  } catch (error) { report.failure = error.stack; await tab.screenshot({ path: 'test-results/browser-ai-failure.png', fullPage: true }) }
  finally { await context.close() }
  return report
}
