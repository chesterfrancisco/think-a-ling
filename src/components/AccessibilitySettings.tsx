import { useEffect, useState } from 'react'
import { Accessibility } from 'lucide-react'
export function AccessibilitySettings() {
  const setting = (name: string) => { try { return JSON.parse(localStorage.getItem('think-accessibility') ?? '{}')[name] === true } catch { return false } }
  const [large, setLarge] = useState(() => setting('large')), [still, setStill] = useState(() => setting('still')), [contrast, setContrast] = useState(() => setting('contrast'))
  useEffect(() => { document.documentElement.classList.toggle('large-reading', large); document.documentElement.classList.toggle('still-ling', still); document.documentElement.classList.toggle('strong-contrast', contrast); try { localStorage.setItem('think-accessibility', JSON.stringify({ large, still, contrast })) } catch { /* Preferences still work for this session. */ } }, [large, still, contrast])
  return <section className="settings-section accessibility-settings" aria-labelledby="accessibility-title"><h3 id="accessibility-title"><Accessibility size={20} /> Reading & accessibility</h3><label><input type="checkbox" checked={large} onChange={e => setLarge(e.target.checked)} /> Larger reading text</label><label><input type="checkbox" checked={still} onChange={e => setStill(e.target.checked)} /> Pause decorative animation</label><label><input type="checkbox" checked={contrast} onChange={e => setContrast(e.target.checked)} /> Stronger text contrast</label><p>Use Tab to move, Enter to activate and Escape to close dialogs. Browser zoom works too.</p></section>
}
