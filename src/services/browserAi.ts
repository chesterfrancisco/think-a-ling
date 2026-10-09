import { useSyncExternalStore } from 'react'

type State = { status: 'idle' | 'checking' | 'downloading' | 'compiling' | 'ready' | 'error'; loaded: number; total: number; message: string; busy: boolean }
let state: State = { status: 'idle', loaded: 0, total: 373678114, message: '', busy: false }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const publish = (change: Partial<State>) => { state = { ...state, ...change }; listeners.forEach(fn => fn()) }
export function useBrowserAi() { return useSyncExternalStore(subscribe, () => state) }
let worker: Worker | undefined
let generation = 0
let pending: { resolve: (value: { text: string; elapsedMs: number }) => void; reject: (error: Error) => void; cleanup: () => void } | undefined

export function stopBrowserAi(message = 'Stopped. Downloaded model files can be reused when you enable AI again.') {
  generation++
  worker?.terminate(); worker = undefined
  const task = pending; pending = undefined; task?.cleanup(); task?.reject(new Error(message))
  publish({ status: 'idle', busy: false, message })
}

function send(type: 'load' | 'generate', payload: object, signal?: AbortSignal) {
  if (pending) return Promise.reject(new Error('Ling is already working. Wait or cancel the current request.'))
  return new Promise<{ text: string; elapsedMs: number }>((resolve, reject) => {
    const abort = () => stopBrowserAi('Analysis cancelled. Enable on-device AI again to reload the saved model.')
    const timer = window.setTimeout(() => { stopBrowserAi('On-device AI timed out. Try again or use detection and text reading.'); publish({ status: 'error' }) }, type === 'load' ? 600_000 : 90_000)
    pending = { resolve, reject, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) } }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) { abort(); return }
    worker!.postMessage({ type, ...payload })
  })
}

export async function enableBrowserAi() {
  if (state.status === 'ready' || pending) return
  const run = ++generation
  publish({ status: 'checking', message: 'Checking this device…', loaded: 0 })
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    if (!isSecureContext || !gpu || !await gpu.requestAdapter()) throw new Error('This device does not provide WebGPU. Try an updated Chrome or Edge on a compatible computer. Detection and text reading still work.')
    if (run !== generation) return
    if (!globalThis.caches) throw new Error('Browser model storage is unavailable. Try a regular browser window.')
    worker = new Worker(new URL('./browserVision.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      if (run !== generation) return
      if (data.type === 'download') publish({ status: 'downloading', loaded: data.loaded, total: data.total })
      if (data.type === 'compiling') publish({ status: 'compiling', message: 'Preparing the model for your device. First use may take longer.' })
      if (data.type === 'ready' || data.type === 'result') {
        const task = pending; pending = undefined; task?.cleanup()
        publish({ status: 'ready', busy: false, message: '' })
        task?.resolve({ text: data.text ?? '', elapsedMs: data.elapsedMs ?? 0 })
      }
      if (data.type === 'error') { stopBrowserAi(data.message); publish({ status: 'error', message: data.message }) }
    }
    worker.onerror = () => { if (run === generation) { stopBrowserAi('The browser AI worker stopped. Retry, or use detection and text reading.'); publish({ status: 'error' }) } }
    publish({ status: 'downloading', message: '' })
    await send('load', {})
  } catch (error) { if (run === generation) publish({ status: 'error', message: error instanceof Error ? error.message : String(error) }) }
}

export async function generateBrowserAnswer(prompt: string, signal: AbortSignal, image?: Blob) {
  if (state.status !== 'ready' || !worker) throw new Error('Enable on-device AI first. Your photo stays here while the model loads.')
  publish({ busy: true })
  return send('generate', { prompt, image, maxTokens: image ? 90 : 150 }, signal)
}

export async function removeBrowserAi() {
  stopBrowserAi('On-device AI disabled.')
  try {
    for (const name of await caches.keys()) if (name.startsWith('think-browser-ai-')) await caches.delete(name)
    publish({ loaded: 0, message: 'Saved AI model removed from this browser’s model cache.' })
  } catch { publish({ status: 'error', message: 'Could not clear model storage. You can also clear this website’s data in browser settings.' }) }
}
