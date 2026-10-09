import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dismissStory } from './dismiss-story.js'

// Recorded model responses check request wiring, not language fluency or accuracy.
export default async function validateSettings(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const tab = await context.newPage()
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  const report = { checks: [], errors: [], languages: [], accountRequests: [] }
  tab.on('pageerror', e => report.errors.push(e.message))
  context.on('request', r => { if (r.url().includes('supabase.co')) report.accountRequests.push(r.url()) })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const images = body.messages.flatMap(m => m.images ?? []).length
    if (!images) report.languages.push(body.messages.map(m => m.content).join('\n'))
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, message: { content: JSON.stringify(images ? fixture.scene : fixture.turns.find(t => t.mode === 'EXPLORE').response) } }) })
  })
  try {
    await tab.goto('http://localhost:5173'); await dismissStory(tab)
    await tab.getByRole('button', { name: 'Settings', exact: true }).click()
    await tab.getByLabel('Answer language', { exact: true }).selectOption('Filipino')
    await tab.getByRole('checkbox', { name: 'Stronger text contrast' }).check()
    await tab.screenshot({ path: 'test-results/settings-desktop.png' })
    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: 844 })
      assert(await tab.locator('.settings-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), 'Settings has no horizontal overflow')
    }
    await tab.screenshot({ path: 'test-results/settings-mobile.png' })
    await tab.keyboard.press('Escape')
    assert(await tab.getByRole('button', { name: 'Settings', exact: true }).evaluate(b => b === document.activeElement), 'Focus returns to settings button')
    await tab.reload(); await dismissStory(tab)
    assert(await tab.evaluate(() => document.documentElement.classList.contains('strong-contrast')))
    await tab.getByRole('button', { name: 'Settings', exact: true }).click()
    assert.equal(await tab.getByLabel('Answer language', { exact: true }).inputValue(), 'Filipino')
    await tab.getByRole('button', { name: 'Close settings' }).click()
    await tab.setViewportSize({ width: 1440, height: 1000 })
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done' && document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    assert.equal(await tab.locator('.reasoning-panel select, .reasoning-panel .language-help').count(), 0)
    await tab.locator('#scene-goal').fill('What can I use this desk for?')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.locator('.intent-result').waitFor()
    assert.match(report.languages[0], /Write explanations in Filipino/)
    await tab.getByRole('button', { name: 'Settings', exact: true }).click()
    await tab.getByLabel('Answer language', { exact: true }).selectOption('English')
    await tab.getByRole('button', { name: 'Close settings' }).click()
    await tab.locator('#scene-goal').fill('What shape is this desk?')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.reasoning-panel')?.getAttribute('aria-busy') === 'false')
    assert.match(report.languages[1], /Write explanations in English/)
    assert.deepEqual(report.accountRequests, [])
    assert.deepEqual(report.errors, [])
    report.languages = ['Filipino', 'English']
    report.checks.push('Settings preferences persist after reload; mobile dialog fits; Escape restores focus; no account requests', 'Language moves out of analysis card and reaches both actual local request prompts; recorded responses used, no accuracy claim')
  } catch (error) { report.failure = error.stack }
  finally { await context.close() }
  return report
}
