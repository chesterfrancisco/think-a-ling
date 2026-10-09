import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, AudioLines, BookOpen, Focus, Leaf, ScanText, X } from 'lucide-react'
import type { DetectedObject } from '../services/objectDetection'
import type { LabelCorrection, SceneAnalysis, SceneTurn } from '../types/scene'
import type { ReasoningMode } from '../services/reasoning'
import { discoveryActions, discoveryCategory, discoveryExcerpt, discoveryGoal } from './objectDiscovery'
import { localReasoningAvailable } from '../services/ollama'

interface Props {
  detection: DetectedObject
  index: number
  displayName: string
  scene?: SceneAnalysis
  response?: SceneTurn
  ocr: { status: string; message: string; data: string }
  busy: boolean
  onClose: () => void
  onReadText: () => void
  onAction: (mode: ReasoningMode, goal: string, submit: boolean) => void
  correction?: LabelCorrection
  onCorrect: (label: string | null) => void
  onReplace: () => void
}

export function ObjectCard({ detection, index, displayName, scene, response, ocr, busy, onClose, onReadText, onAction, correction, onCorrect, onReplace }: Props) {
  const [editing, setEditing] = useState(false)
  const [labelError, setLabelError] = useState('')
  const close = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLElement>(null)
  useEffect(() => {
    close.current?.focus({ preventScroll: true })
    card.current?.scrollIntoView({ block: 'nearest' })
  }, [detection])
  const label = correction?.label ?? detection.label
  // A label edit cannot bypass the people-specific privacy boundary.
  const actionLabel = discoveryCategory(detection.label) === 'people' ? detection.label : label
  const category = discoveryCategory(actionLabel)
  const Icon = category === 'plants' ? Leaf : category === 'documents' ? BookOpen : Focus
  const text = ocr.status === 'done' ? ocr.data : scene?.ocr.text ?? ''
  const answer = response?.sceneId === scene?.id ? response : undefined
  return <aside ref={card} className="sheet object-detail-card" aria-label="Detected object details"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="sheet-handle" />
    <button ref={close} className="sheet-close" aria-label="Close object details" onClick={onClose}><X size={18} /></button>
    <div className="object-sheet">
      <div className="object-head"><span className="object-icon"><Icon size={22} /></span>
        <div><span className="sheet-kicker">A LITTLE DISCOVERY · {index + 1}</span><h2>{displayName}</h2></div>
      </div>
      <p className="object-read">{correction ? `Named by you. The AI originally guessed ${detection.label}.` : `This could be a ${detection.label}. Does that look right?`}</p>
      <p className="detection-confidence">{(detection.confidence * 100).toFixed(1)}% model confidence{correction ? ` in the original “${detection.label}” guess` : ''}<small>Not an accuracy rate. Objects can be missed or misidentified.</small></p>
      <button className="correct-label" disabled={busy} onClick={() => { setEditing(value => !value); setLabelError('') }}>{editing ? 'Cancel label edit' : correction ? 'Edit your label' : 'Correct this label'}</button>
      {editing && <form className="label-editor" onSubmit={event => {
        event.preventDefault()
        try { onCorrect(String(new FormData(event.currentTarget).get('label') ?? '')); setEditing(false); setLabelError('') }
        catch (error) { setLabelError(error instanceof Error ? error.message : String(error)) }
      }}>
        <label htmlFor="corrected-label">What is this object?</label><input id="corrected-label" name="label" defaultValue={label} required maxLength={60} autoComplete="off" />
        <button type="submit">Save label</button>{correction && <button type="button" onClick={() => { onCorrect(null); setEditing(false) }}>Use AI label</button>}
        <p>Your correction is for this photo. It does not retrain the detector.</p>
        {labelError && <p role="alert">{labelError}</p>}
      </form>}
      <p className="object-action-note">What would you like to do with this?</p>
      <div className="action-grid" aria-label={'Next actions for ' + label}>
        {discoveryActions(actionLabel, { ocrText: text, userGoal: answer?.intent.goal }).map(action => <button key={action.label} disabled={busy || (action.kind !== 'ocr' && !localReasoningAvailable)}
          title={action.kind !== 'ocr' && !localReasoningAvailable ? 'Requires the local app with Ollama' : undefined}
          onClick={() => action.kind === 'ocr' ? onReadText() : onAction(action.mode, discoveryGoal(action, detection, scene, correction?.label, answer?.intent.goal), action.kind !== 'ask')}>
          {action.kind === 'ask' ? <AudioLines size={16} /> : action.kind === 'ocr' ? <ScanText size={16} /> : <ArrowUpRight size={16} />}{action.label}
        </button>)}
      </div>
      {answer && <section className="discovery-answer" aria-label="Saved object response">
        <span className="sheet-kicker">FROM YOUR LOCAL AI · {answer.intent.mode}</span>
        {answer.response.status !== 'answered' && <p className="discovery-status">{answer.response.status === 'needs-more-evidence' ? 'More evidence needed' : 'No supported result'}</p>}
        <p>{discoveryExcerpt(answer.response.answer, 240)}</p>
        {answer.response.answer.length > 240 && <details><summary>Read full answer</summary><p>{answer.response.answer}</p></details>}
      </section>}
      {category === 'documents' && <section className="discovery-text" aria-label="Text from this photo" aria-live="polite">
        {ocr.status === 'loading' && <p role="status">{ocr.message}</p>}
        {ocr.status === 'error' && <p role="alert">{ocr.message} Select Read text to retry.</p>}
        {!!text && <><span className="sheet-kicker">RECOGNIZED TEXT · WHOLE PHOTO</span><p>{discoveryExcerpt(text)}</p>
          {text.length > 200 && <details><summary>Read all text</summary><p>{text}</p></details>}</>}
        {ocr.status === 'done' && !text && <p>No readable text found in this photo.</p>}
      </section>}
      <p className="object-action-note">{!localReasoningAvailable ? 'Object recognition and text reading work here. These deeper answers require the local app with Ollama.' : scene ? 'Scene saved. Keep exploring without rescanning.' : 'Choose an action to explore with local AI.'}</p>
      <button className="clearer-photo" onClick={onReplace}>Upload a clearer photo</button>
      <details className="discovery-evidence">
        <summary>About this recognition</summary>
        <p>The AI guessed {detection.label}. It can be mistaken; compare it with the photo. Some everyday items are outside its supported categories.</p>
        {answer && <>{answer.response.uncertainty_notes.map((note, i) => <p key={i}>{note}</p>)}<p>Suggested actions are possibilities, not verified facts.</p></>}
      </details>
    </div>
  </aside>
}
