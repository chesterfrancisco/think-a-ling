import test from 'node:test'
import assert from 'node:assert/strict'
import { intentPrompt } from '../src/services/intent.ts'
import { analysisStageProgress, estimatedAnalysisProgress } from '../src/services/analysisProgress.ts'
import { objectDisplayName } from '../src/services/objectNames.ts'

test('same-scene follow-ups cannot inherit another object or whole-photo conversation', () => {
  const scene = { id: 'photo-1', description: 'A scene', objects: [], ocr: { status: 'complete', text: '' }, evidence: [], relationships: [], visibleIssues: [], uncertainty: [] }
  const turn = (objectId, answer, sceneId = scene.id) => ({ sceneId, intent: { mode: 'EXPLORE', goal: 'Tell me more', ...(objectId ? { objectId } : {}) }, response: { answer, suggestions: [] } })
  const history = [turn('mp-0', 'door-context'), turn('mp-1', 'person-context'), turn(undefined, 'whole-photo-context'), turn('mp-1', 'other-image-context', 'photo-2')]
  const prompt = intentPrompt(scene, { mode: 'EXPLORE', goal: 'What next?', objectId: 'mp-1' }, history)
  assert.match(prompt, /person-context/)
  assert.doesNotMatch(prompt, /door-context|whole-photo-context|other-image-context/)
  assert.match(prompt, /"objectId":"mp-1"/)
  assert.match(prompt, /never identify them or infer personal traits/)
  const whole = intentPrompt(scene, { mode: 'EXPLORE', goal: 'What next?' }, history)
  assert.match(whole, /whole-photo-context/)
  assert.doesNotMatch(whole, /door-context|person-context/)
})

test('step percentages never count the unfinished model step as complete', () => {
  for (const objectsReady of [true, false]) for (const textReady of [true, false]) {
    const stage = analysisStageProgress('scene', objectsReady, textReady)
    assert(stage.percent >= 0 && stage.percent < 100)
    assert.equal(stage.completed, Number(objectsReady) + Number(textReady))
    assert.equal(stage.total, 3)
  }
  assert.equal(analysisStageProgress('scene', true, true).percent, 67)
  assert.deepEqual(analysisStageProgress('intent', true, true), { completed: 1, total: 2, percent: 50 })
})

test('estimated progress starts at zero, increases monotonically and never declares pending work complete', () => {
  assert.equal(estimatedAnalysisProgress(0, 50_000), 0)
  let previous = 0
  for (let elapsed = 0; elapsed <= 250_000; elapsed += 500) {
    const percent = estimatedAnalysisProgress(elapsed, 50_000)
    assert(percent >= previous && percent <= 95)
    previous = percent
  }
  assert.equal(previous, 95)
  assert.equal(estimatedAnalysisProgress(-10, 0), 0)
  assert(estimatedAnalysisProgress(10_000, NaN) > 0)
})

test('same-category numbering follows measured boxes and never modifies predictions', () => {
  const objects = ['person', 'laptop', 'person', 'person'].map((label, i) => ({ label, confidence: .8, box: { x: i * 40, y: 0, width: 30, height: 80 } }))
  const original = structuredClone(objects)
  assert.deepEqual(objects.map(object => objectDisplayName(object, objects)), ['Person 1', 'Laptop', 'Person 2', 'Person 3'])
  assert.equal(objectDisplayName(structuredClone(objects[2]), objects), 'Person 2')
  const correction = { originalLabel: 'laptop', label: 'screen', box: objects[1].box }
  assert.equal(objectDisplayName(objects[1], objects, [correction]), 'Screen')
  assert.deepEqual(objects, original)
})
