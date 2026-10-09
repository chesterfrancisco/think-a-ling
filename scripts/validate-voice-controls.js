import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
import { readFile } from 'node:fs/promises'
// Speech API test double for lifecycle/UI checks only, not a speech accuracy test.
export default async function validateVoiceControls(page) {
  const context = await page.context().browser().newContext()
  const tab = await context.newPage()
  const report = { checks: [], kind: 'Speech event simulation; no real transcription claim' }
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  await context.route('**/local-ollama/api/chat', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, message: { content: JSON.stringify(fixture.scene) } }) }))
  try {
    await tab.addInitScript(() => {
      window.voiceTest = { started: 0, aborted: 0, checked: 0 }
      class LocalSpeech {
        static async available(options) { if (options.processLocally !== true) throw new Error('Remote mode requested'); window.voiceTest.checked++; return 'available' }
        static async install() { return true }
        start() { if (this.processLocally !== true) throw new Error('Remote mode requested'); window.voiceTest.started++; window.voiceTest.recognition = this }
        abort() { window.voiceTest.aborted++ }
      }
      LocalSpeech.prototype.processLocally = false
      window.SpeechRecognition = LocalSpeech
    })
    await tab.goto('http://localhost:5173'); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done')
    assert.equal(await tab.getByRole('button', { name: 'Voice question', exact: true }).count(), 0)
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    await tab.getByRole('button', { name: 'Voice question', exact: true }).click()
    assert.equal(await tab.evaluate(() => window.voiceTest.started), 0)
    await tab.getByRole('button', { name: 'Enable local voice', exact: true }).click()
    await tab.getByRole('button', { name: 'Speak your question', exact: true }).click()
    await tab.evaluate(() => window.voiceTest.recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Find a book on this desk.' } }] }))
    await tab.waitForFunction(() => document.querySelector('#scene-goal')?.value === 'Find a book on this desk.')
    assert.equal(await tab.locator('#scene-goal').inputValue(), 'Find a book on this desk.')
    assert.equal(await tab.locator('.selected-intent').getAttribute('data-mode'), 'FIND')
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('aria-busy'), 'false')
    await tab.locator('#scene-goal').fill('Find a notebook instead.')
    await tab.getByRole('button', { name: 'Enable local voice', exact: true }).click()
    await tab.getByRole('button', { name: 'Speak your question', exact: true }).click()
    const current = await tab.evaluate(() => window.voiceTest.aborted)
    await tab.getByRole('button', { name: 'Close panel', exact: true }).click()
    assert(await tab.evaluate(() => window.voiceTest.aborted) > current)
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    await tab.evaluate(() => { window.SpeechRecognition = class {}; window.webkitSpeechRecognition = undefined })
    await tab.getByRole('button', { name: 'Enable local voice', exact: true }).click()
    assert.match(await tab.locator('.local-voice [role=alert]').innerText(), /No cloud voice service/)
    assert.equal(await tab.locator('#scene-goal').inputValue(), 'Find a notebook instead.')
    report.checks.push('Local-only flag enforced; no auto-recording; editable transcript selects Find; no automatic AI submission', 'Closing panel aborts speech; unsupported local speech refuses remote fallback and preserves typed input')
  } catch (error) { report.failure = error.stack; report.screen = (await tab.locator('body').innerText()).slice(-5000) }
  finally { await context.close() }
  return report
}
