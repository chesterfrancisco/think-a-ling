import { readFile, writeFile, readdir, stat, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, relative } from 'node:path'
import { gunzipSync } from 'node:zlib'
const root = resolve('dist')
async function files(folder) {
  const entries = await readdir(folder, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(resolve(folder, e.name)) : resolve(folder, e.name)))).flat()
}
await copyFile(resolve(root, 'index.html'), resolve(root, '404.html'))
const base = JSON.parse(await readFile('public/ai/manifest.json', 'utf8'))
const brain = JSON.parse(await readFile('public/ai/browser-reasoning.json', 'utf8'))
const paths = [...new Set(['index.html', '404.html', 'favicon.svg', 'ai/manifest.json', 'ai/browser-reasoning.json', ...base.assets.map(a => 'ai/' + a.file), ...(await files(resolve(root, 'assets'))).filter(f => !f.endsWith('.wasm')).map(f => relative(root, f).replaceAll('\\', '/')), ...(await files(resolve(root, 'fonts'))).map(f => relative(root, f).replaceAll('\\', '/'))])]
const assets = await Promise.all(paths.map(async path => {
  const raw = await readFile(resolve(root, path))
  const decoded = path.endsWith('.gz') ? gunzipSync(raw) : undefined
  return { url: '/' + path, bytes: (await stat(resolve(root, path))).size, sha256: createHash('sha256').update(raw).digest('hex'), ...(decoded ? { decodedBytes: decoded.length, decodedSha256: createHash('sha256').update(decoded).digest('hex') } : {}) }
}))
for (const file of ['plant.png', 'landmark.png', 'study-notes.png', 'food.png', 'animal.png']) {
  const sample = await readFile(resolve(root, 'demo', file))
  assets.push({ url: '/demo/' + file, bytes: sample.length, sha256: createHash('sha256').update(sample).digest('hex') })
}
const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 16)
const template = await readFile('scripts/service-worker.template.js', 'utf8')
await writeFile(resolve(root, 'sw.js'), `const BUILD = ${JSON.stringify({ version, assets, brain: brain.assets.map(a => '/ai/' + a.file) })};\n` + template)
console.log(`Offline pack ${version}: ${assets.length} verified assets, ${(assets.reduce((s, a) => s + a.bytes, 0) / 1048576).toFixed(1)} MiB. Download is opt-in.`)
