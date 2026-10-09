import type { DetectedObject } from './objectDetection'
import type { ReasoningMode } from './reasoning'
import type { SceneAnalysis } from '../types/scene'

// Equal labels do not associate a Gemma object with a measured detector box.
export function sceneObjectForDetection(scene: SceneAnalysis | undefined, detection: DetectedObject) {
  return scene?.objects.find(object => object.source === 'mediapipe' && object.name === detection.label &&
    object.boundingBox && object.boundingBox.x === detection.box.x && object.boundingBox.y === detection.box.y &&
    object.boundingBox.width === detection.box.width && object.boundingBox.height === detection.box.height)
}

export function objectGoal(mode: ReasoningMode, detection: DetectedObject, scene?: SceneAnalysis) {
  const object = sceneObjectForDetection(scene, detection)
  const target = object ? `${object.name} (object ${object.id}, evidence ${object.evidenceIds.join(', ')})` :
    `${detection.label} detected at image-pixel box x=${detection.box.x}, y=${detection.box.y}, w=${detection.box.width}, h=${detection.box.height}`
  const instruction = mode === 'FIX' ? 'What visible evidence warrants a check? Zero issues is valid.' :
    mode === 'IMPROVE' ? 'Suggest realistic ways to make better use of this object or its setting.' :
    'Explain what is visible and possible purposes, without assuming identity, condition or capabilities.'
  return `About ${target}: ${instruction} Distinguish observations from inference. Do not assume another model’s same-named object is this one.`
}
