// Setup only: inference never calls these remote URLs. No extra packages required.
import { copyFile, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'public/ai')
const manifest = []
async function record(relative, source) {
  const bytes = await readFile(path.join(output, relative))
  manifest.push({ file: relative, source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
async function copy(relative, source) {
  await mkdir(path.dirname(path.join(output, relative)), { recursive: true })
  await copyFile(path.join(root, source), path.join(output, relative))
  await record(relative, source)
}
async function download(relative, url, validate) {
  const target = path.join(output, relative)
  await mkdir(path.dirname(target), { recursive: true })
  try { await access(target) } catch {
    console.log('Downloading ' + relative)
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(url + ': HTTP ' + response.status)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!validate(bytes)) throw new Error('Unexpected asset format: ' + relative)
    await writeFile(target, bytes)
  }
  if (!validate(await readFile(target))) throw new Error('Invalid asset: ' + relative)
  await record(relative, url)
}
for (const file of await readdir(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm'))) {
  if (/\.(js|wasm)$/.test(file)) await copy('mediapipe/' + file, 'node_modules/@mediapipe/tasks-vision/wasm/' + file)
}
await copy('tesseract/worker.min.js', 'node_modules/tesseract.js/dist/worker.min.js')
// Include LSTM scalar, SIMD and relaxed SIMD for browser feature selection.
for (const file of await readdir(path.join(root, 'node_modules/tesseract.js-core'))) {
  if (/-lstm\.wasm(\.js)?$/.test(file)) await copy('tesseract/core/' + file, 'node_modules/tesseract.js-core/' + file)
}
await copy('tesseract/LICENSE-core', 'node_modules/tesseract.js-core/LICENSE')
await copy('tesseract/LICENSE', 'node_modules/tesseract.js/LICENSE.md')
await download('models/efficientdet_lite0.tflite',
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
  bytes => bytes.length > 1_000_000 && bytes.toString('ascii', 4, 8) === 'TFL3')
await download('tesseract/lang/eng.traineddata.gz',
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz',
  bytes => bytes.length > 100_000 && bytes[0] === 31 && bytes[1] === 139)
const packages = {}
for (const name of ['@mediapipe/tasks-vision', 'tesseract.js', 'tesseract.js-core']) {
  packages[name] = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ packages, assets: manifest }, null, 2) + '\n')
console.log('Prepared ' + manifest.length + ' local assets (' + (manifest.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024).toFixed(1) + ' MiB).')
