import type { UploadedImage } from './image'
import { ObjectDetectionService } from './objectDetection'
import type { DetectedObject } from './objectDetection'
import { OcrService } from './ocr'
import { analyzeImage, OllamaError, localReasoningAvailable } from './ollama'
import { browserScene } from './browserReasoning'
import { assembleScene } from './scene'
import { errorMessage } from './assets'

export interface SceneSupport {
  detections: DetectedObject[] | null
  ocrText: string | null
  onDetections: (value: DetectedObject[]) => void
  onOcr: (value: string) => void
}

export async function buildScene(
  image: UploadedImage, support: SceneSupport, signal: AbortSignal, onStatus: (text: string) => void,
) {
  const start = performance.now()
  const detector = new ObjectDetectionService()
  const ocr = new OcrService()
  const dispose = () => { detector.dispose(); ocr.dispose() }
  signal.addEventListener('abort', dispose, { once: true })
  let detections = support.detections
  let ocrText = support.ocrText
  const failures: { detection?: string; ocr?: string } = {}
  try {
    signal.throwIfAborted()
    if (detections === null) {
      try {
        detections = await detector.detect(image.element, onStatus)
        signal.throwIfAborted()
        support.onDetections(detections)
      } catch (error) {
        signal.throwIfAborted()
        failures.detection = errorMessage(error)
        detections = []
      }
    }
    if (ocrText === null) {
      try {
        ocrText = await ocr.recognize(image.file, onStatus)
        signal.throwIfAborted()
        support.onOcr(ocrText)
      } catch (error) {
        signal.throwIfAborted()
        failures.ocr = errorMessage(error)
        ocrText = ''
      }
    }
    dispose()
    signal.throwIfAborted()
    if (!localReasoningAvailable) {
      onStatus('Interpreting the photo on this device…')
      const scene = await browserScene(image, detections, ocrText, signal)
      if (failures.ocr) { scene.ocr.status = 'error'; scene.ocr.error = failures.ocr }
      if (failures.detection) scene.uncertainty.push('Object detection was unavailable: ' + failures.detection)
      return scene
    }
    const result = await analyzeImage(image, 'SCENE', '', {
      detections: failures.detection ? null : detections,
      ocrText: failures.ocr ? null : ocrText,
    }, signal, onStatus)
    signal.throwIfAborted()
    return assembleScene(image, detections, ocrText, result, failures, performance.now() - start)
  } catch (error) {
    if (signal.aborted) throw new OllamaError('cancelled', 'Analysis cancelled.')
    throw error
  } finally {
    signal.removeEventListener('abort', dispose)
    dispose()
  }
}
