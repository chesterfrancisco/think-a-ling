import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'
import { CameraService, cameraError, captureFrame, LIVE_DETECTION_INTERVAL_MS } from '../services/camera'
import { ObjectDetectionService } from '../services/objectDetection'
import type { DetectedObject } from '../services/objectDetection'

interface Props { onCapture: (file: File, object?: string) => void; onClose: () => void; markersVisible?: boolean; processing?: boolean }

export function LiveCamera({ onCapture, onClose, markersVisible = true, processing = false }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const frozenFrame = useRef<HTMLCanvasElement>(null)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const stopSession = useRef<() => void>(() => {})
  const captureGeneration = useRef(0)
  const captureLock = useRef(false)
  const [selection, setSelection] = useState('environment')
  const [attempt, setAttempt] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [phase, setPhase] = useState<'starting' | 'live' | 'error' | 'paused' | 'capturing' | 'review'>('starting')
  const [captured, setCaptured] = useState<{ file: File; object?: string }>()
  const reviewing = phase === 'capturing' || phase === 'review'
  const [message, setMessage] = useState('Requesting camera permission…')
  const [detectionMessage, setDetectionMessage] = useState('Preparing local detection…')
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 })
  const [snapshot, setSnapshot] = useState<{ width: number; height: number; objects: DetectedObject[]; count: number; ms: number }>({ width: 1280, height: 720, objects: [], count: 0, ms: 0 })

  useEffect(() => {
    if (phase === 'review') reviewButton.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    const camera = new CameraService()
    const detector = new ObjectDetectionService()
    const element = video.current!
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let count = 0
    const canvas = document.createElement('canvas')
    const preview = frozenFrame.current
    const stop = () => {
      active = false
      clearTimeout(timer)
      detector.dispose()
      camera.stop()
      element.srcObject = null
    }
    stopSession.current = stop
    const pause = () => { if (active) { stop(); setPhase('paused'); setMessage('Camera paused. Resume when you are ready.'); setSnapshot(previous => ({ ...previous, objects: [] })) } }
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    async function tick() {
      if (!active || document.hidden) return
      if (element.readyState < 2 || element.paused) { timer = setTimeout(() => void tick(), LIVE_DETECTION_INTERVAL_MS); return }
      const start = performance.now()
      setDimensions(previous => previous.width === element.videoWidth && previous.height === element.videoHeight ? previous : { width: element.videoWidth, height: element.videoHeight })
      const scale = Math.min(1, 960 / Math.max(element.videoWidth, element.videoHeight))
      canvas.width = Math.round(element.videoWidth * scale)
      canvas.height = Math.round(element.videoHeight * scale)
      canvas.getContext('2d')!.drawImage(element, 0, 0, canvas.width, canvas.height)
      try {
        const objects = await detector.detect(canvas, text => { if (active) setDetectionMessage(text) })
        if (!active) return
        setSnapshot({ width: canvas.width, height: canvas.height, objects, count: ++count, ms: performance.now() - start })
        setDetectionMessage(objects.length ? objects.length + ' live predictions' : 'No objects above the confidence threshold')
        // No overlap; the next sample starts only after this inference and a pause.
        timer = setTimeout(() => void tick(), LIVE_DETECTION_INTERVAL_MS)
      } catch (error) { if (active) { detector.dispose(); setDetectionMessage('Live detection stopped: ' + cameraError(error) + ' Capture still works; retry camera to reload detection.') } }
    }
    async function start() {
      try {
        const stream = await camera.start(selection)
        if (!active) { camera.stop(); return }
        element.srcObject = stream
        const track = stream.getVideoTracks()[0]
        track.addEventListener('ended', pause, { once: true })
        await element.play()
        if (!active) return
        setDimensions({ width: element.videoWidth, height: element.videoHeight })
        setPhase('live')
        setMessage(track.label || 'Live camera')
        const available = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        if (!active) return
        setDevices(available.filter(device => device.kind === 'videoinput'))
        void tick()
      } catch (error) { if (active) { stop(); setPhase('error'); setMessage(cameraError(error)) } }
    }
    void start()
    const invalidateCapture = () => { captureGeneration.current++ }
    return () => {
      invalidateCapture()
      stop()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pause)
      if (preview) preview.width = preview.height = 0
    }
  }, [selection, attempt])

  function restart(next = selection) {
    captureGeneration.current++
    captureLock.current = false
    setCaptured(undefined)
    stopSession.current()
    setPhase('starting')
    setMessage('Requesting camera permission…')
    setSnapshot(previous => ({ ...previous, objects: [], count: 0 }))
    setSelection(next)
    setAttempt(previous => previous + 1)
  }

  async function capture(object?: string) {
    if (!video.current || !frozenFrame.current || phase !== 'live' || captureLock.current) return
    captureLock.current = true
    const run = ++captureGeneration.current
    setPhase('capturing')
    try {
      const pending = captureFrame(video.current, frozenFrame.current)
      stopSession.current()
      const file = await pending
      if (run === captureGeneration.current) { setCaptured({ file, object }); setPhase('review') }
    } catch (error) { if (run === captureGeneration.current) { setPhase('error'); setMessage(cameraError(error)) } }
    finally { if (run === captureGeneration.current) captureLock.current = false }
  }

  return <div className="live-camera" data-phase={phase} data-detection-count={snapshot.count}>
    <div className="live-camera-toolbar">
      {reviewing ? <span className="capture-review-title">Your photo</span> : <label>Camera<select aria-label="Camera selection" value={selection} onChange={event => restart(event.target.value)}>
        <option value="environment">Rear camera (preferred)</option><option value="user">Front camera (preferred)</option>
        {devices.map((device, index) => <option value={'device:' + device.deviceId} key={device.deviceId || index}>{device.label || 'Camera ' + (index + 1)}</option>)}
      </select></label>}
      <button type="button" className="small-glass" onClick={onClose} aria-label={reviewing ? 'Discard photo' : 'Stop camera'}><X size={20} /></button>
    </div>
    <div className="live-video-stage">
      <div className="video-preview">
        <video ref={video} hidden={reviewing} width={dimensions.width} height={dimensions.height} autoPlay muted playsInline aria-label="Live camera preview" />
        <canvas ref={frozenFrame} hidden={!reviewing} className="captured-preview" role="img" aria-label="Captured photo preview" />
        {phase === 'live' && markersVisible && <>
          <svg viewBox={`0 0 ${snapshot.width} ${snapshot.height}`} role="img" aria-label={`${snapshot.objects.length} live object bounding boxes`}>
            {snapshot.objects.map((object, index) => <rect key={index} x={object.box.x} y={object.box.y} width={object.box.width} height={object.box.height} fill="none" stroke="#19ef91" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
          {snapshot.objects.map((object, index) => <button className="box-label" key={index} aria-label={`Capture and ask about ${object.label} ${index + 1}`} onClick={() => void capture(object.label)} style={{ left: Math.min(80, Math.max(0, object.box.x / snapshot.width * 100)) + '%', top: Math.min(94, Math.max(0, object.box.y / snapshot.height * 100)) + '%' }}>{object.confidence < .6 ? 'Maybe ' : ''}{object.label}?</button>)}
        </>}
      </div>
    </div>
    <div className="live-camera-status">
      <p role={phase === 'error' ? 'alert' : 'status'}>{phase === 'capturing' ? 'Saving your photo…' : phase === 'review' ? 'Happy with this photo?' : message}</p>
      {reviewing && <><small>Retake for a clearer view, or let Ling take a closer look.</small><div className="capture-review-actions"><button className="camera-retry" disabled={processing} onClick={() => restart()}><RefreshCw size={18} /> Retake photo</button><button ref={reviewButton} className="primary" disabled={!captured || phase !== 'review' || processing} onClick={() => { if (captured) onCapture(captured.file, captured.object) }}>{processing ? 'Opening photo…' : 'Analyze photo'}</button></div></>}
      {phase === 'live' && <><p>{detectionMessage}</p><small>Quick guesses can be wrong. Capture a still photo to correct a name or look closer.</small></>}
      {phase === 'live' && <button className="primary" onClick={() => void capture()}><Camera size={18} /> Capture photo</button>}
      {phase !== 'starting' && !reviewing && <button className="camera-retry" onClick={() => restart()}><RefreshCw size={14} />{phase === 'paused' ? 'Resume camera' : 'Retry camera'}</button>}
    </div>
  </div>
}
