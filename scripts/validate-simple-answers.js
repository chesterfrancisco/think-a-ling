import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'
import { dismissStory } from './dismiss-story.js'

// Vision worker responses are simulated to test controls, never model accuracy.
// MediaPipe detection, OCR and the example photo still run normally.
export default async function validateSimpleAnswers(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const tab = await context.newPage()
  const report = { checks: [], errors: [], accessibility: [], kind: 'Real detection/OCR; simulated vision worker for UI lifecycle only' }
  tab.on('pageerror', e => report.errors.push(e.message))
  const ready = () => tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done', null, { timeout: 60000 })
  const audit = async () => { const r = await new AxeBuilder({ page: tab }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); report.accessibility.push(...r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))) }
  await tab.addInitScript(() => {
    window.aiUiTest = { prompts: [], hold: false }
    Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => ({}) }, configurable: true })
    const NativeWorker = window.Worker
    window.Worker = class extends EventTarget {
      constructor(url, options) {
        super()
        if (!String(url).includes('browserVision.worker')) return new NativeWorker(url, options)
      }
      postMessage(data) {
        if (data.type === 'load') { setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 30); return }
        window.aiUiTest.prompts.push(data.prompt)
        const deliver = () => this.onmessage?.({ data: { type: 'result', text: data.image ? 'Several animals are visible in this photo.' : 'The photo shows animals resting near one another.', elapsedMs: 250 } })
        if (window.aiUiTest.hold) window.aiUiTest.deliver = deliver
        else setTimeout(deliver, 30)
      }
      terminate() {}
    }
  })
  try {
    await tab.goto('http://127.0.0.1:4173'); await dismissStory(tab)
    await tab.locator('.demo-guide summary').click()
    assert.equal(await tab.locator('.demo-guide ol, .demo-guide p').count(), 0)
    await tab.getByRole('button', { name: 'Try example study notes', exact: true }).click(); await ready()
    await tab.getByRole('button', { name: 'Read text', exact: true }).click()
    await tab.locator('.text-workbench input[type=search]').fill('Photosynthesis')
    assert.match(await tab.locator('.text-workbench [role=status]').innerText(), /uses light to make food/i)
    await tab.getByRole('button', { name: 'Close text', exact: true }).click()
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg'); await ready()
    const hotspots = tab.locator('.image-stage .detection-hotspot')
    assert.equal(await hotspots.count(), 4)
    const firstName = await hotspots.first().getAttribute('aria-label')
    await hotspots.first().click()
    await tab.getByRole('button', { name: 'Correct this label', exact: true }).click()
    await tab.getByLabel('What is this object?', { exact: true }).fill('Pet')
    await tab.getByRole('button', { name: 'Save label', exact: true }).click()
    assert.match(await tab.locator('.object-detail-card h2').innerText(), /Pet/)
    await tab.getByRole('button', { name: 'Remove tag', exact: true }).click()
    assert.equal(await hotspots.count(), 3)
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    assert.equal(await tab.locator('.image-stage svg rect').count(), 3)
    await tab.getByRole('button', { name: 'Exit fullscreen photo', exact: true }).click()
    await tab.getByRole('button', { name: 'Undo last removal', exact: true }).click()
    assert.equal(await hotspots.count(), 4)
    assert.match(await hotspots.first().getAttribute('aria-label'), /Pet/)
    await hotspots.first().click()
    await tab.getByRole('button', { name: 'Edit your label', exact: true }).click()
    await tab.getByRole('button', { name: 'Use AI label', exact: true }).click()
    await tab.getByRole('button', { name: 'Close object details', exact: true }).click()
    assert.equal(await hotspots.first().getAttribute('aria-label'), firstName)
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.browser-ai-setup summary')?.textContent.includes('On-device AI ready'))
    assert.equal(await tab.locator('.browser-ai-setup').getAttribute('open'), null)
    assert.equal(await tab.getByRole('button', { name: 'Remove downloaded model', exact: true }).isVisible(), false)
    await tab.locator('.browser-ai-setup summary').click()
    assert(await tab.getByRole('button', { name: 'Remove downloaded model', exact: true }).isVisible())
    await tab.locator('.browser-ai-setup summary').click()
    await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    const ask = async text => { await tab.locator('#scene-goal').fill(text); await tab.getByRole('button', { name: 'Ask scene', exact: true }).click(); await tab.waitForFunction(() => document.querySelector('.reasoning-panel')?.getAttribute('aria-busy') === 'false') }
    await ask('Describe what the animals are doing.')
    const latest = tab.locator('.shared-scene > .intent-result')
    assert.equal(await latest.locator('.answer-evidence').getAttribute('open'), null)
    assert.equal(await latest.getByText('This small browser model can invent details.', { exact: false }).isVisible(), false)
    await latest.getByRole('button', { name: 'Save this', exact: true }).click()
    await latest.getByRole('button', { name: 'Helpful', exact: true }).click()
    assert.match(await latest.locator('.feedback-note').innerText(), /this visit/)
    await latest.locator('.answer-evidence summary').click()
    assert.match(await latest.locator('.answer-evidence').innerText(), /not a verified recommendation/)
    await latest.locator('.answer-evidence summary').click()
    await latest.getByRole('button', { name: 'Not quite', exact: true }).click()
    assert.equal(await tab.locator('#scene-goal').inputValue(), 'Describe what the animals are doing.')
    await tab.waitForFunction(() => document.querySelector('#scene-goal') === document.activeElement)
    await latest.getByRole('button', { name: 'Ask again', exact: true }).click()
    assert.equal(await tab.locator('#scene-goal').inputValue(), '')
    await ask('How are the animals positioned?')
    await tab.locator('.earlier-questions > summary').click()
    assert.equal(await tab.locator('.earlier-questions > details[open]').count(), 0)
    for (const width of [1440, 390, 320]) {
      await tab.setViewportSize({ width, height: 1000 })
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }
    await tab.screenshot({ path: 'test-results/simple-answer-mobile.png', fullPage: true })
    await audit()
    await tab.setViewportSize({ width: 1440, height: 1000 })
    await tab.evaluate(() => { window.aiUiTest.hold = true })
    await tab.locator('#scene-goal').fill('One more detail please.')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.waitForFunction(() => !!window.aiUiTest.deliver)
    await hotspots.first().click()
    await tab.getByRole('button', { name: 'Remove tag', exact: true }).click()
    await tab.evaluate(() => { window.aiUiTest.deliver(); window.aiUiTest.hold = false })
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    assert.equal(await tab.locator('.intent-result').count(), 0, 'Tag edits invalidate old/pending answers')
    await tab.getByRole('button', { name: 'Enable on-device AI', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.browser-ai-setup summary')?.textContent.includes('On-device AI ready'))
    await ask('Describe the remaining animals.')
    assert.match(await tab.evaluate(() => window.aiUiTest.prompts.at(-1)), /User removed detector tag/)
    await tab.locator('input[type=file]').setInputFiles('test-images/cats-and-dogs.jpg'); await ready()
    assert.equal(await hotspots.count(), 4, 'A new photo starts with all detections')
    assert.equal(await tab.locator('.removed-tags').count(), 0)
    assert.deepEqual(report.errors, [])
    assert.deepEqual(report.accessibility, [])
    report.checks.push('Example button restored without instructional paragraphs; actual example OCR runs', 'Real tags: correct label, remove, fullscreen, Undo and new-photo reset; late simulated answers cannot survive removal', 'AI-ready status collapses; compact answers retain expandable evidence; save, feedback, ask again and collapsed earlier answers work at desktop/390/320px', 'Rejected detection notes reach the next browser prompt; no model quality claim; zero Axe violations on tested answer screen')
  } catch (error) { report.failure = error.stack; report.screen = (await tab.locator('body').innerText()).slice(-2500); await tab.screenshot({ path: 'test-results/simple-answers-failure.png', fullPage: true }) }
  finally { await context.close() }
  return report
}
