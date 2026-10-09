import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Camera, Focus, ImageUp, ScanText, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { Mascot } from './Mascot'

type Props = {
  busy: boolean
  onCamera: () => void
  onChoose: () => void
  onFile: (file: File) => Promise<void>
  onExample: (file: File, question: string) => Promise<void>
  onError: (message: string) => void
}

const examples = [
  { file: 'plant.png', question: 'What plant is this?' },
  { file: 'landmark.png', question: 'Tell me about this landmark' },
  { file: 'study-notes.png', question: 'Summarize this document' },
  { file: 'food.png', question: 'What’s in this food?' },
  { file: 'animal.png', question: 'Identify this animal' },
]

export function HomeDashboard({ busy, onCamera, onChoose, onFile, onExample, onError }: Props) {
  const [dragging, setDragging] = useState(false)
  const [exampleLoading, setExampleLoading] = useState(false)
  const download = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => download.current?.abort(), [])
  const disabled = busy || exampleLoading

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    if (event.dataTransfer.files.length !== 1) { onError('Drop one photo at a time.'); return }
    void onFile(event.dataTransfer.files[0])
  }

  async function example(sample: typeof examples[number]) {
    if (disabled) return
    const controller = new AbortController()
    download.current = controller
    setExampleLoading(true)
    onError('')
    try {
      const response = await fetch('/demo/' + sample.file, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      if (!response.ok) throw new Error('The example is unavailable. Choose your own photo or try again.')
      const blob = await response.blob()
      if (!controller.signal.aborted) await onExample(new File([blob], 'example-' + sample.file, { type: 'image/png' }), sample.question)
    } catch (error) {
      if (!controller.signal.aborted) onError(error instanceof Error ? error.message : 'The example could not be opened. Try again.')
    } finally {
      if (!controller.signal.aborted) setExampleLoading(false)
    }
  }

  return <div className="welcome dashboard-home">
    <div className="mascot-welcome dashboard-ling">
      <div className="ling-thought">Look closer.<br />Think a little bigger.<Sparkles size={18} aria-hidden="true" /></div>
      <ArrowDownRight className="ling-thought-arrow" size={37} aria-hidden="true" />
      <div className="mascot-orbit"><Mascot /></div>
      <span className="mascot-greeting">Hi, I’m Ling!</span>
      <p>A little perspective.<br />A useful next step.</p>
    </div>

    <section className={'dashboard-capture' + (dragging ? ' is-dragging' : '')} aria-label="Start with a photo"
      onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; if (!disabled) setDragging(true) } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={drop}>
      <div className="camera-orbit">
        <span className="orbit-spark orbit-spark-one" aria-hidden="true" />
        <span className="orbit-spark orbit-spark-two" aria-hidden="true" />
        <button className="camera-launch" aria-label="Use camera" disabled={disabled} onClick={onCamera}>
          <Camera size={65} strokeWidth={1.6} aria-hidden="true" />
          <strong>Open camera</strong><span>Start with what’s here</span>
        </button>
      </div>
      <div className="dashboard-upload"><button className="upload-btn" aria-label="Upload a photo" disabled={disabled} onClick={onChoose}><ImageUp size={21} aria-hidden="true" /> Choose a photo <ArrowUpRight size={17} aria-hidden="true" /></button>
        <span className="drop-hint"><Upload size={15} aria-hidden="true" />{dragging ? 'Release to open your photo' : 'or drop a photo here'}</span></div>
      <span className="file-hint">JPEG, PNG, WebP or BMP · up to 20 MB</span>
    </section>

    <ul className="dashboard-possibilities" aria-label="What you can explore">
      <li><span className="possibility-icon"><Focus size={24} aria-hidden="true" /></span><span><strong>Notice the details</strong><small>Explore objects around you.</small></span></li>
      <li><span className="possibility-icon"><ScanText size={24} aria-hidden="true" /></span><span><strong>Make words useful</strong><small>Read, find and save text.</small></span></li>
      <li><span className="possibility-icon"><Sparkles size={24} aria-hidden="true" /></span><span><strong>Find your next step</strong><small>Ask a question with local AI.</small></span></li>
    </ul>

    <div className="dashboard-bottom">
      <span className="welcome-note"><ShieldCheck size={17} aria-hidden="true" /> No account needed. Photos stay on your device.</span>
      <section className="inspiration" aria-labelledby="inspiration-title" aria-busy={exampleLoading}>
        <div className="inspiration-heading"><h2 id="inspiration-title"><Sparkles size={18} aria-hidden="true" /> Need inspiration?</h2><span>Try these <ArrowUpRight size={15} aria-hidden="true" /></span></div>
        <div className="inspiration-grid">{examples.map(sample => <button key={sample.file} disabled={disabled} onClick={() => void example(sample)}>
          <img src={'/demo/' + sample.file} alt="" width="64" height="64" loading="lazy" /><span>{sample.question}</span>
        </button>)}</div>
      </section>
      {exampleLoading && <span role="status" className="example-status">Opening example…</span>}
    </div>
  </div>
}
