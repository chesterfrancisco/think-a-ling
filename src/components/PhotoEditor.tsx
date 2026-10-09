import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { UploadedImage } from '../services/image'
import { defaultPhotoEdits, renderEditedPhoto } from '../services/photoEdit'
export function PhotoEditor({ image, onApply, onClose }: { image: UploadedImage; onApply: (file: File) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const [edits, setEdits] = useState(defaultPhotoEdits)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; dialog.current?.showModal(); return () => { active.current = false } }, [])
  useEffect(() => { if (canvas.current) renderEditedPhoto(image.element, edits, canvas.current) }, [image, edits])
  const sliders = [
    { key: 'left', label: 'Crop from left', min: 0, max: 90 }, { key: 'top', label: 'Crop from top', min: 0, max: 90 },
    { key: 'width', label: 'Crop width', min: 10, max: 100 - edits.left }, { key: 'height', label: 'Crop height', min: 10, max: 100 - edits.top },
    { key: 'brightness', label: 'Brightness', min: 50, max: 150 }, { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  ] as const
  return <dialog className="help-dialog photo-editor" ref={dialog} onCancel={onClose} aria-labelledby="edit-title"><button className="sheet-close" aria-label="Close photo editor" onClick={onClose}><X size={20} /></button>
    <h2 id="edit-title">Give Ling a clearer view.</h2><p>Crop distractions, rotate, flip or adjust brightness. Use the sliders with touch or arrow keys. Applying creates a new image and rescans it; old answers and tags are cleared.</p>
    <canvas ref={canvas} aria-label="Edited photo preview" role="img" />
    <div className="edit-controls">{sliders.map(({ key, label, min, max }) => <label key={key}>{label}: {edits[key]}%<input type="range" min={min} max={max} value={edits[key]} onChange={e => setEdits(old => { const next = { ...old, [key]: Number(e.target.value) }; next.width = Math.min(next.width, 100 - next.left); next.height = Math.min(next.height, 100 - next.top); return next })} /></label>)}</div>
    <button onClick={() => setEdits(old => ({ ...old, rotation: (old.rotation + 90) % 360 }))}>Rotate 90°</button><button aria-pressed={edits.flip} onClick={() => setEdits(old => ({ ...old, flip: !old.flip }))}>Flip horizontally</button><button onClick={() => setEdits(defaultPhotoEdits)}>Reset edits</button>
    <p>Edits stay on your device. The edited image is limited to 2048 pixels on its longest side. Adjustments can change recognition; they do not reveal missing detail.</p>
    {error && <p role="alert" className="error">{error}</p>}<button disabled={busy} onClick={() => { setBusy(true); canvas.current!.toBlob(blob => { if (!active.current) return; if (!blob) { setBusy(false); setError('Could not create the edited photo. Try again.'); return } onApply(new File([blob], 'edited-' + image.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })) }, 'image/png') }}>Apply edits and rescan</button><button disabled={busy} onClick={onClose}>Keep original</button>
  </dialog>
}
