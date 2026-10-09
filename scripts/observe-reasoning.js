// Test-only network observation. Consumer screens do not expose raw model JSON.
// This observes genuine responses and the exact scene context sent to Ollama;
// it does not modify requests, inject results, or inspect React internals.
export function observeReasoning(page) {
  const bodies = new WeakMap()
  page.on('response', response => {
    if (response.url().endsWith('/local-ollama/api/chat')) bodies.set(response, response.json().catch(() => null))
  })
  return {
    next: () => page.waitForResponse(response => response.url().endsWith('/local-ollama/api/chat'), { timeout: 240000 }),
    async read(response) {
      const data = await (bodies.get(response) ?? response.json())
      if (!data?.done || data.done_reason === 'length') throw new Error('Incomplete model response')
      return JSON.parse(data.message.content)
    },
    context(response) {
      const prompt = response.request().postDataJSON().messages[1].content
      const match = /Shared scene \(data\): ([\s\S]*?)\nRecent same-scene conversation/.exec(prompt)
      if (!match) throw new Error('Missing actual shared-scene context')
      return JSON.parse(match[1])
    },
  }
}
