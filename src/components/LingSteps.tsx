import { ListChecks } from 'lucide-react'
import { stepsForTurn } from '../services/lingSteps'
import type { LingStepsState } from '../services/lingSteps'
import type { SceneAnalysis, SceneTurn } from '../types/scene'
import './LingSteps.css'

export function LingSteps({ turn, scene, state, onChange }: {
  turn: SceneTurn; scene: SceneAnalysis; state?: LingStepsState; onChange: (value: LingStepsState) => void
}) {
  const steps = stepsForTurn(turn, scene)
  if (!steps.length) return null
  const completed = state?.completed ?? []
  const count = steps.filter(step => completed.includes(step.id)).length
  return <section className="ling-steps" aria-label="Ling Steps">
    <button type="button" className="steps-toggle" aria-expanded={!!state?.opened} onClick={() => onChange({ opened: !state?.opened, completed })}>
      <ListChecks size={19} />{state?.opened ? 'Hide steps' : 'Turn into steps'}
    </button>
    {state?.opened && <div className="steps-content">
      <h4>One useful step at a time.</h4>
      <p className="steps-disclosure">From Ling’s suggestions, with their original caveats. Mark what you do; Ling has not verified any physical changes.</p>
      <p role="status" className="steps-count">{count} of {steps.length} marked done by you</p>
      <ol>{steps.map(step => <li key={step.id}>
        <label className="step-choice"><input type="checkbox" checked={completed.includes(step.id)} onChange={event => onChange({ opened: true,
          completed: event.target.checked ? [...completed, step.id] : completed.filter(id => id !== step.id),
        })} /><strong>{step.title}</strong></label>
        {step.description !== step.title && <p>{step.description}</p>}
        <small className="step-caveat">{step.uncertainty}</small>
        <details><summary>Why this step?</summary>{step.evidenceIds.map(id => {
          const evidence = scene.evidence.find(item => item.id === id)!
          return <p key={id}>{evidence.kind === 'inferred' ? 'Inferred possibility' : evidence.source === 'user' ? 'Your correction' : 'Observed by AI'}: {evidence.description}</p>
        })}<p>Evidence links explain the source; they do not prove a recommendation is correct.</p></details>
      </li>)}</ol>
      <p className="steps-disclosure">Kept only for this session. Changing the photo or refreshing clears your checklist.</p>
    </div>}
  </section>
}
