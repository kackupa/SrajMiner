import { POD_PAINTS, POD_PROFILES, PILOT_SUITS, POD_DECALS } from '../config';
import type { Progress } from '../economy/Progress';

/** Original hangar portrait of the same articulated pressure-cabin miner. */
export function podPortrait(p: Progress) {
  const paint = POD_PAINTS[p.selectedPaint],
    suit = PILOT_SUITS[p.selectedSuit];
  const profile = POD_PROFILES[p.selectedProfile],
    decal = POD_DECALS[p.selectedDecal];
  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
  const pods = [-1, 1]
    .map(
      (side) => `<g transform="translate(${side * 16} 3)">
    <path d="M-5-12 3-13 6-8 5 11H-5L-7 5Z" fill="#102536"/>
    <path d="M-4-11 2-12 4-7 3 6H-4Z" fill="#7299ad"/>
    <path d="M-4-9 2-10 3-6-4-5Z" fill="${hex(paint.trim)}"/>
    <path d="M-4-2H3M-4 1H3M-4 4H3" stroke="#244456" stroke-width="1.4"/>
    <path d="M-4 7H3L4 9H-5Z" fill="#d2e4e8"/>
    <path d="M0 10 2 14M-5 14H6" fill="none" stroke="#7ca2b5" stroke-width="1.5"/>
  </g>`,
    )
    .join('');
  const accessory =
    profile.style === 'antenna'
      ? '<path d="M-4-19-5-26 0-27" fill="none" stroke="#91aebf"/><circle cy="-27" r="1" fill="#ffcc91"/>'
      : profile.style === 'stabilizers'
        ? '<path d="m-12-5-12-6 2 14 7 4M12-5l12-6-2 14-7 4" fill="#688e9f"/>'
        : profile.style === 'armor'
          ? '<path d="m-10 2-4 1 2 7 5 4M10 2l4 1-2 7-5 4" fill="#8eafbc"/>'
          : '';
  const mark =
    decal.style === 'stripe'
      ? '<path d="M-5 7H4"/>'
      : decal.style === 'arrow'
        ? '<path d="M-4 7H4L1 5M4 7 1 9"/>'
        : decal.style === 'crest'
          ? '<path d="m0 5 3 2-3 3-3-3Z"/>'
          : '<path d="m-4 6 2 2m3-2 2 2"/>';
  return `<svg class="pod-portrait" viewBox="0 0 360 300" role="img" aria-label="Your articulated mining rig with a panoramic cockpit, pilot and twin engine pods">
    <ellipse cx="180" cy="270" rx="105" ry="12" fill="#061725" opacity=".5"/>
    <g transform="translate(180 147) scale(5)">
      <path d="M-9 0-16 7M9 0 16 7" stroke="#91acba" stroke-width="2"/>
      ${pods}${accessory}
      <path d="M-13-15-6-21 8-20 14-13V8L8 15-9 14-14 7Z" fill="#071925"/>
      <path d="M-11-14-5-19 7-18 12-12V7L7 12-8 11-12 5Z" fill="${hex(paint.hull)}"/>
      <path d="M-11-14-5-19 7-18 12-12-2-13Z" fill="${hex(paint.trim)}"/>
      <path d="M7-12H12V7L7 12 6 2Z" fill="#102c40" opacity=".45"/>
      <path d="M-10-12-11 3-7 9 3 10" fill="none" stroke="#fff0cd" stroke-width=".7" opacity=".6"/>
      <path d="M-10-10 8-12 10-7 8 2-7 4-11 0Z" fill="#092437"/>
      <path d="M-8-9 7-10 8-6 6 0-6 2-9-1Z" fill="#35758e"/>
      <path d="M-8-9 7-10 7-7-8-5Z" fill="${hex(profile.cabin)}" opacity=".65"/>
      <path d="M-3-1H3L5 3H-4Z" fill="${hex(suit.body)}"/>
      <rect x="-3" y="-7" width="6" height="6" rx="1" fill="${hex(suit.trim)}"/>
      <path d="M-2-5H2V-3H-2Z" fill="#102536"/>
      <path d="M-2 1-5 1-6-1M2 1 5 0 6-2" fill="none" stroke="${hex(suit.body)}" stroke-width="1.3"/>
      <path d="M-8-8-4-9-8-2Z" fill="#d9ffff" opacity=".25"/>
      <path d="M-9-10 8-11 9-7" fill="none" stroke="#bedce2" stroke-width=".6"/>
      <path d="M-6 6H6V9H-6Z" fill="#183448"/>
      <g fill="none" stroke="${hex(decal.color)}" stroke-width="1">${mark}</g>
      <g fill="${hex(paint.light)}"><circle cx="-11" cy="-2" r="1.2"/><circle cx="11" cy="-2" r="1.2"/></g>
      <path d="M-3 12H3V17H-3Z" fill="#4d7287"/><path d="M-3 17 0 23 3 17Z" fill="#c4d4cf"/><path d="m-2 18 4 2" stroke="#476579" stroke-width=".8"/>
    </g>
  </svg>`;
}
