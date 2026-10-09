import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const report = { date: new Date().toISOString(), checks: [] }
const origin = 'http://localhost:5173'
const headers = { 'Content-Type': 'application/json', 'X-Think-A-Ling': 'local-reasoning', Origin: origin }
try {
  for (const [name, path, method, extra, expected] of [
    ['Missing app header', '/local-ollama/api/chat', 'POST', { 'X-Think-A-Ling': '' }, 403],
    ['Foreign origin', '/local-ollama/api/chat', 'POST', { Origin: 'https://example.com' }, 403],
    ['Opaque origin', '/local-ollama/api/chat', 'POST', { Origin: 'null' }, 403],
    ['Unexpected Host (rejected by Vite HTTP layer)', '/local-ollama/api/chat', 'POST', { Host: 'example.com:5173' }, 400],
    ['Form submission', '/local-ollama/api/chat', 'POST', { 'Content-Type': 'application/x-www-form-urlencoded' }, 403],
    ['Unsupported method', '/local-ollama/api/chat', 'GET', {}, 405],
    ['Model management path', '/local-ollama/api/pull', 'POST', {}, 405],
    ['Chat with query string', '/local-ollama/api/chat?x=1', 'POST', {}, 405],
  ]) {
    const response = await fetch(origin + path, { method, headers: { ...headers, ...extra }, ...(method === 'POST' ? { body: '{}' } : {}) })
    assert.equal(response.status, expected, name)
    report.checks.push({ name, status: response.status })
  }
  const preview = await fetch('http://127.0.0.1:4173/local-ollama/api/chat', { method: 'POST', headers, body: '{}' })
  assert(preview.status >= 400 || !(preview.headers.get('content-type') ?? '').includes('application/json'), 'Preview must not proxy Ollama')
  report.checks.push({ name: 'Production preview has no Ollama bridge', status: preview.status })
} catch (error) { report.failure = String(error); process.exitCode = 1 }
await mkdir('test-results', { recursive: true })
await writeFile('test-results/security-audit.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
