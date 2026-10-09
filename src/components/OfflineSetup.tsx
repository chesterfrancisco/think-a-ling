import { useEffect, useRef, useState } from 'react'
import { Download, WifiOff } from 'lucide-react'
export function OfflineSetup() {
  const [online, setOnline] = useState(navigator.onLine)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [size, setSize] = useState(100)
  const [message, setMessage] = useState('Download the app, object detection and English text-reading files for offline use. Optional AI needs its own model download.')
  const [error, setError] = useState(false)
  const worker = useRef<ServiceWorker | undefined>(undefined)
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
    let active = true
    const handle = (data: { type: string; ready?: boolean; preparing?: boolean; total?: number; loaded?: number; message?: string }) => {
      if (!active) return
      if (data.total) setSize(Math.ceil(data.total / 1048576))
      if (data.type === 'offline-progress') setProgress(Math.floor(100 * (data.loaded ?? 0) / (data.total || 1)))
      if (data.type === 'offline-state') { setReady(!!data.ready); setBusy(!!data.preparing); if (data.ready) setMessage('Offline pack ready. Detection, English text reading and device saves can reopen offline. Optional AI needs its separate model download.') }
      if (data.type === 'offline-error') { setBusy(false); setError(true); setMessage(data.message ?? 'Could not prepare offline files.') }
    }
    const receive = (event: MessageEvent) => handle(event.data)
    navigator.serviceWorker.addEventListener('message', receive)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready).then(reg => {
      if (!active) return
      worker.current = reg.active ?? undefined
      const channel = new MessageChannel(); channel.port1.onmessage = event => { handle(event.data); channel.port1.close() }
      reg.active?.postMessage({ type: 'offline-status' }, [channel.port2])
    }).catch(() => { if (active) { setError(true); setMessage('Offline setup is unavailable in this browser. Keep this page open or try a regular browser window.') } })
    return () => { active = false; navigator.serviceWorker.removeEventListener('message', receive); window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  return <details className="offline-setup"><summary>{online ? ready ? 'Offline pack ready' : 'Offline downloads' : 'You’re offline'} {!online && <WifiOff size={16} />}</summary>
    <p className={error ? 'error' : ready ? 'success-notice' : ''} role="status">{message}</p>
    {import.meta.env.DEV ? <p>Offline downloads are available on the public website.</p> : !('serviceWorker' in navigator) ? <p className="warning-notice">This browser cannot prepare offline reload. Keep this page open or use a browser with service-worker support.</p> : <>
      {!ready && <button disabled={busy || !online} onClick={() => { if (!worker.current) { setError(true); setMessage('Offline setup is still starting. Try again shortly.'); return } setError(false); setBusy(true); setProgress(0); worker.current.postMessage({ type: 'offline-prepare' }) }}><Download size={16} /> Prepare for offline · {size} MB</button>}
      {busy && <><progress value={progress} max={100} aria-label="Offline download progress" /><span>{progress}% of files ready</span><button className="danger-action" onClick={() => worker.current?.postMessage({ type: 'offline-cancel' })}>Cancel download</button></>}
    </>}
    <p>Browser storage can be cleared or evicted. Recheck readiness before going offline. Photos are not included in this download.</p>
  </details>
}
