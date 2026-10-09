import type { SceneAnalysis, SceneTurn } from '../types/scene'

export interface LingStep {
  id: string
  title: string
  description: string
  evidenceIds: string[]
  uncertainty: string
}
export interface LingStepsState { opened: boolean; completed: string[] }

// Scope completion to the exact scene, object, goal and answer, not its label.
export const lingStepsKey = (turn: SceneTurn) => JSON.stringify([turn.sceneId, turn.intent, turn.response])

// Re-present existing recommendations verbatim. No answer parsing, invented
// substeps or extra model request. References provide traceability, not proof.
export function stepsForTurn(turn: SceneTurn, scene: SceneAnalysis): LingStep[] {
  if (turn.sceneId !== scene.id || turn.response.status !== 'answered' ||
    (turn.intent.objectId && !scene.objects.some(item => item.id === turn.intent.objectId))) return []
  const supported = (ids: string[]) => ids.length > 0 && ids.every(id => scene.evidence.some(item => item.id === id)) &&
    ids.some(id => scene.evidence.some(item => item.id === id && item.kind === 'observed' && item.source !== 'user'))
  const suggestions: LingStep[] = turn.response.suggestions.flatMap((item, index) =>
    item.title.trim() && item.description.trim() && supported(item.evidence_ids) ? [{
      id: 'suggestion-' + index, title: item.title, description: item.description,
      evidenceIds: [...new Set(item.evidence_ids)], uncertainty: item.uncertainty,
    }] : [])
  const checks: LingStep[] = turn.intent.mode === 'FIX' ? turn.response.issues.flatMap((item, index) =>
    supported(item.evidence_ids) ? item.checks.filter(check => check.trim()).map((check, checkIndex) => ({
      id: `check-${index}-${checkIndex}`, title: check, description: item.description,
      evidenceIds: [...new Set(item.evidence_ids)], uncertainty: 'A suggested check, not a diagnosis or confirmation of safety.',
    })) : []) : []
  const seen = new Set<string>()
  return [...suggestions, ...checks].filter(item => {
    const key = JSON.stringify([item.title, item.description])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
}
