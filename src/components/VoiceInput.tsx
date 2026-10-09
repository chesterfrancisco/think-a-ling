import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { localSpeechEngine, speechError } from '../services/localSpeech'
import type { LocalRecognition } from '../services/localSpeech'

export function VoiceInput({ disabled, onTranscript }: { disabled: boolean; onTranscript: (text: string) => void }) {
  const [phase, setPhase] = useState<'idle' | 'checking' | 'download' | 'installing' | 'ready' | 'listening' | 'error'>('idle')
  const [message, setMessage] = useState('Experimental · English, on-device only. Browser and language-pack support vary. Review the words before asking Ling.')
  const recognition = useRef<LocalRecognition | undefined>(undefined)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const transcriptHandler = useRef(onTranscript)
  useEffect(() => { transcriptHandler.current = onTranscript }, [onTranscript])
  function cancel() {
    generation.current++
    clearTimeout(timer.current)
    const current = recognition.current; recognition.current = undefined
    if (current) { current.onend = null; current.onerror = null; current.onresult = null; current.abort() }
  }
  useEffect(() => cancel, [])
  useEffect(() => {
    const hidden = () => { if (document.hidden) { cancel(); setPhase('idle'); setMessage('Voice stopped when you left this page.') } }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [])
  async function prepare(install = false) {
    cancel(); const run = generation.current
    setPhase(install ? 'installing' : 'checking')
    setMessage(install ? 'Installing the browser’s English voice pack. This can take a while.' : 'Checking local English voice support…')
    timer.current = setTimeout(() => { cancel(); setPhase('error'); setMessage('Voice setup timed out. Try again later, or type instead.') }, 120000)
    try {
      const engine = localSpeechEngine()
      if (install && !await engine.install({ langs: ['en-US'], processLocally: true })) throw new Error('The browser could not install its English voice pack. Try again later.')
      const available = await engine.available({ langs: ['en-US'], processLocally: true })
      if (run !== generation.current) return
      clearTimeout(timer.current)
      if (available === 'available') { setPhase('ready'); setMessage('Voice ready. Tap Speak, say your question, then review it. Nothing is submitted automatically.') }
      else if (available === 'downloadable' || available === 'downloading') { setPhase('download'); setMessage('Your browser needs an English voice pack. Download requires internet; speech recognition will stay on this device.') }
      else throw new Error('Local English speech recognition is unavailable on this device. Please type your question.')
    } catch (error) { if (run === generation.current) { clearTimeout(timer.current); setPhase('error'); setMessage(error instanceof Error ? error.message : 'Could not prepare voice.') } }
  }
  function speak() {
    cancel(); const run = generation.current
    try {
      const Engine = localSpeechEngine(); const current = new Engine()
      current.processLocally = true
      if (current.processLocally !== true) throw new Error('This browser cannot guarantee local speech recognition. Please type instead.')
      current.lang = 'en-US'; current.continuous = false; current.interimResults = false
      recognition.current = current
      let heard = false
      current.onresult = event => {
        if (run !== generation.current) return
        const text = Array.from(event.results).slice(event.resultIndex).filter(r => r.isFinal).map(r => r[0].transcript).join(' ').trim()
        if (!text) return
        heard = true; transcriptHandler.current(text.slice(0, 500))
        setMessage('Added to your question. Check the wording and selected mode, then tap Ask Ling.')
      }
      current.onerror = event => { if (run === generation.current) { cancel(); setPhase('error'); setMessage(speechError(event.error)) } }
      current.onend = () => { if (run === generation.current) { clearTimeout(timer.current); recognition.current = undefined; setPhase('ready'); if (!heard) setMessage('No words captured. Tap Speak to try again, or type instead.') } }
      setPhase('listening'); setMessage('Listening on this device…')
      current.start()
      timer.current = setTimeout(() => { cancel(); setPhase('ready'); setMessage('Listening stopped after 30 seconds. Review your question or try again.') }, 30000)
    } catch (error) { cancel(); setPhase('error'); setMessage(error instanceof Error ? error.message : 'Could not start local voice.') }
  }
  const waiting = phase === 'checking' || phase === 'installing'
  return <div className="local-voice">
    <button type="button" title={phase === 'listening' ? 'Stop listening' : phase === 'ready' ? 'Speak your question' : phase === 'download' ? 'Install English voice pack' : 'Enable local voice'} aria-label={phase === 'listening' ? 'Stop listening' : phase === 'ready' ? 'Speak your question' : phase === 'download' ? 'Install English voice pack' : 'Enable local voice'} disabled={disabled || waiting} onClick={() => phase === 'listening' ? (cancel(), setPhase('ready'), setMessage('Voice stopped.')) : phase === 'ready' ? speak() : void prepare(phase === 'download')}>
      {phase === 'listening' ? <Square size={16} /> : <Mic size={16} />}
    </button>
    {waiting && <button type="button" onClick={() => { cancel(); setPhase('idle'); setMessage('Setup closed. A browser-managed language download may continue; the microphone was not opened.') }}>Cancel voice setup</button>}
    <small role={phase === 'error' ? 'alert' : 'status'}>{message}</small>
  </div>
}
