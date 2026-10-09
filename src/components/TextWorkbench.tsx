import { useState } from 'react'
import { SaveDiscovery } from './LingPockets'
export function TextWorkbench({ text, photoName }: { text: string; photoName: string }) {
  const [search, setSearch] = useState(''), [cards, setCards] = useState(false)
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const matches = search.trim() ? lines.filter(line => line.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) : []
  return <section className="text-workbench"><h3>Put these words to use.</h3><label>Find a detail<input type="search" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder="Search the recognized text…" /></label>
    {search.trim() && <div role="status">{matches.length ? matches.map((line, i) => <p key={i}>{line}</p>) : <p>No matching text. OCR may have missed it; check the photo.</p>}</div>}
    <button onClick={() => setCards(value => !value)} aria-expanded={cards}>{cards ? 'Hide recall practice' : 'Practice recall from these lines'}</button>
    {cards && <><p>Text practice, not an AI explanation. Recall each line, then reveal the exact OCR text and check it against your photo.</p>{lines.slice(0, 6).map((line, i) => <details key={i}><summary>Recall line {i + 1}: “{line.split(/\s+/).slice(0, 2).join(' ')}…”</summary><p>{line}</p></details>)}
    <SaveDiscovery draft={{ title: 'Recall practice: ' + photoName.slice(0, 140), kind: 'text', content: lines.slice(0, 6).map((line, i) => `Line ${i + 1}: ${line}`).join('\n\n'), source: 'Tesseract · verbatim recall practice', photoName, evidence: [], caveats: ['Verbatim OCR text, not verified facts or generated explanations. Check the original photo.'] }} /></>}
  </section>
}
