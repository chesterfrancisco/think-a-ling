import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppBoundary, NotFound } from './components/AppFallback'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary>{location.pathname === '/' || location.pathname === '/index.html' ? <App /> : <NotFound />}</AppBoundary>
  </StrictMode>,
)
