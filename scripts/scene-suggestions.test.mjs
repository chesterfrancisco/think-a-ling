import test from 'node:test'
import assert from 'node:assert/strict'
import { sceneSuggestions } from '../src/services/sceneSuggestions.ts'

const empty = () => ({ objects: [], evidence: [], visibleIssues: [], ocr: { status: 'complete', text: '', evidenceIds: [] } })
const evidence = id => ({ id, kind: 'observed', source: 'gemma', description: 'Test evidence' })
test('question starters use current evidence, corrected names and recorded affordances without mutating the scene', () => {
  const scene = { ...empty(), evidence: [evidence('D1')], objects: [{ name: 'toothbrush', userLabel: 'ballpen', evidenceIds: ['D1'], purposes: [] }] }
  const original = structuredClone(scene)
  for (const mode of ['EXPLORE', 'FIND', 'FIX', 'IMPROVE']) {
    const questions = sceneSuggestions(scene, mode).join(' ')
    assert.match(questions, /ballpen/)
    assert.doesNotMatch(questions, /toothbrush|writing|study|warning|danger/)
  }
  assert.deepEqual(scene, original)
  scene.objects[0].purposes = ['Writing on paper']
  assert.match(sceneSuggestions(scene, 'FIND').join(' '), /Writing on paper/)
})
test('study and warning questions require actual OCR; unsupported objects/issues are not promoted', () => {
  const scene = { ...empty(), evidence: [evidence('T1')], objects: [{ name: 'soldering iron', evidenceIds: ['missing'], purposes: ['soldering'] }], visibleIssues: [{ description: 'damaged cable', evidenceIds: ['missing'] }] }
  assert.doesNotMatch(sceneSuggestions(scene, 'EXPLORE').join(), /soldering|study|words/)
  assert.doesNotMatch(sceneSuggestions(scene, 'FIX').join(), /damaged cable/)
  scene.ocr = { status: 'complete', text: 'KEEP DRY', evidenceIds: ['T1'] }
  assert.match(sceneSuggestions(scene, 'FIX').join(), /recognised text.*warnings/)
  assert.match(sceneSuggestions(scene, 'EXPLORE').join(), /study prompts/)
  scene.ocr.status = 'error'
  assert.doesNotMatch(sceneSuggestions(scene, 'EXPLORE').join(), /study prompts/)
})
test('person-only and empty photos get honest photo questions; long content stays bounded', () => {
  const scene = { ...empty(), evidence: [evidence('D1')], objects: [{ name: 'person', userLabel: 'neighbour', evidenceIds: ['D1'], purposes: [] }] }
  for (const mode of ['EXPLORE', 'FIND', 'FIX', 'IMPROVE']) {
    assert.doesNotMatch(sceneSuggestions(scene, mode).join(), /neighbour|identity|age|trait/)
    assert(sceneSuggestions(empty(), mode).length)
  }
  scene.objects[0] = { name: 'A'.repeat(1000), purposes: ['B'.repeat(1000)], evidenceIds: ['D1'] }
  assert(sceneSuggestions(scene, 'EXPLORE').every(text => text.length < 200))
})
