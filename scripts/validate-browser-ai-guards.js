import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'

// Inject unsupported-device / failed-download conditions only, never model answers.
export default async function validateBrowserAiGuards(page) {
  const browser = page.context().browser()
  const origin = 'http://127.0.0.1:4173'
  const report = { checks: [] }
  const open = async context => {
    const tab = await context.newPage()
    await tab.goto(origin); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    return tab
  }
  let context
  try {
    context = await browser.newContext()
    let modelRequests = 0
    context.on('request', request => { if (/smolvlm500|browser-reasoning/.test(request.url())) modelRequests++ })
    await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }))
    let tab = await open(context)
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click()
    await tab.locator('.browser-ai-setup [role=alert]').waitFor()
    assert.match(await tab.locator('.browser-ai-setup [role=alert]').innerText(), /does not provide WebGPU/)
    assert.equal(modelRequests, 0)
    assert.equal(await tab.getByRole('button', { name: 'Build shared scene', exact: true }).isDisabled(), true)
    report.checks.push('Unsupported WebGPU: clear error, no model download, detection/OCR still complete')
    await context.close()

    context = await browser.newContext()
    await context.route('**/ai/browser-reasoning.json', route => route.fulfill({ status: 404, body: 'Not found' }))
    tab = await open(context)
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click()
    await tab.locator('.browser-ai-setup [role=alert]').waitFor()
    assert.equal(await tab.getByRole('button', { name: 'Retry on-device AI', exact: true }).isVisible(), true)
    await context.unroute('**/ai/browser-reasoning.json')
    // Keep a real request pending long enough to cancel setup before weights download.
    let release
    const paused = new Promise(resolve => { release = resolve })
    await context.route('**/ai/browser-reasoning.json', async route => { await paused; await route.abort().catch(() => {}) })
    await tab.getByRole('button', { name: 'Retry on-device AI', exact: true }).click()
    await tab.getByRole('button', { name: 'Cancel setup', exact: true }).click()
    release()
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).waitFor()
    assert.equal(await tab.getByRole('button', { name: 'Build shared scene', exact: true }).isDisabled(), true)
    assert.equal(await tab.locator('.browser-ai-setup progress').count(), 0)
    report.checks.push('Missing asset fails visibly; retry and cancellation terminate setup; no indefinite loading')
  } catch (error) { report.failure = error.stack }
  finally { await context?.close() }
  return report
}
