import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { dismissStory } from './dismiss-story.js'
export default async function validateLocalVoice(page) {
  // Real browser recognizer, supplied with a local synthesized WAV rather than
  // recording the user's microphone. No transcription results are mocked.
  const browser = await page.context().browser().browserType().launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + resolve('test-results/voice-question.wav')] })
  const report = { checks: [], transcript: '', errors: [] }
  try {
    const context = await browser.newContext({ permissions: ['microphone'] })
    const tab = await context.newPage()
    // Replay scene setup only; speech below still uses the native recognizer.
    const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
    await context.route('**/local-ollama/api/chat', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, message: { content: JSON.stringify(fixture.scene) } }) }))
    // Supply an actual audio track to the browser's recognizer. Native local
    // speech does not consistently consume Chromium's fake microphone flag.
    await tab.addInitScript(bytes => {
      const Engine = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (!Engine) return
      const start = Engine.prototype.start
      Engine.prototype.start = function() {
        const audio = new AudioContext({ sampleRate: 16000 })
        const output = audio.createMediaStreamDestination()
        const source = audio.createBufferSource()
        audio.decodeAudioData(new Uint8Array(bytes).buffer).then(async buffer => {
          source.buffer = buffer; source.connect(output); await audio.resume()
          this.addEventListener('end', () => { output.stream.getTracks().forEach(track => track.stop()); void audio.close() }, { once: true })
          start.call(this, output.stream.getAudioTracks()[0])
          source.start(audio.currentTime + 0.3)
        })
      }
    }, [...await readFile(resolve('test-results/voice-question.wav'))])
    tab.on('pageerror', error => report.errors.push(error.message))
    await tab.goto('http://localhost:5173/'); await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    await tab.getByRole('button', { name: 'Voice question', exact: true }).click()
    await tab.getByRole('button', { name: 'Enable local voice', exact: true }).click()
    await tab.waitForFunction(() => !document.querySelector('.local-voice')?.textContent.includes('Checking local'))
    if (await tab.getByRole('button', { name: 'Install English voice pack', exact: true }).isVisible()) {
      await tab.getByRole('button', { name: 'Install English voice pack', exact: true }).click()
    }
    await tab.waitForFunction(() => document.querySelector('.local-voice button[aria-label="Speak your question"]') || document.querySelector('.local-voice [role=alert]'), null, { timeout: 130000 })
    if (await tab.locator('.local-voice [role=alert]').count()) throw new Error(await tab.locator('.local-voice [role=alert]').innerText())
    await tab.getByRole('button', { name: 'Speak your question', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('#scene-goal')?.value.length > 0 || document.querySelector('.local-voice [role=alert]'), null, { timeout: 35000 })
    report.voiceStatus = await tab.locator('.local-voice').innerText()
    report.transcript = await tab.locator('#scene-goal').inputValue()
    assert.match(report.transcript, /find.*desk/i)
    assert.equal(await tab.locator('.selected-intent').getAttribute('data-mode'), 'FIND')
    assert.equal(await tab.locator('.reasoning-panel').getAttribute('aria-busy'), 'false')
    assert.deepEqual(report.errors, [])
    report.checks.push('Actual on-device English recognition from generated audio track; editable transcript routes Find without auto-submitting AI; physical microphone untested')
  } catch (error) { report.failure = error.stack }
  finally { await browser.close() }
  return report
}
