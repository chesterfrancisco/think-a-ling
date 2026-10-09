import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { dismissStory } from './dismiss-story.js'

export default async function validateDashboard(page) {
  // Network-failure injection must reach Playwright instead of the service worker.
  // Real service-worker/offline behavior is covered by validate-resilience.
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const tab = await context.newPage()
  const report = { checks: [], errors: [], accessibility: [] }
  tab.on('pageerror', error => report.errors.push(error.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done', null, { timeout: 60000 })
  const drop = async entries => {
    const dataTransfer = await tab.evaluateHandle(files => {
      const transfer = new DataTransfer()
      for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
      return transfer
    }, entries)
    await tab.locator('.dashboard-capture').dispatchEvent('dragover', { dataTransfer })
    await tab.locator('.dashboard-capture').dispatchEvent('drop', { dataTransfer })
    await dataTransfer.dispose()
  }
  try {
    await tab.goto('http://127.0.0.1:4173/'); await dismissStory(tab)
    for (const width of [1440, 1024, 768, 390, 320]) {
      await tab.setViewportSize({ width, height: 900 })
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No home overflow at ' + width)
      assert.equal(await tab.getByRole('button', { name: 'Account', exact: true }).count(), 0)
      assert.equal(await tab.getByRole('button', { name: 'Use camera', exact: true }).isVisible(), true)
      if (width <= 390) {
        const centered = await tab.evaluate(() => {
          const ling = document.querySelector('.mascot-orbit').getBoundingClientRect()
          return Math.abs(ling.x + ling.width / 2 - innerWidth / 2) < 2
        })
        assert(centered, 'Ling centered at ' + width)
      }
      if (width === 1440 || width === 390) {
        const result = await new AxeBuilder({ page: tab }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        report.accessibility.push(...result.violations.map(v => ({ width, id: v.id, nodes: v.nodes.map(n => n.target) })))
        await tab.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true })
      }
    }
    await tab.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await tab.locator('.mascot-orbit .ling-mascot').evaluate(el => getComputedStyle(el).animationName), 'none')
    report.checks.push('Central camera, centered mobile Ling, no overflow at 1440/1024/768/390/320px; reduced motion respected; no account UI')

    await tab.setViewportSize({ width: 1440, height: 900 })
    await tab.locator('.demo-guide summary').focus()
    await tab.keyboard.press('Enter')
    await tab.route('**/demo/study-notes.png', route => route.fulfill({ status: 503, body: 'Unavailable' }))
    await tab.getByRole('button', { name: 'Try example study notes', exact: true }).click()
    await tab.getByRole('alert').filter({ hasText: 'example is unavailable' }).waitFor()
    assert.equal(await tab.getByRole('button', { name: 'Try example study notes', exact: true }).isEnabled(), true)
    await tab.unroute('**/demo/study-notes.png')
    await tab.getByRole('button', { name: 'Try example study notes', exact: true }).click(); await ready()
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    assert.match(await tab.getByLabel('Recognized text', { exact: true }).inputValue(), /Photosynthesis/i)
    await tab.keyboard.press('Escape')
    await tab.getByRole('button', { name: 'Back to start', exact: true }).click()
    report.checks.push('Keyboard opens study example; simulated download failure exits loading and retries; example runs real OCR')

    let heldRoute, received
    const requested = new Promise(resolve => { received = resolve })
    await tab.route('**/demo/study-notes.png', route => {
      if (route.request().resourceType() !== 'fetch') return route.continue()
      heldRoute = route; received()
    })
    await tab.locator('.demo-guide summary').click()
    await tab.getByRole('button', { name: 'Try example study notes', exact: true }).click()
    await requested
    await tab.getByRole('button', { name: 'Think-a-ling home', exact: true }).click()
    await heldRoute.fulfill({ path: 'test-images/study-notes.png', contentType: 'image/png' })
    await tab.unroute('**/demo/study-notes.png')
    await tab.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await tab.locator('.image-preview img').count(), 0)
    assert.equal(await tab.getByRole('button', { name: 'Use camera', exact: true }).isEnabled(), true)
    report.checks.push('Returning home cancels a pending example download; its late response does not open an old photo')

    const invalid = { name: 'text.txt', type: 'text/plain', bytes: [104, 105] }
    await drop([invalid, invalid]); await tab.getByRole('alert').filter({ hasText: 'one photo at a time' }).waitFor()
    await drop([invalid]); await tab.getByRole('alert').filter({ hasText: 'Choose a JPEG' }).waitFor()
    assert.equal(await tab.locator('.dashboard-capture.is-dragging').count(), 0)
    const bytes = [...await readFile('test-images/ocr-test.png')]
    await drop([{ name: 'ocr-test.png', type: 'image/png', bytes }]); await ready()
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    assert.match(await tab.getByLabel('Recognized text', { exact: true }).inputValue(), /Invoice 12345/i)
    await tab.keyboard.press('Escape')
    await tab.getByRole('button', { name: 'Back to start', exact: true }).click()
    const choosing = tab.waitForEvent('filechooser')
    await tab.getByRole('button', { name: 'Upload a photo', exact: true }).click()
    await (await choosing).setFiles('test-images/cats-and-dogs.jpg'); await ready()
    assert.equal(await tab.locator('.detection-hotspot').count(), 4)
    report.checks.push('Drop rejects multiple/unsupported files, accepts real photo and runs OCR; Choose a photo opens file chooser and yields four real detections')
    assert.deepEqual(report.errors, [])
    assert.deepEqual(report.accessibility, [])
  } catch (error) { report.failure = error.stack; await tab.screenshot({ path: 'test-results/dashboard-failure.png', fullPage: true }) }
  finally { await context.close() }
  return report
}
