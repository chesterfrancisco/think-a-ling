import test from 'node:test'
import assert from 'node:assert/strict'
import { stepsForTurn, lingStepsKey } from '../src/services/lingSteps.ts'

const scene = { id: 'scene-one', objects: [{ id: 'desk-one' }, { id: 'desk-two' }], evidence: [
  { id: 'E1', kind: 'observed', source: 'gemma', description: 'A visible desk surface.' },
  { id: 'E2', kind: 'inferred', source: 'gemma', description: 'A possible use.' },
  { id: 'U1', kind: 'observed', source: 'user', description: 'A user correction.' },
] }
const turn = () => ({ sceneId: scene.id, intent: { mode: 'IMPROVE', goal: 'Organize', objectId: 'desk-one' }, response: {
  status: 'answered', answer: 'An explanation is not a checklist.',
  suggestions: [{ title: 'Use the surface', description: 'If suitable, arrange the items you use on the visible surface.', evidence_ids: ['E1'], uncertainty: 'Available space is unclear.', kind: 'improve' }],
  issues: [],
} })
test('steps preserve original recommendations, caveats and evidence without rewriting or new inference', () => {
  const original = turn(), saved = structuredClone(original)
  const result = stepsForTurn(original, scene)
  assert.equal(result.length, 1)
  assert.equal(result[0].description, original.response.suggestions[0].description)
  assert.equal(result[0].uncertainty, 'Available space is unclear.')
  assert.deepEqual(result[0].evidenceIds, ['E1'])
  assert.deepEqual(original, saved)
})
test('unsupported, correction-only, inferred-only and non-answered recommendations do not become steps', () => {
  for (const ids of [[], ['missing'], ['E1', 'missing'], ['E2'], ['U1']]) {
    const value = turn(); value.response.suggestions[0].evidence_ids = ids
    assert.deepEqual(stepsForTurn(value, scene), [])
  }
  for (const status of ['needs-more-evidence', 'no-supported-result']) {
    const value = turn(); value.response.status = status
    assert.deepEqual(stepsForTurn(value, scene), [])
  }
})
test('scene/object/answer keys prevent completion from leaking to another discovery', () => {
  const original = turn(), another = turn()
  another.intent.objectId = 'desk-two'
  assert.notEqual(lingStepsKey(original), lingStepsKey(another))
  another.sceneId = 'different-photo'
  assert.deepEqual(stepsForTurn(another, scene), [])
  another.sceneId = scene.id; another.intent.objectId = 'missing'
  assert.deepEqual(stepsForTurn(another, scene), [])
  another.intent.objectId = 'desk-one'; another.response.suggestions[0].description = 'Changed instruction'
  assert.notEqual(lingStepsKey(original), lingStepsKey(another))
})
test('only existing FIX checks become check steps; an observation or prose answer never becomes a task', () => {
  const value = turn(); value.response.suggestions = []
  value.response.issues = [{ description: 'A visible clue.', evidence_ids: ['E1'], checks: ['Check the visible clue without touching equipment.'] }]
  assert.deepEqual(stepsForTurn(value, scene), [])
  value.intent.mode = 'FIX'
  const result = stepsForTurn(value, scene)
  assert.equal(result[0].title, value.response.issues[0].checks[0])
  assert.match(result[0].uncertainty, /not a diagnosis/)
  value.response.issues = []
  assert.deepEqual(stepsForTurn(value, scene), [])
})
