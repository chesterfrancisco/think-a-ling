import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReasoning, reasoningPrompt, reasoningWarnings } from '../src/services/reasoning.ts'

// Synthetic contract fixtures, never used by the application or model validation runs.
const valid = () => ({
  scene_description: 'A table on a plain background.',
  visible_objects: [{ name: 'table', evidence: 'A flat surface supported by side panels.' }],
  object_affordances: [{ object: 'table', use: 'Possible work surface.', basis: 'Flat top.' }],
  visible_issues: [], potential_improvements: [], uncertainty_notes: [], matches: [], relationships: [],
})
test('accepts zero issues and empty arrays without inventing defaults', () => {
  const value = valid()
  assert.deepEqual(parseReasoning(JSON.stringify(value)), value)
})
test('rejects malformed or incomplete JSON instead of displaying partial claims', () => {
  assert.throws(() => parseReasoning('{'))
  assert.throws(() => parseReasoning('{}'))
  assert.throws(() => parseReasoning('```json\n{}\n```'))
})
test('requires nonempty evidence and rejects extra coordinates', () => {
  const value = valid()
  value.visible_issues = [{ issue: 'Broken table', evidence: '  ' }]
  assert.throws(() => parseReasoning(JSON.stringify(value)))
  value.visible_issues = []
  value.visible_objects[0].box = [0, 0, 100, 100]
  assert.throws(() => parseReasoning(JSON.stringify(value)))
})
test('rejects wrong types and unknown match categories', () => {
  for (const change of [
    value => { value.visible_objects = 'table' },
    value => { value.matches = [{ object: 'table', kind: 'certain', reason: 'yes', evidence: 'top' }] },
  ]) {
    const value = valid()
    change(value)
    assert.throws(() => parseReasoning(JSON.stringify(value)))
  }
})
test('surfaces inconsistent references without inventing or changing model objects', () => {
  const value = valid()
  value.object_affordances[0].object = 'unlisted chair'
  const parsed = parseReasoning(JSON.stringify(value))
  assert.deepEqual(parsed, value)
  assert.match(reasoningWarnings(parsed)[0], /unlisted chair.*unverified/)
  assert.deepEqual(reasoningWarnings(valid()), [])
})
test('limits model content size and list lengths', () => {
  const value = valid()
  value.scene_description = 'x'.repeat(501)
  assert.throws(() => parseReasoning(JSON.stringify(value)))
  value.scene_description = 'table'
  value.uncertainty_notes = Array(6).fill('uncertain')
  assert.throws(() => parseReasoning(JSON.stringify(value)))
})
test('mode-specific validation rejects extraneous mode output', () => {
  const value = valid()
  assert.throws(() => parseReasoning(JSON.stringify(value), 'FIX'))
  value.object_affordances = []
  assert.deepEqual(parseReasoning(JSON.stringify(value), 'FIX'), value)
})
test('includes positive supporting context as data', () => {
  const prompt = reasoningPrompt('EXPLORE', '', {
    detections: [{ label: 'dog', confidence: 0.734 }], ocrText: 'Invoice 12345',
  })
  assert.match(prompt, /"label":"dog","confidence":0.734/)
  assert.match(prompt, /Invoice 12345/)
})
test('prompt differentiates modes, preserves empty detector/OCR results and caps context', () => {
  const empty = { detections: [], ocrText: '' }
  assert.match(reasoningPrompt('FIX', '', empty), /Zero issues is a valid/)
  assert.match(reasoningPrompt('FIND', 'work surface', empty), /work surface/)
  assert.match(reasoningPrompt('EXPLORE', '', empty), /practical uses/)
  assert.match(reasoningPrompt('IMPROVE', '', empty), /optional enhancements/)
  assert.match(reasoningPrompt('FIX', '', empty), /"detections":\[\],"ocrText":""/)
  assert.match(reasoningPrompt('FIX', '', { detections: null, ocrText: null }), /"detections":null/)
  const prompt = reasoningPrompt('FIND', 'q'.repeat(900), { detections: null, ocrText: 'z'.repeat(8000) })
  assert.ok(!prompt.includes('z'.repeat(4001)))
  assert.ok(!prompt.includes('q'.repeat(501)))
  assert.match(prompt, /untrusted data/)
})
