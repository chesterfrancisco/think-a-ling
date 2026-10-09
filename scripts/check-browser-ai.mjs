import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const dir = process.argv.includes('--dist') ? 'dist/ai/' : 'public/ai/'
const manifest = JSON.parse(await readFile(new URL(dir + 'browser-reasoning.json', root), 'utf8'))
for (const [name, version] of Object.entries(manifest.packages)) {
  if (JSON.parse(await readFile(new URL('node_modules/' + name + '/package.json', root), 'utf8')).version !== version) throw new Error('Refresh browser model runtime assets after changing ' + name)
}
for (const asset of manifest.assets) {
  const hash = createHash('sha256'); let size = 0
  for (const part of asset.parts ?? [asset.file]) { const data = await readFile(new URL(dir + part, root)); hash.update(data); size += data.length }
  if (size !== asset.bytes || hash.digest('hex') !== asset.sha256) throw new Error('Browser model asset failed integrity check: ' + asset.file)
}
console.log('Verified browser model and runtime assets in ' + dir)
