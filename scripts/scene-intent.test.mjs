import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleScene } from '../src/services/scene.ts'
import { groundStudyCards, parseIntent, intentPrompt } from '../src/services/intent.ts'

const image = { name: 'test.png', url: 'blob:local-test', element: { naturalWidth: 640, naturalHeight: 480 } }
const detections = [{ label: 'table', confidence: 0.8, box: { x: 10, y: 20, width: 300, height: 200 } }]
const model = {
  analysis: { scene_description: 'A table.', visible_objects: [{ name: 'table', evidence: 'A flat top.' }],
    object_affordances: [{ object: 'table', use: 'Writing surface', basis: 'Flat top.' }], visible_issues: [],
    relationships: [], potential_improvements: [], matches: [], uncertainty_notes: [] },
  warnings: [], elapsedMs: 100, modelMs: 90,
}
const scene = () => assembleScene(image, detections, 'Plants need light.', model)
const response = () => ({ status: 'answered', answer: 'A possible study surface.', observations: [], suggestions: [], issues: [], study_cards: [], uncertainty_notes: [] })

test('fusion preserves original image and exact MediaPipe coordinates without assigning them to Gemma', () => {
  const value = scene()
  assert.equal(value.image.url, image.url)
  assert.equal(value.objects.length, 2)
  assert.deepEqual(value.objects[0].boundingBox, detections[0].box)
  assert.equal(value.objects[0].confidence, 0.8)
  assert.equal(value.objects[1].boundingBox, undefined)
  assert.equal(value.objects[1].confidence, undefined)
  assert.deepEqual(value.objects[1].purposes, ['Writing surface'])
  assert.equal(value.ocr.text, 'Plants need light.')
})
test('grounded cards accept OCR evidence and reject vision-only evidence', () => {
  const value = scene()
  const answer = response()
  answer.study_cards = [{ question: 'What do plants need?', answer: 'Light.', evidence_ids: value.ocr.evidenceIds }]
  assert.deepEqual(parseIntent(JSON.stringify(answer), value, { mode: 'EXPLORE', goal: 'Make cards' }), answer)
  answer.study_cards[0].evidence_ids = value.objects[1].evidenceIds
  assert.throws(() => parseIntent(JSON.stringify(answer), value, { mode: 'EXPLORE', goal: 'Make cards' }))
})
test('rejects unknown evidence IDs and suggestions without supporting evidence', () => {
  const answer = response()
  answer.suggestions = [{ title: 'Write', description: 'Use the top.', kind: 'use', evidence_ids: ['invented'], uncertainty: 'Not verified.' }]
  assert.throws(() => parseIntent(JSON.stringify(answer), scene(), { mode: 'EXPLORE', goal: 'Use it' }))
  answer.suggestions[0].evidence_ids = []
  assert.throws(() => parseIntent(JSON.stringify(answer), scene(), { mode: 'EXPLORE', goal: 'Use it' }))
})
test('empty scenes and zero issues are valid; cards require actual OCR', () => {
  const value = assembleScene(image, [], '', { ...model, analysis: { ...model.analysis, visible_objects: [], object_affordances: [] } })
  const answer = { ...response(), status: 'needs-more-evidence' }
  assert.deepEqual(parseIntent(JSON.stringify(answer), value, { mode: 'FIX', goal: 'Check this' }), answer)
  answer.study_cards = [{ question: 'Invented?', answer: 'No.', evidence_ids: ['E1'] }]
  assert.throws(() => parseIntent(JSON.stringify(answer), value, { mode: 'EXPLORE', goal: 'Study' }))
})
test('follow-up prompt carries same-scene history, provenance and scenario limits', () => {
  const value = scene()
  const prompt = intentPrompt(value, { mode: 'IMPROVE', goal: 'Which idea first?' }, [{ sceneId: value.id, intent: { mode: 'EXPLORE', goal: 'Use the table' }, response: response() }, { sceneId: 'other-image', intent: { mode: 'FIX', goal: 'SECRET OTHER SCENE' }, response: response() }])
  assert.match(prompt, /Use the table/)
  assert.match(prompt, /Plants need light/)
  assert.match(prompt, /not receiving a new image/)
  assert.match(prompt, /medical suitability/)
  assert.match(prompt, /untrusted data/)
  assert.ok(!prompt.includes('"boundingBox"'))
  assert.ok(!prompt.includes('SECRET OTHER SCENE'))
})
test('card grounding corrects source links and withholds unsupported answers without editing model output', () => {
  const value = scene()
  const answer = response()
  answer.study_cards = [
    { question: 'What do plants need?', answer: 'Plants need light.', evidence_ids: ['E1'] },
    { question: 'Unsupported?', answer: 'Plants need metal.', evidence_ids: value.ocr.evidenceIds },
  ]
  const copy = structuredClone(answer)
  const result = groundStudyCards(answer, value)
  assert.equal(result.studyCards.length, 1)
  assert.deepEqual(result.studyCards[0].evidence_ids, value.ocr.evidenceIds)
  assert.equal(result.warnings.length, 2)
  assert.deepEqual(answer, copy)
})
test('observations cannot cite inferred evidence as an observed fact', () => {
  const value = scene()
  value.evidence.push({ id: 'inferred-use', kind: 'inferred', source: 'gemma', description: 'Possible use.' })
  const answer = response()
  answer.observations = [{ statement: 'Guaranteed use.', evidence_ids: ['inferred-use'] }]
  assert.throws(() => parseIntent(JSON.stringify(answer), value, { mode: 'EXPLORE', goal: 'Use this' }))
})

test('answer text matches expose actual OCR without inventing citations or rewriting model content', () => {
  const value = scene()
  value.evidence.push({ id: 'vision-warning', source: 'gemma', kind: 'observed', description: 'Do not mix with bleach.' })
  const answer = { ...response(), answer: 'The notes say "Plants need light." Do not mix with bleach.' }
  const original = structuredClone(answer)
  assert.deepEqual(groundStudyCards(answer, value).answerTextMatches, value.ocr.evidenceIds)
  assert.deepEqual(answer, original)
  assert.deepEqual(groundStudyCards({ ...answer, answer: 'Plants might need more light.' }, value).answerTextMatches, [])
})
test('partial local engine failures remain explicit rather than fabricated empty successes', () => {
  const value = assembleScene(image, [], '', model, { detection: 'Missing model', ocr: 'Missing language' })
  assert.equal(value.ocr.status, 'error')
  assert.match(value.uncertainty.join(' '), /Missing model.*Missing language/)
})

test('Find rejects capability suggestions when the actual scene has no recorded affordances', () => {
  const value = scene()
  value.objects.forEach(object => { object.purposes = [] })
  const answer = response()
  answer.suggestions = [{ title: 'Unsupported capability', description: 'Prop up a charger.', kind: 'find', evidence_ids: value.objects[0].evidenceIds, uncertainty: 'Not verified.' }]
  assert.throws(() => parseIntent(JSON.stringify(answer), value, { mode: 'FIND', goal: 'Charge my phone' }))
  answer.suggestions = []
  answer.status = 'no-supported-result'
  assert.deepEqual(parseIntent(JSON.stringify(answer), value, { mode: 'FIND', goal: 'Charge my phone' }), answer)
})
