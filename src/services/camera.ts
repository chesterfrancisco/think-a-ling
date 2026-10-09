export const LIVE_DETECTION_INTERVAL_MS = 750

export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access for this site in your browser settings, then retry, or upload a photo.'
  if (name === 'NotFoundError') return 'No camera was found. Connect a camera or upload a photo.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera could not start. It may be in use by another app. Close that app and retry.'
  if (name === 'OverconstrainedError') return 'That camera is unavailable. Choose another camera or retry with the front/rear preference.'
  return error instanceof Error ? error.message : 'Camera access failed. Retry or upload a photo.'
}

// A generation guard also stops streams granted after the user has left.
export class CameraService {
  private generation = 0
  private stream?: MediaStream

  async start(selection: string): Promise<MediaStream> {
    this.stop()
    const generation = this.generation
    if (!globalThis.isSecureContext) throw new Error('Camera access needs HTTPS or localhost. Open the secure local app, or upload a photo.')
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access. Try current Chrome or Edge, or upload a photo.')
    const video: MediaTrackConstraints = {
      width: { ideal: 1280 }, height: { ideal: 720 },
      ...(selection.startsWith('device:') ? { deviceId: { exact: selection.slice(7) } } : { facingMode: { ideal: selection } }),
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
    if (generation !== this.generation) {
      stream.getTracks().forEach(track => track.stop())
      throw new DOMException('Camera request superseded.', 'AbortError')
    }
    this.stream = stream
    return stream
  }

  stop(): void {
    this.generation++
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = undefined
  }
}

export async function captureFrame(video: HTMLVideoElement, preview?: HTMLCanvasElement): Promise<File> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('Wait for a camera frame before capturing.')
  // Draw synchronously into the visible review surface before stopping tracks.
  // Keep that surface intact while PNG encoding runs asynchronously.
  const canvas = preview ?? document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not capture this frame. Try uploading a photo.')
  context.drawImage(video, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode the captured frame.')), 'image/png'))
  if (!preview) canvas.width = canvas.height = 0
  return new File([blob], 'camera-' + Date.now() + '.png', { type: 'image/png' })
}
