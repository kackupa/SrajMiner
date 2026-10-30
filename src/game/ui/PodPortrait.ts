import type { Progress } from '../economy/Progress';
import { conceptMiner, conceptSvg } from '../player/ConceptMiner';

/** Workshop portrait uses the actual animated miner's shapes and equipment. */
export function podPortrait(p:Progress, model:typeof conceptMiner=conceptMiner) {
 const points=model(p).flatMap(mark=>mark.kind==='circle'
   ? [[mark.x-mark.r,mark.y-mark.r],[mark.x+mark.r,mark.y+mark.r]] : mark.points);
 const xs=points.map(pt=>pt[0]),ys=points.map(pt=>pt[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const scale=Math.min(280/(right-left),230/(bottom-top));
 const x=180-(left+right)*scale/2,y=144-(top+bottom)*scale/2;
 return `<svg class="pod-portrait" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Your fitted mining rig"><ellipse cx="180" cy="274" rx="90" ry="7" fill="#061018" opacity=".5"/><g transform="translate(${x} ${y}) scale(${scale})">${conceptSvg(p,model)}</g></svg>`;
}
