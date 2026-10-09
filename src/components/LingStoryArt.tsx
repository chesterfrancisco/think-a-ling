// Decorative SVG poses extend Ling's existing face, lime body and lilac limbs.
// These are onboarding illustrations, never recognition examples or AI results.
export function LingStoryArt({ activity }: { activity: 'hello' | 'workspace' | 'label' | 'study' | 'check' }) {
  return <svg className={'ling-story-art pose-' + activity} viewBox="0 0 400 280" role="img" aria-label={{ hello: 'Ling waving hello', workspace: 'Ling holding a coiled cable beside a laptop', label: 'Ling reading a product label', study: 'Ling reading an open book', check: 'Ling looking closely at a cable with a magnifying glass' }[activity]}>
    <circle cx="200" cy="135" r="111" fill="#ffffff" opacity=".07" />
    <circle cx="200" cy="135" r="130" fill="none" stroke="#ffffff" strokeOpacity=".13" strokeDasharray="3 12" />
    <g className="story-sparkles" fill="none" stroke="#d5c2ff" strokeWidth="3" strokeLinecap="round"><path d="M70 85v16m-8-8h16M319 67v12m-6-6h12M326 188v16m-8-8h16" /><circle cx="90" cy="191" r="4" /><circle cx="291" cy="29" r="3" /></g>
    <ellipse cx="202" cy="257" rx="112" ry="9" fill="#34224f" opacity=".24" />
    {activity === 'workspace' && <g><path d="M52 217h296" stroke="#c4a8f2" strokeWidth="5" strokeLinecap="round" /><rect x="65" y="152" width="66" height="54" rx="6" fill="#3c2a61" stroke="#d9cbfa" strokeWidth="3" /><path d="M53 207h88l-6 7H59z" fill="#d9cbfa" /><path d="M82 177h20m-20 8h30" stroke="#c7f34b" strokeWidth="3" strokeLinecap="round" /></g>}
    <g className="story-ling-body">
      <path d="M170 218l-13 23q-4 9 12 8l22-20m39-11 15 23q5 9-12 8l-21-20" fill="#bea0f3" />
      <path d="M195 82q-5-24 19-28" fill="none" stroke="#bea0f3" strokeWidth="7" strokeLinecap="round" /><circle cx="215" cy="52" r="8" fill="#bea0f3" />
      <rect x="128" y="79" width="144" height="150" rx="45" fill="#c7f34b" />
      <path d="M160 107h-11v13m91-13h11v13m-102 65v14h14m88-14v14h-14" fill="none" stroke="#3a304d" strokeWidth="5" strokeLinecap="round" />
      <g className="story-eyes"><rect x="170" y="122" width="13" height="28" rx="6.5" fill="#30263e" /><rect x="218" y="122" width="13" height="28" rx="6.5" fill="#30263e" /></g>
      <ellipse cx="161" cy="157" rx="9" ry="5" fill="#a0c53d" /><ellipse cx="241" cy="157" rx="9" ry="5" fill="#a0c53d" />
      <path d="M184 166q17 16 34-1" fill="none" stroke="#30263e" strokeWidth="6" strokeLinecap="round" />
      {activity === 'hello' && <><path d="M130 165q-30 3-34-23" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /><path className="story-wave" d="M269 153q39-7 30-46" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /></>}
      {activity === 'workspace' && <g className="story-held-prop"><path d="M133 161q-22 9-20 32m155-35q29 13 25 37" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /><path d="M115 192c0 44 90 55 120 25s-27-39-29-6 73 49 84-13" fill="none" stroke="#40304f" strokeWidth="7" strokeLinecap="round" /><rect x="103" y="181" width="22" height="19" rx="4" fill="#f6f0ff" /><path d="M109 181v-8m10 8v-8" stroke="#f6f0ff" strokeWidth="4" /><rect x="279" y="183" width="23" height="20" rx="4" fill="#f6f0ff" /><path d="M285 183v-7m11 7v-7" stroke="#f6f0ff" strokeWidth="4" /></g>}
      {activity === 'label' && <g className="story-held-prop"><rect x="204" y="175" width="76" height="67" rx="13" fill="#fff9e9" /><rect x="215" y="163" width="55" height="15" rx="5" fill="#46315f" /><rect x="213" y="187" width="59" height="40" rx="5" fill="#e5d8fb" /><path d="M222 198h34m-34 8h25m-25 8h29" stroke="#786091" strokeWidth="3" strokeLinecap="round" /><path d="M133 164q0 50 83 47m52-53q28 7 12 44" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /><path className="story-label-scan" d="M215 197h54" stroke="#8bb52f" strokeWidth="2" /></g>}
      {activity === 'study' && <g className="story-held-prop"><path d="M123 183q38-18 77 2 39-20 77-2v61q-40-16-77 1-38-17-77-1z" fill="#473260" stroke="#d7c5f3" strokeWidth="3" /><path d="M133 176q34-12 67 9 33-21 67-9v59q-34-13-67 8-33-21-67-8z" fill="#fff7e9" /><path d="M200 185v57" stroke="#cdbbda" strokeWidth="2" /><g className="story-book-lines" stroke="#9d87b4" strokeWidth="3" strokeLinecap="round"><path d="m145 193 35 4m-35 7 35 4m-35 7 29 4m32-22 37-4m-37 15 37-4m-37 15 28-4" /></g><path d="M131 164q-22 25 0 45m138-45q22 25 0 45" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /></g>}
      {activity === 'check' && <g className="story-held-prop"><path d="M129 165q-27 6-14 30m153-35q15 13 27 7" fill="none" stroke="#bea0f3" strokeWidth="12" strokeLinecap="round" /><path d="m278 155 32 40" stroke="#f4ecff" strokeWidth="11" strokeLinecap="round" /><circle cx="267" cy="140" r="29" fill="#ffffff" fillOpacity=".16" stroke="#faf6ff" strokeWidth="7" /><path d="m253 129 9-7" stroke="#faf6ff" strokeWidth="3" strokeLinecap="round" /></g>}
    </g>
    {activity === 'check' && <g><path d="M91 243c-5-36 21-42 38-21s-1 23 14 30" fill="none" stroke="#d9cbfa" strokeWidth="6" strokeLinecap="round" /><rect x="132" y="244" width="23" height="11" rx="4" fill="#d9cbfa" /></g>}
  </svg>
}
