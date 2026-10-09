import test from 'node:test'
import assert from 'node:assert/strict'
import { sceneObjectForDetection, objectGoal } from '../src/services/objectSelection.ts'

test('hotspot association distinguishes same-named detections and never assigns Gemma coordinates', () => {
  const detection = { label: 'dog', confidence: .8, box: { x: 50, y: 10, width: 20, height: 30 } }
  const scene = { objects: [
    { id: 'vision-0', source: 'gemma', name: 'dog', evidenceIds: ['E3'] },
    { id: 'mp-0', source: 'mediapipe', name: 'dog', boundingBox: { ...detection.box, x: 5 }, evidenceIds: ['E1'] },
    { id: 'mp-1', source: 'mediapipe', name: 'dog', boundingBox: detection.box, evidenceIds: ['E2'] },
  ] }
  assert.equal(sceneObjectForDetection(scene, detection).id, 'mp-1')
  assert.match(objectGoal('EXPLORE', detection, scene), /object mp-1, evidence E2/)
  assert.match(objectGoal('FIX', detection, scene), /Zero issues is valid/)
  assert.equal(sceneObjectForDetection({ objects: [scene.objects[0]] }, detection), undefined)
  assert.match(objectGoal('EXPLORE', detection), /x=50, y=10, w=20, h=30/)
})
