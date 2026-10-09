import { dismissStory } from './dismiss-story.js'
import { observeReasoning } from './observe-reasoning.js'
export default async function validateSharedScenarios(page) {
  const context = await page.context().browser().newContext()
  const tab = await context.newPage()
  const capture = observeReasoning(tab)
  const report = { cases: [], requests: [] }
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  tab.on('request', request => {
    if (request.url().endsWith('/local-ollama/api/chat')) {
      const body = request.postDataJSON()
      report.requests.push({ imageCount: body.messages[1].images?.length ?? 0 })
    }
  })
  try {
    await tab.goto('http://localhost:5173/')
    await dismissStory(tab)
    for (const [file, goal] of [
      ['study-notes.png', 'Create two simple study flashcards strictly from the recognized notes.'],
      ['product-label.png', 'Explain the visible label and identify the warnings it actually states. Do not infer medical advice.'],
    ].filter(([file]) => !process.env.SCENARIO_FILE || file === process.env.SCENARIO_FILE)) {
      await tab.locator('input[type=file]').setInputFiles('test-images/' + file)
      await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
      const sceneResponse = capture.next()
      await tab.getByRole('button', { name: 'Build shared scene', exact: true }).click()
      await tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false', null, { timeout: 240_000 })
      const sceneModelOutput = await capture.read(await sceneResponse)
      assert(await tab.locator('.scene-description').textContent() === sceneModelOutput.scene_description, 'Scene failed')
      await tab.locator('#scene-goal').fill(goal)
      const start = Date.now()
      const intentResponse = capture.next()
      await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
      await tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false', null, { timeout: 190_000 })
      const result = await intentResponse
      const response = await capture.read(result)
      const scene = capture.context(result)
      const caseReport = { file, scene, response, displayedCards: [], intentMs: Date.now() - start, intentTransport: await result.json() }
      report.cases.push(caseReport) // Keep genuine output even when a grounding assertion fails.
      const ocrEvidenceIds = scene.evidence.filter(item => item.source === 'tesseract').map(item => item.id)
      assert(scene.ocr.text.trim(), 'Expected actual OCR text')
      let displayedCards = []
      if (file === 'study-notes.png') {
        assert(response.study_cards.length > 0, 'Expected real study cards')
        assert(response.study_cards.every(card => card.evidence_ids.every(id => ocrEvidenceIds.includes(id))), 'Study cards must cite OCR evidence')
        displayedCards = await tab.locator('.shared-scene > .intent-result .study-card').evaluateAll(cards => cards.map(card => ({
          question: card.querySelector('summary').textContent,
          answer: card.querySelector('p').textContent,
          evidence: [...card.querySelectorAll('.evidence-references small')].map(item => item.textContent),
        })))
        const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
        assert(displayedCards.length > 0, 'Expected OCR-grounded cards in the UI')
        assert(displayedCards.every(card => card.evidence.length && card.evidence.every(entry =>
          normalize(entry).includes(normalize(card.answer)))), 'Displayed card citations must contain the actual answer')
      } else {
        caseReport.modelCitedOcr = [...response.observations, ...response.suggestions].some(item => item.evidence_ids.some(id => ocrEvidenceIds.includes(id)))
        caseReport.displayedTextMatches = await tab.locator('.answer-text-matches .evidence-references small').allTextContents()
        assert(caseReport.modelCitedOcr || caseReport.displayedTextMatches.length > 0, 'Label answer must expose its actual recognized-text sources')
      }
      caseReport.displayedCards = displayedCards
      console.log(file + ': goal answered')
      await tab.screenshot({ path: 'test-results/' + file + '-shared.png', fullPage: true })
    }
    const expected = report.cases.flatMap(() => [1, 0])
    assert(report.requests.map(item => item.imageCount).join(',') === expected.join(','), 'Each scenario must reuse its scene without another image request')
    return report
  } catch (error) { return { ...report, failure: String(error) } }
  finally { await context.close() }
}
