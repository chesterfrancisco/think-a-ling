import { Download, Check, X } from 'lucide-react'
import { enableBrowserAi, removeBrowserAi, stopBrowserAi, useBrowserAi } from '../services/browserAi'

export function BrowserAiSetup() {
  const state = useBrowserAi()
  const loading = ['checking', 'downloading', 'compiling'].includes(state.status)
  return <div className="browser-ai-setup" aria-label="On-device AI setup">
    <strong>{state.status === 'ready' ? <><Check size={17} /> On-device AI ready</> : 'A little more understanding, on your device.'}</strong>
    <p>Experimental SmolVLM · short interpretations and answers. It can miss or invent details. Structured action checklists and deeper Gemma reasoning remain in the local app.</p>
    {state.status !== 'ready' && !loading && <><p>Optional download: about {Math.ceil(state.total / 1_000_000)} MB. Requires WebGPU and enough browser storage. Model files come from this site; your photos stay on your device.</p><button className="primary" onClick={() => void enableBrowserAi()}><Download size={17} />{state.status === 'error' ? 'Retry on-device AI' : 'Enable on-device AI'}</button></>}
    {loading && <div role="status"><p>{state.status === 'downloading' ? `Downloading & checking model · ${Math.min(100, Math.floor(state.loaded / state.total * 100))}%` : state.message}</p>{state.status === 'downloading' && <progress aria-label="Model download" max={state.total} value={state.loaded} />}<button onClick={() => stopBrowserAi()}><X size={15} /> Cancel setup</button></div>}
    {state.message && !loading && <p role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
    {state.status === 'ready' && <small>Ready for Analyze photo. Follow-ups use your saved photo context.</small>}
    {!loading && <button className="remove-browser-ai" disabled={state.busy} onClick={() => void removeBrowserAi()}>Remove downloaded model</button>}
  </div>
}
