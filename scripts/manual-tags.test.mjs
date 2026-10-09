import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imagePoint, manualTagName } from '../src/services/manualTags.ts'

test('manual points preserve image-relative positions across sizes and clamp to the image', () => {
  assert.deepEqual(imagePoint(300, 175, { left: 100, top: 75, width: 800, height: 400 }), { x: .25, y: .25 })
  assert.deepEqual(imagePoint(85, 125, { left: 10, top: 50, width: 300, height: 300 }), { x: .25, y: .25 })
  assert.deepEqual(imagePoint(-10, 900, { left: 0, top: 0, width: 100, height: 100 }), { x: 0, y: 1 })
  assert.throws(() => imagePoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }))
})

test('user tags follow detected peers without modifying model data or borrowing confidence', () => {
  const detections = [{ label: 'person', confidence: .72, box: { x: 1, y: 2, width: 3, height: 4 } }]
  const before = structuredClone(detections)
  const tags = ['a', 'b'].map(id => ({ id, source: 'user', label: 'person', point: { x: .2, y: .3 } }))
  assert.equal(manualTagName(tags[0], tags, detections), 'Person 2')
  assert.equal(manualTagName(tags[1], tags, detections), 'Person 3')
  assert.equal(manualTagName(tags[0], [tags[0]], detections, [{ originalLabel: 'person', label: 'chair', box: detections[0].box }]), 'Person')
  assert.deepEqual(detections, before)
  assert.equal('confidence' in tags[0], false)
  assert.equal('box' in tags[0], false)
})
