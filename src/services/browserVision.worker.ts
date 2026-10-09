import { AutoProcessor, AutoModelForVision2Seq, RawImage, TextStreamer, env } from '@huggingface/transformers'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/ai/'
const wasm = env.backends.onnx.wasm!
wasm.wasmPaths = {
  mjs: new URL('/ai/transformers/ort-wasm-simd-threaded.asyncify.mjs', self.location.origin).href,
  wasm: new URL('/ai/transformers/ort-wasm-simd-threaded.asyncify.wasm', self.location.origin).href,
}
wasm.numThreads = 1
wasm.proxy = false

let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
let model: Awaited<ReturnType<typeof AutoModelForVision2Seq.from_pretrained>>
let active = false
async function prepareCache() {
  const response = await fetch('/ai/browser-reasoning.json')
  if (!response.ok) throw new Error('Browser AI files are unavailable on this deployment. Retry after the deployment finishes; detection and text reading still work.')
  const manifest = await response.json()
  const cache = await caches.open('think-browser-ai-' + manifest.revision)
  const total = manifest.assets.reduce((sum: number, asset: { bytes: number }) => sum + asset.bytes, 0)
  let loaded = 0
  const hash = async (blob: Blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('')
  for (const asset of manifest.assets) {
    const url = new URL('/ai/' + asset.file, self.location.origin).href
    const saved = await cache.match(url)
    if (saved && await hash(await saved.blob()) === asset.sha256) { loaded += asset.bytes; self.postMessage({ type: 'download', loaded, total }); continue }
    if (saved) await cache.delete(url)
    const chunks: ArrayBuffer[] = []
    for (const file of asset.parts ?? [asset.file]) {
      const response = await fetch('/ai/' + file)
      if (!response.ok) throw new Error('Missing browser AI asset: ' + file)
      const reader = response.body!.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value.slice().buffer as ArrayBuffer); loaded += value.byteLength
        self.postMessage({ type: 'download', loaded, total })
      }
    }
    const blob = new Blob(chunks)
    if (blob.size !== asset.bytes || await hash(blob) !== asset.sha256) throw new Error('Model integrity check failed. Please retry the download.')
    await cache.put(url, new Response(blob))
  }
  env.useBrowserCache = false
  env.useCustomCache = true
  env.customCache = { match: (url: string) => cache.match(new URL(url, self.location.origin).href), put: (url: string, response: Response) => cache.put(new URL(url, self.location.origin).href, response) }
}
self.onmessage = async ({ data }) => {
  if (active) return
  active = true
  try {
    if (data.type === 'load') {
      await prepareCache()
      self.postMessage({ type: 'compiling' })
      processor = await AutoProcessor.from_pretrained('smolvlm500', { local_files_only: true })
      model = await AutoModelForVision2Seq.from_pretrained('smolvlm500', {
        device: 'webgpu', dtype: { embed_tokens: 'q8', vision_encoder: 'q4', decoder_model_merged: 'q4' },
        local_files_only: true, progress_callback: progress => self.postMessage({ type: 'progress', progress }),
      })
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'generate') {
      const start = performance.now()
      const picture = data.image ? await RawImage.fromBlob(data.image) : undefined
      const content = [...(picture ? [{ type: 'image' }] : []), { type: 'text', text: data.prompt }]
      const text = processor.apply_chat_template([{ role: 'user', content }], { add_generation_prompt: true, tokenize: false }) as string
      const inputs = picture ? await processor(text, picture, { do_image_splitting: false }) : processor.tokenizer!(text)
      let result = ''
      const streamer = new TextStreamer(processor.tokenizer!, { skip_prompt: true, skip_special_tokens: true, callback_function: part => { result += part; self.postMessage({ type: 'token', text: part }) } })
      await model.generate({ ...inputs, max_new_tokens: data.maxTokens ?? 160, do_sample: false, repetition_penalty: 1.1, streamer })
      self.postMessage({ type: 'result', text: result.trim(), elapsedMs: performance.now() - start })
    }
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }) }
  finally { active = false }
}
