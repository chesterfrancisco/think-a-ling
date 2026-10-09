import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cleanLabel } from '../services/labelCorrections'
import type { ManualTag } from '../services/manualTags'

export function ManualTagEditor({ tag, existing, onSave, onDelete, onClose }: {
  tag: ManualTag; existing: boolean; onSave: (tag: ManualTag) => void; onDelete: () => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState(tag.label)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal(); input.current?.focus() }, [])
  return <dialog ref={dialog} className="help-dialog manual-tag-editor" aria-labelledby="tag-title" onClose={onClose}>
    <button className="sheet-close" aria-label="Close tag editor" onClick={onClose}><X size={20} /></button>
    <span className="sheet-kicker">ADDED BY YOU</span>
    <h2 id="tag-title">{existing ? 'Edit your tag' : 'What did Ling miss?'}</h2>
    <p>You placed this pin. It has no AI confidence score and doesn’t change what the models detected.</p>
    <form onSubmit={event => {
      event.preventDefault()
      try { onSave({ ...tag, label: cleanLabel(label) }) }
      catch (issue) { setError(issue instanceof Error ? issue.message : 'Please enter a short name.') }
    }}>
      <label htmlFor="manual-tag-name">Object name</label>
      <input ref={input} id="manual-tag-name" value={label} maxLength={60} placeholder="For example, person or pen" autoComplete="off" aria-describedby="tag-note" onChange={event => { setLabel(event.target.value); setError('') }} />
      {error && <p role="alert" className="error">{error}</p>}
      <p id="tag-note">An annotation for this photo only. It isn’t saved after you change photos or leave, and isn’t used as AI evidence or for training.</p>
      <div className="tag-editor-actions"><button className="primary" type="submit">Save tag</button><button type="button" onClick={onClose}>Cancel</button>
        {existing && <button className="remove-tag" type="button" onClick={onDelete}>Remove tag</button>}</div>
    </form>
  </dialog>
}
