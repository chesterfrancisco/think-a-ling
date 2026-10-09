import type { SceneAnalysis, SceneTurn, UserIntent } from '../types/scene'
// Conservative direct answers use recorded evidence only. They are explicitly
// marked as rules/text retrieval, never passed off as a new model generation.
export function directEvidenceAnswer(scene: SceneAnalysis, intent: UserIntent): SceneTurn | undefined {
  let answer = '', warning = '', status: SceneTurn['response']['status'] = 'answered'
  const question = intent.goal.trim().toLowerCase()
  if (/\b(who is|identify this person|identify the person|sino (ito|siya)|ethnicity|diagnos|certify|guarantee.{0,15}safe|is (this|it).{0,15}safe|ligtas ba|overloaded)\b/.test(question)) {
    answer = intent.language === 'Filipino' ? 'Hindi makukumpirma mula sa larawan ang pagkakakilanlan, diagnosis, o kaligtasan. Sabihin ang partikular na nakikitang detalye na gusto mong suriin; maaaring kailangan ng mas malinaw na larawan o kwalipikadong tao.' : 'A photo cannot establish identity, a diagnosis or safety. Ask about a specific visible detail; a clearer image or a qualified person may be needed.'
    warning = 'Conservative limitation message; no assessment was performed.'; status = 'needs-more-evidence'
  } else if (!intent.objectId && /^(read|show|copy|basahin|ipakita|kopyahin)\b.*\b(text|words|nakasulat|teksto)\b/.test(question) && scene.ocr.status === 'complete') {
    answer = scene.ocr.text.trim().slice(0, 1800) || 'No readable text was recorded. Try a closer, sharper photo.'
    warning = 'Direct OCR retrieval, not a generated explanation. OCR can be wrong; compare with the photo.'
    if (!scene.ocr.text.trim()) status = 'needs-more-evidence'
  } else return undefined
  return { sceneId: scene.id, intent, response: { status, answer, observations: [], suggestions: [], issues: [], study_cards: [], uncertainty_notes: [warning] }, grounding: { studyCards: [], warnings: [warning] }, elapsedMs: 0, modelMs: null }
}
export function repetitiveAnswer(text: string) {
  const sentences = text.toLowerCase().split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 15)
  if (sentences.length > 2 && new Set(sentences).size <= sentences.length / 2) return true
  return /\b(\w+)(?:\s+\1){5,}\b/i.test(text)
}
export function unsupportedBlanketAnswer(text: string) {
  return /\b(used for (anything|everything)|use.{0,12}any purpose|(?:perfectly|completely|100%) safe|guaranteed safe)\b/i.test(text)
}
