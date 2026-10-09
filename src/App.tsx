import { useEffect, useRef, useState } from 'react'
import { ImagePreview } from './components/ImagePreview'
import { ReasoningPanel } from './components/ReasoningPanel'
import { LiveCamera } from './components/LiveCamera'
import { ObjectCard } from './components/ObjectCard'
import type { LabelCorrection, SceneAnalysis, SceneTurn } from './types/scene'
import { discoveryCategory, discoveryKey } from './components/objectDiscovery'
import { errorMessage } from './services/assets'
import { loadImage } from './services/image'
import type { UploadedImage } from './services/image'
import { ObjectDetectionService } from './services/objectDetection'
import type { DetectedObject } from './services/objectDetection'
import { OcrService } from './services/ocr'
import { ArrowUpRight, ArrowDown, Camera, Compass, Eye, EyeOff, Focus, HelpCircle, ImageUp, Maximize, Search, ShieldCheck, Sparkles, Wrench, X, ScanText, ArrowRight, Undo2 } from 'lucide-react'
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
import { localReasoningAvailable } from './services/ollama'

type Result<T> = { status: 'idle' | 'loading' | 'done' | 'error'; message: string; data: T }
const emptyDetection: Result<DetectedObject[]> = { status: 'idle', message: '', data: [] }
const emptyOcr: Result<string> = { status: 'idle', message: '', data: '' }

function App() {
  const [showStory, setShowStory] = useState(() => !hasSeenStory())
  const [showSplash, setShowSplash] = useState(true)
  const [corrections, setCorrections] = useState<LabelCorrection[]>([])
  const [image, setImage] = useState<UploadedImage>()
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
  const [autoBuild, setAutoBuild] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const viewfinder = useRef<HTMLElement>(null)
  const help = useRef<HTMLDialogElement>(null)
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

  useEffect(() => () => {
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
    const run = ++revision.current
    if (detection.status === 'loading') { detector.current?.dispose(); detector.current = undefined }
    if (ocr.status === 'loading') { recognizer.current?.dispose(); recognizer.current = undefined }
    if (!captured) setCameraOpen(false)
    setSelectedIndex(undefined)
    setObjectFocus(undefined)
    setMarkersVisible(true)
    setDismissedSummaryId(undefined)
    setCorrections([])
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
    setCorrections([])
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
    setCorrections([])
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
    requestAnimationFrame(() => viewfinder.current?.querySelectorAll<HTMLButtonElement>('.detection-hotspot')[index ?? 0]?.focus({ preventScroll: true }))
  }

  if (showSplash || showStory) return <LingStory startWithSplash={showSplash} skipStory={!showStory} onDone={() => { setShowStory(false); setShowSplash(false) }} />

  return <div className={'app-shell everyday-app' + (!image && !cameraOpen ? ' is-home' : '')}>
    <header className="site-header">
      <button className="brand-button" aria-label="Think-a-ling home" onClick={goHome}><Brand /></button>
      <span className="header-tagline">A little help. A whole new perspective.</span>
      <div className="header-right">
        <button className="help-button" onClick={() => help.current?.showModal()} aria-label="How it works"><HelpCircle size={21} /></button>
      </div>
    </header>
    <main>
      <div className="page-intro"><div><span className="eyebrow"><Sparkles size={16} /> YOUR WORLD. FULL OF POSSIBILITIES.</span>
        <h1>{image || cameraOpen ? <>Let’s find your <em>next step.</em></> : <>What can we<br /><em>figure out today?</em></>}</h1></div>
      </div>
      {!localReasoningAvailable && <div className="runtime-strip"><ShieldCheck size={16} /><span>Objects & text work here · deeper answers need the local app</span><button onClick={() => help.current?.showModal()}>How local AI works <ArrowUpRight size={14} /></button></div>}
      <section ref={viewfinder} data-detection-status={detection.status} data-ocr-status={ocr.status} className={'viewfinder' + (image ? ' has-image' : '') + (cameraOpen ? ' has-camera' : '') + (panelOpen || selectedIndex !== undefined ? ' has-drawer' : '') + (selectedIndex !== undefined ? ' has-object-card' : '') + (sceneBuilding || detection.status === 'loading' ? ' is-scanning' : '')} aria-label="Your visual workspace">
        {(image || cameraOpen) && <div className="camera-top">
          <button className="back-to-start" onClick={goHome} aria-label="Back to start"><Undo2 size={18} /><span>Back</span></button>
          <div className="camera-tools">
            <button disabled={busy} onClick={startCamera} aria-label="Use camera"><Camera size={18} /></button>
            <button disabled={loadingImage} onClick={() => fileInput.current?.click()} aria-label="Upload a photo" title="Change photo"><ImageUp size={18} /></button>
            <button onClick={() => { setMarkersVisible(value => !value); setSelectedIndex(undefined) }} aria-label={markersVisible ? 'Hide object markers' : 'Show object markers'} aria-pressed={markersVisible} title={markersVisible ? 'Hide object markers' : 'Show object markers'}>{markersVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
            <button disabled={!image} onClick={() => void expand()} aria-label="Expand image" title="Fullscreen photo"><Maximize size={18} /></button>
            <button onClick={() => help.current?.showModal()} aria-label="Help"><HelpCircle size={18} /></button>
          </div>
        </div>}
        {cameraOpen && <LiveCamera markersVisible={markersVisible} processing={loadingImage} onClose={goHome} onCapture={(file, object) => { if (object) setMode('EXPLORE'); void selectImage(file, true, object) }} />}
        <div ref={photoFrame} className="image-stage" hidden={cameraOpen}>
          {image && <div className="fullscreen-tools"><button aria-label={markersVisible ? 'Hide fullscreen markers' : 'Show fullscreen markers'} onClick={() => setMarkersVisible(value => !value)}>{markersVisible ? <Eye size={21} /> : <EyeOff size={21} />}{markersVisible ? 'Hide markers' : 'Show markers'}</button><button aria-label="Exit fullscreen photo" onClick={() => void document.exitFullscreen()}><X size={21} /> Close</button></div>}
          {image ? <ImagePreview image={image} detections={detection.data} markersVisible={markersVisible} corrections={corrections} selectedIndex={selectedIndex} onObjectSelect={selectObject} /> : <div className="welcome">
            <div className="welcome-copy"><span className="welcome-number">01 / START WITH A PHOTO</span>
            <h2>Start with<br />what’s here<span>.</span></h2>
            <p>Point your camera or choose a photo.<br />Start with the objects and words in front of you.</p>
            <div className="start-actions"><button className="primary" aria-label="Use camera" disabled={busy} onClick={startCamera}><Camera size={22} /> Open camera <ArrowUpRight size={20} /></button>
            <button className="upload-btn" aria-label="Upload a photo" disabled={busy} onClick={() => fileInput.current?.click()}><ImageUp size={20} /> Choose a photo</button></div>
            <span className="welcome-note"><ShieldCheck size={16} /> No account. No image uploads to the cloud.</span></div>
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
          {detection.status === 'loading' || ocr.status === 'loading' ? <div className="quick-progress" role="status"><span>{ocrProgress === undefined ? 'Noticing objects and reading text…' : `Reading text · ${ocrProgress}%`}</span>{ocrProgress !== undefined && <progress aria-label="Reading text" value={Number(ocrProgress)} max={100} />}<button onClick={cancelQuickScan}>Cancel scan</button></div> : <span className="photo-hint">{detection.data.length ? 'Tap a green dot to explore.' : localReasoningAvailable ? 'No objects found. You can still read text or ask about the photo.' : 'No objects found. Try a clearer photo, or read its text.'}</span>}
          <div className="photo-buttons">
            <button disabled={busy} onClick={() => void detect()} aria-label="Detect objects"><Focus size={17} /> Scan again</button>
            <button onClick={() => textDialog.current?.showModal()} aria-label="Read text"><ScanText size={17} /> Read text</button>
            {!sceneSnapshot && <button className="photo-next" aria-label="Explore this photo" disabled={sceneBuilding || !localReasoningAvailable} title={!localReasoningAvailable ? 'Deeper analysis requires the local app with Ollama' : undefined} onClick={() => { setObjectFocus(undefined); setGoalRequest(undefined); openQuestion(); if (localReasoningAvailable) setAutoBuild(true) }}>Analyze photo <ArrowRight size={18} /></button>}
          </div>
          {detection.status === 'error' && <p role="alert" className="error">{detection.message} Try scanning again.</p>}
          {sceneBuilding && !panelOpen && <button className="thinking-link" onClick={() => openQuestion()}>Understanding your photo... View progress</button>}
        </div>}
      {sceneSnapshot && <section ref={summary} tabIndex={-1} className="scene-summary" aria-label="Photo summary">
        <Mascot /><div><span className="sheet-kicker">HERE'S THE PICTURE</span><p className="answer-ready">100% · Analysis complete</p><p className="scene-description">{sceneSnapshot.description}</p><small>AI interpretation. Check important details against your photo.</small>{corrections.length > 0 && <p className="correction-note">Your label changes apply to new questions. This description was written from the original photo.</p>}
        {!!sceneSnapshot.uncertainty.length && <details><summary>What is unclear?</summary>{sceneSnapshot.uncertainty.map((note, index) => <p key={index}>{note}</p>)}</details>}</div>
      </section>}
        {selectedIndex !== undefined && detection.data[selectedIndex] && <ObjectCard key={discoveryKey(detection.data[selectedIndex])} detection={detection.data[selectedIndex]} index={selectedIndex}
          displayName={objectDisplayName(detection.data[selectedIndex], detection.data, corrections)}
          correction={corrections.find(item => sameDetection(item, detection.data[selectedIndex]))} onCorrect={label => correctLabel(detection.data[selectedIndex], label)} onReplace={() => fileInput.current?.click()}
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
      {sceneSnapshot && <nav className="intent-choices" aria-label="Scene experience">
        {([{ name: 'EXPLORE', label: 'Explore', hint: 'Understand it. Discover a use.', icon: Compass }, { name: 'FIND', label: 'Find', hint: 'What here could help with your goal?', icon: Search }, { name: 'FIX', label: 'Fix', hint: 'Find what to check first.', icon: Wrench }, { name: 'IMPROVE', label: 'Improve', hint: 'Make more of what you already have.', icon: Sparkles }] as const).map(({ name, label, hint, icon: Icon }) => <button key={name} data-mode={name} aria-label={label} aria-pressed={mode === name} aria-controls="ask-panel" className={mode === name ? 'selected' : ''} onClick={() => { setMode(name); setObjectFocus(undefined); setGoalRequest(undefined); openQuestion() }}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span></button>)}
      </nav>}
      {image && <button className="floating-ask" aria-label={panelOpen ? 'Close chat' : 'Ask This Space'} aria-expanded={panelOpen} aria-controls="ask-panel" onClick={() => { if (panelOpen) setPanelOpen(false); else openQuestion() }}><Mascot thinking={sceneBuilding} /><span>{panelOpen ? 'Close chat' : 'Ask This Space'}</span>{panelOpen ? <X size={19} /> : <ArrowUpRight size={19} />}</button>}
      {summaryNotice && sceneSnapshot && <div className="summary-ready-notice" role="status"><button onClick={() => { setDismissedSummaryId(sceneSnapshot.id); summary.current?.focus({ preventScroll: true }); summary.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}><ArrowDown size={20} /><span><strong>HERE'S THE PICTURE</strong><small>Your photo summary is ready. View below.</small></span></button><button aria-label="Dismiss summary notice" onClick={() => setDismissedSummaryId(sceneSnapshot.id)}><X size={17} /></button></div>}
      <footer><span><span className="privacy-dot" /> Curiosity on. Privacy first. Images stay on your device.</span></footer>
      {!image && !cameraOpen && <button className="replay-story" onClick={() => setShowStory(true)}>Meet Ling again</button>}
    </main>
    <dialog ref={pictureDialog} className="picture-dialog" aria-label="Fullscreen photo" onClose={() => setPictureOpen(false)}><div className="fullscreen-tools"><button aria-label={markersVisible ? 'Hide fullscreen markers' : 'Show fullscreen markers'} onClick={() => setMarkersVisible(value => !value)}>{markersVisible ? <Eye size={21} /> : <EyeOff size={21} />}{markersVisible ? 'Hide markers' : 'Show markers'}</button><button aria-label="Close fullscreen photo" onClick={() => pictureDialog.current?.close()}><X size={22} /> Close</button></div>{pictureOpen && image && <ImagePreview image={image} detections={detection.data} corrections={corrections} markersVisible={markersVisible} selectedIndex={selectedIndex} onObjectSelect={selectObject} />}</dialog>
    <dialog ref={textDialog} className="help-dialog text-dialog" aria-labelledby="text-title">
      <button className="sheet-close" onClick={() => textDialog.current?.close()} aria-label="Close text"><X size={20} /></button>
      <h2 id="text-title">Text in your photo</h2>
      {ocr.status === 'loading' && <p role="status">Reading the text...</p>}
      {ocr.status === 'error' && <p role="alert" className="error">{ocr.message}</p>}
      {ocr.status === 'done' && (ocr.data ? <textarea id="recognized-text" aria-label="Recognized text" readOnly value={ocr.data} rows={8} /> : <p>No readable text found. Try a closer, sharper photo.</p>)}
      {ocr.status === 'idle' && <p>Choose a photo to read its text.</p>}
      <button disabled={!image || busy} onClick={() => void recognize()}>Read again</button>
      {ocr.data.trim() && <button disabled={!localReasoningAvailable} onClick={() => { textDialog.current?.close(); openQuestion('Explain the text in this photo.') }}>Explain this text</button>}
      {ocr.data.trim() && !localReasoningAvailable && <p className="context-note">Reading text works here. Explanations and study questions need the local app with Ollama.</p>}
      <p className="context-note">Text recognition can make mistakes. Compare important details with your photo.</p>
    </dialog>
    <dialog ref={help} className="help-dialog" aria-labelledby="help-title">
      <button className="sheet-close" onClick={() => help.current?.close()} aria-label="Close help"><X size={20} /></button><Brand />
      <h2 id="help-title">Your everyday, reimagined.</h2>
      <p>Choose a photo or capture one. Objects and readable text appear automatically. Tap a green dot to inspect an object. In the local development app, you can also ask questions and reuse your photo’s saved understanding.</p>
      <p>Green boxes and confidence scores come from MediaPipe. Text comes from Tesseract. Gemma descriptions have no measured locations. Check the evidence and uncertainty beside every response.</p>
      <p>Detection and OCR run in your browser. Deeper answers use Gemma through Ollama on the computer running the local development app. They can take a minute or more on a CPU. A public website has no connection to the developer’s local model; visitors get browser detection and OCR, not Gemma reasoning. This is not a safety or medical assessment.</p>
      <p>Use live camera for periodic on-device detection. Capture freezes a frame and stops the camera. Review it, then retake or analyze it. This website detects objects and reads text; deeper scene interpretation needs the local app. Camera access requires HTTPS or localhost and your permission. Front/rear selection depends on your device. Voice input is not included.</p>
      <p>Internet is needed to load this website and its model files. Once detection and text reading have initialized, you can keep using them without internet while this page stays open. Offline reload or installation is not supported. Your photos are processed on your device and are not uploaded; the hosting provider receives normal page and asset requests.</p>
      <button className="primary" onClick={() => help.current?.close()}>Let’s explore <ArrowUpRight size={18} /></button>
    </dialog>
  </div>
}

export default App
