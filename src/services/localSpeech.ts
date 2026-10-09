type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
export interface LocalRecognition {
  processLocally: boolean; lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; abort: () => void
}
type SpeechConstructor = {
  new(): LocalRecognition
  prototype: LocalRecognition
  available: (options: { langs: string[]; processLocally: true }) => Promise<string>
  install: (options: { langs: string[]; processLocally: true }) => Promise<boolean>
}
export function localSpeechEngine(): SpeechConstructor {
  const host = globalThis as typeof globalThis & { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor }
  const engine = host.SpeechRecognition ?? host.webkitSpeechRecognition
  if (!globalThis.isSecureContext || !engine || !('processLocally' in engine.prototype) || !engine.available || !engine.install) {
    throw new Error('On-device voice is not supported here. You can still type your question. No cloud voice service will be used.')
  }
  return engine
}
export function speechError(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone or local speech permission was denied. Allow it in browser settings, or type instead.'
  if (code === 'audio-capture') return 'No usable microphone found. Check your microphone or type instead.'
  if (code === 'no-speech') return 'No speech heard. Try again, or type your question.'
  if (code === 'language-not-supported') return 'This local voice pack is unavailable. Check voice setup again, or type instead.'
  return 'Local voice could not finish. Try again, or type instead. No cloud fallback is used.'
}
