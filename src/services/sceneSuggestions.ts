import type { SceneAnalysis } from '../types/scene'
import type { ReasoningMode } from './reasoning'

export const intentPresentation: Record<ReasoningMode, { label: string; hint: string }> = {
  EXPLORE: { label: 'Explore', hint: 'Discover what it is and what you could do with it.' },
  FIND: { label: 'Find', hint: 'Tell Ling what you need. See what around you could help.' },
  FIX: { label: 'Fix', hint: 'Something not working? Find what to check first.' },
  IMPROVE: { label: 'Improve', hint: 'Make better use of what you already have.' },
}

// These are editable question starters, not model answers or asserted findings.
// Use only current-scene data; no extra inference or cross-photo memory.
export function sceneSuggestions(scene: SceneAnalysis, mode: ReasoningMode): string[] {
  const short = (text: string, limit = 75) => {
    // Strip controls from model/user content before inserting it into a label.
    // eslint-disable-next-line no-control-regex
    const value = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    return value.length > limit ? value.slice(0, limit - 1).trimEnd() + '…' : value
  }
  const supported = (ids: string[]) => ids.length > 0 && ids.some(id => scene.evidence.some(item => item.id === id))
  const objects = scene.objects.filter(item => supported(item.evidenceIds))
    .sort((a, b) => Number(!!b.userLabel) - Number(!!a.userLabel) || b.purposes.length - a.purposes.length)
  const named = objects.find(item => !/\b(person|people|man|woman|child|boy|girl|baby|human)\b/i.test(item.name + ' ' + (item.userLabel ?? '')) && short(item.userLabel ?? item.name))
  const name = named ? '“' + short(named.userLabel ?? named.name, 45) + '”' : undefined
  const purpose = named?.purposes.find(value => short(value) && !/^(support|use|unknown|none)$/i.test(short(value)))
  const text = scene.ocr.status === 'complete' && scene.ocr.text.trim() && supported(scene.ocr.evidenceIds)
  const issue = scene.visibleIssues.find(item => supported(item.evidenceIds) && short(item.description))
  const result: string[] = []
  if (mode === 'EXPLORE') {
    if (name) result.push(`What can you tell me about the ${name}?`)
    if (text) result.push('Explain the words in this photo.', 'Make two study prompts from the recognised text.')
    if (purpose) result.push(`How might the ${name} help with “${short(purpose)}”?`)
    else if (name && !text) result.push(`What could I use the ${name} for?`)
  } else if (mode === 'FIND') {
    if (purpose) result.push(`What here could help with “${short(purpose)}”?`)
    if (name) result.push(`Help me find the ${name} in this photo.`)
    if (text) result.push('Find the important words in the recognised text.')
  } else if (mode === 'FIX') {
    if (issue) result.push(`What should I check about “${short(issue.description, 105)}”?`)
    if (name) result.push(`What can this photo tell us about the condition of the ${name}?`)
    if (text) result.push('Does the recognised text mention any warnings?')
  } else {
    if (name) result.push(`How could I make better use of the ${name}?`)
    if (purpose) result.push(`What could help with “${short(purpose)}” here?`)
    if (text) result.push('How could I organise this text into useful notes?')
  }
  // Empty/person-only scenes get questions about the photo, never identity or
  // invented objects, hazards, OCR text, capabilities or coordinates.
  if (!result.length) result.push({ EXPLORE: 'Help me understand the surroundings in this photo.', FIND: 'What can this photo tell us about things I could use?', FIX: 'What is visible, and what would need a closer photo to check?', IMPROVE: 'What practical ideas does this photo support?' }[mode])
  return [...new Set(result)].slice(0, 3)
}
