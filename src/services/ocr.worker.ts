import { createWorker, OEM, PSM } from 'tesseract.js'
import type { Worker } from 'tesseract.js'
import { errorMessage, localAsset } from './assets'

// Owning Tesseract in a dedicated worker lets the service terminate the entire
// worker tree, including when Tesseract fails before createWorker resolves.
let engine: Promise<Worker> | undefined
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    engine ??= createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: localAsset('tesseract/worker.min.js'),
      corePath: localAsset('tesseract/core'),
      langPath: localAsset('tesseract/lang'),
      workerBlobURL: false,
      cacheMethod: 'none',
      logger: message => self.postMessage({ type: 'progress', message: `${message.status} (${Math.round(message.progress * 100)}%)` }),
      errorHandler: error => self.postMessage({ type: 'error', message: errorMessage(error) }),
    }).then(async worker => {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
      return worker
    })
    const worker = await engine
    const result = await worker.recognize(event.data)
    self.postMessage({ type: 'result', text: result.data.text.trim() })
  } catch (error) {
    self.postMessage({ type: 'error', message: errorMessage(error) })
  }
}
