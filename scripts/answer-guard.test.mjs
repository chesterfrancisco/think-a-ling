import test from 'node:test'
import assert from 'node:assert/strict'
import { directEvidenceAnswer, repetitiveAnswer, unsupportedBlanketAnswer } from '../src/services/answerGuard.ts'
test('direct text retrieval never rewrites OCR or associates all-photo text to one object', () => {
  const scene = { id: 'scene', ocr: { status: 'complete', text: 'Invoice 12345 Total 250.00' } }
  const turn = directEvidenceAnswer(scene, { mode: 'EXPLORE', goal: 'Read the text' })
  assert.equal(turn.response.answer, scene.ocr.text)
  assert.equal(turn.modelMs, null)
  assert.match(turn.grounding.warnings[0], /Direct OCR/)
  assert.equal(directEvidenceAnswer(scene, { mode: 'EXPLORE', goal: 'Read the text', objectId: 'person-1' }), undefined)
})
test('photo safety/identity checks return limitations instead of fabricated certification', () => {
  for (const goal of ['Is this safe?', 'Who is this?', 'Ligtas ba ito?', 'Is this overloaded?']) {
    const result = directEvidenceAnswer({ id: 's' }, { mode: 'FIX', goal, language: 'Filipino' })
    assert.equal(result.response.status, 'needs-more-evidence')
    assert.equal(result.response.issues.length, 0)
    assert.equal(result.response.suggestions.length, 0)
  }
})
test('rejects repeated sentences/tokens without rejecting normal concise answers', () => {
  assert(repetitiveAnswer('This is a wooden table. This is a wooden table. This is a wooden table.'))
  assert(repetitiveAnswer('desk desk desk desk desk desk'))
  assert(!repetitiveAnswer('A desk is visible. It may help with studying.'))
})
test('rejects the actually observed unhelpful blanket-use answer and unsupported safety assurances', () => {
  assert(unsupportedBlanketAnswer('The desk could be used for anything.'))
  assert(unsupportedBlanketAnswer('This setup is completely safe.'))
  assert(!unsupportedBlanketAnswer('The detector noticed a table; ask about one visible detail.'))
})
