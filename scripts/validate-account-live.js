import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dismissStory } from './dismiss-story.js'
// Non-destructive live checks: no user creation, email sending or valid login.
export default async function validateAccountLive(page) {
  const report = { checks: [], errors: [], kind: 'Live Supabase negative-access checks; positive cross-device login is a separate acceptance test' }
  const entries = (await readFile('.env.local', 'utf8')).trim().split(/\r?\n/).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)] })
  const env = Object.fromEntries(entries), headers = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
  const context = await page.context().browser().newContext(), tab = await context.newPage()
  tab.on('pageerror', e => report.errors.push(e.message))
  try {
    const settings = await fetch(env.VITE_SUPABASE_URL + '/auth/v1/settings', { headers, signal: AbortSignal.timeout(15000) })
    assert.equal(settings.status, 200)
    const data = await settings.json(); assert(data.external.email); assert(!data.disable_signup)
    for (const path of ['/rest/v1/discoveries?select=id&limit=0', '/rest/v1/rpc/delete_own_account']) {
      const response = await fetch(env.VITE_SUPABASE_URL + path, { headers, ...(path.includes('/rpc/') ? { method: 'POST', body: '{}' } : {}), signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 401); assert.equal((await response.json()).code, '42501')
    }
    await tab.goto('http://127.0.0.1:4173'); await dismissStory(tab)
    await tab.getByRole('button', { name: 'Account', exact: true }).click()
    await tab.getByLabel('Email', { exact: true }).fill('nonexistent-' + crypto.randomUUID() + '@example.invalid')
    await tab.getByLabel('Password', { exact: false }).fill(crypto.randomUUID())
    await tab.getByRole('button', { name: 'Sign in', exact: true }).click()
    await tab.locator('.account-dialog [role=alert]').waitFor({ timeout: 30000 })
    assert.match(await tab.locator('.account-dialog [role=alert]').innerText(), /invalid login credentials/i)
    assert(await tab.getByRole('button', { name: 'Sign in', exact: true }).isEnabled())
    assert.equal(await tab.getByRole('button', { name: 'Sign out', exact: true }).count(), 0)
    await context.setOffline(true)
    await tab.getByRole('button', { name: 'Sign in', exact: true }).click()
    assert.match(await tab.locator('.account-dialog [role=alert]').innerText(), /Reconnect/)
    assert.deepEqual(report.errors, [])
    report.checks.push('Live email provider and signup enabled; real table and account-delete RPC deny anonymous requests', 'Production UI rejects an invalid real login without claiming success, exits loading, and explains offline account actions')
  } catch (error) { report.failure = error.stack }
  finally { await context.close() }
  return report
}
