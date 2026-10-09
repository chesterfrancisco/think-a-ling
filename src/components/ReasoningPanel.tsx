import { useEffect, useMemo, useRef, useState } from 'react'
import type { UploadedImage } from '../services/image'
import type { DetectedObject } from '../services/objectDetection'
import { localReasoningAvailable as ollamaAvailable } from '../services/ollama'
import { useBrowserAi } from '../services/browserAi'
import { BrowserAiSetup } from './BrowserAiSetup'
import { buildScene } from '../services/sceneAnalysis'
import { answerIntent } from '../services/intentEngine'
import type { ReasoningMode } from '../services/reasoning'
import type { LabelCorrection, SceneAnalysis, SceneTurn } from '../types/scene'
import './ReasoningPanel.css'
import { Mascot } from './Mascot'
import { AnalysisProgress } from './AnalysisProgress'
import { applyLabelCorrections } from '../services/labelCorrections'
import { intentPresentation, sceneSuggestions } from '../services/sceneSuggestions'
import { sceneObjectForDetection } from '../services/objectSelection'
import { discoveryKey } from './objectDiscovery'
import { LingSteps } from './LingSteps'
import { lingStepsKey } from '../services/lingSteps'
import type { LingStepsState } from '../services/lingSteps'
import { SaveDiscovery } from './LingPockets'
import { pocketFromTurn } from '../services/pockets'
import { VoiceInput } from './VoiceInput'
import { modeForGoal } from '../services/modeRelevance'
import type { AnswerLanguage } from '../services/preferences'
import { MessageCircle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { excludeDismissedDetections } from '../services/dismissedDetections'

interface Props {
  language: AnswerLanguage
  dismissed: DetectedObject[]
  image?: UploadedImage
  detections: DetectedObject[] | null
  ocrText: string | null
  processing: boolean
  onBuildingChange: (value: boolean) => void
  onDetections: (value: DetectedObject[]) => void
  onOcr: (value: string) => void
  mode: ReasoningMode
  goalRequest?: { id: number; text: string; submit?: boolean; displayText?: string }
  onSceneChange?: (scene: SceneAnalysis) => void
  onTurnComplete?: (turn: SceneTurn, objectKey?: string) => void
  objectFocus?: DetectedObject
  objectLabel?: string
  autoBuild?: boolean
  corrections: LabelCorrection[]
  onVoiceMode?: (mode: ReasoningMode) => void
  visible?: boolean
  voiceRequest?: number
}

const sourceNames = { mediapipe: 'Object recognition', tesseract: 'Text in the photo', gemma: 'Gemma interpretation', smolvlm: 'Experimental browser interpretation', user: 'Your label correction' }
function EvidenceReferences({ ids, scene }: { ids: string[]; scene: SceneAnalysis }) {
  return <div className="evidence-references">{[...new Set(ids)].map(id => {
    const item = scene.evidence.find(evidence => evidence.id === id)
    return item ? <small key={id}>{sourceNames[item.source]} · {item.kind === 'inferred' ? 'possible interpretation' : 'what the AI noticed'}: {item.description}</small> : null
  })}</div>
}

function IntentResult({ turn, scene, stepsState, onStepsChange, onAskAgain }: { turn: SceneTurn; scene: SceneAnalysis; stepsState?: LingStepsState; onStepsChange: (value: LingStepsState) => void; onAskAgain: (question?: string) => void }) {
  const response = turn.response
  const [feedback, setFeedback] = useState<'helpful' | 'unclear'>()
  return <article className="intent-result" data-mode={turn.intent.mode}>
    <h3>{response.suggestions.length ? 'Here’s what you can try.' : 'Ling’s answer'}</h3>
    <p className="visually-hidden" role="status">Answer ready</p>
    {response.status !== 'answered' && <p className="local-notice">{response.status === 'no-supported-result' ? 'No supported result for this goal.' : 'More evidence is needed.'}</p>}
    <p>{response.answer}</p>
    <LingSteps turn={turn} scene={scene} state={stepsState} onChange={onStepsChange} />
    <div className="answer-actions"><SaveDiscovery compact draft={pocketFromTurn(scene, turn)} /><button type="button" onClick={() => onAskAgain()}><MessageCircle size={16} /> Ask again</button></div>
    <div className="answer-feedback" aria-label="Was this answer useful?"><span>Was this useful?</span><button type="button" aria-pressed={feedback === 'helpful'} onClick={() => setFeedback('helpful')}><ThumbsUp size={16} /> Helpful</button><button type="button" aria-pressed={feedback === 'unclear'} onClick={() => { setFeedback('unclear'); onAskAgain(turn.intent.goal) }}><ThumbsDown size={16} /> Not quite</button></div>
    {feedback && <p className="feedback-note" role="status">{feedback === 'helpful' ? 'Marked helpful for this visit.' : 'Edit your question to tell Ling what seems wrong, then ask again.'}</p>}
    <small className="answer-caution">AI can make mistakes. Check against your photo.</small>
    <details className="answer-evidence"><summary>Why this answer?</summary>
    {turn.grounding.warnings.map((warning, i) => <p className="local-notice" key={i}>{warning}</p>)}
    {!!turn.grounding.answerTextMatches?.length && <div className="answer-text-matches"><h4>Matching text from your photo</h4><p className="context-note">These lines also appear in the answer. Text matches do not verify the rest of the interpretation.</p><EvidenceReferences ids={turn.grounding.answerTextMatches} scene={scene} /></div>}
    
    <p className="context-note">Answered from the same scene in {(turn.elapsedMs / 1000).toFixed(1)}s. No image analysis rerun.</p>
    {!!response.observations.length && <><h4>Observed information — model interpretation</h4><ul>
      {response.observations.map((item, i) => <li key={i}>{item.statement}<EvidenceReferences ids={item.evidence_ids} scene={scene} /></li>)}
    </ul></>}
    <h4>Uncertainty</h4>
    {response.uncertainty_notes.length ? <ul>{response.uncertainty_notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
      : <p>The model supplied no extra notes. Its claims and evidence links can still be incorrect.</p>}
    
    </details>
    {!!response.suggestions.length && <h4>Suggested next actions · possibilities, not verified fixes</h4>}
    {response.suggestions.length ? <ul>{response.suggestions.map((item, i) => <li key={i}>
      <strong>{item.title}</strong><p>{item.description}</p>
      <details><summary>Evidence & uncertainty</summary><EvidenceReferences ids={item.evidence_ids} scene={scene} /><small>Uncertainty: {item.uncertainty}</small></details>
    </li>)}</ul> : null}
    {turn.intent.mode === 'FIX' && <><h4>Visible issues and checks</h4>
      {response.issues.length ? <ul>{response.issues.map((item, i) => <li key={i}>
        <strong>{item.description}</strong><EvidenceReferences ids={item.evidence_ids} scene={scene} />
        {item.checks.map((check, j) => <p key={j}>Suggested check (not a diagnosis): {check}</p>)}
      </li>)}</ul> : <p>{scene.reasoner === 'browser' ? 'Browser mode has not performed a structured issue assessment. Any checks above are unverified suggestions.' : 'No evidence-supported visible issues reported. This does not certify safety or rule out hidden problems.'}</p>}
    </>}
    {!!turn.grounding.studyCards.length && <><h4>Study cards — answers matched to recognized text</h4>
      {turn.grounding.studyCards.map((card, i) => <details className="study-card" key={i}>
        <summary>{card.question}</summary><p>{card.answer}</p><EvidenceReferences ids={card.evidence_ids} scene={scene} />
      </details>)}
    </>}
  </article>
}

export function ReasoningPanel({ language, dismissed, image, detections, ocrText, processing, onBuildingChange, onDetections, onOcr, mode, goalRequest, autoBuild = false, onSceneChange, onTurnComplete, corrections, objectFocus, objectLabel, onVoiceMode, visible = true, voiceRequest = 0 }: Props) {
  const browserAi = useBrowserAi()
  const localReasoningAvailable = ollamaAvailable || browserAi.status === 'ready'
  const [scene, setScene] = useState<SceneAnalysis>()
  const correctedScene = useMemo(() => scene ? excludeDismissedDetections(applyLabelCorrections(scene, corrections), dismissed) : undefined, [scene, corrections, dismissed])
  const previousCorrections = useRef(corrections)
  const previousDismissed = useRef(dismissed)
  const [goal, setGoal] = useState('')
  const [appliedGoal, setAppliedGoal] = useState(goalRequest)
  if (goalRequest !== appliedGoal) {
    setAppliedGoal(goalRequest)
    setGoal('')
  }
  const [turns, setTurns] = useState<SceneTurn[]>([])
  const [stepLists, setStepLists] = useState<Record<string, LingStepsState>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'cancelled'>('idle')
  const [phase, setPhase] = useState<'scene' | 'intent'>('scene')
  const [message, setMessage] = useState('')
  const request = useRef<AbortController | undefined>(undefined)
  const generation = useRef(0)
  const previousMode = useRef(mode)
  const automaticStarted = useRef(false)
  const submittedAction = useRef<number | undefined>(undefined)
  const focusKey = objectFocus ? discoveryKey(objectFocus) : undefined
  const latestFocus = useRef(focusKey)
  const previousFocus = useRef(focusKey)
  const previousGoalId = useRef(goalRequest?.id)
  const requestPhase = useRef<'scene' | 'intent'>('scene')
  const [lastQuestion, setLastQuestion] = useState('')
  const [activeRun, setActiveRun] = useState(0)
  const [previousDuration, setPreviousDuration] = useState<Partial<Record<'scene' | 'intent', number>>>({})
  const focusedObject = objectFocus ? sceneObjectForDetection(correctedScene, objectFocus) : undefined
  const visibleTurns = turns.filter(turn => turn.sceneId === scene?.id && (objectFocus ? !!focusedObject && turn.intent.objectId === focusedObject.id : !turn.intent.objectId))

  useEffect(() => {
    latestFocus.current = focusKey
    if (previousFocus.current === focusKey && previousGoalId.current === goalRequest?.id) return
    previousFocus.current = focusKey
    previousGoalId.current = goalRequest?.id
    setGoal('')
    setLastQuestion('')
    // A shared image analysis can finish for any object. A question belongs only
    // to its original selection and must not arrive in the newly selected chat.
    if (request.current && requestPhase.current === 'scene') return
    generation.current++
    request.current?.abort()
    request.current = undefined
    setStatus('idle')
    setMessage('')
  }, [focusKey, goalRequest])

  useEffect(() => {
    if (previousMode.current === mode) return
    previousMode.current = mode
    setLastQuestion('')
    generation.current++
    request.current?.abort()
    request.current = undefined
    onBuildingChange(false)
    setStatus('idle')
  }, [mode, onBuildingChange])

  useEffect(() => () => { generation.current++; request.current?.abort(); onBuildingChange(false) }, [onBuildingChange])
  useEffect(() => {
    if (previousCorrections.current === corrections && previousDismissed.current === dismissed) return
    previousCorrections.current = corrections
    previousDismissed.current = dismissed
    generation.current++
    request.current?.abort()
    request.current = undefined
    setTurns([])
    setStepLists({})
    setLastQuestion('')
    setGoal('')
    setStatus('idle')
    onBuildingChange(false)
    if (correctedScene) onSceneChange?.(correctedScene)
  }, [corrections, dismissed, correctedScene, onBuildingChange, onSceneChange])

  function begin(nextPhase: 'scene' | 'intent') {
    requestPhase.current = nextPhase
    const id = ++generation.current
    setActiveRun(id)
    const controller = new AbortController()
    request.current = controller
    setPhase(nextPhase)
    setStatus('loading')
    onBuildingChange(nextPhase === 'scene')
    return { id, controller }
  }

  function cancel() {
    generation.current++
    request.current?.abort()
    request.current = undefined
    onBuildingChange(false)
    setStatus('cancelled')
    setMessage('Stopped for now. What we already found is still here.')
  }

  async function createScene() {
    if (!localReasoningAvailable || !image || processing || status === 'loading' || request.current) return
    const { id, controller } = begin('scene')
    const started = performance.now()
    setMessage('Combining local detection, OCR and visual reasoning…')
    try {
      const next = await buildScene(image, { detections, ocrText, onDetections, onOcr }, controller.signal,
        text => { if (id === generation.current) setMessage(text) })
      if (id === generation.current) {
        setPreviousDuration(previous => ({ ...previous, scene: performance.now() - started }))
        const corrected = excludeDismissedDetections(applyLabelCorrections(next, corrections), dismissed)
        setScene(next); onSceneChange?.(corrected); setTurns([]); setStatus('idle'); setMessage('Shared scene ready.')
        return corrected
      }
    } catch (error) {
      if (id === generation.current) { setStatus('error'); setMessage(error instanceof Error ? error.message : String(error)) }
    } finally {
      if (id === generation.current) { request.current = undefined; onBuildingChange(false) }
    }
  }

  async function ask(activeScene = correctedScene, activeGoal = goal) {
    if (!localReasoningAvailable || latestFocus.current !== focusKey) return
    if (!activeScene || processing || status === 'loading' || request.current || !activeGoal.trim()) return
    const objectId = objectFocus ? sceneObjectForDetection(activeScene, objectFocus)?.id : undefined
    if (objectFocus && !objectId) { setStatus('error'); setMessage('This detection is not in the saved scene. Choose the photo again to refresh it.'); return }
    const { id, controller } = begin('intent')
    setLastQuestion(activeGoal)
    const started = performance.now()
    setMessage('Reasoning about your goal using the saved scene…')
    try {
      const history = turns.filter(turn => turn.sceneId === activeScene.id && turn.intent.objectId === objectId)
      const next = await answerIntent(activeScene, { mode, goal: activeGoal, language, ...(objectId ? { objectId } : {}) }, history, controller.signal)
      if (id === generation.current && latestFocus.current === focusKey) { setPreviousDuration(previous => ({ ...previous, intent: performance.now() - started })); setTurns(previous => [...previous, next].slice(-24)); onTurnComplete?.(next, focusKey); setStatus('idle'); setMessage('Goal response ready.') }
    } catch (error) {
      if (id === generation.current) { setStatus('error'); setMessage(error instanceof Error ? error.message : String(error)) }
    } finally { if (id === generation.current) request.current = undefined }
  }

  // Capture creates a new keyed panel. Start its pipeline once, after decoding.
  useEffect(() => {
    if (!autoBuild || automaticStarted.current || scene || !image || processing || !localReasoningAvailable) return
    // Defer until StrictMode's mount/cleanup probe has finished; otherwise its
    // cleanup aborts the only automatic request and leaves Capture idle.
    const timer = setTimeout(() => {
      automaticStarted.current = true
      void createScene()
    }, 0)
    return () => clearTimeout(timer)
  })

  // Object actions reuse the mounted panel's scene/history. Only a missing scene
  // needs image inference; subsequent actions send text and evidence only.
  useEffect(() => {
    if (!goalRequest?.submit || submittedAction.current === goalRequest.id || !image || processing || status !== 'idle' || !localReasoningAvailable) return
    const timer = setTimeout(() => {
      submittedAction.current = goalRequest.id
      void (async () => {
        const activeScene = correctedScene ?? await createScene()
        if (activeScene && previousGoalId.current === goalRequest.id) await ask(activeScene, goalRequest.text)
      })()
    }, 0)
    return () => clearTimeout(timer)
  })

  const latest = visibleTurns.at(-1)
  const renderTurn = (turn: SceneTurn) => {
    const key = lingStepsKey(turn)
    return <IntentResult key={key} turn={turn} scene={correctedScene ?? scene!} stepsState={stepLists[key]}
      onAskAgain={question => { setGoal(question ?? ''); requestAnimationFrame(() => { const input = document.getElementById('scene-goal'); input?.focus(); input?.scrollIntoView({ block: 'center', behavior: 'instant' }) }) }}
      onStepsChange={value => setStepLists(previous => ({ ...previous, [key]: value }))} />
  }
  const placeholder = goalRequest?.displayText ?? (objectLabel ? `What would you like to know about ${objectLabel}?` : goalRequest?.text ?? 'Type a question…')
  const retryingQuestion = (status === 'error' || status === 'cancelled') && phase === 'intent'
  const questionToSend = goal.trim() || (retryingQuestion ? lastQuestion : '')
  const suggestions = correctedScene ? sceneSuggestions(objectFocus ? { ...correctedScene, objects: focusedObject ? [focusedObject] : [], visibleIssues: [], ocr: { ...correctedScene.ocr, text: '' } } : correctedScene, mode) : []
  return <section className="panel reasoning-panel" aria-labelledby="reasoning-title" aria-busy={status === 'loading'} data-scene-id={scene?.id}>
    <div className="ask-heading"><Mascot thinking={status === 'loading'} /><div><span className="sheet-kicker">A LITTLE HELP FROM LING</span><h2 id="reasoning-title">Hello, thinker!</h2></div></div>
    <div className="selected-intent" data-mode={mode} role="status"><span className="selected-intent-dot" /><div><strong>{intentPresentation[mode].label}</strong><span>{intentPresentation[mode].hint}</span></div></div>
    {objectFocus && <p className="object-chat-context">About <strong>{objectLabel ?? objectFocus.label}</strong><span>Answers stay with this selected object.</span></p>}
    {!ollamaAvailable && <BrowserAiSetup />}
    {image && scene && voiceRequest > 0 && <VoiceInput key={image.url + (focusKey ?? '') + mode + visible + processing + localReasoningAvailable + (status === 'loading')} disabled={!visible || status === 'loading' || processing || !localReasoningAvailable} onTranscript={text => { setGoal(text); const next = modeForGoal(text); if (next) onVoiceMode?.(next) }} />}
    {!scene && localReasoningAvailable && <p>What are you trying to do? Let’s start with what’s here.</p>}
    {!scene && image && <div className="first-question"><label htmlFor="scene-goal">Your question <span className="context-note">Optional</span></label><input id="scene-goal" value={goal} maxLength={500} disabled={status === 'loading' || !localReasoningAvailable} onChange={event => setGoal(event.target.value)} placeholder={placeholder} /></div>}
    {!scene && <button aria-label={status === 'error' || status === 'cancelled' ? 'Retry scene' : 'Build shared scene'} onClick={() => void (async () => {
      const next = await createScene()
      if (next && goal.trim()) await ask(next)
      else if (next && goalRequest?.submit) await ask(next, goalRequest.text)
    })()} disabled={!image || !localReasoningAvailable || processing || status === 'loading'}>
      {status === 'error' || status === 'cancelled' ? 'Try again' : 'Analyze photo'}
    </button>}
    {status === 'loading' && <div className="thinking-status"><AnalysisProgress key={activeRun} phase={phase} objectsReady={detections !== null} textReady={ocrText !== null} expectedMs={previousDuration[phase]} /><button className="danger-action" onClick={cancel}>Cancel analysis</button></div>}
    {status === 'error' && <p role="alert" className="error">{message}</p>}
    {status === 'cancelled' && <p role="status" className="cancel-notice">{message}</p>}
    {!image && <p className="empty">Choose an image to begin.</p>}
    {scene && <div className="shared-scene">
      <form onSubmit={event => { event.preventDefault(); void ask(correctedScene, questionToSend) }}>
        <label htmlFor="scene-goal">{mode === 'FIND' ? 'What are you looking for?' : mode === 'FIX' ? 'What would you like to check?' : mode === 'IMPROVE' ? 'What would you like to improve?' : 'Ask about your photo'}</label>
        <input id="scene-goal" value={goal} maxLength={500} disabled={status === 'loading'} onChange={event => setGoal(event.target.value)} placeholder={placeholder} />
        <div className="suggestions" aria-label="Suggested goals">
          {suggestions.map(text => <button key={text} type="button" aria-pressed={goal === text} disabled={status === 'loading'} onClick={() => { setGoal(text); document.getElementById('scene-goal')?.focus({ preventScroll: true }) }}>{text}</button>)}
        </div>
        <button type="submit" aria-label={retryingQuestion ? 'Retry question' : 'Ask scene'} disabled={!localReasoningAvailable || processing || status === 'loading' || !questionToSend}>{retryingQuestion ? 'Try again' : 'Ask Ling'}</button>
      </form>
      {latest && renderTurn(latest)}
      {visibleTurns.length > 1 && <details className="earlier-questions"><summary>Earlier questions ({visibleTurns.length - 1})</summary>{visibleTurns.slice(0, -1).map((turn, index) => <details key={lingStepsKey(turn)}><summary>{intentPresentation[turn.intent.mode].label} · Answer {index + 1}</summary>{renderTurn(turn)}</details>)}</details>}
    </div>}
  </section>
}
