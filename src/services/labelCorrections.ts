import type { DetectedObject } from './objectDetection'
import type { LabelCorrection, SceneAnalysis } from '../types/scene'

export function sameDetection(a: { originalLabel: string; box: DetectedObject['box'] }, b: DetectedObject) {
  return a.originalLabel === b.label && a.box.x === b.box.x && a.box.y === b.box.y && a.box.width === b.box.width && a.box.height === b.box.height
}

export function cleanLabel(value: string): string {
  const label = value.trim().replace(/\s+/g, ' ')
  if (!label || label.length > 60 || [...label].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('Use a short object name, up to 60 characters.')
  return label
}

// Add provenance without rewriting detector output, coordinates or model prose.
// User assertions are not eligible for observed-fact/issue citations.
export function applyLabelCorrections(scene: SceneAnalysis, corrections: LabelCorrection[]): SceneAnalysis {
  const evidence = scene.evidence.filter(item => item.source !== 'user')
  const objects = scene.objects.map(object => {
    const { userLabel: _label, userLabelEvidenceId: _id, ...original } = object
    if (object.source !== 'mediapipe' || !object.boundingBox) return original
    const correction = corrections.find(item => sameDetection(item, { label: object.name, box: object.boundingBox!, confidence: object.confidence ?? 0 }))
    if (!correction) return original
    const id = 'U-' + object.id
    evidence.push({ id, source: 'user', kind: 'inferred', description: `User names object ${object.id} ${JSON.stringify(correction.label)}; detector originally predicted ${JSON.stringify(object.name)}. User-supplied, not independently verified.` })
    return { ...original, userLabel: correction.label, userLabelEvidenceId: id }
  })
  return { ...scene, objects, evidence }
}
