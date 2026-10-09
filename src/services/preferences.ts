import { useEffect, useState } from 'react'

export type AnswerLanguage = 'English' | 'Filipino'

export function useAnswerLanguage() {
  const [language, setLanguage] = useState<AnswerLanguage>(() => {
    try { return localStorage.getItem('think-answer-language') === 'Filipino' ? 'Filipino' : 'English' }
    catch { return 'English' }
  })
  useEffect(() => {
    try { localStorage.setItem('think-answer-language', language) }
    catch { /* The selected language still works for this session. */ }
  }, [language])
  return [language, setLanguage] as const
}
