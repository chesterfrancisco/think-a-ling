import { useEffect, useRef, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import { accountClient, accountConfigured, finishRecovery, useAccount } from '../services/account'
export function AccountPanel() {
  const { session, recovery } = useAccount()
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { if (recovery) dialog.current?.showModal() }, [recovery])
  async function perform(action: () => Promise<string>) {
    if (!navigator.onLine) { setError(true); setMessage('Reconnect for account actions. You can still use device saves offline.'); return }
    setBusy(true); setError(false); setMessage('Connecting securely…')
    try { setMessage(await action()); setPassword('') } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Account request failed. Try again.') } finally { setBusy(false) }
  }
  return <><button className="account-nav" title="Account and cross-device history" aria-label="Account" onClick={() => { setMessage(''); dialog.current?.showModal() }}><UserRound size={19} /></button>
    <dialog ref={dialog} className="help-dialog account-dialog" aria-labelledby="account-title">
      <button className="sheet-close" aria-label="Close account" onClick={() => { setPassword(''); dialog.current?.close() }}><X size={20} /></button>
      <h2 id="account-title">{recovery ? 'Choose a new password' : session ? 'Your account' : 'Keep discoveries across devices'}</h2>
      <p>Core AI and device saves work without an account. Sign in to sync the text and evidence you explicitly choose. Photos stay on your device.</p>
      {!accountConfigured ? <p className="warning-notice" role="status">Accounts are not connected on this deployment yet. You can use all available local features and save discoveries on this device.</p> : <>
        {session && !recovery ? <><p>Signed in as {session.user.email}</p><p>Open Saved to upload selected discoveries or see your account history.</p>
          <button disabled={busy} onClick={() => void perform(async () => { const { error } = await accountClient!.auth.signOut(); if (error) throw error; return 'Signed out. Your device saves remain here.' })}>Sign out</button>
          <button className="danger-action" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete account</button>
          {confirmDelete && <div className="warning-notice"><p>Delete this account and all its synced discoveries? Device-only saves remain. This cannot be undone.</p><button className="danger-action" disabled={busy} onClick={() => void perform(async () => { const { error } = await accountClient!.rpc('delete_own_account'); if (error) throw error; await accountClient!.auth.signOut({ scope: 'local' }); setConfirmDelete(false); return 'Account and synced discoveries deleted.' })}>Confirm account deletion</button><button onClick={() => setConfirmDelete(false)}>Keep account</button></div>}
        </> : <form onSubmit={e => { e.preventDefault(); void perform(async () => {
          if (recovery) { const { error } = await accountClient!.auth.updateUser({ password }); if (error) throw error; finishRecovery(); return 'Password updated.' }
          if (mode === 'reset') { const { error } = await accountClient!.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }); if (error) throw error; return 'If this account exists, check your email for a recovery link.' }
          if (mode === 'signup') { const { error } = await accountClient!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/' } }); if (error) throw error; return 'Check your email to confirm your account, then sign in. If already registered, use Sign in or Reset password.' }
          const { error } = await accountClient!.auth.signInWithPassword({ email, password }); if (error) throw error; return 'Signed in. Open Saved to choose what to sync.'
        }) }}>
          {!recovery && <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
          {(recovery || mode !== 'reset') && <label>Password<input type="password" minLength={8} maxLength={128} required autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /><small>At least 8 characters. Use a unique password.</small></label>}
          <button disabled={busy} type="submit">{recovery ? 'Update password' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send recovery link' : 'Sign in'}</button>
          {!recovery && <div>{(['signin', 'signup', 'reset'] as const).filter(m => m !== mode).map(m => <button type="button" disabled={busy} key={m} onClick={() => { setMode(m); setMessage(''); setPassword('') }}>{m === 'signin' ? 'Sign in' : m === 'signup' ? 'Create account' : 'Reset password'}</button>)}</div>}
        </form>}
      </>}
      {message && <p className={error ? 'error' : busy ? '' : 'success-notice'} role={error ? 'alert' : 'status'}>{message}</p>}
    </dialog>
  </>
}
