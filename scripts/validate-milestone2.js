import { dismissStory } from './dismiss-story.js'
import { observeReasoning } from './observe-reasoning.js'
export default async function validateMilestone2(page) {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' })
  const tab = await context.newPage()
  const capture = observeReasoning(tab)
  const report = { requests: [], external: [], turns: [], pageErrors: [] }
  const assert = (value, message) => { if (!value) throw new Error(message) }
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url())
    return route.abort()
  })
  tab.on('request', request => {
    if (request.url().endsWith('/local-ollama/api/chat')) {
      const body = request.postDataJSON()
      report.requests.push({ imageCount: body.messages[1].images?.length ?? 0,
        model: body.model, promptLength: body.messages[1].content.length,
        historyIncluded: body.messages[1].content.includes('What is this desk useful for') })
    }
  })
  tab.on('pageerror', error => report.pageErrors.push(error.message))
  const done = () => tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false', null, { timeout: 240_000 })
  try {
    await tab.goto('http://localhost:5173/')
    await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    const sceneResponse = capture.next()
    await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
    await done()
    report.sceneModelOutput = await capture.read(await sceneResponse)
    assert(await tab.locator('.scene-description').textContent() === report.sceneModelOutput.scene_description, 'Scene description not displayed')
    assert(await tab.locator('.viewfinder').getAttribute('data-ocr-status') === 'done', 'OCR must complete')
    assert(await tab.locator('.image-preview svg rect').count() === 0, 'Original desk fixture has no detector predictions')
    const sceneId = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    for (const [mode, goal] of [
      ['EXPLORE', 'What is this desk useful for, and how could I use it for studying?'],
      ['FIND', 'Which of those objects can help me write notes?'],
      ['FIX', 'Are any problems actually visible, and what should I check?'],
      ['IMPROVE', 'Use the earlier ideas to help me make better use of this desk for focused study.'],
    ]) {
      await tab.locator('.intent-choices button[data-mode=' + mode + ']').click()
      await tab.locator('#scene-goal').fill(goal)
      const start = Date.now()
      const intentResponse = capture.next()
      await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
      await done()
      const result = await intentResponse
      const response = await capture.read(result)
      report.sceneContext = capture.context(result)
      assert(await tab.locator('.shared-scene > .intent-result').isVisible(), 'Actual response must be displayed')
      report.turns.push({ mode, elapsedMs: Date.now() - start, response })
      assert(await tab.locator('.reasoning-panel').getAttribute('data-scene-id') === sceneId, 'Scene identity must persist across modes')
    }
    assert(report.requests.length === 5 && report.requests[0].imageCount === 1 && report.requests.slice(1).every(item => item.imageCount === 0), 'Expected one image pass followed by four scene-only requests')
    assert(report.requests[2].historyIncluded, 'FIND follow-up must include the earlier EXPLORE goal')
    assert(report.external.length === 0 && report.pageErrors.length === 0, 'Unexpected external request or page error')
    await tab.screenshot({ path: 'test-results/shared-scene-workspace.png', fullPage: true })
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
