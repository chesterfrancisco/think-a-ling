import type { SceneAnalysis } from '../types/scene'
import type { ReasoningMode } from './reasoning'

// UI routing hints only: neither a diagnosis nor an inference result. Explicit
// user goals outrank scene heuristics; users can always choose another mode.
export function modeForGoal(goal: string): ReasoningMode | undefined {
  if (/\b(check|fix|broken|problem|concern|safe|safety|sira|ayusin|problema)\b/i.test(goal)) return 'FIX'
  if (/\b(find|where|locate|look for|hanap|hanapin|saan)\b/i.test(goal)) return 'FIND'
  if (/\b(improve|organize|organise|better|enhance|ideas|pagandahin)\b/i.test(goal)) return 'IMPROVE'
  if (/\b(explain|understand|learn|read|study|what|ano|basahin)\b/i.test(goal)) return 'EXPLORE'
  return undefined
}
export function relevantModes(scene: SceneAnalysis, goal = ''): { modes: ReasoningMode[]; reason: string } {
  const explicit = modeForGoal(goal)
  if (explicit) return { modes: [explicit, explicit === 'EXPLORE' ? 'FIND' : 'EXPLORE'], reason: 'Suggested from your question. You can choose another approach.' }
  const observed = (ids: string[]) => ids.some(id => scene.evidence.some(e => e.id === id && e.kind === 'observed' && e.source !== 'user'))
  if (scene.visibleIssues.some(issue => observed(issue.evidenceIds))) return { modes: ['FIX', 'EXPLORE'], reason: 'The model flagged a possible concern. Check the photo; this is not a confirmed fault.' }
  const objects = scene.objects.filter(object => object.evidenceIds.some(id => scene.evidence.some(e => e.id === id)))
  if (objects.some(o => /\b(cable|wire|socket|outlet|power strip)\b/i.test(o.name))) return { modes: ['FIX', 'EXPLORE'], reason: 'Possible cabling context: ask what to inspect. Appearance alone does not establish overload or safety.' }
  if (scene.ocr.status === 'complete' && scene.ocr.text.trim()) return { modes: ['EXPLORE', 'FIND'], reason: 'Readable text is available: understand it or look for a detail.' }
  if (objects.some(o => /\b(desk|table|chair|shelf|room)\b/i.test(o.name))) return { modes: ['IMPROVE', 'EXPLORE'], reason: 'Explore practical uses or ideas for the objects the model noticed.' }
  if (objects.some(o => o.purposes.length > 0)) return { modes: ['FIND', 'EXPLORE'], reason: 'The saved scene includes possible uses. Match one to your goal.' }
  return { modes: ['EXPLORE'], reason: 'Start by understanding the scene. More options are available when you have a goal.' }
}
