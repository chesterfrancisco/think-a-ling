import { dismissStory } from './dismiss-story.js'
import { observeReasoning } from './observe-reasoning.js'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const live = process.argv.includes('--live-gemma')
const origin = live ? 'http://localhost:5173' : 'http://127.0.0.1:4173'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const capture = observeReasoning(page)
const report = { liveGemma: live, checks: [], requests: [], external: [], errors: [], images: [] }
await mkdir('test-results', { recursive: true })
context.on('request', request => {
  if (request.url().includes('/local-ollama/api/chat')) report.requests.push({ images: request.postDataJSON().messages.flatMap(m => m.images ?? []).length, body: request.postDataJSON() })
})
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin === origin) return route.continue()
  report.external.push(route.request().url()); return route.abort()
})
page.on('pageerror', error => report.errors.push(error.message))
const visible = name => page.getByRole('button', { name, exact: true })
async function detect(file) {
  await page.locator('input[type=file]').setInputFiles(`test-images/${file}`)
  if (await visible('Close panel').isVisible()) await visible('Close panel').click()
  await visible('Detect objects').click()
  await page.waitForFunction(() => document.querySelector('.viewfinder').dataset.detectionStatus === 'done')
  const actual = await page.locator('.image-preview svg rect').evaluateAll(nodes => nodes.map(n => ({ title: n.textContent, box: ['x', 'y', 'width', 'height'].map(k => Number(n.getAttribute(k))) })))
  report.images.push({ file, detections: actual })
  return actual
}
async function geometry() {
  const data = await page.locator('.image-preview').evaluate(element => {
    const img = element.querySelector('img').getBoundingClientRect()
    const svg = element.querySelector('svg')
    const view = svg.viewBox.baseVal
    return { aspectError: Math.abs(img.width / img.height - view.width / view.height), overflow: document.documentElement.scrollWidth > innerWidth + 1,
      spots: [...element.querySelectorAll('.detection-hotspot')].map((button, index) => {
        const rect = svg.querySelectorAll('rect')[index]
        const dot = button.querySelector('.hotspot-dot').getBoundingClientRect()
        const x = Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2
        const y = Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 4
        return [Math.abs(dot.x + dot.width / 2 - (img.x + x / view.width * img.width)), Math.abs(dot.y + dot.height / 2 - (img.y + y / view.height * img.height))]
      }) }
  })
  assert(!data.overflow, 'Horizontal overflow')
  assert(data.aspectError < .01, 'Original image aspect ratio must be preserved')
  assert(data.spots.every(([x, y]) => x < 2 && y < 2), JSON.stringify(data))
}
try {
  await page.goto(origin)
  await dismissStory(page)
  assert.equal((await detect('cats-and-dogs.jpg')).length, 4)
  for (const width of [1280, 390, 320]) {
    report.currentWidth = width
    await page.setViewportSize({ width, height: 900 })
    await geometry()
    await page.locator('.detection-hotspot').first().click()
    await page.locator('.object-detail-card').waitFor({ timeout: 5000 })
    await page.waitForTimeout(500)
    await geometry()
    const bounds = await page.locator('.object-detail-card').boundingBox()
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    assert(!(await page.locator('.object-detail-card').innerText()).includes('Confidence:'), 'Technical details should be collapsed')
    await page.locator('.discovery-evidence summary').click()
    assert((await page.locator('.object-detail-card').innerText()).includes('It can be mistaken'), 'Recognition uncertainty remains accessible')
    await page.locator('.discovery-evidence summary').click()
    await page.screenshot({ path: `test-results/interactions-card-${width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('.detection-hotspot') === document.activeElement)
    assert(await page.locator('.detection-hotspot').first().evaluate(node => node === document.activeElement), 'Close restores hotspot focus')
  }
  report.checks.push('Four real animal detections; exact box-relative hotspot anchors, card fit, Escape/focus restoration at 1280/390/320px')
  await page.setViewportSize({ width: 1280, height: 900 })
  if (live) {
    await page.locator('.detection-hotspot').first().click()
    const start = Date.now()
    const sceneResponse = capture.next()
    await visible('Learn').click()
    await page.locator('.shared-scene > .intent-result').waitFor({ timeout: 370000 })
    await page.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false')
    report.actionMs = Date.now() - start
    report.sceneModelOutput = await capture.read(await sceneResponse)
    report.answer = await page.locator('.shared-scene > .intent-result').innerText()
    assert.deepEqual(report.requests.map(r => r.images), [1, 0], 'One image build then text-only object action')
    const sceneId = await page.locator('.reasoning-panel').getAttribute('data-scene-id')
    await visible('Close panel').click()
    await page.locator('.detection-hotspot').nth(1).click()
    assert((await page.locator('.object-detail-card').innerText()).includes('Scene saved.'))
    await visible('Ask').click()
    assert.equal(await page.locator('.reasoning-panel').getAttribute('data-scene-id'), sceneId)
    assert.equal(await page.locator('#scene-goal').inputValue(), '')
    assert.match(await page.locator('#scene-goal').getAttribute('placeholder'), /Cat/)
    assert.equal(report.requests.length, 2, 'Opening a second card must not infer again')
    report.checks.push('Real object action completed with one Gemma image request and one text-only intent; second card/Ask reuses scene and exact object ID')
  }
  const portrait = await detect('portrait.jpg')
  assert.equal(portrait.filter(item => item.title.startsWith('person')).length, 1)
  await page.getByRole('button', { name: /Ask about Person/ }).click()
  assert.equal(await page.locator('.object-detail-card h2').textContent(), 'Person')
  assert.deepEqual(await page.locator('.object-detail-card .action-grid button').allTextContents(), ['Learn about the scene', 'Ask about the photo', 'Explore surroundings'])
  await page.screenshot({ path: 'test-results/interactions-person.png', fullPage: true, animations: 'disabled' })
  await visible('Close object details').click()
  assert.equal((await detect('blank.png')).length, 0)
  assert.equal(await page.locator('.detection-hotspot').count(), 0)
  assert.equal(await page.locator('.object-detail-card').count(), 0)
  assert((await page.locator('.photo-actions').innerText()).includes('No objects found'))
  await page.screenshot({ path: 'test-results/interactions-empty.png', fullPage: true, animations: 'disabled' })
  report.checks.push('Portrait: one real person prediction; blank: zero boxes/hotspots and honest empty state')
  assert.equal(report.external.length, 0)
  assert.equal(report.errors.length, 0)
} catch (error) {
  report.failure = String(error); process.exitCode = 1
  report.failureText = await page.locator('body').innerText()
  await page.screenshot({ path: 'test-results/interactions-failure.png', fullPage: true })
}
finally {
  await writeFile(`test-results/interactions-${live ? 'live' : 'browser'}.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, requests: report.requests.map(r => ({ images: r.images })), scene: report.scene ? { elapsedMs: report.scene.elapsedMs } : undefined, answer: undefined }, null, 2))
  await browser.close()
}
