import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const root = new URL('../', import.meta.url)
const assetRoot = process.argv.includes('--dist') ? 'dist/ai/' : 'public/ai/'
try {
  const manifest = JSON.parse(await readFile(new URL('public/ai/manifest.json', root), 'utf8'))
  if (assetRoot === 'dist/ai/') {
    const published = JSON.parse(await readFile(new URL('dist/ai/manifest.json', root), 'utf8'))
    if (JSON.stringify(published) !== JSON.stringify(manifest)) throw new Error('Production AI manifest differs from the source assets.')
  }
  for (const [name, version] of Object.entries(manifest.packages)) {
    const installed = JSON.parse(await readFile(new URL('node_modules/' + name + '/package.json', root), 'utf8')).version
    if (installed !== version) throw new Error(name + ' has changed; refresh its local assets.')
  }
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(assetRoot + asset.file, root))
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
      throw new Error('Local AI asset is corrupt: ' + asset.file)
    }
  }
  console.log('Verified all ' + manifest.assets.length + ' local AI assets and package versions in ' + assetRoot + '.')
} catch (error) {
  console.error(error.message + '\nRun npm run setup:ai before building. No runtime CDN fallback is used.')
  process.exitCode = 1
}
