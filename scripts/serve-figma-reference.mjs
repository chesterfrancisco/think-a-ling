// Run the unchanged exported UI in an isolated directory, never edit the export.
import { mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
const source = resolve('../thing-a-ling-figma')
const root = resolve('test-results/figma-reference')
await mkdir(resolve(root, 'src'), { recursive: true })
for (const file of ['index.html', 'src/App.tsx', 'src/main.tsx', 'src/index.css']) {
  await copyFile(resolve(source, file), resolve(root, file))
}
const server = await createServer({ configFile: false, root, plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true }, cacheDir: resolve(root, '.vite') })
await server.listen()
server.printUrls()
