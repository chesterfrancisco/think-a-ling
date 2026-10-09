import { Component } from 'react'
import type { ReactNode } from 'react'
import { Mascot } from './Mascot'
import { Brand } from './Brand'
export function NotFound({ crash = false }: { crash?: boolean }) {
  return <main className="app-fallback"><Brand /><Mascot thinking /><h1>{crash ? 'Ling hit a snag.' : 'Ling can’t find that page.'}</h1><p>{crash ? 'Please reopen the app. Your saved discoveries are still in this browser.' : 'This address may have changed or been mistyped. Let’s get you back to exploring.'}</p><a href="/">Back to Think-a-ling</a><small>{crash ? 'Unexpected interface error' : '404 · Page not found'}</small></main>
}
export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <NotFound crash /> : this.props.children }
}
