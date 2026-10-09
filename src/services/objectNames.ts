import type { DetectedObject } from './objectDetection'
import type { LabelCorrection } from '../types/scene'
import { sameDetection } from './labelCorrections.ts'

// Presentation only: ordinals distinguish boxes within this photo, not identities.
// Never change the detector label, confidence, coordinates or evidence key.
export function objectDisplayName(object: DetectedObject, objects: DetectedObject[], corrections: LabelCorrection[] = []) {
  const labelFor = (item: DetectedObject) => corrections.find(correction => sameDetection(correction, item))?.label ?? item.label
  const label = labelFor(object)
  const peers = objects.filter(item => labelFor(item).toLocaleLowerCase() === label.toLocaleLowerCase())
  const index = peers.findIndex(item => sameDetection({ originalLabel: item.label, box: item.box }, object))
  const title = label.charAt(0).toLocaleUpperCase() + label.slice(1)
  return peers.length > 1 && index >= 0 ? `${title} ${index + 1}` : title
}
