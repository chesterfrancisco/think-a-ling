import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
export default async function validatePocketsLayout(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const tab = await context.newPage()
  const report = { checks: [], requests: [], errors: [] }
  context.on('request', r => report.requests.push({ url: r.url(), method: r.method() }))
  tab.on('pageerror', e => report.errors.push(e.message))
  try {
    await tab.goto('http://127.0.0.1:4173'); await dismissStory(tab)
    await tab.waitForFunction(() => Number(getComputedStyle(document.querySelector('.welcome')).opacity) > .99)
    assert.equal(await tab.locator('.home-purpose').count(), 0)
    assert.equal(await tab.locator('.page-intro h1 br').count(), 0)
    await tab.screenshot({ path: 'test-results/home-desktop-refined.png', fullPage: true })
    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: 844 })
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No home overflow at ' + width)
      const centered = await tab.evaluate(() => {
        const orbit = document.querySelector('.mascot-orbit').getBoundingClientRect()
        const welcome = document.querySelector('.welcome').getBoundingClientRect()
        return Math.abs(orbit.x + orbit.width / 2 - welcome.x - welcome.width / 2) < 2
      })
      assert(centered, 'Ling centered at ' + width)
    }
    await tab.screenshot({ path: 'test-results/home-mobile-refined.png', fullPage: true })
    assert.deepEqual(await tab.evaluate(() => localStorage.getItem('think-a-ling.pockets.v1')), null)
    await tab.locator('input[type=file]').setInputFiles('test-images/ocr-test.png')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    await tab.locator('.text-dialog').getByRole('button', { name: 'Save this', exact: true }).click()
    await tab.locator('.text-dialog').getByRole('button', { name: 'Save this', exact: true }).click()
    const raw = await tab.evaluate(() => localStorage.getItem('think-a-ling.pockets.v1'))
    assert.equal(JSON.parse(raw).length, 1)
    assert.match(raw, /Invoice 12345/)
    assert(!raw.includes('blob:') && !raw.includes('data:image'))
    await tab.reload(); await dismissStory(tab)
    await tab.getByRole('button', { name: 'Saved', exact: true }).click()
    await tab.locator('.pocket-entry > summary').click()
    assert.match(await tab.locator('.pocket-content').innerText(), /Invoice 12345/)
    assert.equal(await tab.locator('.image-preview img').count(), 0)
    assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await tab.getByRole('button', { name: /^Delete saved discovery:/ }).click()
    assert.match(await tab.locator('.pockets-dialog').innerText(), /Nothing saved yet/)
    await tab.getByRole('button', { name: 'Close saved discoveries' }).click()
    await tab.reload(); await dismissStory(tab)
    assert.equal(await tab.evaluate(() => JSON.parse(localStorage.getItem('think-a-ling.pockets.v1')).length), 0)
    assert.deepEqual(report.errors, [])
    assert.equal(report.requests.some(r => !['GET', 'HEAD'].includes(r.method)), false)
    report.checks.push('Single-line desktop heading; centered Ling and no overflow at 390/320px', 'Actual OCR saved only on click; deduplicated; survives reload; no photo stored; review/delete persists; no upload or AI requests')
  } catch (error) { report.failure = error.stack; await tab.screenshot({ path: 'test-results/pockets-layout-failure.png', fullPage: true }) }
  finally { await context.close() }
  return report
}
