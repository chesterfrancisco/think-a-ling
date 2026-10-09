import type { DetectedObject } from './objectDetection'
import type { LabelCorrection } from '../types/scene'
import { sameDetection } from './labelCorrections.ts'

// A user-placed point, not a detected region. Never insert this into model
// detections, confidence scores, observed evidence, or the shared AI scene.
export interface ManualTag {
  id: string
  source: 'user'
  label: string
  point: { x: number; y: number } // Fractions of the original image, 0–1.
}

export function imagePoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (rect.width <= 0 || rect.height <= 0) throw new Error('The photo is not ready for a tag.')
  return { x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) }
}

export function manualTagName(tag: ManualTag, tags: ManualTag[], detections: DetectedObject[], corrections: LabelCorrection[] = []) {
  const label = tag.label.toLocaleLowerCase()
  const detectedCount = detections.filter(item => (corrections.find(correction => sameDetection(correction, item))?.label ?? item.label).toLocaleLowerCase() === label).length
  const peers = tags.filter(item => item.label.toLocaleLowerCase() === label)
  const ordinal = detectedCount + peers.findIndex(item => item.id === tag.id) + 1
  const title = tag.label.charAt(0).toLocaleUpperCase() + tag.label.slice(1)
  return detectedCount + peers.length > 1 ? `${title} ${ordinal}` : title
}
