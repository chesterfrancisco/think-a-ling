import assert from 'node:assert/strict'
import { chooseSceneMode } from './choose-scene-mode.js'
import { readFile } from 'node:fs/promises'

// Recorded Gemma HTTP replay for UI validation. Detection and OCR run for real.
export default async function validateStoryNavigation(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await context.newPage()
  const fixture = JSON.parse(await readFile(new URL('./fixtures/milestone2-ui-replay.json', import.meta.url), 'utf8'))
  const report = { checks: [], requests: [], external: [], errors: [] }
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://localhost:5173') return route.continue()
    report.external.push(route.request().url()); return route.abort()
  })
  await context.route('**/local-ollama/api/chat', route => {
    const body = route.request().postDataJSON()
    const images = body.messages.flatMap(item => item.images ?? []).length
    const mode = /User intent \(data\): \{"mode":"([A-Z]+)"/.exec(body.messages[1].content)?.[1]
    report.requests.push({ images, mode })
    const content = images ? fixture.scene : fixture.turns.find(turn => turn.mode === mode)?.response
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ done: true, done_reason: 'stop', message: { content: JSON.stringify(content) } }) })
  })
  tab.on('pageerror', error => report.errors.push(error.message))
  const fits = () => tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
  try {
    await tab.goto('http://localhost:5173')
    await tab.locator('.ling-splash.is-loading').waitFor()
    assert.equal(await tab.locator('.splash-prompt').count(), 0, 'Tap prompt must wait for opening animation')
    assert(await tab.getByRole('button', { name: 'Opening Think-a-ling' }).isDisabled())
    await tab.mouse.click(25, 120)
    await tab.keyboard.press('Enter')
    assert.equal(await tab.locator('.ling-story, .app-shell').count(), 0, 'Early tap/Enter must not skip loading')
    await tab.waitForFunction(() => {
      const bar = document.querySelector('.splash-loading > span'), track = document.querySelector('.splash-loading')
      return bar && track && bar.getBoundingClientRect().width > 0 && bar.getBoundingClientRect().width < track.getBoundingClientRect().width
    })
    await tab.screenshot({ path: 'test-results/ling-splash-loading.png' })
    await tab.getByRole('button', { name: 'Tap anywhere to continue' }).waitFor()
    await tab.waitForTimeout(1200) // Prove the splash does NOT advance on a timer.
    assert.equal(await tab.locator('.ling-story, .app-shell, video, input[type=file]').count(), 0)
    assert.equal(await tab.locator('.splash-loading > span').evaluate(node => node.getBoundingClientRect().width), await tab.locator('.splash-loading').evaluate(node => node.getBoundingClientRect().width))
    await tab.screenshot({ path: 'test-results/ling-splash-new.png', animations: 'disabled' })
    await tab.mouse.click(25, 120) // Anywhere, not only the centre logo.
    await tab.locator('.ling-story').waitFor()
    await tab.locator('.story-ling-body').waitFor()
    const before = await tab.locator('.story-ling-body').evaluate(node => getComputedStyle(node).transform)
    await tab.waitForTimeout(240)
    assert.notEqual(await tab.locator('.story-ling-body').evaluate(node => getComputedStyle(node).transform), before)
    assert((await tab.locator('.ling-story h1').innerText()).includes('Hi, I’m Ling!'))
    assert.equal(await tab.locator('.story-local-note').count(), 0)
    for (const [i, pose] of ['hello', 'workspace', 'label', 'study', 'check'].entries()) {
      if (i > 0) await tab.getByRole('button', { name: 'Story ' + (i + 1), exact: true }).click()
      assert(await tab.locator('.pose-' + pose).isVisible())
      assert.equal(await tab.locator('.ling-story h1').evaluate(node => node === document.activeElement), true)
      await tab.screenshot({ path: 'test-results/ling-story-' + pose + '.png', fullPage: true, animations: 'disabled' })
    }
    await tab.getByRole('button', { name: 'Previous story', exact: true }).click()
    assert(await tab.locator('.pose-study').isVisible())
    for (const width of [390, 320]) {
      await tab.setViewportSize({ width, height: width === 320 ? 640 : 844 })
      assert(await fits(), 'Story overflow at ' + width)
      const button = await tab.locator('.story-next').boundingBox()
      assert(button.y >= 0 && button.y + button.height <= tab.viewportSize().height, 'Story Next should fit without scrolling at ' + width)
      await tab.screenshot({ path: 'test-results/ling-story-new-' + width + '.png', fullPage: true, animations: 'disabled' })
    }
    await tab.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await tab.locator('.story-ling-body').evaluate(node => getComputedStyle(node).animationName), 'none')
    await tab.getByRole('button', { name: 'Next', exact: true }).click()
    await tab.getByRole('button', { name: 'Let’s discover', exact: true }).click()
    await tab.locator('.welcome').waitFor()
    assert(!(await tab.locator('body').innerText()).includes('A confusing label.'))
    assert(!(await tab.locator('body').innerText()).includes('Private AI on this computer'))
    await tab.reload()
    await tab.getByRole('button', { name: 'Tap anywhere to continue' }).waitFor()
    await tab.keyboard.press('Enter')
    await tab.locator('.welcome').waitFor()
    assert.equal(await tab.locator('.ling-story').count(), 0)
    await tab.getByRole('button', { name: 'Meet Ling again' }).click()
    await tab.locator('.pose-hello').waitFor()
    await tab.getByRole('button', { name: 'Skip intro' }).click()
    report.checks.push('Logo animation and green bar run before the prompt; early tap/Enter ignored; completed bar reveals prompt and waits for a real tap/Enter; Hi I’m Ling plus four scenarios; navigation, remembered story and replay', 'Story fits at desktop/390/320; keyboard focus; reduced-motion disables animation; dashboard copy removed')

    await tab.emulateMedia({ reducedMotion: 'no-preference' })
    await tab.setViewportSize({ width: 1280, height: 900 })
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.waitForFunction(() => document.querySelector('.viewfinder')?.dataset.detectionStatus === 'done' && document.querySelector('.viewfinder')?.dataset.ocrStatus === 'done')
    await tab.getByRole('button', { name: 'Explore this photo', exact: true }).click()
    await tab.locator('.scene-summary').waitFor()
    const sceneId = await tab.locator('.reasoning-panel').getAttribute('data-scene-id')
    for (const width of [1280, 390, 320]) {
      await tab.setViewportSize({ width, height: 900 })
      for (const mode of ['FIND', 'FIX', 'IMPROVE', 'EXPLORE', 'EXPLORE']) {
        report.activeCheck = { width, mode }
        await chooseSceneMode(tab, mode)
        await tab.waitForFunction(() => {
          const top = document.querySelector('.reasoning-drawer').getBoundingClientRect().top
          return top >= 0 && top < 90
        })
        assert.equal(await tab.locator('.selected-intent').getAttribute('data-mode'), mode)
        assert.equal(await tab.locator('.reasoning-drawer').evaluate(node => node === document.activeElement), true)
        assert((await tab.locator('.suggestions').innerText()).includes('desk'), 'Suggestions must reflect the saved scene')
        assert(await fits())
        assert.equal(await tab.locator('.reasoning-panel').getAttribute('data-scene-id'), sceneId)
      }
      await tab.screenshot({ path: 'test-results/ling-mode-navigation-' + width + '.png', animations: 'disabled' })
    }
    assert.equal(report.requests.length, 1, 'Mode navigation/suggestions do not trigger inference')
    const suggested = await tab.locator('.suggestions button').first().innerText()
    await tab.locator('.suggestions button').first().click()
    assert.equal(await tab.locator('#scene-goal').inputValue(), suggested)
    assert.equal(await tab.locator('#scene-goal').evaluate(node => node === document.activeElement), true)
    assert.equal(report.requests.length, 1, 'Question starters are editable and do not auto-submit')
    await tab.getByRole('button', { name: 'Ask scene', exact: true }).click()
    await tab.locator('.intent-result').waitFor()
    assert.deepEqual(report.requests.map(item => item.images), [1, 0])
    await chooseSceneMode(tab, 'IMPROVE')
    assert.equal(await tab.locator('.selected-intent').getAttribute('data-mode'), 'IMPROVE')
    assert.equal(await tab.locator('.intent-result .answer-mode').innerText(), 'Explore', 'Previous answer retains its mode')
    const form = await tab.locator('.shared-scene form').boundingBox()
    const result = await tab.locator('.intent-result').boundingBox()
    assert(form.y < result.y, 'The next step appears before earlier answers')
    report.checks.push('All modes and repeated same-mode clicks scroll to chat at 1280/390/320; selected mode highlighted; scene-based editable questions cost no extra inference', 'Question submits one text-only request using the same scene; older answer labels retained; form precedes results')
    assert.equal(report.external.length, 0)
    assert.equal(report.errors.length, 0)
    return report
  } catch (error) {
    await tab.screenshot({ path: 'test-results/ling-navigation-failure.png', fullPage: true, animations: 'disabled' })
    return { ...report, failure: String(error), stack: error.stack, bounds: await tab.locator('.reasoning-drawer').boundingBox(), text: await tab.locator('body').innerText() }
  }
  finally { await context.close() }
}
