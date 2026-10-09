import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePublicAccountConfig } from '../src/services/publicAccountConfig.ts'
test('public account configuration fails closed before privileged keys can be bundled', () => {
  const url = 'https://example.supabase.co'
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature'
  assert.equal(validatePublicAccountConfig(), false)
  assert(validatePublicAccountConfig(url, 'sb_publishable_example'))
  assert(validatePublicAccountConfig(url, jwt('anon')))
  for (const key of ['sb_secret_example', jwt('service_role'), jwt('authenticated'), 'invalid']) assert.throws(() => validatePublicAccountConfig(url, key), /publishable or legacy anon/)
  assert.throws(() => validatePublicAccountConfig('http://example.supabase.co', 'sb_publishable_example'))
  assert.throws(() => validatePublicAccountConfig(url))
})
