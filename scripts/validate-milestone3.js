import { dismissStory } from './dismiss-story.js'
import { readFile } from 'node:fs/promises'

import { observeReasoning } from './observe-reasoning.js'

// Replay ONLY at the HTTP boundary, using captured M2 outputs. Browser engines
// still run for real. This verifies UI wiring, not fresh Gemma inference/accuracy.
export default async function validateMilestone3(page) {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  const tab = await context.newPage()
  const capture = observeReasoning(tab)
  const report = { kind: 'UI replay of recorded inference; real browser detection/OCR', checks: [], requests: [], external: [], pageErrors: [] }
  const assert = (value, message) => { if (!value) throw new Error(message) }
  let behavior = 'normal'
  let pending
  const pattern = '**/local-ollama/api/chat'
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url())
    return route.abort()
  })
  await context.route(pattern, async route => {
    const body = route.request().postDataJSON()
    const prompt = body.messages[1]
    const imageCount = prompt.images?.length ?? 0
    report.requests.push({ imageCount, model: body.model, behavior, history: prompt.content.includes('What is this desk useful for') })
    if (imageCount) assert(prompt.images[0].startsWith('/9j/'), 'Expected actual uploaded JPEG bytes')
    if (behavior === 'hold') { pending = route; return }
    if (behavior === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'UI-test engine unavailable' }) })
    const mode = /User intent \(data\): \{"mode":"([A-Z]+)"/.exec(prompt.content)?.[1]
    const content = imageCount ? fixture.scene : fixture.turns.find(turn => turn.mode === mode)?.response
    assert(content, 'No recorded model response for mode ' + mode)
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }) })
  })
  tab.on('pageerror', error => report.pageErrors.push(error.message))
  const done = () => tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false')
  const upload = name => tab.locator('input[type=file]').setInputFiles('test-images/' + name)
  const overflow = () => tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
  try {
    await tab.goto('http://localhost:5173/')
    await dismissStory(tab)
    await tab.evaluate(() => document.fonts.ready)
    assert(await tab.locator('.intent-choices, .local-evidence, .everyday-use-cases, .floating-ask').count() === 0, 'No modes, dashboard, promo cards or chat before a photo')
    assert(await tab.locator('.mascot-welcome .ling-mascot').isVisible(), 'Brand mascot must appear on welcome')
    assert(await overflow(), 'Desktop overflow')
    await tab.screenshot({ path: 'test-results/milestone3-desktop-empty.png', fullPage: true, animations: 'disabled' })
    await tab.getByRole('button', { name: 'How it works', exact: true }).click()
    assert(await tab.getByRole('dialog').isVisible(), 'Help dialog must open')
    await tab.keyboard.press('Escape')
    assert(!await tab.getByRole('dialog').isVisible(), 'Escape must close help')
    assert(await tab.getByRole('button', { name: 'How it works', exact: true }).evaluate(node => node === document.activeElement), 'Help must restore focus')
    await upload('desk.jpg')
    await tab.getByRole('button', { name: 'Expand image', exact: true }).click()
    await tab.waitForFunction(() => document.fullscreenElement || document.querySelector('.workspace-status').textContent.includes('Fullscreen'))
    report.fullscreen = await tab.evaluate(async () => {
      if (!document.fullscreenElement) return 'Browser fallback notice shown'
      await document.exitFullscreen()
      return 'Entered and exited successfully'
    })
    report.checks.push('Desktop Figma shell, local fonts, accessible help and keyboard dismissal')

    assert(await tab.locator('.intent-choices').count() === 0, 'Upload alone must not show reasoning modes')
    const observedScene = capture.next()
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    await done()
    const id = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    assert(id, 'Scene did not build')
    assert((await capture.read(await observedScene)).scene_description === fixture.scene.scene_description, 'Network-observed scene must match display')
    assert(await tab.locator('.scene-description').textContent() === fixture.scene.scene_description, 'Actual scene response must lead the page')
    assert(await tab.locator('pre').count() === 0, 'No raw JSON in the consumer UI')
    assert(await tab.locator('.intent-choices button').count() === 4, 'Four clearly described choices after analysis')
    assert(await tab.locator('.viewfinder').getAttribute('data-ocr-status') === 'done', 'Actual OCR did not finish')
    for (const mode of ['EXPLORE', 'FIND', 'FIX', 'IMPROVE']) {
      await tab.locator('.intent-choices button[data-mode=' + mode + ']').click()
      await tab.locator('#scene-goal').fill(mode === 'EXPLORE' ? 'What is this desk useful for?' : 'Help me with this goal in ' + mode)
      const observedIntent = capture.next()
      await tab.locator('#scene-goal').press('Enter')
      await done()
      const result = await observedIntent
      assert(capture.context(result).description === fixture.scene.scene_description, 'Exact saved scene must be sent as context')
      assert((await tab.locator('.shared-scene > .intent-result').innerText()).includes((await capture.read(result)).answer), 'Display actual response, without developer JSON')
      assert(await tab.locator('.reasoning-panel').getAttribute('data-scene-id') === id, 'Switching mode discarded the scene')
      assert(await tab.locator('.shared-scene > .intent-result').getAttribute('data-mode') === mode, 'Response in wrong mode')
      if (mode === 'FIX') assert((await tab.locator('.shared-scene > .intent-result').innerText()).includes('No evidence-supported visible issues reported'), 'No-issue state missing')
    }
    assert(report.requests.length === 5 && report.requests.map(item => item.imageCount).join(',') === '1,0,0,0,0', 'Modes unnecessarily repeated image inference')
    assert(report.requests[2].history, 'Follow-up history missing')
    await tab.getByRole('button', { name: 'Close chat', exact: true }).click()
    assert(await tab.locator('.floating-ask').getAttribute('aria-expanded') === 'false', 'Floating close must collapse chat')
    const expandedImage = await tab.locator('.image-preview').boundingBox()
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    const splitImage = await tab.locator('.image-preview').boundingBox()
    assert(expandedImage.width > splitImage.width, 'Closing chat gives the photo more room')
    assert(await tab.locator('.reasoning-panel').getAttribute('data-scene-id') === id, 'Closing/reopening discarded scene')
    await tab.screenshot({ path: 'test-results/milestone3-desktop-result.png', fullPage: true, animations: 'disabled' })
    report.checks.push('One scene, all four modes, real image payload, evidence, no fabricated coordinates, zero issues, Enter submission and retained follow-up history (recorded model replay)')

    behavior = 'hold'
    let sent = tab.waitForRequest(pattern)
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await sent
    await tab.getByRole('button', { name: 'Cancel analysis' }).click()
    await done()
    await pending.abort().catch(() => {})
    assert(await tab.getByRole('button', { name: 'Retry question' }).isEnabled(), 'Intent cancellation must permit retry')
    behavior = 'error'
    await tab.getByRole('button', { name: 'Retry question' }).click()
    await done()
    assert((await tab.locator('.reasoning-panel [role=alert]').innerText()).includes('Local Ollama is unavailable'), 'Intent failure missing')
    behavior = 'normal'
    await tab.getByRole('button', { name: 'Retry question' }).click()
    await done()
    behavior = 'hold'
    sent = tab.waitForRequest(pattern)
    await tab.locator('#scene-goal').fill('Explain this scene again.')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await sent
    await tab.getByRole('button', { name: 'Find', exact: true }).click()
    await done()
    await pending.abort().catch(() => {})
    assert(await tab.locator('.reasoning-panel').getAttribute('data-scene-id') === id, 'Cancelling via mode switch discarded scene')
    report.checks.push('Intent cancellation, unavailable engine, successful retry, and mode-switch cancellation preserve the scene')

    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: 844 })
      assert(await overflow(), 'Mobile horizontal overflow at ' + width)
      await tab.getByRole('button', { name: 'Explore', exact: true }).click()
      await tab.locator('.reasoning-drawer').evaluate(node => { node.scrollTop = 0 })
      await tab.screenshot({ path: 'test-results/milestone3-mobile-' + width + '-sheet.png', fullPage: true, animations: 'disabled' })
      await tab.getByRole('button', { name: 'Close panel' }).click()
      assert(await tab.getByRole('button', { name: 'Ask This Space', exact: true }).isVisible(), 'Mobile Ask button needs an accessible name')
      assert(await tab.locator('.floating-ask').evaluate(node => getComputedStyle(node).position === 'fixed'), 'Ask must float on mobile')
      await tab.getByRole('button', { name: 'Help', exact: true }).click()
      assert(await tab.getByRole('dialog').isVisible(), 'Mobile help unavailable')
      await tab.getByRole('button', { name: 'Close help' }).click()
      await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    }
    report.checks.push('390px/320px responsive sheets/navigation, no horizontal overflow and mobile help')

    behavior = 'hold'
    sent = tab.waitForRequest(pattern)
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await sent
    await upload('cats-and-dogs.jpg')
    await pending.abort().catch(() => {})
    assert(await tab.locator('.shared-scene').count() === 0, 'New image retained stale scene/results')
    await tab.getByRole('button', { name: 'Detect objects', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.viewfinder').dataset.detectionStatus === 'done')
    assert(await tab.locator('.image-preview svg rect').count() === 4, 'Expected actual detections')
    await tab.locator('.detection-hotspot').first().click()
    // A real object can prefill a future question before shared-scene creation.
    assert(await tab.locator('.object-detail-card').isVisible(), 'Object chip must use the same contextual card')
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert(await tab.locator('.reasoning-drawer').isVisible(), 'Object question did not open the sheet')
    await tab.getByRole('button', { name: 'Close panel' }).click()
    await tab.locator('.image-preview .box-label').first().click()
    assert(await tab.getByRole('complementary', { name: 'Detected object details' }).isVisible(), 'Real detection label must open the object card')
    await tab.getByRole('button', { name: 'Ask', exact: true }).click()
    assert(await tab.locator('.reasoning-drawer').isVisible(), 'Object card Ask must open object questioning')
    await tab.getByRole('button', { name: 'Close panel' }).click()
    await tab.screenshot({ path: 'test-results/milestone3-mobile-boxes.png', fullPage: true, animations: 'disabled' })
    report.checks.push('New upload cancels pending intent and clears old scene; real four-object detection and object-question entry')
    await tab.getByRole('button', { name: 'Back to start', exact: true }).click()
    assert(await tab.locator('.welcome').isVisible(), 'Back returns to source selection')
    assert(await tab.locator('.scene-summary, .intent-choices, .image-preview').count() === 0, 'Back clears the previous photo and analysis')
    report.checks.push('Mascot, no home/upload modes or technical dashboard, one-click Analyze, prominent actual description, floating toggle/image expansion and Back reset')
    assert(report.external.length === 0, 'External requests: ' + report.external.join(', '))
    assert(report.pageErrors.length === 0, 'Browser errors: ' + report.pageErrors.join(', '))
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}

