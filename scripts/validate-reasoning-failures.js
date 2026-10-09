import { dismissStory } from './dismiss-story.js'
export default async function validateReasoningFailures(page) {
  const context = await page.context().browser().newContext()
  const tab = await context.newPage()
  const checks = []
  const pattern = '**/local-ollama/api/chat'
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const panel = tab.locator('.reasoning-panel')
  const start = () => panel.getByRole('button', { name: /^(Build shared scene|Retry scene)$/ }).click()
  const done = () => tab.waitForFunction(() => document.querySelector('.reasoning-panel').getAttribute('aria-busy') === 'false', null, { timeout: 60_000 })
  try {
    await tab.goto('http://localhost:5173/')
    await dismissStory(tab)
    await tab.locator('input[type=file]').setInputFiles('test-images/desk.jpg')
    await tab.getByRole('button', { name: 'Ask This Space', exact: true }).click()
    for (const value of [
      { status: 404, body: { error: 'model not found' }, expected: 'gemma3:4b is unavailable' },
      { status: 503, body: { error: 'test unavailable' }, expected: 'Local Ollama is unavailable' },
      { status: 200, body: { done: true, message: { content: '{' } }, expected: 'malformed JSON' },
      { status: 200, body: { done: true, message: { content: '{}' } }, expected: 'Invalid model JSON' },
      { status: 200, body: { done: true, done_reason: 'length', message: { content: '{}' } }, expected: 'incomplete' },
    ]) {
      await context.route(pattern, route => route.fulfill({ status: value.status, contentType: 'application/json', body: JSON.stringify(value.body) }))
      await start()
      await done()
      assert((await panel.getByRole('alert').innerText()).includes(value.expected), 'Expected ' + value.expected)
      assert(await panel.getByRole('button', { name: 'Retry scene' }).isEnabled(), 'Retry must be available')
      assert(await panel.locator('.shared-scene').count() === 0, 'Invalid results must not create a scene')
      await context.unroute(pattern)
      checks.push(value.expected)
    }
    let pending
    await context.route(pattern, route => { pending = route })
    const sent = tab.waitForRequest(pattern)
    await start()
    await sent
    await tab.getByRole('button', { name: 'Cancel analysis' }).click()
    await done()
    assert((await panel.innerText()).includes('Analysis cancelled.'), 'Cancellation not displayed')
    if (pending) await pending.abort().catch(() => {})
    checks.push('Scene cancellation releases controls and permits retry')

    await tab.clock.install()
    const sentAgain = tab.waitForRequest(pattern)
    await start()
    await sentAgain
    await tab.clock.fastForward(180_001)
    await done()
    assert((await panel.getByRole('alert').innerText()).includes('timed out'), 'Timeout must be visible')
    if (pending) await pending.abort().catch(() => {})
    await context.unroute(pattern)
    checks.push('180-second timeout (advanced test clock) and retry state')
    return { checks }
  } finally { await context.close() }
}
