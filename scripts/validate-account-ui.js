import assert from 'node:assert/strict'
import { dismissStory } from './dismiss-story.js'
// HTTP contract simulation for the real Supabase SDK. This is NOT a hosted
// authentication/RLS test and must never be reported as real cross-device sync.
export default async function validateAccountUi(page) {
  const context = await page.context().browser().newContext()
  const tab = await context.newPage(), report = { checks: [], requests: [], errors: [], kind: 'Supabase HTTP simulation; real backend/RLS still require configured project' }
  const user = { id: '22222222-2222-4222-8222-222222222222', email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const access_token = part({ alg: 'HS256', typ: 'JWT' }) + '.' + part({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.test-only'
  const records = []
  const pocket = { id: '33333333-3333-4333-8333-333333333333', title: 'Test saved text', kind: 'text', content: 'Invoice 12345', source: 'Tesseract', photoName: 'fixture.png', caveats: ['OCR can be wrong.'], evidence: [], savedAt: new Date().toISOString() }
  tab.on('pageerror', e => report.errors.push(e.message))
  await context.route('https://think-a-ling-test.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()); report.requests.push({ path: url.pathname, method: req.method() })
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/auth/v1/signup') { assert.equal(req.postDataJSON().email, user.email); return send({ user, session: null }) }
    if (url.pathname === '/auth/v1/token') return send({ access_token, token_type: 'bearer', expires_in: 3600, refresh_token: 'local-test-refresh', user })
    if (url.pathname === '/auth/v1/user') return send(user)
    if (url.pathname === '/auth/v1/logout') return send({})
    if (url.pathname === '/auth/v1/recover') return send({})
    if (url.pathname === '/rest/v1/discoveries') {
      assert.match(req.headers().authorization, /^Bearer ey/)
      if (req.method() === 'POST') { const row = req.postDataJSON(); assert.equal(row.owner_id, user.id); assert.equal(row.payload.content, pocket.content); assert(!JSON.stringify(row).includes('data:image')); records.push(row); return send(null, 201) }
      if (req.method() === 'DELETE') { records.length = 0; return send(null) }
      if (url.searchParams.get('select') === 'id') return send(records.filter(r => 'eq.' + r.id === url.searchParams.get('id')).map(r => ({ id: r.id })))
      return send(records.map(row => ({ payload: row.payload })))
    }
    return send({ message: 'Unexpected test request' }, 400)
  })
  try {
    await tab.goto('http://localhost:5174'); await dismissStory(tab)
    await tab.getByRole('button', { name: 'Account', exact: true }).click()
    await tab.getByRole('button', { name: 'Create account', exact: true }).click()
    await tab.getByLabel('Email', { exact: true }).fill(user.email)
    await tab.getByLabel('Password', { exact: false }).fill('Test-only-not-real-123!')
    await tab.getByRole('button', { name: 'Create account', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.account-dialog')?.textContent.includes('Check your email'))
    assert.equal(await tab.getByRole('button', { name: 'Sign out' }).count(), 0)
    await tab.getByRole('button', { name: 'Sign in', exact: true }).click()
    await tab.getByLabel('Password', { exact: false }).fill('Test-only-not-real-123!')
    await tab.getByRole('button', { name: 'Sign in', exact: true }).click()
    await tab.getByRole('button', { name: 'Sign out' }).waitFor()
    await tab.getByRole('button', { name: 'Close account' }).click()
    await tab.evaluate(p => localStorage.setItem('think-a-ling.pockets.v1', JSON.stringify([p])), pocket)
    await tab.getByRole('button', { name: 'Saved', exact: true }).click()
    await tab.getByText('Choose device discoveries to sync', { exact: true }).click()
    await tab.getByRole('button', { name: 'Sync this discovery', exact: true }).click()
    await tab.waitForFunction(() => document.querySelector('.account-history')?.textContent.includes('Discovery synced'))
    await tab.locator('.account-history .pocket-entry > summary').click()
    assert.match(await tab.locator('.account-history .pocket-content').innerText(), /Invoice 12345/)
    await tab.getByRole('button', { name: 'Delete account copy' }).click()
    await tab.waitForFunction(() => document.querySelector('.account-history')?.textContent.includes('Removed from account'))
    assert.equal(records.length, 0)
    assert.equal(await tab.evaluate(() => JSON.parse(localStorage.getItem('think-a-ling.pockets.v1')).length), 1)
    await tab.getByRole('button', { name: 'Close saved discoveries' }).click()
    await tab.getByRole('button', { name: 'Account', exact: true }).click()
    await tab.getByRole('button', { name: 'Sign out' }).click()
    await tab.waitForFunction(() => document.querySelector('.account-dialog')?.textContent.includes('Signed out.'))
    assert.deepEqual(report.errors, [])
    report.checks.push('Real SDK signup confirmation, sign-in, authenticated explicit upload/list/delete and signout wiring; account deletion of a discovery preserves its device copy; no image upload')
  } catch (error) { report.failure = error.stack; await tab.screenshot({ path: 'test-results/account-ui-failure.png', fullPage: true }) }
  finally { await context.close() }
  return report
}
