// Test-only server. Never send these values to a real project or deployment.
// A separate Vite dependency cache prevents two differently configured servers
// from invalidating localhost's OCR worker imports.
import { createServer } from 'vite'
process.env.VITE_SUPABASE_URL = 'https://think-a-ling-test.supabase.co'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_browser_test_only'
const server = await createServer({ cacheDir: 'node_modules/.vite-account-tests', server: { host: 'localhost', port: 5174, strictPort: true } })
await server.listen()
console.log('Account HTTP simulation server: http://localhost:5174 (separate cache)')
