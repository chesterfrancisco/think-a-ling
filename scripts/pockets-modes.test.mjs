import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readPockets, savePocket, deletePocket, pocketFromScene, pocketFromTurn } from '../src/services/pockets.ts'
import { relevantModes, modeForGoal } from '../src/services/modeRelevance.ts'
import { localSpeechEngine } from '../src/services/localSpeech.ts'

const scene = { id: 's1', image: { name: 'desk.jpg', url: 'blob:private-photo' }, description: 'Model description', objects: [], ocr: { text: '', status: 'complete' }, evidence: [], visibleIssues: [], uncertainty: ['May be wrong.'] }
test('saving is explicit, deduplicated, removable and does not store photo URLs; corrupt storage is rejected', () => {
  const data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  globalThis.window = new EventTarget()
  const draft = pocketFromScene(scene)
  assert.deepEqual(readPockets(), [])
  const result = savePocket(draft)
  assert.equal(savePocket(draft).id, result.id)
  assert.equal(readPockets().length, 1)
  assert.equal(JSON.stringify(readPockets()).includes('blob:private-photo'), false)
  assert.deepEqual(readPockets()[0].caveats.slice(-1), scene.uncertainty)
  deletePocket(result.id)
  assert.deepEqual(readPockets(), [])
  data.set('think-a-ling.pockets.v1', '[{"content":"broken"}]')
  assert.throws(readPockets)
  assert.throws(() => savePocket(draft))
})
test('saved answers preserve recommendation caveats and references; saving does not claim completed physical work', () => {
  const turn = { intent: { goal: 'Improve my desk' }, response: { answer: 'An option.', suggestions: [{ title: 'Idea', description: 'Move an item.', evidence_ids: ['E0'], uncertainty: 'Check first.' }], issues: [], uncertainty_notes: ['May not fit.'] }, grounding: { studyCards: [], warnings: ['Unverified.'] } }
  const saved = pocketFromTurn(scene, turn)
  assert.match(saved.content, /Move an item\./)
  assert.match(saved.content, /E0/)
  assert.match(saved.content, /Check first/)
  assert.ok(saved.caveats.includes('Unverified.'))
  assert.match(saved.caveats.at(-1), /has not been verified/)
})
test('mode relevance follows user intent; an ungrounded issue is not promoted; wiring is a check context not a confirmed hazard', () => {
  assert.deepEqual(relevantModes(scene).modes, ['EXPLORE'])
  assert.equal(relevantModes(scene, 'Find a cable').modes[0], 'FIND')
  assert.equal(relevantModes({ ...scene, visibleIssues: [{ description: 'Danger!', evidenceIds: ['missing'] }] }).modes[0], 'EXPLORE')
  const wiring = { ...scene, evidence: [{ id: 'E0', kind: 'observed', source: 'gemma' }], objects: [{ name: 'power strip', purposes: [], evidenceIds: ['E0'] }] }
  assert.equal(relevantModes(wiring).modes[0], 'FIX')
  assert.equal(relevantModes(wiring, 'Find a switch').modes[0], 'FIND')
  assert.match(relevantModes(wiring).reason, /does not establish overload or safety/)
  assert.equal(modeForGoal('Please organize my workspace'), 'IMPROVE')
  assert.equal(modeForGoal('unrelated'), undefined)
})
test('voice rejects remote-only speech APIs rather than silently uploading audio', () => {
  globalThis.isSecureContext = true
  globalThis.SpeechRecognition = class {}
  assert.throws(localSpeechEngine, /No cloud voice/)
  class Local { processLocally = false; static available() {}; static install() {} }
  Object.defineProperty(Local.prototype, 'processLocally', { value: false })
  globalThis.SpeechRecognition = Local
  assert.equal(localSpeechEngine(), Local)
  globalThis.isSecureContext = false
  assert.throws(localSpeechEngine)
})
