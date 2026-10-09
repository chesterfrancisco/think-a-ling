type OcrMessage = { type: 'progress'; message: string } | { type: 'error'; message: string } | { type: 'result'; text: string }

export class OcrService {
  private worker?: Worker
  private disposed = false
  private cancel?: () => void

  async recognize(image: Blob, onStatus: (status: string) => void): Promise<string> {
    if (this.disposed) throw new Error('OCR has been disposed.')
    if (this.cancel) throw new Error('OCR is already running.')
    onStatus(this.worker ? 'Recognizing text…' : 'Loading local OCR engine…')
    this.worker ??= new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' })
    const worker = this.worker
    return new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        this.cancel = undefined
      }
      const fail = (message: string) => {
        cleanup()
        worker.terminate()
        this.worker = undefined
        reject(new Error(message))
      }
      const timer = setTimeout(() => fail('OCR timed out. Try a smaller image.'), 120_000)
      this.cancel = () => fail('OCR has been disposed.')
      worker.onmessage = (event: MessageEvent<OcrMessage>) => {
        if (event.data.type === 'progress') onStatus(event.data.message)
        else if (event.data.type === 'error') fail(event.data.message)
        else {
          cleanup()
          resolve(event.data.text)
        }
      }
      worker.onerror = event => {
        event.preventDefault()
        fail(event.message || 'Could not load the local OCR worker.')
      }
      worker.onmessageerror = () => fail('Could not read the OCR worker response.')
      try { worker.postMessage(image) } catch (error) { fail(String(error)) }
    })
  }

  dispose(): void {
    this.disposed = true
    this.cancel?.()
    this.worker?.terminate()
    this.worker = undefined
  }
}
