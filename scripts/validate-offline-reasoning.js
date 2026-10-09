import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
export default async function validateOfflineReasoning(page) {
  const context = await page.context().browser().newContext()
  const tab = await context.newPage()
  const report = { checks: [], errors: [], actualResponses: [] }
  tab.on('pageerror', e => report.errors.push(e.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
  const enable = async () => { await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click(); await tab.waitForFunction(() => document.querySelector('.browser-ai-setup')?.textContent.includes('On-device AI ready') || document.querySelector('.browser-ai-setup [role=alert]'), null, { timeout: 180000 }); assert.match(await tab.locator('.browser-ai-setup').innerText(), /On-device AI ready/) }
  try {
    await tab.goto('http://127.0.0.1:4173'); await dismissStory(tab)
    await tab.locator('.offline-setup summary').click(); await tab.waitForFunction(() => !!navigator.serviceWorker.controller)
    await tab.getByRole('button', { name: /Prepare for offline/ }).click()
    await tab.waitForFunction(() => document.querySelector('.offline-setup summary')?.textContent.includes('Offline pack ready'), null, { timeout: 120000 })
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg'); await ready()
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click(); await enable()
    await context.setOffline(true)
    await tab.reload(); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg'); await ready()
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click(); await enable()
    const start = Date.now()
    await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
    await tab.locator('.scene-summary').waitFor({ timeout: 100000 })
    report.actualResponses.push({ phase: 'offline image', text: await tab.locator('.scene-description').innerText(), ms: Date.now() - start })
    await tab.locator('#scene-goal').fill('What could this desk be used for?')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.shared-scene > .intent-result') || document.querySelector('.reasoning-panel [role=alert]'), null, { timeout: 100000 })
    const result = tab.locator('.shared-scene > .intent-result')
    report.actualResponses.push({ phase: 'offline follow-up', text: await result.count() ? await result.innerText() : await tab.locator('.reasoning-panel [role=alert]').innerText(), rejected: !await result.count() })
    assert.deepEqual(report.errors, [])
    report.checks.push('Real SmolVLM enabled again from cache after full offline reload; actual image interpretation and same-scene follow-up with all browser networking disabled. Output remains unverified model interpretation.')
  } catch (error) { report.failure = error.stack; report.screen = (await tab.locator('body').innerText()).slice(-2500) }
  finally { await context.close() }
  return report
}
