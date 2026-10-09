// Pinned, same-origin browser model. Never downloads a user's photo.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const model = 'HuggingFaceTB/SmolVLM-500M-Instruct'
const revision = 'a7da5b986cb59b408707209984f360a5f4ad7e47'
const names = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'processor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'added_tokens.json', 'chat_template.json', 'README.md', 'onnx/embed_tokens_quantized.onnx', 'onnx/vision_encoder_q4.onnx', 'onnx/decoder_model_merged_q4.onnx']
const assets = []
await mkdir(new URL('public/ai/smolvlm500/onnx/', root), { recursive: true })
await mkdir(new URL('public/ai/transformers/', root), { recursive: true })
const tree = await (await fetch(`https://huggingface.co/api/models/${model}/tree/${revision}?recursive=true`)).json()
for (const name of names) {
  const file = 'smolvlm500/' + name
  const entry = tree.find(item => item.path === name)
  let data
  try { data = await readFile(new URL('public/ai/' + file, root)) } catch { /* Download missing files below. */ }
  const valid = value => value && value.length === entry.size && (!entry.lfs || createHash('sha256').update(value).digest('hex') === entry.lfs.oid)
  if (!valid(data)) {
    const response = await fetch(`https://huggingface.co/${model}/resolve/${revision}/${name}`)
    if (!response.ok) throw new Error(`Download ${name}: ${response.status}`)
    data = Buffer.from(await response.arrayBuffer())
    if (!valid(data)) throw new Error('Model size/hash mismatch: ' + name)
  }
  const parts = []
  const limit = 64 * 1024 * 1024
  if (data.length > 95 * 1024 * 1024) {
    for (let start = 0; start < data.length; start += limit) {
      const part = file + '.part' + parts.length
      await writeFile(new URL('public/ai/' + part, root), data.subarray(start, start + limit))
      parts.push(part)
    }
  } else { await writeFile(new URL('public/ai/' + file, root), data) }
  assets.push({ file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), ...(parts.length ? { parts } : {}) })
  console.log('Verified', file, data.length)
}
for (const name of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  const file = 'transformers/' + name
  await copyFile(new URL('node_modules/onnxruntime-web/dist/' + name, root), new URL('public/ai/' + file, root))
  const data = await readFile(new URL('public/ai/' + file, root))
  assets.push({ file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })
}
const packages = {}
await copyFile(new URL('node_modules/@huggingface/transformers/LICENSE', root), new URL('public/ai/transformers/LICENSE-Apache-2.0.txt', root))
for (const name of ['@huggingface/transformers', 'onnxruntime-web']) packages[name] = JSON.parse(await readFile(new URL('node_modules/' + name + '/package.json', root), 'utf8')).version
await writeFile(new URL('public/ai/browser-reasoning.json', root), JSON.stringify({ model, revision, license: 'Apache-2.0', packages, assets }, null, 2) + '\n')
console.log('Browser reasoning download bytes:', assets.reduce((sum, file) => sum + file.bytes, 0))
