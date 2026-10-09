// A code-native extension of the original viewfinder-face brand mark.
// Decorative identity only; never used to imply a model prediction.
export function Mascot({ thinking = false }: { thinking?: boolean }) {
  return <svg className={'ling-mascot' + (thinking ? ' is-thinking' : '')} viewBox="0 0 160 160" aria-hidden="true">
    <ellipse cx="80" cy="146" rx="43" ry="7" fill="#ddd5f0" />
    <path d="M53 127l-7 14q-2 7 10 6l15-12M106 127l9 14q3 7-9 6l-16-12" fill="#a68ae1" />
    <path d="M29 82Q8 72 12 61M130 83q20-9 17-23" fill="none" stroke="#a68ae1" strokeWidth="9" strokeLinecap="round" />
    <rect x="27" y="24" width="106" height="110" rx="35" fill="#c7f34b" />
    <path d="M51 45h-7v10m65-10h7v10M44 102v9h9m63-9v9h-9" fill="none" stroke="#3a304d" strokeWidth="4" strokeLinecap="round" />
    <rect x="58" y="59" width="10" height="23" rx="5" fill="#30263e" />
    <rect x="94" y="59" width="10" height="23" rx="5" fill="#30263e" />
    <path d="M68 95q13 12 26-1" fill="none" stroke="#30263e" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="51" cy="88" rx="7" ry="4" fill="#a0c53d" /><ellipse cx="112" cy="88" rx="7" ry="4" fill="#a0c53d" />
    <path d="M80 23q-3-14 13-15" fill="none" stroke="#a68ae1" strokeWidth="5" strokeLinecap="round" /><circle cx="95" cy="8" r="6" fill="#a68ae1" />
    <path d="M144 25v12m-6-6h12M16 111v8m-4-4h8" stroke="#a68ae1" strokeWidth="3" strokeLinecap="round" />
  </svg>
}
