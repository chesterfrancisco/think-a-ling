import { chatLocal } from './ollama'
import { groundStudyCards, intentPrompt, intentSchema, parseIntent } from './intent'
import type { SceneAnalysis, SceneTurn, UserIntent } from '../types/scene'
import { browserIntent } from './browserReasoning'
import { directEvidenceAnswer } from './answerGuard'

export async function answerIntent(scene: SceneAnalysis, intent: UserIntent, history: SceneTurn[], signal: AbortSignal): Promise<SceneTurn> {
  const goal = intent.goal.trim()
  if (!goal || goal.length > 500) throw new Error('Enter a goal or question between 1 and 500 characters.')
  if (intent.objectId && !scene.objects.some(object => object.id === intent.objectId)) throw new Error('The selected object is not in this saved scene. Choose the photo again to refresh it.')
  const next = { ...intent, goal }
  signal.throwIfAborted()
  const direct = directEvidenceAnswer(scene, next)
  if (direct) return direct
  if (scene.reasoner === 'browser') return browserIntent(scene, next, history, signal)
  const result = await chatLocal(intentPrompt(scene, next, history), intentSchema(scene, next), signal)
  const response = parseIntent(result.content, scene, next)
  return { sceneId: scene.id, intent: next, response, grounding: groundStudyCards(response, scene), elapsedMs: result.elapsedMs, modelMs: result.modelMs }
}
