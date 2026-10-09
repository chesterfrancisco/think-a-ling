import { useEffect, useRef, useState } from 'react'
import { ImagePreview } from './components/ImagePreview'
import { ReasoningPanel } from './components/ReasoningPanel'
import { LiveCamera } from './components/LiveCamera'
import { ObjectCard } from './components/ObjectCard'
import { ManualTagEditor } from './components/ManualTagEditor'
import { manualTagName, type ManualTag } from './services/manualTags'
import type { LabelCorrection, SceneAnalysis, SceneTurn } from './types/scene'
import { discoveryCategory, discoveryKey } from './components/objectDiscovery'
import { errorMessage } from './services/assets'
import { loadImage } from './services/image'
import type { UploadedImage } from './services/image'
import { ObjectDetectionService } from './services/objectDetection'
import type { DetectedObject } from './services/objectDetection'
import { OcrService } from './services/ocr'
import { ArrowUpRight, ArrowDown, Camera, Eye, EyeOff, Focus, HelpCircle, ImageUp, Maximize, ShieldCheck, Sparkles, X, ScanText, ArrowRight, Undo2, MapPinPlus, Mic, Crop } from 'lucide-react'
import { Brand } from './components/Brand'
import { Mascot } from './components/Mascot'
import { LingStory } from './components/LingStory'
import { hasSeenStory } from './services/storyPreference'
import { cleanLabel, sameDetection } from './services/labelCorrections'
import { objectDisplayName } from './services/objectNames'
import type { ReasoningMode } from './services/reasoning'
import './App.css'
import './Everyday.css'
import './SimpleExperience.css'
import { localReasoningAvailable as ollamaAvailable } from './services/ollama'
import { stopBrowserAi, useBrowserAi } from './services/browserAi'
import { LingPockets, SaveDiscovery } from './components/LingPockets'
import { pocketFromScene } from './services/pockets'
import { ModeChoices } from './components/ModeChoices'
import { SettingsPanel } from './components/SettingsPanel'
import { useAnswerLanguage } from './services/preferences'
import { detectionDismissed } from './services/dismissedDetections'
import { PhotoEditor } from './components/PhotoEditor'
import { TextWorkbench } from './components/TextWorkbench'
import './Resilience.css'

type Result<T> = { status: 'idle' | 'loading' | 'done' | 'error'; message: string; data: T }
const emptyDetection: Result<DetectedObject[]> = { status: 'idle', message: '', data: [] }
const emptyOcr: Result<string> = { status: 'idle', message: '', data: '' }

function App() {
  const [answerLanguage, setAnswerLanguage] = useAnswerLanguage()
  const browserAi = useBrowserAi()
  const localReasoningAvailable = ollamaAvailable || browserAi.status === 'ready'
  const [showStory, setShowStory] = useState(() => !hasSeenStory())
  const [showSplash, setShowSplash] = useState(true)
  const [corrections, setCorrections] = useState<LabelCorrection[]>([])
  const [dismissedTags, setDismissedTags] = useState<DetectedObject[]>([])
  const [manualTags, setManualTags] = useState<ManualTag[]>([])
  const [placingTag, setPlacingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState<ManualTag>()
  const [image, setImage] = useState<UploadedImage>()
  const [editing, setEditing] = useState(false)
  const [voiceRequest, setVoiceRequest] = useState(0)
  const [imageError, setImageError] = useState('')
  const [loadingImage, setLoadingImage] = useState(false)
  const [detection, setDetection] = useState(emptyDetection)
  const [ocr, setOcr] = useState(emptyOcr)
  const [sceneBuilding, setSceneBuilding] = useState(false)
  const [mode, setMode] = useState<ReasoningMode>('EXPLORE')
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelVisit, setPanelVisit] = useState(0)
  const [goalRequest, setGoalRequest] = useState<{ id: number; text: string; submit?: boolean; objectKey?: string; displayText?: string }>()
  const [sceneSnapshot, setSceneSnapshot] = useState<SceneAnalysis>()
  const [objectAnswers, setObjectAnswers] = useState<Record<string, SceneTurn>>({})
  const [selectedIndex, setSelectedIndex] = useState<number>()
  const [objectFocus, setObjectFocus] = useState<DetectedObject>()
  const [markersVisible, setMarkersVisible] = useState(true)
  const [pictureOpen, setPictureOpen] = useState(false)
  const [dismissedSummaryId, setDismissedSummaryId] = useState<string>()
  const summaryNotice = !!sceneSnapshot && dismissedSummaryId !== sceneSnapshot.id
  const [viewMessage, setViewMessage] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraFill, setCameraFill] = useState(false)
  const [cameraNative, setCameraNative] = useState(false)
  const [autoBuild, setAutoBuild] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const viewfinder = useRef<HTMLElement>(null)
  const help = useRef<HTMLDialogElement>(null)
  const about = useRef<HTMLDialogElement>(null)
  const textDialog = useRef<HTMLDialogElement>(null)
  const chatPanel = useRef<HTMLElement>(null)
  const photoFrame = useRef<HTMLDivElement>(null)
  const pictureDialog = useRef<HTMLDialogElement>(null)
  const summary = useRef<HTMLElement>(null)
  const detector = useRef<ObjectDetectionService | undefined>(undefined)
  const recognizer = useRef<OcrService | undefined>(undefined)
  const currentImage = useRef<UploadedImage | undefined>(undefined)
  const revision = useRef(0)
  const busy = loadingImage || sceneBuilding || detection.status === 'loading' || ocr.status === 'loading'
  // Tesseract reports real progress for its recognition stage. Gemma does not.
  const ocrProgress = ocr.status === 'loading' ? /recognizing text \((\d+)%\)/i.exec(ocr.message)?.[1] : undefined

  useEffect(() => {
    const changed = () => setCameraNative(document.fullscreenElement === viewfinder.current)
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setCameraFill(false) }
    document.addEventListener('fullscreenchange', changed)
    window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('fullscreenchange', changed); window.removeEventListener('keydown', escape) }
  }, [])

  useEffect(() => () => {
    stopBrowserAi()
    revision.current++
    detector.current?.dispose()
    recognizer.current?.dispose()
    if (currentImage.current) URL.revokeObjectURL(currentImage.current.url)
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const frame = requestAnimationFrame(() => {
      chatPanel.current?.focus({ preventScroll: true })
      // Mode changes can resize the question area. An immediate move avoids a
      // previous smooth scroll pulling the heading offscreen on small displays.
      chatPanel.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [panelOpen, panelVisit])


  async function selectImage(file: File, captured = false, object?: string) {
    setEditing(false); setVoiceRequest(0)
    setCameraFill(false)
    if (document.fullscreenElement === viewfinder.current) void document.exitFullscreen().catch(() => {})
    const run = ++revision.current
    if (detection.status === 'loading') { detector.current?.dispose(); detector.current = undefined }
    if (ocr.status === 'loading') { recognizer.current?.dispose(); recognizer.current = undefined }
    if (!captured) setCameraOpen(false)
    setSelectedIndex(undefined)
    setObjectFocus(undefined)
    setMarkersVisible(true)
    setDismissedSummaryId(undefined)
    setCorrections([]); setDismissedTags([])
    setManualTags([]); setPlacingTag(false); setTagDraft(undefined)
    setSceneSnapshot(undefined)
    setObjectAnswers({})
    setAutoBuild(captured && localReasoningAvailable)
    setImageError('')
    setLoadingImage(true)
    setDetection(emptyDetection)
    setOcr(emptyOcr)
    setImage(undefined)
    if (currentImage.current) URL.revokeObjectURL(currentImage.current.url)
    currentImage.current = undefined
    try {
      const next = await loadImage(file)
      if (run !== revision.current) { URL.revokeObjectURL(next.url); return }
      currentImage.current = next
      setCameraOpen(false)
      setImage(next)
      setPanelOpen(captured && localReasoningAvailable)
      setGoalRequest(object ? { id: Date.now(), text: discoveryCategory(object) === 'people'
        ? 'Explain the visible surroundings in this captured photo. Do not identify the person or infer personal traits. Distinguish observation from inference.'
        : 'Explain the visible ' + object + ' and suggest practical uses grounded in this captured scene. Distinguish observation from inference.' } : undefined)
      // Return useful browser inference first. Both engines are retained for
      // warm/offline reuse; the shared scene consumes these completed results.
      void Promise.allSettled([detect(next, run, true), recognize(next, run, true)])
    } catch (error) {
      if (run === revision.current) setImageError(errorMessage(error))
    } finally {
      if (run === revision.current) setLoadingImage(false)
    }
  }

  async function detect(target = image, run = revision.current, automatic = false) {
    if (!target || (!automatic && busy)) return
    setDetection({ status: 'loading', message: 'Preparing object detection…', data: [] })
    try {
      detector.current ??= new ObjectDetectionService()
      const data = await detector.current.detect(target.element, message => {
        if (run === revision.current) setDetection({ status: 'loading', message, data: [] })
      })
      if (run === revision.current) { setDetection({ status: 'done', message: '', data }) }
    } catch (error) {
      if (run === revision.current) {
        detector.current?.dispose(); detector.current = undefined
        setDetection({ status: 'error', message: errorMessage(error), data: [] })
      }
    }
  }

  async function recognize(target = image, run = revision.current, automatic = false) {
    if (!target || (!automatic && busy)) return
    setOcr({ status: 'loading', message: 'Preparing text recognition…', data: '' })
    try {
      recognizer.current ??= new OcrService()
      const data = await recognizer.current.recognize(target.file, message => {
        if (run === revision.current) setOcr({ status: 'loading', message, data: '' })
      })
      if (run === revision.current) { setOcr({ status: 'done', message: '', data }) }
    } catch (error) {
      if (run === revision.current) {
        recognizer.current?.dispose(); recognizer.current = undefined
        setOcr({ status: 'error', message: errorMessage(error), data: '' })
      }
    }
  }

  function cancelQuickScan() {
    revision.current++
    detector.current?.dispose(); recognizer.current?.dispose()
    detector.current = undefined; recognizer.current = undefined
    setDetection(previous => previous.status === 'loading' ? { status: 'error', data: [], message: 'Object scan cancelled. Select Detect objects to retry.' } : previous)
    setOcr(previous => previous.status === 'loading' ? { status: 'error', data: '', message: 'Text scan cancelled. Select Read text to retry.' } : previous)
  }

  function openQuestion(text?: string) {
    setSelectedIndex(undefined)
    setPanelOpen(true)
    setPanelVisit(previous => previous + 1)
    if (text) { setObjectFocus(undefined); setGoalRequest({ id: Date.now(), text }) }
  }

  function startCamera() {
    if (busy) return
    revision.current++
    if (currentImage.current) URL.revokeObjectURL(currentImage.current.url)
    currentImage.current = undefined
    setImage(undefined)
    setObjectFocus(undefined)
    setMarkersVisible(true)
    setCorrections([]); setDismissedTags([])
    setManualTags([]); setPlacingTag(false); setTagDraft(undefined)
    setSceneSnapshot(undefined)
    setObjectAnswers({})
    setSelectedIndex(undefined)
    setImageError('')
    setDetection(emptyDetection)
    setOcr(emptyOcr)
    setAutoBuild(false)
    setPanelOpen(false)
    setGoalRequest(undefined)
    setCameraOpen(true)
  }

  function goHome() {
    setCameraFill(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    revision.current++
    if (detection.status === 'loading') { detector.current?.dispose(); detector.current = undefined }
    if (ocr.status === 'loading') { recognizer.current?.dispose(); recognizer.current = undefined }
    if (currentImage.current) URL.revokeObjectURL(currentImage.current.url)
    currentImage.current = undefined
    setImage(undefined) // Unmounts the keyed reasoning panel and aborts its request.
    setObjectFocus(undefined)
    setDismissedSummaryId(undefined)
    setCameraOpen(false)
    setLoadingImage(false)
    setSceneBuilding(false)
    setCorrections([]); setDismissedTags([])
    setManualTags([]); setPlacingTag(false); setTagDraft(undefined)
    setSceneSnapshot(undefined)
    setObjectAnswers({})
    setSelectedIndex(undefined)
    setPanelOpen(false)
    setGoalRequest(undefined)
    setDetection(emptyDetection)
    setOcr(emptyOcr)
    setAutoBuild(false)
    setImageError('')
    setViewMessage('')
    setMode('EXPLORE')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function expand() {
    if (cameraOpen) {
      if (document.fullscreenElement) { await document.exitFullscreen(); return }
      if (cameraFill) { setCameraFill(false); return }
      try {
        if (viewfinder.current?.requestFullscreen) await viewfinder.current.requestFullscreen()
        else setCameraFill(true)
      } catch { setCameraFill(true) }
      return
    }
    if (!image) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (photoFrame.current?.requestFullscreen) await photoFrame.current.requestFullscreen()
      else { setPictureOpen(true); pictureDialog.current?.showModal() }
    } catch { setPictureOpen(true); pictureDialog.current?.showModal() }
  }

  function selectObject(object: DetectedObject, index: number) {
    // The card lives outside the fullscreen photo; return to it on selection.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    pictureDialog.current?.close()
    setSelectedIndex(index)
    setObjectFocus(object)
    setGoalRequest(undefined)
    setPanelOpen(false)
  }

  function editTag(tag: ManualTag) {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    pictureDialog.current?.close()
    setTagDraft(tag)
  }

  function finishTagEdit() {
    setTagDraft(undefined)
    requestAnimationFrame(() => viewfinder.current?.querySelector<HTMLButtonElement>('.add-manual-tag')?.focus({ preventScroll: true }))
  }

  function beginTag() {
    setMarkersVisible(true)
    setSelectedIndex(undefined)
    setPanelOpen(false)
    setPlacingTag(true)
    requestAnimationFrame(() => photoFrame.current?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  }

  function correctLabel(detected: DetectedObject, value: string | null) {
    const label = value === null ? null : cleanLabel(value)
    setCorrections(previous => {
      const rest = previous.filter(item => !sameDetection(item, detected))
      return label ? [...rest, { label, originalLabel: detected.label, box: { ...detected.box } }] : rest
    })
    setObjectAnswers({})
    setGoalRequest(undefined)
  }

  function closeObject() {
    const index = selectedIndex
    setSelectedIndex(undefined)
    requestAnimationFrame(() => viewfinder.current?.querySelector<HTMLButtonElement>(`[data-detection-index="${index ?? 0}"]`)?.focus({ preventScroll: true }))
  }

  function updateRemovedTags(next: DetectedObject[]) {
    setDismissedTags(next)
    setObjectAnswers({})
    setGoalRequest(undefined)
    setObjectFocus(undefined)
    setSelectedIndex(undefined)
  }

  function removeDetection(object: DetectedObject) {
    if (busy || detectionDismissed(object, dismissedTags)) return
    updateRemovedTags([...dismissedTags, object])
    requestAnimationFrame(() => viewfinder.current?.querySelector<HTMLButtonElement>('.undo-tag')?.focus({ preventScroll: true }))
  }

  function undoRemovedTag() {
    const restored = dismissedTags.at(-1)
    updateRemovedTags(dismissedTags.slice(0, -1))
    const index = detection.data.findIndex(item => restored && sameDetection({ originalLabel: restored.label, box: restored.box }, item))
    requestAnimationFrame(() => viewfinder.current?.querySelector<HTMLButtonElement>(`[data-detection-index="${index}"]`)?.focus({ preventScroll: true }))
  }

  if (showSplash || showStory) return <LingStory startWithSplash={showSplash} skipStory={!showStory} onDone={() => { setShowStory(false); setShowSplash(false) }} />

  return <div className={'app-shell everyday-app' + (!image && !cameraOpen ? ' is-home' : '')}>
    <header className="site-header">
      <button className="brand-button" aria-label="Think-a-ling home" onClick={goHome}><Brand /></button>
      <span className="header-tagline">A little help. A whole new perspective.</span>
      <div className="header-right">
        <LingPockets />
        <SettingsPanel language={answerLanguage} onLanguageChange={setAnswerLanguage} />
        <button className="help-button" onClick={() => about.current?.showModal()} aria-label="About Think-a-ling"><HelpCircle size={21} /></button>
      </div>
    </header>
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <main id="main-workspace" tabIndex={-1}>
      <div className="page-intro"><div><span className="eyebrow"><Sparkles size={16} /> YOUR WORLD. FULL OF POSSIBILITIES.</span>
        <h1>{image || cameraOpen ? <>Let’s find your <em>next step.</em></> : <>What can we <em>figure out today?</em></>}</h1></div>
      </div>
      {!ollamaAvailable && <div className="runtime-strip"><ShieldCheck size={16} /><span>Objects & text in your browser · optional on-device AI answers</span><button onClick={() => help.current?.showModal()}>How local AI works <ArrowUpRight size={14} /></button></div>}
      <section ref={viewfinder} data-detection-status={detection.status} data-ocr-status={ocr.status} className={'viewfinder' + (image ? ' has-image' : '') + (cameraOpen ? ' has-camera' : '') + (cameraOpen && cameraFill ? ' camera-fill' : '') + (panelOpen || selectedIndex !== undefined ? ' has-drawer' : '') + (selectedIndex !== undefined ? ' has-object-card' : '') + (sceneBuilding || detection.status === 'loading' ? ' is-scanning' : '')} aria-label="Your visual workspace">
        {(image || cameraOpen) && <div className="camera-top">
          <button className="back-to-start" onClick={goHome} aria-label="Back to start"><Undo2 size={18} /><span>Back</span></button>
          <div className="camera-tools">
            {sceneSnapshot && <button aria-label="Voice question" title="Speak a question · experimental English on-device voice" disabled={busy} onClick={() => { openQuestion(); setVoiceRequest(n => n + 1) }}><Mic size={18} /></button>}
            {image && <button aria-label="Edit photo" title="Crop, rotate and adjust this photo" disabled={busy} onClick={() => setEditing(true)}><Crop size={18} /></button>}
            <button disabled={busy} onClick={startCamera} aria-label="Use camera"><Camera size={18} /></button>
            <button disabled={loadingImage} onClick={() => fileInput.current?.click()} aria-label="Upload a photo" title="Change photo"><ImageUp size={18} /></button>
            <button onClick={() => { setMarkersVisible(value => !value); setSelectedIndex(undefined) }} aria-label={markersVisible ? 'Hide object markers' : 'Show object markers'} aria-pressed={markersVisible} title={markersVisible ? 'Hide object markers' : 'Show object markers'}>{markersVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
            <button disabled={!image && !cameraOpen} onClick={() => void expand()} aria-label={cameraOpen ? cameraFill || cameraNative ? 'Exit fullscreen camera' : 'Expand camera' : 'Expand image'} title={cameraOpen ? 'Fullscreen camera' : 'Fullscreen photo'}><Maximize size={18} /></button>
            <button onClick={() => help.current?.showModal()} aria-label="Help"><HelpCircle size={18} /></button>
          </div>
        </div>}
        {cameraOpen && <LiveCamera markersVisible={markersVisible} processing={loadingImage} onClose={goHome} onCapture={(file, object) => { if (object) setMode('EXPLORE'); void selectImage(file, true, object) }} />}
        <div ref={photoFrame} className="image-stage" hidden={cameraOpen}>
          {image && <div className="fullscreen-tools"><button aria-label={markersVisible ? 'Hide fullscreen markers' : 'Show fullscreen markers'} onClick={() => setMarkersVisible(value => !value)}>{markersVisible ? <Eye size={21} /> : <EyeOff size={21} />}{markersVisible ? 'Hide markers' : 'Show markers'}</button><button aria-label="Exit fullscreen photo" onClick={() => void document.exitFullscreen()}><X size={21} /> Close</button></div>}
          {image ? <ImagePreview image={image} detections={detection.data} dismissed={dismissedTags} markersVisible={markersVisible} corrections={corrections} selectedIndex={selectedIndex} onObjectSelect={selectObject}
            manualTags={manualTags} onTagSelect={editTag} placingTag={placingTag} onCancelTag={() => setPlacingTag(false)} onPlaceTag={point => { setPlacingTag(false); setTagDraft({ id: crypto.randomUUID(), source: 'user', label: '', point }) }} /> : <div className="welcome">
            <div className="welcome-copy"><span className="welcome-number">01 / START WITH A PHOTO</span>
            <h2>Start with <br />what’s here<span>.</span></h2>
            <p>Point your camera or choose a photo.<br />Start with the objects and words in front of you.</p>
            <div className="start-actions"><button className="primary" aria-label="Use camera" disabled={busy} onClick={startCamera}><Camera size={22} /> Open camera <ArrowUpRight size={20} /></button>
            <button className="upload-btn" aria-label="Upload a photo" disabled={busy} onClick={() => fileInput.current?.click()}><ImageUp size={20} /> Choose a photo</button></div>
            <span className="welcome-note"><ShieldCheck size={16} /> No account needed. Photos stay on your device.</span>
            <details className="demo-guide"><summary>First time? Try a study task.</summary><button disabled={busy} onClick={() => void (async () => {
              try {
                const response = await fetch('/demo/study-notes.png', { signal: AbortSignal.timeout(15000) })
                if (!response.ok) throw new Error('The example is unavailable. Choose your own photo or try again.')
                await selectImage(new File([await response.blob()], 'example-study-notes.png', { type: 'image/png' }))
              } catch (error) { setImageError(errorMessage(error)) }
            })()}>Try example study notes</button></details>
            </div>
            <div className="mascot-welcome"><div className="mascot-orbit"><Mascot /></div><span className="mascot-greeting">Hi, I’m Ling!</span><p>A little perspective. A useful next step.</p></div>
          </div>}
        </div>
        <input ref={fileInput} id="image-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" disabled={loadingImage}
          aria-label="Upload an image" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void selectImage(file) }} />
        <div className="workspace-status">
          {loadingImage && <p role="status">Loading image…</p>}
          {imageError && <p role="alert" className="error">{imageError}</p>}
          {viewMessage && <p role="status">{viewMessage}</p>}
        </div>
        {image && <div className="photo-actions">
          {placingTag && <div className="tag-placement-help" role="status"><p id="tag-placement-help">Tap the missed person or object, then give it a name. Keyboard: move the pin with arrow keys, then press Enter.</p><button onClick={() => setPlacingTag(false)}>Cancel tagging</button></div>}
          {detection.status === 'loading' || ocr.status === 'loading' ? <div className="quick-progress" role="status"><span>{ocrProgress === undefined ? 'Noticing objects and reading text…' : `Reading text · ${ocrProgress}%`}</span>{ocrProgress !== undefined && <progress aria-label="Reading text" value={Number(ocrProgress)} max={100} />}<button onClick={cancelQuickScan}>Cancel scan</button></div> : <span className="photo-hint">{detection.data.some(item => !detectionDismissed(item, dismissedTags)) ? 'Tap a green dot to explore.' : dismissedTags.length ? 'No tags shown. Undo a removal or add a tag.' : localReasoningAvailable ? 'No objects found. You can still read text or ask about the photo.' : 'No objects found. Try a clearer photo, or read its text.'}</span>}
          <div className="photo-buttons">
            <button disabled={loadingImage} className="change-photo" onClick={() => fileInput.current?.click()}><ImageUp size={17} /> Change photo</button>
            <button className="add-manual-tag" disabled={placingTag} onClick={beginTag}><MapPinPlus size={17} /> Add missing tag</button>
            <button disabled={busy} onClick={() => void detect()} aria-label="Detect objects"><Focus size={17} /> Scan again</button>
            <button onClick={() => textDialog.current?.showModal()} aria-label="Read text"><ScanText size={17} /> Read text</button>
            {!sceneSnapshot && <button className="photo-next" aria-label="Explore this photo" disabled={sceneBuilding} onClick={() => { setObjectFocus(undefined); setGoalRequest(undefined); openQuestion(); if (localReasoningAvailable) setAutoBuild(true) }}>{localReasoningAvailable ? 'Analyze photo' : 'Enable AI to analyze'} <ArrowRight size={18} /></button>}
          </div>
          {!!manualTags.length && <div className="manual-tag-list" aria-label="Your photo tags"><span>Added by you · {manualTags.length} {manualTags.length === 1 ? 'pin' : 'pins'}</span>{manualTags.map(tag => <button key={tag.id} onClick={() => editTag(tag)}>{manualTagName(tag, manualTags, detection.data, corrections)}</button>)}<small>Photo annotations, not AI detections. Tap to edit or remove.</small></div>}
          {!!dismissedTags.length && <div className="removed-tags"><span role="status">{dismissedTags.length} {dismissedTags.length === 1 ? 'tag removed' : 'tags removed'} from this photo.</span><button className="undo-tag" disabled={busy} onClick={undoRemovedTag}><Undo2 size={16} /> Undo last removal</button></div>}
          {detection.status === 'error' && <p role="alert" className="error">{detection.message} Try scanning again.</p>}
          {sceneBuilding && !panelOpen && <button className="thinking-link" onClick={() => openQuestion()}>Understanding your photo... View progress</button>}
        </div>}
      {sceneSnapshot && <section ref={summary} tabIndex={-1} className="scene-summary" aria-label="Photo summary">
        <Mascot /><div><span className="sheet-kicker">HERE'S THE PICTURE</span><p className="answer-ready">100% · Analysis complete</p><p className="scene-description">{sceneSnapshot.description}</p><small>AI interpretation. Check important details against your photo.</small>{(corrections.length > 0 || dismissedTags.length > 0) && <p className="correction-note">Your tag changes apply to new questions. This description was written from the original photo.</p>}
        {!!sceneSnapshot.uncertainty.length && <details><summary>What is unclear?</summary>{sceneSnapshot.uncertainty.map((note, index) => <p key={index}>{note}</p>)}</details>}<SaveDiscovery draft={pocketFromScene(sceneSnapshot)} /></div>
      </section>}
        {selectedIndex !== undefined && detection.data[selectedIndex] && <ObjectCard key={discoveryKey(detection.data[selectedIndex])} detection={detection.data[selectedIndex]} index={selectedIndex}
          displayName={objectDisplayName(detection.data[selectedIndex], detection.data, corrections)}
          correction={corrections.find(item => sameDetection(item, detection.data[selectedIndex]))} onCorrect={label => correctLabel(detection.data[selectedIndex], label)} onReplace={() => fileInput.current?.click()}
          onRemove={() => removeDetection(detection.data[selectedIndex])}
          scene={sceneSnapshot} response={objectAnswers[discoveryKey(detection.data[selectedIndex])]} ocr={ocr}
          onReadText={() => { textDialog.current?.showModal(); if (ocr.status !== 'done') void recognize() }} busy={busy} onClose={closeObject} onAction={(nextMode, text, submit) => {
            setMode(nextMode); setSelectedIndex(undefined); setPanelOpen(true)
            setGoalRequest({ id: Date.now(), text, submit, displayText: 'Ask about ' + objectDisplayName(detection.data[selectedIndex], detection.data, corrections) + ' in this photo…', objectKey: discoveryKey(detection.data[selectedIndex]) })
          }} />}
        <aside ref={chatPanel} tabIndex={-1} id="ask-panel" className="sheet reasoning-drawer" hidden={!panelOpen} aria-label="Scene intelligence" onKeyDown={event => { if (event.key === 'Escape') { setPanelOpen(false); document.querySelector<HTMLButtonElement>('.floating-ask')?.focus() } }}>
          <div className="sheet-handle" />
          <button className="sheet-close" aria-label="Close panel" onClick={() => setPanelOpen(false)}><X size={18} /></button>
          {goalRequest?.objectKey && objectAnswers[goalRequest.objectKey] && objectAnswers[goalRequest.objectKey].sceneId === sceneSnapshot?.id &&
            detection.data.map((item, index) => discoveryKey(item) === goalRequest.objectKey ?
              <button key={index} className="discovery-return" onClick={() => selectObject(item, index)}>View {objectDisplayName(item, detection.data, corrections)} discovery <ArrowUpRight size={15} /></button> : null)}
          <ReasoningPanel key={image?.url ?? 'no-image'} image={image} mode={mode} goalRequest={goalRequest} autoBuild={autoBuild} corrections={corrections}
            language={answerLanguage} dismissed={dismissedTags} onVoiceMode={setMode} visible={panelOpen} voiceRequest={voiceRequest}
            objectFocus={objectFocus} objectLabel={objectFocus ? objectDisplayName(objectFocus, detection.data, corrections) : undefined}
            onSceneChange={setSceneSnapshot}
            onTurnComplete={(turn, key) => {
              if (key) setObjectAnswers(previous => ({ ...previous, [key]: turn }))
            }}
            detections={detection.status === 'done' ? detection.data : null}
            ocrText={ocr.status === 'done' ? ocr.data : null} processing={busy}
            onBuildingChange={setSceneBuilding}
            onDetections={data => { if (image?.url === currentImage.current?.url) setDetection({ status: 'done', data, message: '' }) }}
            onOcr={data => { if (image?.url === currentImage.current?.url) setOcr({ status: 'done', data, message: '' }) }} />
        </aside>
        <span className="viewfinder-corner corner-tl" /><span className="viewfinder-corner corner-br" />
      </section>
      {sceneSnapshot && <ModeChoices scene={sceneSnapshot} mode={mode} goal={goalRequest?.text} onSelect={name => { setMode(name); setObjectFocus(undefined); setGoalRequest(undefined); openQuestion() }} />}
      {image && <button className="floating-ask" aria-label={panelOpen ? 'Close chat' : 'Ask This Space'} aria-expanded={panelOpen} aria-controls="ask-panel" onClick={() => { if (panelOpen) setPanelOpen(false); else openQuestion() }}><Mascot thinking={sceneBuilding} /><span>{panelOpen ? 'Close chat' : 'Ask This Space'}</span>{panelOpen ? <X size={19} /> : <ArrowUpRight size={19} />}</button>}
      {summaryNotice && sceneSnapshot && <div className="summary-ready-notice" role="status"><button onClick={() => { setDismissedSummaryId(sceneSnapshot.id); summary.current?.focus({ preventScroll: true }); summary.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}><ArrowDown size={20} /><span><strong>HERE'S THE PICTURE</strong><small>Your photo summary is ready. View below.</small></span></button><button aria-label="Dismiss summary notice" onClick={() => setDismissedSummaryId(sceneSnapshot.id)}><X size={17} /></button></div>}
      <footer><span>Think-a-ling! · AppBuildersPH Hackathon Prototype · 2026</span></footer>
      {!image && !cameraOpen && <button className="replay-story" onClick={() => setShowStory(true)}>Meet Ling again</button>}
    </main>
    <dialog ref={pictureDialog} className="picture-dialog" aria-label="Fullscreen photo" onClose={() => setPictureOpen(false)}><div className="fullscreen-tools"><button aria-label={markersVisible ? 'Hide fullscreen markers' : 'Show fullscreen markers'} onClick={() => setMarkersVisible(value => !value)}>{markersVisible ? <Eye size={21} /> : <EyeOff size={21} />}{markersVisible ? 'Hide markers' : 'Show markers'}</button><button aria-label="Close fullscreen photo" onClick={() => pictureDialog.current?.close()}><X size={22} /> Close</button></div>{pictureOpen && image && <ImagePreview image={image} detections={detection.data} dismissed={dismissedTags} corrections={corrections} markersVisible={markersVisible} selectedIndex={selectedIndex} onObjectSelect={selectObject} manualTags={manualTags} onTagSelect={editTag} />}</dialog>
    {tagDraft && <ManualTagEditor key={tagDraft.id} tag={tagDraft} existing={manualTags.some(tag => tag.id === tagDraft.id)} onClose={finishTagEdit}
      onSave={tag => { setManualTags(previous => previous.some(item => item.id === tag.id) ? previous.map(item => item.id === tag.id ? tag : item) : [...previous, tag]); finishTagEdit() }}
      onDelete={() => { setManualTags(previous => previous.filter(tag => tag.id !== tagDraft.id)); finishTagEdit() }} />}
    <dialog ref={textDialog} className="help-dialog text-dialog" aria-labelledby="text-title">
      <button className="sheet-close" onClick={() => textDialog.current?.close()} aria-label="Close text"><X size={20} /></button>
      <h2 id="text-title">Text in your photo</h2>
      {ocr.status === 'loading' && <p role="status">Reading the text...</p>}
      {ocr.status === 'error' && <p role="alert" className="error">{ocr.message}</p>}
      {ocr.status === 'done' && (ocr.data ? <textarea id="recognized-text" aria-label="Recognized text" readOnly value={ocr.data} rows={8} /> : <p>No readable text found. Try a closer, sharper photo.</p>)}
      {ocr.status === 'done' && ocr.data.trim() && <><SaveDiscovery draft={{ title: 'Text from ' + (image?.name ?? 'photo').slice(0, 150), kind: 'text', content: ocr.data, source: 'Tesseract · recognized text', photoName: image?.name ?? '', evidence: [], caveats: ['OCR can misread text. Check against the original. The photo is not saved.'] }} /><TextWorkbench key={image?.url} text={ocr.data} photoName={image?.name ?? 'photo'} /></>}
      {ocr.status === 'idle' && <p>Choose a photo to read its text.</p>}
      <button disabled={!image || busy} onClick={() => void recognize()}>Read again</button>
      {ocr.data.trim() && <button disabled={!localReasoningAvailable} onClick={() => { textDialog.current?.close(); openQuestion('Explain the text in this photo.') }}>Explain this text</button>}
      {ocr.data.trim() && !localReasoningAvailable && <p className="context-note">Reading text works here. Enable on-device AI in Ask This Space for experimental explanations. Grounded study cards require the local app with Ollama.</p>}
      <p className="context-note">Text recognition can make mistakes. Compare important details with your photo.</p>
    </dialog>
    <dialog ref={about} className="help-dialog about-dialog" aria-labelledby="about-title">
      <button className="sheet-close" onClick={() => about.current?.close()} aria-label="Close about"><X size={20} /></button><Brand />
      <h2 id="about-title">Your world. Full of possibilities.</h2>
      <p><strong>Point at anything. Know what to do.</strong> Think-a-ling! is an Everyday Action Intelligence app: discover what you can understand, use, fix, and improve with what’s around you.</p>
      <p>Meet Ling, your guide from a little discovery to a practical next step. Explore, Find, Fix, Improve, or Ask This Space about what you’re trying to accomplish.</p>
      <p>Created by <strong>Chester Francisco</strong> as an <strong>AppBuildersPH Local AI Hackathon 2026</strong> entry, developed within 24 hours using local AI. This is a hackathon prototype, with room to learn and improve.</p>
      <h3>Built with local AI</h3>
      <p>React, Vite, and TypeScript power the interface. MediaPipe EfficientDet-Lite0 detects objects and Tesseract.js reads text in your browser. In the local development app, Gemma 3 4B through Ollama provides deeper reasoning on the same computer.</p>
      <p>The public website supports browser detection, text reading, and optional experimental SmolVLM 500M answers through Transformers.js and WebGPU. It cannot access the developer’s local Gemma model. Predictions can be incomplete or mistaken. No cloud AI or cloud photo storage is used. The app is free to use without an account. Saved discoveries stay in this browser.</p>
      <p><strong>Online website, local AI.</strong> Internet is needed for your first visit and downloads. For use without a signal, prepare Offline downloads in Settings before going offline. This keeps the app and its detection and English text-reading files in this browser; optional AI answers need a separate model download. Saved keeps your discoveries, not the app itself.</p>
      <button className="primary" onClick={() => { about.current?.close(); help.current?.showModal() }}>How to use Think-a-ling <ArrowUpRight size={18} /></button>
    </dialog>
    <dialog ref={help} className="help-dialog navigation-help" aria-labelledby="help-title">
      <button className="sheet-close" onClick={() => help.current?.close()} aria-label="Close help"><X size={20} /></button><Brand />
      <h2 id="help-title">Your everyday, reimagined.</h2>
      <p>Choose a photo or capture one. Objects and readable text appear automatically. Tap a green dot to inspect an object. For questions, enable on-device AI or use the local app with Ollama. Follow-up questions reuse your photo’s saved understanding.</p>
      <p>Select Change photo to choose another image without going back home. Use the eye button to hide or show markers, and the fullscreen button to see the whole photo. Ask This Space opens or closes Ling’s question panel.</p>
      <p>Missed someone or something? Select Add missing tag, tap its location, and enter a name. Lilac pins are added by you, not predicted by AI. Tap a pin to rename or remove it. Tags stay with the current photo only and aren’t used as AI evidence or for training. For a mistaken green marker, open its object card and select Correct this label or Remove tag. Undo last removal brings it back.</p>
      <p>Green boxes and confidence scores come from MediaPipe. Text comes from Tesseract. Gemma descriptions have no measured locations. Check the evidence and uncertainty beside every response.</p>
      <p>Detection and OCR run in your browser. On the public site, open Ask This Space and select Enable on-device AI to download approximately 374 MB of model files from this site. Experimental SmolVLM answers then run on your device using WebGPU. It can miss or invent details. Follow-up questions reuse the saved description and recognized text. Structured action checklists and grounded study cards remain in the local app with Gemma through Ollama. Neither mode is a safety or medical assessment.</p>
      <p>Use live camera for periodic on-device detection. Expand camera opens fullscreen while keeping the controls and measured boxes. Capture freezes a frame and stops the camera. Review it, then retake or analyze it. Camera access requires HTTPS or localhost and your permission. Front/rear selection depends on your device.</p>
      <p>Experimental local voice requires a compatible browser, its English language pack and microphone permission. Enable local voice, install the pack if offered, then speak. Review the transcript and selected mode before sending. No cloud speech fallback is used. Language-pack downloads are managed by your browser and require internet. Filipino support was unavailable in the tested browser.</p>
      <p>Save this keeps text and supporting evidence in this browser. Open Saved to revisit or delete it. Photos are not saved or uploaded. Clearing site data removes saved copies; anyone using the same browser profile can access them. Saving a discovery does not prepare the app for offline use.</p>
      <p><strong>To use the app without a signal:</strong> while online, open Settings → Offline downloads → Prepare for offline and wait until ready. You can then reopen this website in the same browser and use detection, English text reading and Saved without internet. Optional SmolVLM answers need their separate model download and compatible hardware. First visits and downloads need internet. A new app version or cleared browser storage may need preparation again. Local Gemma still needs the local app and Ollama running. Hosting receives normal page and asset requests when online.</p>
      <button className="primary" onClick={() => help.current?.close()}>Let’s explore <ArrowUpRight size={18} /></button>
    </dialog>
    {editing && image && <PhotoEditor image={image} onClose={() => setEditing(false)} onApply={file => void selectImage(file)} />}
  </div>
}

export default App
