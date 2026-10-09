import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// This bridge is never installed in preview or production hosting.
function localOllamaGuard(): Plugin {
  return {
    name: 'loopback-only-ollama',
    apply: 'serve',
    configResolved(config) {
      if (!['localhost', '127.0.0.1', '::1'].includes(String(config.server.host))) {
        throw new Error('think-a-ling local reasoning requires a loopback Vite host. Public/LAN binding is disabled.')
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/local-ollama')) return next()
        const address = req.socket.remoteAddress
        const loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
        const host = req.headers.host ?? ''
        const validHost = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)
        const origin = req.headers.origin
        if (!loopback || !validHost || (origin && origin !== 'http://' + host) ||
          req.headers['x-think-a-ling'] !== 'local-reasoning' ||
          !req.headers['content-type']?.startsWith('application/json')) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Only same-origin local reasoning requests are allowed.' }))
        }
        if (req.url !== '/local-ollama/api/chat' || req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Only POST /api/chat is available.' }))
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localOllamaGuard()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '^/local-ollama/api/chat$': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: path => path.replace('/local-ollama', ''),
        timeout: 185_000,
        proxyTimeout: 185_000,
        configure(proxy) {
          proxy.on('proxyReq', (upstream, req, res) => {
            // Browser cancellation must also close the local generation request.
            req.on('aborted', () => upstream.destroy())
            res.on('close', () => { if (!res.writableFinished) upstream.destroy() })
          })
        },
      },
    },
  },
  // Vite otherwise inherits server.proxy in preview.
  preview: { host: '127.0.0.1', proxy: {} },
})
