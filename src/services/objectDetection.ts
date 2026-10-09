import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import { localAsset } from './assets'

export const DETECTION_THRESHOLD = 0.35
export interface DetectedObject {
  label: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

export class ObjectDetectionService {
  private detector?: ObjectDetector
  private initializing?: Promise<ObjectDetector>
  private disposed = false

  private initialize(): Promise<ObjectDetector> {
    if (this.disposed) return Promise.reject(new Error('Object detector has been disposed.'))
    if (this.detector) return Promise.resolve(this.detector)
    this.initializing ??= (async () => {
      const files = await FilesetResolver.forVisionTasks(localAsset('mediapipe'))
      const detector = await ObjectDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: localAsset('models/efficientdet_lite0.tflite'), delegate: 'CPU' },
        runningMode: 'IMAGE', scoreThreshold: DETECTION_THRESHOLD, maxResults: 20,
      })
      if (this.disposed) {
        detector.close()
        throw new Error('Object detector has been disposed.')
      }
      this.detector = detector
      return detector
    })().catch(error => {
      this.initializing = undefined
      throw error
    })
    return this.initializing
  }

  async detect(image: HTMLImageElement | HTMLCanvasElement, onStatus: (status: string) => void): Promise<DetectedObject[]> {
    onStatus(this.detector ? 'Detecting objects…' : 'Loading local object detection model…')
    const detector = await this.initialize()
    onStatus('Detecting objects…')
    // Paint the loading state before MediaPipe's synchronous single-image call.
    await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
    if (this.disposed) throw new Error('Object detector has been disposed.')
    return detector.detect(image).detections.flatMap(detection => {
      const category = detection.categories[0]
      const box = detection.boundingBox
      if (!category || !box) return []
      return [{ label: category.categoryName, confidence: category.score,
        box: { x: box.originX, y: box.originY, width: box.width, height: box.height } }]
    })
  }

  dispose(): void {
    this.disposed = true
    this.detector?.close()
    this.detector = undefined
  }
}
