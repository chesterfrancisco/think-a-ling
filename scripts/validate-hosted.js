import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
// Uses the real public deployment, real OCR/detector and its offline pack.
// Checks that core tools make no requests to external services.
export default async function validateHosted(page) {
  const report = { checks: [], errors: [], url: 'https://thinkaling.vercel.app/' }
  const context = await page.context().browser().newContext(), tab = await context.newPage()
  tab.on('pageerror', e => report.errors.push(e.message))
  const externalRequests = []
  context.on('request', r => { const url = new URL(r.url()); if (/^https?:$/.test(url.protocol) && url.origin !== new URL(report.url).origin) externalRequests.push(url.origin) })
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done', null, { timeout: 120000 })
  try {
    const response = await tab.goto(report.url); assert.equal(response.status(), 200); await dismissStory(tab)
    assert.match(response.headers()['content-security-policy'], /connect-src 'self';/)
    assert.equal(await tab.getByRole('button', { name: 'Account', exact: true }).count(), 0)
    assert.equal(await tab.locator('.demo-guide p, .demo-guide ol, main .offline-setup, main .accessibility-settings').count(), 0)
    await tab.getByRole('button', { name: 'Settings', exact: true }).click()
    await tab.getByLabel('Answer language', { exact: true }).selectOption('Filipino')
    await tab.getByRole('button', { name: 'Close settings' }).click()
    await tab.getByRole('button', { name: 'Summarize this document', exact: true }).click(); await ready()
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    await tab.locator('.text-workbench input[type=search]').fill('Photosynthesis')
    assert.match(await tab.locator('.text-workbench [role=status]').innerText(), /uses light to make food/i)
    await tab.getByRole('button', { name: 'Close text', exact: true }).click()
    await tab.getByRole('button', { name: 'Settings', exact: true }).click()
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
    await tab.locator('.detection-hotspot').first().click()
    await tab.getByRole('button', { name: 'Remove tag', exact: true }).click()
    assert.equal(await tab.locator('.detection-hotspot').count(), 3)
    await tab.getByRole('button', { name: 'Undo last removal', exact: true }).click()
    assert.equal(await tab.locator('.detection-hotspot').count(), 4)
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    assert.deepEqual(report.errors, [])
    assert.deepEqual(externalRequests, [])
    report.checks.push('Live free app without external requests; Settings and example button work; actual example OCR and keyword lookup', 'Real hosted offline pack downloaded and hash-verified; full offline reload processes a new image with four detections and OCR completion; tag removal and Undo work offline', 'Hosted missing page returns HTTP 404 with Ling; no page errors')
  } catch (error) { report.failure = error.stack; report.screen = (await tab.locator('body').innerText()).slice(-2500) }
  finally { await context.close() }
  return report
}
