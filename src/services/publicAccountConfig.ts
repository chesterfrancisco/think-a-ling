export function isPublicAccountKey(value: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true
  try {
    const payload = value.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
    return JSON.parse(atob(payload)).role === 'anon'
  } catch { return false }
}

export function validatePublicAccountConfig(url?: string, key?: string) {
  if (!url && !key) return false
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('Set VITE_SUPABASE_URL to the project HTTPS URL, without a trailing slash.')
  if (!key || !isPublicAccountKey(key)) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key. Secret and service-role keys must never enter a browser build.')
  return true
}
