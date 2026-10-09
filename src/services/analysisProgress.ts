// Equal completed-stage counts, not a prediction of model time or token progress.
export function analysisStageProgress(phase: 'scene' | 'intent', objectsReady: boolean, textReady: boolean) {
  const total = phase === 'scene' ? 3 : 2
  const completed = phase === 'scene' ? Number(objectsReady) + Number(textReady) : 1
  return { completed, total, percent: Math.round(completed / total * 100) }
}

// Ollama does not supply completion percentages. This is a time-based estimate,
// never a measurement of model work. Hold below 100 until validation succeeds.
export function estimatedAnalysisProgress(elapsedMs: number, expectedMs: number) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const expected = Number.isFinite(expectedMs) && expectedMs > 0 ? expectedMs : 60_000
  return Math.min(95, Math.floor(100 * (1 - Math.exp(-2 * elapsed / expected))))
}
