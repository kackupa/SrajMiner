import type { Progress } from '../economy/Progress';
import { conceptSvg } from '../player/ConceptMiner';

/** Workshop portrait uses the actual animated miner's shapes and equipment. */
export function podPortrait(p:Progress) {
 return `<svg class="pod-portrait" viewBox="0 0 360 300" role="img" aria-label="Your mining rig: oversized work lamp, offset pilot cockpit, articulated drill and engine legs"><ellipse cx="180" cy="274" rx="110" ry="10" fill="#061725" opacity=".5"/><g transform="translate(180 164) scale(3.7)">${conceptSvg(p)}</g></svg>`;
}
