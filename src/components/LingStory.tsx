import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Brand } from './Brand'
import { LingStoryArt } from './LingStoryArt'
import { STORY_KEY } from '../services/storyPreference'
import { localReasoningAvailable } from '../services/ollama'
import './LingStory.css'

const pages = [
  { activity: 'hello', title: 'Hi, I’m Ling!', question: 'Your world. Full of possibilities.', text: 'Think-a-ling! helps you figure out everyday problems using what’s around you. Show me a space, an object or some information. Tell me what you need, and we’ll look for a useful next step.', hint: 'See possibilities. Think differently. Do more.' },
  { activity: 'workspace', title: 'A little room for better.', question: 'What can I improve here?', text: 'Point at your workspace. Explore the objects, rethink a corner, or ask how to organise what’s there.', hint: 'Small changes. Everyday possibilities.' },
  { activity: 'label', title: 'Make the small print clearer.', question: 'What should I know before buying this?', text: 'Show Ling a product label. Read the visible words and ask about ingredients or warnings in the text.', hint: 'Check the original label. Ling can misread, too.' },
  { activity: 'study', title: 'Turn a page into a possibility.', question: 'Help me understand this.', text: 'Bring your notes or a textbook. Explore the recognised text and ask for simple study prompts or flashcards.', hint: 'Start with the words in your photo.' },
  { activity: 'check', title: 'A second look can help.', question: 'Is there anything I should check?', text: 'Look closer at a possible concern. Ling can suggest checks from visible clues, but can’t certify that something is safe.', hint: 'Your judgement matters. You can correct a wrong name.' },
] as const

export function LingStory({ onDone, startWithSplash = true, skipStory = false }: { onDone: () => void; startWithSplash?: boolean; skipStory?: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'story'>(startWithSplash ? 'loading' : 'story')
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const page = pages[step]
  useEffect(() => {
    if (phase === 'ready') startButton.current?.focus({ preventScroll: true })
    if (phase === 'story') heading.current?.focus({ preventScroll: true })
  }, [phase, step])
  useEffect(() => {
    if (phase !== 'loading') return
    // Brand introduction only. No inference or camera permission starts here.
    // Finish the opening animation, then wait indefinitely for a real tap.
    const timer = setTimeout(() => setPhase('ready'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1500)
    return () => clearTimeout(timer)
  }, [phase])
  function finish() {
    try { localStorage.setItem(STORY_KEY, 'seen') } catch { /* Works without storage. */ }
    onDone()
  }
  if (phase !== 'story') return <main className={'ling-splash is-' + phase} data-phase={phase}>
    <button ref={startButton} className="splash-start" aria-label={phase === 'ready' ? 'Tap anywhere to continue' : 'Opening Think-a-ling'} disabled={phase === 'loading'} onClick={() => { if (phase === 'ready') { if (skipStory) onDone(); else setPhase('story') } }}>
      <span className="splash-center"><Brand /><span className="splash-tagline">Point at anything. Know what to do.</span><span className="splash-loading" aria-hidden="true"><span /></span></span>
      {phase === 'ready' && <span className="splash-prompt">Tap anywhere to continue</span>}
    </button>
  </main>
  return <main className="ling-story" aria-label="Meet Ling">
    <header className="story-header"><Brand /><button className="story-skip" onClick={finish}>Skip intro <ArrowRight size={16} /></button></header>
    <div className="story-content" key={step}>
      <span className="story-eyebrow">{['A LITTLE HELLO. A WORLD OF POSSIBILITIES.', 'YOUR WORKSPACE', 'THE EVERYDAY LABEL', 'YOUR NEXT LIGHTBULB MOMENT', 'A LITTLE CLOSER LOOK'][step]}</span>
      <LingStoryArt activity={page.activity} />
      <div className="story-copy"><h1 ref={heading} tabIndex={-1}>{page.title}</h1>
        <p className="story-question">“{page.question}”</p><p className="story-description">{page.text}{step === 0 && !localReasoningAvailable ? ' Start with objects and readable text. Enable optional on-device AI for experimental answers; deeper Gemma features and Ling Steps need the local app.' : ''}</p></div>
    </div>
    <footer className="story-footer"><nav className="story-dots" aria-label="Introduction steps">{pages.map((item, index) => <button key={item.title} aria-label={'Story ' + (index + 1)} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} />)}</nav>
      <div className="story-controls"><button className="story-back" aria-label="Previous story" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={20} /></button>
        <button className="story-next" onClick={() => step === pages.length - 1 ? finish() : setStep(step + 1)}>{step === pages.length - 1 ? 'Let’s discover' : 'Next'}<ArrowRight size={19} /></button></div>
      <small>{page.hint}</small>
    </footer>
  </main>
}
