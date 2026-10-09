import { useRef } from 'react'
import { Languages, Settings, X } from 'lucide-react'
import { AccessibilitySettings } from './AccessibilitySettings'
import { OfflineSetup } from './OfflineSetup'
import type { AnswerLanguage } from '../services/preferences'

export function SettingsPanel({ language, onLanguageChange }: { language: AnswerLanguage; onLanguageChange: (language: AnswerLanguage) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <button className="settings-nav" aria-label="Settings" title="Accessibility and language settings" onClick={() => dialog.current?.showModal()}><Settings size={19} /><span>Settings</span></button>
    <dialog ref={dialog} className="help-dialog settings-dialog" aria-labelledby="settings-title">
      <button className="sheet-close" aria-label="Close settings" onClick={() => dialog.current?.close()}><X size={20} /></button>
      <span className="sheet-kicker">MAKE IT YOURS</span>
      <h2 id="settings-title">Settings</h2>
      <p className="settings-intro">A little more comfort. Your way of asking.</p>
      <AccessibilitySettings />
      <section className="settings-section" aria-labelledby="language-title">
        <h3 id="language-title"><Languages size={20} /> Prompt & answer language</h3>
        <label htmlFor="answer-language">Answer language</label>
        <select id="answer-language" value={language} onChange={event => onLanguageChange(event.target.value as AnswerLanguage)}>
          <option value="English">English</option>
          <option value="Filipino">Filipino / Tagalog</option>
        </select>
        <p>Applies to your next AI question. English is recommended; Filipino answers may vary in quality.</p>
        <details className="language-help"><summary>Prompt and language limits</summary><p>Ask one specific question, up to 500 characters. Filipino is a requested response language, not a guarantee of fluency or accuracy. Cebuano, Arabic, Korean and other languages are not validated. Text reading uses an English OCR pack; local voice currently requires an English speech pack.</p></details>
      </section>
      <OfflineSetup />
      <p className="settings-footnote">Preferences are kept in this browser when storage is available. No account needed.</p>
    </dialog>
  </>
}
