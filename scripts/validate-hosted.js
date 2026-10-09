import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
// Uses the real public deployment, real OCR/detector and its offline pack.
// Does not register accounts, send mail or call a model inference backend.
export default async function validateHosted(page) {
  const report = { checks: [], errors: [], url: 'https://think-a-ling.vercel.app/' }
  const context = await page.context().browser().newContext(), tab = await context.newPage()
  tab.on('pageerror', e => report.errors.push(e.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done', null, { timeout: 120000 })
  try {
    const response = await tab.goto(report.url); assert.equal(response.status(), 200); await dismissStory(tab)
    assert.match(response.headers()['content-security-policy'], /supabase/)
    await tab.getByRole('button', { name: 'Account', exact: true }).click()
    assert(await tab.getByRole('button', { name: 'Sign in', exact: true }).isVisible())
    assert(!await tab.getByText('Accounts are not connected on this deployment yet.', { exact: false }).count())
    await tab.getByRole('button', { name: 'Close account' }).click()
    await tab.locator('.demo-guide summary').click()
    await tab.getByRole('button', { name: 'Try example study notes', exact: true }).click(); await ready()
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    await tab.locator('.text-workbench input[type=search]').fill('Photosynthesis')
    assert.match(await tab.locator('.text-workbench [role=status]').innerText(), /uses light to make food/i)
    await tab.keyboard.press('Escape')
    await tab.locator('.offline-setup summary').click()
    await tab.waitForFunction(() => !!navigator.serviceWorker.controller)
    await tab.getByRole('button', { name: /Prepare for offline/ }).click()
    await tab.waitForFunction(() => document.querySelector('.offline-setup summary')?.textContent.includes('Offline pack ready') || document.querySelector('.offline-setup .error'), null, { timeout: 300000 })
    assert.equal(await tab.locator('.offline-setup .error').count(), 0, await tab.locator('.offline-setup').innerText())
    const bad = await tab.goto(report.url + 'missing-think-page'); assert.equal(bad.status(), 404)
    assert.match(await tab.locator('h1').innerText(), /can’t find/)
    await tab.goto(report.url); await dismissStory(tab)
    await context.setOffline(true); await tab.reload(); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg'); await ready()
    assert.equal(await tab.locator('.detection-hotspot').count(), 4)
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    assert.deepEqual(report.errors, [])
    report.checks.push('Live HTTPS page with Supabase CSP and configured account form; actual study example OCR and keyword lookup', 'Real hosted offline pack downloaded and hash-verified; full offline reload processes a new image with four detections and OCR completion', 'Hosted missing page returns HTTP 404 with Ling; no page errors')
  } catch (error) { report.failure = error.stack; report.screen = (await tab.locator('body').innerText()).slice(-2500) }
  finally { await context.close() }
  return report
}
