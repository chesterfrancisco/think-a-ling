import type { DetectedObject } from '../services/objectDetection'
import type { ReasoningMode } from '../services/reasoning'

export interface Evidence {
  id: string
  source: 'mediapipe' | 'tesseract' | 'gemma' | 'user'
  kind: 'observed' | 'inferred'
  description: string
}

export interface VisualObject {
  id: string
  name: string
  source: 'mediapipe' | 'gemma'
  // Only MediaPipe objects may have measured coordinates or confidence.
  boundingBox?: DetectedObject['box']
  confidence?: number
  purposes: string[]
  evidenceIds: string[]
  userLabel?: string
  userLabelEvidenceId?: string
}

export interface LabelCorrection {
  originalLabel: string
  label: string
  box: DetectedObject['box']
}

export interface OCRText {
  text: string
  language: 'eng'
  status: 'complete' | 'error'
  error?: string
  evidenceIds: string[]
}

export interface SceneAnalysis {
  id: string
  image: { name: string; width: number; height: number; url: string }
  description: string
  objects: VisualObject[]
  ocr: OCRText
  evidence: Evidence[]
  relationships: { subject: string; relation: string; object: string; kind: 'observed' | 'inferred'; evidenceIds: string[] }[]
  visibleIssues: { description: string; evidenceIds: string[] }[]
  uncertainty: string[]
  elapsedMs: number
  modelMs: number | null
}

export interface UserIntent {
  mode: ReasoningMode
  goal: string
  // Exact shared-scene object ID, never a label-based association.
  objectId?: string
}

export interface ActionSuggestion {
  title: string
  description: string
  kind: 'use' | 'find' | 'check' | 'improve' | 'study'
  evidence_ids: string[]
  uncertainty: string
}

export interface IntentResponse {
  status: 'answered' | 'no-supported-result' | 'needs-more-evidence'
  answer: string
  observations: { statement: string; evidence_ids: string[] }[]
  suggestions: ActionSuggestion[]
  issues: { description: string; evidence_ids: string[]; checks: string[] }[]
  study_cards: { question: string; answer: string; evidence_ids: string[] }[]
  uncertainty_notes: string[]
}

export interface SceneTurn {
  sceneId: string
  intent: UserIntent
  response: IntentResponse
  grounding: { studyCards: IntentResponse['study_cards']; warnings: string[]; answerTextMatches?: string[] }
  elapsedMs: number
  modelMs: number | null
}
