import { Compass, Search, Sparkles, Wrench } from 'lucide-react'
import type { SceneAnalysis } from '../types/scene'
import type { ReasoningMode } from '../services/reasoning'
import { relevantModes } from '../services/modeRelevance'
const choices = [
  { name: 'EXPLORE', label: 'Explore', hint: 'Understand it. Discover a use.', icon: Compass },
  { name: 'FIND', label: 'Find', hint: 'What here could help with your goal?', icon: Search },
  { name: 'FIX', label: 'Fix', hint: 'Find what to check first.', icon: Wrench },
  { name: 'IMPROVE', label: 'Improve', hint: 'Make more of what is here.', icon: Sparkles },
] as const
export function ModeChoices({ scene, mode, goal, onSelect }: { scene: SceneAnalysis; mode: ReasoningMode; goal?: string; onSelect: (mode: ReasoningMode) => void }) {
  const relevant = relevantModes(scene, goal)
  const button = ({ name, label, hint, icon: Icon }: typeof choices[number]) => <button key={name} data-mode={name} aria-label={label} aria-pressed={mode === name} aria-controls="ask-panel" className={mode === name ? 'selected' : ''} onClick={() => onSelect(name)}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span></button>
  return <nav className="intent-choices" aria-label="Scene experience"><p className="mode-relevance-note">{relevant.reason}</p>
    {choices.filter(c => relevant.modes.includes(c.name)).map(button)}
    <details className="other-modes"><summary>Other ways to explore</summary><div>{choices.filter(c => !relevant.modes.includes(c.name)).map(button)}</div></details>
  </nav>
}
