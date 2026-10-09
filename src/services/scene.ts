import type { DetectedObject } from './objectDetection'
import type { UploadedImage } from './image'
import type { ReasoningResult } from './ollama'
import type { Evidence, SceneAnalysis, VisualObject } from '../types/scene'

// Fusion retains separate provenance. Equal names are not proof of a shared identity.
export function assembleScene(
  image: UploadedImage, detections: DetectedObject[], ocrText: string, result: ReasoningResult,
  failures: { detection?: string; ocr?: string } = {}, elapsedMs = result.elapsedMs,
): SceneAnalysis {
  const evidence: Evidence[] = []
  const addEvidence = (source: Evidence['source'], kind: Evidence['kind'], description: string) => {
    const id = 'E' + (evidence.length + 1)
    evidence.push({ id, source, kind, description })
    return id
  }
  const objects: VisualObject[] = detections.map((item, i) => ({
    id: 'mp-' + i, name: item.label, source: 'mediapipe', boundingBox: { ...item.box }, confidence: item.confidence,
    purposes: [], evidenceIds: [addEvidence('mediapipe', 'observed', `Detector prediction: ${item.label}, confidence ${(item.confidence * 100).toFixed(1)}%.`)],
  }))
  objects.push(...result.analysis.visible_objects.map((item, i): VisualObject => ({
    id: 'vision-' + i, name: item.name, source: 'gemma',
    purposes: result.analysis.object_affordances.filter(use => use.object === item.name).map(use => use.use),
    evidenceIds: [addEvidence('gemma', 'observed', item.name + ': ' + item.evidence)],
  })))
  const ocrIds = ocrText.slice(0, 4000).split(/\n+/).filter(line => line.trim()).slice(0, 30)
    .map(line => addEvidence('tesseract', 'observed', line.slice(0, 500)))
  const relationships = result.analysis.relationships.map(item => ({
    subject: item.subject, relation: item.relation, object: item.object, kind: item.kind,
    evidenceIds: [addEvidence('gemma', item.kind, item.evidence)],
  }))
  const visibleIssues = result.analysis.visible_issues.map(item => ({
    description: item.issue, evidenceIds: [addEvidence('gemma', 'observed', item.evidence)],
  }))
  return {
    id: crypto.randomUUID(), image: { name: image.name, width: image.element.naturalWidth, height: image.element.naturalHeight, url: image.url },
    description: result.analysis.scene_description, objects,
    ocr: { text: ocrText, language: 'eng', status: failures.ocr ? 'error' : 'complete', error: failures.ocr, evidenceIds: ocrIds },
    evidence, relationships, visibleIssues,
    uncertainty: [...result.analysis.uncertainty_notes, ...result.warnings,
      ...(failures.detection ? ['MediaPipe unavailable: ' + failures.detection] : []),
      ...(failures.ocr ? ['OCR unavailable: ' + failures.ocr] : []),
      ...(ocrText.length > 4000 ? ['Only the first 4000 OCR characters are included in reasoning context.'] : [])],
    elapsedMs, modelMs: result.modelMs,
  }
}
