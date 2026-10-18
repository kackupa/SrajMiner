import { FRONTIER, MAPS, ORES, PLANET_EXCLUSIVE_ORES, type MapId } from '../config';
import { drawMothership } from '../surface/MothershipArt';
import { restingVehiclePose } from '../player/VehiclePose';

/** Reuse the game's original carrier artwork in the DOM presentation. */
function mothershipMarkup() {
 const shapes:string[]=[];let fill='#ffffff',fillAlpha=1,stroke='#ffffff',strokeAlpha=1,width=1;
 const hex=(color:number)=>'#'+color.toString(16).padStart(6,'0');
 const points=(values:{x:number;y:number}[])=>values.map(p=>`${p.x},${p.y}`).join(' ');
 const pen={
  fillStyle:(color:number,alpha=1)=>{fill=hex(color);fillAlpha=alpha;},
  lineStyle:(size:number,color:number,alpha=1)=>{width=size;stroke=hex(color);strokeAlpha=alpha;},
  fillPoints:(values:{x:number;y:number}[])=>shapes.push(`<polygon points="${points(values)}" fill="${fill}" fill-opacity="${fillAlpha}"/>`),
  strokePoints:(values:{x:number;y:number}[])=>shapes.push(`<polyline points="${points(values)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${strokeAlpha}"/>`),
  fillCircle:(x:number,y:number,r:number)=>shapes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" fill-opacity="${fillAlpha}"/>`),
 };
 drawMothership(pen as unknown as Parameters<typeof drawMothership>[0],(x,y)=>({x,y}),true,{...restingVehiclePose(),lift:1,gear:1});
 return `<svg viewBox="-240 -245 480 290" xmlns="http://www.w3.org/2000/svg">${shapes.join('')}</svg>`;
}
export function arrivalMarkup(id: MapId, summary = '') {
 return `<section class="modal frontier-arrival" role="dialog" aria-modal="true" aria-label="Arrival"><small>MOTHERSHIP LANDED</small><h1>${MAPS[id].name}</h1><p>Exclusive resource: ${ORES[PLANET_EXCLUSIVE_ORES[id]].name}</p><p>Your ship cargo is aboard. Planet stock remains at its colony.</p><p class="arrival-production">${summary}</p><button id="arrival-deploy" class="primary">Deploy miner</button></section>`;
}
export function showTransit(root: HTMLElement, destination: MapId, landed:()=>void) {
 let finished=false;let timer:ReturnType<typeof setTimeout>;
 const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);landed();};
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
 root.innerHTML=`<section class="modal frontier-arrival frontier-transit" role="dialog" aria-modal="true" aria-label="In transit"><small>DESTINATION SAVED</small><h1>${MAPS[destination].name}</h1><p>Departure → Transit → Landing</p><div class="transit-ship" aria-hidden="true">${mothershipMarkup()}</div><button id="transit-skip">Skip</button></section>`;
 root.querySelector<HTMLButtonElement>('#transit-skip')!.onclick=finish;
 root.querySelector<HTMLButtonElement>('#transit-skip')!.focus();
 timer=setTimeout(finish,FRONTIER.transitMs);
}
