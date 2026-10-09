// Optional test runner. Uses an existing Playwright installation; no app dependency is added.
// node scripts/run-browser-check.mjs <suite> [absolute path to playwright/index.mjs]
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const suite = process.argv[2] || 'validate-milestone1'
if (!/^[a-z0-9-]+$/.test(suite)) throw new Error('Invalid suite name')
const { chromium } = process.argv[3] ? await import(pathToFileURL(resolve(process.argv[3])).href) : await import('playwright')
const { default: validate } = await import(pathToFileURL(resolve('scripts', suite + '.js')).href)
await mkdir('test-results', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  const result = await validate(page)
  await writeFile(resolve('test-results', suite + '.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ suite, browser: browser.version(), failure: result.failure,
    sceneMs: result.scene?.elapsedMs, turns: result.turns?.map(turn => ({ mode: turn.mode, elapsedMs: turn.elapsedMs })),
    checks: result.checks, requestCount: result.requests?.length, externalRequests: result.external ?? result.externalRequests,
  }, null, 2))
  if (result.failure) process.exitCode = 1
} finally { await browser.close() }
