import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import type { Pocket } from './pockets'
import { validPocket } from './pockets'
import { isPublicAccountKey } from './publicAccountConfig'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const accountConfigured = !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !!key && isPublicAccountKey(key)
export const accountClient = accountConfigured ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
}) : undefined
let current: { session: Session | null; recovery: boolean } = { session: null, recovery: false }
const listeners = new Set<() => void>()
accountClient?.auth.onAuthStateChange((event, session) => { current = { session, recovery: event === 'PASSWORD_RECOVERY' || (current.recovery && event !== 'SIGNED_OUT') }; listeners.forEach(fn => fn()) })
export function finishRecovery() { current = { ...current, recovery: false }; listeners.forEach(fn => fn()) }
export function useAccount() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => current) }
function client() {
  if (!navigator.onLine) throw new Error('You’re offline. Device saves still work; reconnect for your account.')
  if (!accountClient) throw new Error('Account service is not connected on this deployment yet. Device saves still work.')
  return accountClient
}
export async function cloudPockets(): Promise<Pocket[]> {
  const { data, error } = await client().from('discoveries').select('payload').order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error('Could not load account history. Check your connection and sign in again if needed.')
  if (!data.every(row => validPocket(row.payload))) throw new Error('Some saved account records could not be read. Nothing was imported.')
  return data.map(row => row.payload as Pocket)
}
export async function uploadPocket(pocket: Pocket) {
  const supabase = client()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Please sign in again before syncing.')
  if (!validPocket(pocket)) throw new Error('This discovery is incomplete.')
  const existing = await supabase.from('discoveries').select('id').eq('id', pocket.id).maybeSingle()
  if (existing.error) throw new Error('Could not check your account history. Reconnect and try again.')
  if (existing.data) return
  const { error } = await supabase.from('discoveries').insert({ id: pocket.id, owner_id: user.id, payload: pocket })
  if (error && error.code !== '23505') throw new Error('Could not sync this discovery. The account limit is 100 saves; check storage and connection.')
}
export async function removeCloudPocket(id: string) {
  const { error } = await client().from('discoveries').delete().eq('id', id)
  if (error) throw new Error('Could not delete this account discovery. Reconnect and try again.')
}
