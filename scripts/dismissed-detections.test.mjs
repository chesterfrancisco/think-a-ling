import test from 'node:test'
import assert from 'node:assert/strict'
import { excludeDismissedDetections } from '../src/services/dismissedDetections.ts'
import { applyLabelCorrections } from '../src/services/labelCorrections.ts'
import { intentPrompt, parseIntent } from '../src/services/intent.ts'

const box = { x: 10, y: 20, width: 30, height: 40 }
const dismissed = { label: 'remote', confidence: .38, box }
const scene = {
  id: 'same-photo', description: 'The original unverified description.',
  objects: [
    { id: 'mp-0', name: 'remote', source: 'mediapipe', boundingBox: box, confidence: .38, purposes: [], evidenceIds: ['E0'] },
    { id: 'mp-1', name: 'remote', source: 'mediapipe', boundingBox: { ...box, x: 80 }, confidence: .6, purposes: [], evidenceIds: ['E1'] },
    { id: 'vision-0', name: 'remote', source: 'gemma', purposes: [], evidenceIds: ['G0'] },
  ],
  evidence: [
    { id: 'E0', source: 'mediapipe', kind: 'observed', description: 'Remote prediction 0' },
    { id: 'E1', source: 'mediapipe', kind: 'observed', description: 'Remote prediction 1' },
    { id: 'G0', source: 'gemma', kind: 'inferred', description: 'A model guess' },
    { id: 'T0', source: 'tesseract', kind: 'observed', description: 'Keep this text.' },
  ],
  ocr: { status: 'complete', text: 'Keep this text.', evidenceIds: ['T0'] },
  relationships: [{ subject: 'mp-0', relation: 'near', object: 'mp-1', evidenceIds: ['E0', 'E1'] }],
  visibleIssues: [{ description: 'Depends on rejected evidence', evidenceIds: ['E0'] }, { description: 'Other evidence', evidenceIds: ['E1'] }],
  uncertainty: [],
}

test('removing one detection excludes only its exact box and dependent evidence, preserving raw IDs and Undo', () => {
  const original = JSON.stringify(scene)
  const corrected = applyLabelCorrections(scene, [{ originalLabel: 'remote', label: 'pen', box }])
  const next = excludeDismissedDetections(corrected, [dismissed])
  assert.deepEqual(next.objects.map(o => o.id), ['mp-1', 'vision-0'])
  assert.deepEqual(next.evidence.map(e => e.id), ['E1', 'G0', 'T0'])
  assert.deepEqual(next.relationships, [])
  assert.equal(next.visibleIssues.length, 1)
  assert.equal(next.ocr, scene.ocr)
  assert.equal(next.description, scene.description)
  assert.equal(JSON.stringify(scene), original)
  assert.equal(excludeDismissedDetections(corrected, []), corrected)
  assert.equal(next.objects[0].confidence, .6)
  assert.match(next.uncertainty[0], /User removed detector tag/)
})

test('follow-up requests cannot cite removed detection evidence as observed, even after a label edit', () => {
  const next = excludeDismissedDetections(scene, [dismissed])
  const intent = { mode: 'EXPLORE', goal: 'What is here?' }
  assert.match(intentPrompt(next, intent, []), /User removed detector tag/)
  const answer = { status: 'answered', answer: 'A remote.', observations: [{ statement: 'A remote is visible.', evidence_ids: ['E0'] }], suggestions: [], issues: [], study_cards: [], uncertainty_notes: [] }
  assert.throws(() => parseIntent(JSON.stringify(answer), next, intent))
})
