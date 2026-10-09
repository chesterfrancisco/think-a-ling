import { Check, ScanEye, ScanText, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { analysisStageProgress, estimatedAnalysisProgress } from '../services/analysisProgress'

export function AnalysisProgress({ phase, objectsReady, textReady, expectedMs }: { phase: 'scene' | 'intent'; objectsReady: boolean; textReady: boolean; expectedMs?: number }) {
  const [elapsed, setElapsed] = useState(0)
  const { completed, total } = analysisStageProgress(phase, objectsReady, textReady)
  useEffect(() => {
    const started = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 250)
    return () => window.clearInterval(timer)
  }, [])
  const percent = estimatedAnalysisProgress(elapsed, expectedMs ?? (phase === 'scene' ? 65_000 : 50_000))
  return <div className="analysis-progress">
    <strong role="status">{phase === 'scene' ? 'Making sense of what’s here…' : 'Finding a useful next step for you…'}</strong>
    <div className="stage-count"><strong>{percent}%</strong><span>Estimated progress</span></div>
    <div className="ling-progress-track measured-stages" role="progressbar" aria-label="Estimated analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`Estimated ${percent} percent. ${completed} of ${total} steps complete. Actual model progress is unknown.`}><span style={{ width: percent + '%' }} /></div>
    {phase === 'scene' && <ol className="analysis-steps">
      <li className={objectsReady ? 'complete' : ''}>{objectsReady ? <Check size={16} /> : <ScanEye size={16} />}Objects</li>
      <li className={textReady ? 'complete' : ''}>{textReady ? <Check size={16} /> : <ScanText size={16} />}Text</li>
      <li aria-current="step"><Sparkles size={16} />Understanding</li>
    </ol>}
    {phase === 'intent' && <ol className="analysis-steps"><li className="complete"><Check size={16} />Context ready</li><li aria-current="step"><Sparkles size={16} />Answer & validation</li></ol>}
    <p className="context-note">{percent >= 95 ? 'Taking a little longer. ' : ''}Analyzing… Please wait until processing is finished. You can cancel anytime.</p>
  </div>
}
