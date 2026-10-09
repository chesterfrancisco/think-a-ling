import type { Evidence, SceneAnalysis, SceneTurn } from '../types/scene'

export type PocketDraft = { title: string; kind: 'text' | 'scene' | 'answer'; content: string; source: string; photoName: string; caveats: string[]; evidence: Evidence[] }
export type Pocket = PocketDraft & { id: string; savedAt: string }
const KEY = 'think-a-ling.pockets.v1'
const LIMIT = 50
const changed = () => window.dispatchEvent(new Event('think-pockets-change'))

// Local storage is untrusted input. Never render arbitrary HTML or restore a
// saved model answer as a fresh AI result. No photo/blob URL is persisted.
function valid(value: unknown): value is Pocket {
  if (!value || typeof value !== 'object') return false
  const p = value as Pocket
  return typeof p.id === 'string' && typeof p.savedAt === 'string' && !Number.isNaN(Date.parse(p.savedAt)) &&
    typeof p.title === 'string' && p.title.length <= 180 && ['text', 'scene', 'answer'].includes(p.kind) &&
    typeof p.content === 'string' && p.content.length > 0 && p.content.length <= 60000 &&
    typeof p.source === 'string' && typeof p.photoName === 'string' &&
    Array.isArray(p.caveats) && p.caveats.every(item => typeof item === 'string') &&
    Array.isArray(p.evidence) && p.evidence.every(e => e && typeof e.id === 'string' && typeof e.description === 'string' &&
      ['observed', 'inferred'].includes(e.kind) && ['mediapipe', 'tesseract', 'gemma', 'smolvlm', 'user'].includes(e.source))
}

export function readPockets(): Pocket[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  if (raw.length > 4_000_000) throw new Error('Saved discoveries could not be read. Clear them from this browser to start again.')
  const values: unknown = JSON.parse(raw)
  if (!Array.isArray(values) || !values.every(valid)) throw new Error('Saved discoveries could not be read. Clear them from this browser to start again.')
  return values.slice(0, LIMIT)
}

export function savePocket(draft: PocketDraft): Pocket {
  const entries = readPockets()
  const existing = entries.find(p => p.kind === draft.kind && p.title === draft.title && p.source === draft.source && p.content === draft.content && p.photoName === draft.photoName && JSON.stringify(p.evidence) === JSON.stringify(draft.evidence) && JSON.stringify(p.caveats) === JSON.stringify(draft.caveats))
  if (existing) return existing
  if (entries.length >= LIMIT) throw new Error('You have 50 saved discoveries. Delete one before saving another.')
  const pocket = { ...draft, id: crypto.randomUUID(), savedAt: new Date().toISOString() }
  if (!valid(pocket)) throw new Error('This result is too large or incomplete to save. Nothing was stored.')
  const serialized = JSON.stringify([pocket, ...entries])
  if (serialized.length > 4_000_000) throw new Error('Saved discoveries are full. Delete an older one before saving this result.')
  try { localStorage.setItem(KEY, serialized) }
  catch { throw new Error('This browser could not save the discovery. Storage may be full or blocked.') }
  changed()
  return pocket
}

export function deletePocket(id: string) { localStorage.setItem(KEY, JSON.stringify(readPockets().filter(p => p.id !== id))); changed() }
export function clearPockets() { localStorage.removeItem(KEY); changed() }

export function pocketFromScene(scene: SceneAnalysis): PocketDraft {
  return { title: 'Understanding ' + scene.image.name.slice(0, 145), kind: 'scene', content: scene.description,
    source: scene.reasoner === 'browser' ? 'SmolVLM · experimental interpretation' : 'Gemma · model interpretation', photoName: scene.image.name,
    caveats: ['Saved interpretation, not verified facts. The original photo is not stored.', ...scene.uncertainty], evidence: scene.evidence }
}

export function pocketFromTurn(scene: SceneAnalysis, turn: SceneTurn): PocketDraft {
  const sections = [turn.response.answer,
    ...turn.response.suggestions.map(s => `${s.title}\n${s.description}\nEvidence: ${s.evidence_ids.join(', ')}\nUncertainty: ${s.uncertainty}`),
    ...turn.response.issues.map(s => `${s.description}\nEvidence: ${s.evidence_ids.join(', ')}\nSuggested checks: ${s.checks.join('; ')}`),
    ...turn.grounding.studyCards.map(s => `${s.question}\n${s.answer}\nEvidence: ${s.evidence_ids.join(', ')}`)]
  return { ...pocketFromScene(scene), title: turn.intent.goal.slice(0, 180), kind: 'answer', content: sections.join('\n\n'),
    caveats: [...scene.uncertainty, ...turn.response.uncertainty_notes, ...turn.grounding.warnings, 'Saved answer. Completion of physical tasks has not been verified.'], }
}
