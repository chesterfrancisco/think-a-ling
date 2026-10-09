import type { DetectedObject } from './objectDetection'
import type { SceneAnalysis } from '../types/scene'
import { sameDetection } from './labelCorrections.ts'

export function detectionDismissed(object: DetectedObject, dismissed: DetectedObject[]) {
  return dismissed.some(item => sameDetection({ originalLabel: item.label, box: item.box }, object))
}

// Keep the original snapshot intact so Undo restores its stable IDs and evidence.
// A user rejection is not a new model observation or a rewrite of model prose.
export function excludeDismissedDetections(scene: SceneAnalysis, dismissed: DetectedObject[]): SceneAnalysis {
  const rejected = scene.objects.filter(object => object.source === 'mediapipe' && object.boundingBox &&
    detectionDismissed({ label: object.name, box: object.boundingBox, confidence: object.confidence ?? 0 }, dismissed))
  if (!rejected.length) return scene
  const ids = new Set(rejected.map(object => object.id))
  const evidenceIds = new Set(rejected.flatMap(object => [...object.evidenceIds, ...(object.userLabelEvidenceId ? [object.userLabelEvidenceId] : [])]))
  const validReferences = (references: string[]) => !references.some(id => evidenceIds.has(id))
  return {
    ...scene,
    objects: scene.objects.filter(object => !ids.has(object.id)),
    evidence: scene.evidence.filter(item => !evidenceIds.has(item.id)),
    relationships: scene.relationships.filter(item => !ids.has(item.subject) && !ids.has(item.object) && validReferences(item.evidenceIds)),
    visibleIssues: scene.visibleIssues.filter(item => validReferences(item.evidenceIds)),
    uncertainty: [...scene.uncertainty, `User removed detector tags: ${JSON.stringify(rejected.map(object => ({ id: object.id, label: object.name })))} as incorrect. Do not treat these tags as evidence. The original photo description has not been re-verified.`],
  }
}
