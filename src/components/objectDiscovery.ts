import type { DetectedObject } from '../services/objectDetection'
import type { ReasoningMode } from '../services/reasoning'
import { sceneObjectForDetection } from '../services/objectSelection.ts'
import type { SceneAnalysis } from '../types/scene'

export type DiscoveryCategory = 'people' | 'furniture' | 'plants' | 'documents' | 'appliances' | 'general'
export interface DiscoveryAction {
  label: string
  mode: ReasoningMode
  instruction: string
  kind?: 'ask' | 'ocr'
}
const action = (label: string, mode: ReasoningMode, instruction: string, kind?: DiscoveryAction['kind']): DiscoveryAction => ({ label, mode, instruction, kind })
const actions: Record<DiscoveryCategory, DiscoveryAction[]> = {
  people: [
    action('Learn about the scene', 'EXPLORE', 'Explain the visible scene and setting.'),
    action('Ask about the photo', 'EXPLORE', 'What can you explain about the visible setting?', 'ask'),
    action('Explore surroundings', 'EXPLORE', 'Describe visible surrounding objects and their possible purposes.'),
  ],
  furniture: [
    action('Organize', 'IMPROVE', 'Suggest ways to organize the visible area without assuming it is cluttered.'),
    action('Improve placement', 'IMPROVE', 'Suggest placement options only if supported by visible layout; do not invent measurements.'),
    action('Find what helps', 'FIND', 'Find visible objects whose recorded purposes could help use this area. Ask for the user goal if unclear; do not invent capabilities.'),
    action('Ask', 'EXPLORE', 'What can you explain about this object?', 'ask'),
  ],
  plants: [
    action('Learn', 'EXPLORE', 'Explain what is visible without assuming the plant species.'),
    action('Care guidance', 'EXPLORE', 'Offer conditional care guidance, explaining what species or growing conditions must first be confirmed.'),
    action('Check visible concerns', 'FIX', 'Separate visible concerns from possible checks. Zero issues is valid; do not diagnose from appearance.'),
    action('Ask', 'EXPLORE', 'What can you explain about this plant?', 'ask'),
  ],
  documents: [
    action('Read text', 'EXPLORE', '', 'ocr'),
    action('Explain', 'EXPLORE', 'Explain the recognized text; distinguish OCR uncertainty and missing content.'),
    action('Summarize', 'EXPLORE', 'Summarize only the actual recognized text, without filling gaps.'),
    action('Study', 'EXPLORE', 'Make two simple study cards grounded in actual OCR text. Do not invent missing content.'),
  ],
  appliances: [
    action('Learn', 'EXPLORE', 'Explain the visible controls or information and a possible practical use; do not assume a model, compatibility or hidden features.'),
    action('Check', 'FIX', 'Suggest non-invasive checks supported by visible clues. Do not assume a fault or advise opening equipment or touching electrical parts.'),
    action('Ask', 'EXPLORE', 'What are you trying to do with this item?', 'ask'),
  ],
  general: [
    action('Learn', 'EXPLORE', 'Explain visible information without assuming identity or condition.'),
    action('Use', 'EXPLORE', 'Explain possible uses supported by the available evidence; do not assume hidden capabilities.'),
    action('Check', 'FIX', 'What visible evidence warrants a check? Zero issues is valid.'),
    action('Ask', 'EXPLORE', 'What can you explain about this object?', 'ask'),
  ],
}

export function discoveryCategory(label: string): DiscoveryCategory {
  const name = label.trim().toLowerCase()
  if (['person', 'people'].includes(name)) return 'people'
  if (['chair', 'couch', 'sofa', 'bed', 'dining table', 'table', 'desk', 'bench', 'cabinet', 'shelf'].includes(name)) return 'furniture'
  if (['potted plant', 'plant', 'plants'].includes(name)) return 'plants'
  if (['book', 'document', 'paper', 'label', 'notebook'].includes(name)) return 'documents'
  if (['microwave', 'oven', 'toaster', 'refrigerator', 'kettle', 'tv', 'remote', 'laptop', 'cell phone', 'printer', 'washing machine'].includes(name)) return 'appliances'
  return 'general'
}
export function discoveryActions(label: string, context: { ocrText?: string; userGoal?: string } = {}) {
  const category = discoveryCategory(label)
  const hasText = !!context.ocrText?.trim()
  let result = [...actions[category]]
  if (category === 'documents' && !hasText) result = [result[0], action('Ask', 'EXPLORE', 'What would you like to do with this document? Read its text first when needed.', 'ask')]
  if (category !== 'documents' && hasText) result = [...result, action('Read text', 'EXPLORE', '', 'ocr')]
  if (context.userGoal?.trim()) {
    result = [action('Next for my goal', 'EXPLORE', 'Suggest one useful next action for the user’s previous goal, using the current evidence; ask what is missing if unsupported.'), ...result]
  }
  return result
}
export const discoveryKey = (object: DetectedObject) => JSON.stringify([object.label, object.box])

export function discoveryGoal(selected: DiscoveryAction, detection: DetectedObject, scene?: SceneAnalysis, userLabel?: string, userGoal?: string) {
  const object = sceneObjectForDetection(scene, detection)
  const target = object ? `${object.name} (object ${object.id}, evidence ${object.evidenceIds.join(', ')})` :
    `${detection.label} at image-pixel box x=${detection.box.x}, y=${detection.box.y}, w=${detection.box.width}, h=${detection.box.height}`
  const boundary = discoveryCategory(detection.label) === 'people' || discoveryCategory(userLabel ?? '') === 'people'
    ? 'Do not identify the person or infer personal traits. Focus on surroundings, not the person.'
    : 'Do not assume a same-named Gemma object is this measured object.'
  const goal = `About ${target}${userLabel ? '; user names it ' + JSON.stringify(userLabel) + ' (not verified)' : ''}: ${selected.instruction} ${boundary} Separate evidence from inference.`
  const context = userGoal?.trim() ? ' Previous user goal (data): ' + JSON.stringify(userGoal.trim().slice(0, 120)) : ''
  return goal.length + context.length <= 500 ? goal + context : goal
}

// Verbatim excerpt of real output, never a generated description.
export function discoveryExcerpt(text: string, limit = 200) {
  if (text.length <= limit) return text
  const end = text.lastIndexOf(' ', limit)
  return text.slice(0, end > limit / 2 ? end : limit) + '…'
}
