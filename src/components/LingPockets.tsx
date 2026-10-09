import { useEffect, useRef, useState } from 'react'
import { Bookmark, Trash2, X } from 'lucide-react'
import { clearPockets, deletePocket, readPockets, savePocket } from '../services/pockets'
import type { Pocket, PocketDraft } from '../services/pockets'

export function SaveDiscovery({ draft, compact = false }: { draft: PocketDraft; compact?: boolean }) {
  const [message, setMessage] = useState('')
  return <div className="save-discovery"><button type="button" onClick={() => {
    try { savePocket(draft); setMessage('Saved on this device. Find it in Saved.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this discovery.') }
  }} title="Save text and evidence on this device"><Bookmark size={16} /> Save this</button>{!compact && <small>Saved on this device · text only.</small>}{message && <p role="status">{message}</p>}</div>
}

export function LingPockets() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<Pocket[]>([])
  const [error, setError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  function refresh() { try { setItems(readPockets()); setError('') } catch { setError('Saved discoveries could not be read. Browser storage may be blocked or damaged.') } }
  useEffect(() => {
    window.addEventListener('think-pockets-change', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('think-pockets-change', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  function remove(id?: string) {
    try { if (id) deletePocket(id); else clearPockets(); setConfirmClear(false); refresh() }
    catch { setError('Could not remove saved discoveries. Check browser storage settings.') }
  }
  return <><button className="saved-nav" aria-label="Saved" title="Saved discoveries" onClick={() => { refresh(); setConfirmClear(false); dialog.current?.showModal() }}><Bookmark size={18} /><span>Saved</span></button>
    <dialog ref={dialog} className="help-dialog pockets-dialog" aria-labelledby="pockets-title">
      <button className="sheet-close" aria-label="Close saved discoveries" onClick={() => dialog.current?.close()}><X size={20} /></button>
      <span className="sheet-kicker">LING POCKETS</span><h2 id="pockets-title">Keep a useful discovery.</h2>
      <p>On this device: saved by you, without automatic history. Anyone using this browser profile can read these notes; clearing site data removes them.</p>
      {error && <p role="alert">{error}</p>}
      {!items.length && !error && <p className="empty">Nothing saved yet. Choose Save this on recognized text, a scene summary or an answer.</p>}
      {items.map(item => <details className="pocket-entry" key={item.id}><summary>{item.title}<small>{new Date(item.savedAt).toLocaleString()} · {item.source}</small></summary>
        <p className="pocket-content">{item.content}</p><p className="context-note">From: {item.photoName}. Original photo not stored. This is a saved result, not a new analysis.</p>
        <details><summary>Original evidence & uncertainty</summary>{item.caveats.map((note, i) => <p key={i}>{note}</p>)}{item.evidence.map(e => <p key={e.id}><strong>{e.id} · {e.source} · {e.kind}</strong><br />{e.description}</p>)}</details>
        <button aria-label={'Delete saved discovery: ' + item.title} onClick={() => remove(item.id)}><Trash2 size={15} /> Delete</button>
      </details>)}
      {(items.length > 0 || error) && (confirmClear ? <div className="clear-pockets"><p>Delete all saved discoveries from this browser?</p><button onClick={() => remove()}>Delete all saved discoveries</button><button onClick={() => setConfirmClear(false)}>Keep them</button></div> : <button className="clear-pockets" onClick={() => setConfirmClear(true)}>Clear saved discoveries</button>)}
    </dialog></>
}
