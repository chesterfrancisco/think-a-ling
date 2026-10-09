export function localAsset(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}ai/${path}`, globalThis.location.href).href
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
