import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryActions, discoveryCategory, discoveryGoal, discoveryKey, discoveryExcerpt } from '../src/components/objectDiscovery.ts'

test('people actions target surroundings and prohibit identity/personal-trait inference', () => {
  const person = { label: 'person', box: { x: 1, y: 2, width: 3, height: 4 } }
  assert.deepEqual(discoveryActions('person').map(item => item.label), ['Learn about the scene', 'Ask about the photo', 'Explore surroundings'])
  for (const action of discoveryActions('person')) assert.match(discoveryGoal(action, person), /Do not identify the person or infer personal traits/)
})
test('context actions keep OCR separate from reasoning and retain uncertainty for plant care', () => {
  assert.equal(discoveryCategory('potted plant'), 'plants')
  assert.match(discoveryActions('potted plant').find(item => item.label === 'Care guidance').instruction, /confirmed/)
  assert.deepEqual(discoveryActions('dining table').map(item => item.label), ['Organize', 'Improve placement', 'Find what helps', 'Ask'])
  assert.equal(discoveryActions('book').find(item => item.label === 'Read text').kind, 'ocr')
  assert.match(discoveryActions('book', { ocrText: 'Plants need light.' }).find(item => item.label === 'Study').instruction, /actual OCR/)
  assert.deepEqual(discoveryActions('unknown item').map(item => item.label), ['Learn', 'Use', 'Check', 'Ask'])
})

test('actions use recognized text and saved goals without assuming OCR belongs to the selected box', () => {
  assert.deepEqual(discoveryActions('document').map(item => item.label), ['Read text', 'Ask'])
  assert.equal(discoveryActions('laptop').some(item => item.label === 'Care guidance'), false)
  assert.deepEqual(discoveryActions('oven').map(item => item.label), ['Learn', 'Check', 'Ask'])
  assert.equal(discoveryActions('bottle', { ocrText: 'Actual label' }).at(-1).kind, 'ocr')
  const selected = discoveryActions('chair', { userGoal: 'Make room for writing' })[0]
  const goal = discoveryGoal(selected, { label: 'chair', box: { x: 1, y: 2, width: 3, height: 4 } }, undefined, undefined, 'Make room for writing')
  assert.match(goal, /Previous user goal \(data\)/)
  assert.match(goal, /Make room for writing/)
})
test('response keys distinguish identical labels by their actual boxes; excerpts never rewrite content', () => {
  const one = { label: 'dog', box: { x: 10, y: 20, width: 30, height: 40 } }
  assert.notEqual(discoveryKey(one), discoveryKey({ ...one, box: { ...one.box, x: 11 } }))
  const text = 'An actual model sentence. Another sentence about the scene.'
  assert.equal(discoveryExcerpt(text, 200), text)
  assert(text.startsWith(discoveryExcerpt(text, 25).slice(0, -1)))
})
