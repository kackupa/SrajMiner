import { POD_PAINTS, POD_PROFILES, PILOT_SUITS, POD_DECALS } from '../config';
import type { Progress } from '../economy/Progress';

// Original vector workshop illustration. Mirrors the player's equipped cosmetics.
export function podPortrait(p: Progress) {
  const paint = POD_PAINTS[p.selectedPaint], suit = PILOT_SUITS[p.selectedSuit];
  const profile = POD_PROFILES[p.selectedProfile], decal = POD_DECALS[p.selectedDecal];
  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
  const vents = [103, 116, 129, 142, 155].map(y =>
    `<path d="M83 ${y}h17m160 0h17" stroke="#0d1c23" stroke-width="5"/>`).join('');
  const accessory = profile.style === 'antenna'
    ? '<path d="M180 62V22m-19 13h38m-11-9v18" stroke="#c9d6d0" stroke-width="3"/><circle cx="180" cy="20" r="4" fill="#ecc28b"/>'
    : profile.style === 'stabilizers'
      ? '<path d="M116 89 58 71 68 162 115 172M244 89 302 71 292 162 245 172" fill="#577077" stroke="#9aa9a3" stroke-width="2"/>'
      : profile.style === 'armor'
        ? '<path d="M110 91 97 194 119 214M250 91 263 194 241 214" fill="none" stroke="#8d9e96" stroke-width="13"/>' : '';
  const mark = decal.style === 'stripe' ? '<path d="M151 187h58"/>'
    : decal.style === 'arrow' ? '<path d="m156 182 44 0m-13-9 15 9-15 9"/>'
      : decal.style === 'crest' ? '<path d="m180 176 13 11-13 11-13-11Z"/>'
        : '<path d="m167 176 10 10-10 10-10-10Zm23 3 10 10-10 10-10-10Z"/>';
  return `<svg class="pod-portrait" viewBox="0 0 360 300" role="img" aria-label="Your mining pod with its equipped paint, suit, decal and profile">
    <ellipse cx="180" cy="275" rx="86" ry="9" fill="#09151b" opacity=".5"/>
    <g fill="none" stroke="#7b9998" stroke-width="1" opacity=".35">
      <path d="M38 67v160m-6-160h12m-12 160h12M68 258h224m-224-6v12m224-12v12"/>
      <path d="M47 77h24m218 0h24M47 216h23m220 0h24" stroke-dasharray="3 5"/>
    </g>
    ${accessory}
    <path d="M101 99h158v106H101z" fill="#0d1c22" stroke="#5e777a" stroke-width="2"/>
    <path d="M73 90h34v85l-9 17H75l-7-17V103zM253 90h34l5 13v72l-7 17h-23l-9-17z" fill="#6a807e" stroke="#101f26" stroke-width="3"/>
    <path d="M76 94h25M259 94h25" stroke="#a8b8aa" stroke-width="3"/>
    ${vents}
    <path d="M77 188h28l-4 28H81zM255 188h28l-4 28h-20z" fill="#14252d" stroke="#637a7b" stroke-width="2"/>
    <path d="M82 207h17m162 0h17" stroke="#a3ccc4" stroke-width="3"/>
    <path d="M136 58h88l22 26v115l-22 23h-88l-22-23V84z" fill="${hex(paint.hull)}" stroke="#102129" stroke-width="4"/>
    <path d="m136 58-15 26h118l-15-26z" fill="${hex(paint.trim)}"/>
    <path d="M123 89v101l13 17h87" fill="none" stroke="#f3e5c2" stroke-opacity=".38" stroke-width="3"/>
    <path d="M235 86v109l-18 20h-81" fill="none" stroke="#102129" stroke-opacity=".35" stroke-width="7"/>
    <path d="M137 86h86l7 12v55l-10 12h-80l-10-12V98z" fill="#10232d" stroke="#758d8a" stroke-width="3"/>
    <path d="M139 92h81v23h-81z" fill="${hex(profile.cabin)}" opacity=".25"/>
    <path d="m142 93 35 0-36 50M189 93h11l-37 44" stroke="#d0ebe3" stroke-width="3" opacity=".17"/>
    <path d="M165 133h30l8 25h-46z" fill="${hex(suit.body)}"/>
    <rect x="165" y="113" width="30" height="29" rx="8" fill="${hex(suit.trim)}"/>
    <path d="M169 120h22v10h-22z" fill="#10232d"/>
    <path d="M173 122h13" stroke="#b5d5d0" stroke-width="2"/>
    <path d="M140 153h18m45 0h18" stroke="#789494" stroke-width="5"/>
    <path d="M145 173h70v29h-70z" fill="#12232b" opacity=".16"/>
    <g fill="none" stroke="${hex(decal.color)}" stroke-width="3">${mark}</g>
    <g fill="#172931" stroke="#cad2b7" stroke-width="1"><circle cx="129" cy="99" r="2"/><circle cx="231" cy="99" r="2"/><circle cx="130" cy="196" r="2"/><circle cx="230" cy="196" r="2"/></g>
    <path d="M150 223h60v12h-60z" fill="#a9b6a5" stroke="#14262d" stroke-width="3"/>
    <path d="m150 235 30 36 30-36z" fill="#bdc3aa" stroke="#23363b" stroke-width="2"/>
    <path d="m155 240 41 8m-33 2 23 7m-15 2 7 4" stroke="#526866" stroke-width="3"/>
    <path d="M151 66h58" stroke="#f6e6c6" stroke-width="3" opacity=".7"/>
    <rect x="171" y="49" width="18" height="9" fill="#183038"/>
    <rect x="175" y="49" width="10" height="5" fill="${hex(paint.light)}"/>
  </svg>`;
}
