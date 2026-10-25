import type Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import { conceptMiner } from '../player/ConceptMiner';
import { restingVehiclePose } from '../player/VehiclePose';
export const RIG_SWAP_SECONDS=3.2;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Empty chassis returns to the hangar; replacement sections fly out around the hovering pilot. */
export function drawRigSwap(g:Phaser.GameObjects.Graphics,x:number,y:number,scale:number,p:Progress,age:number,ship:{x:number;y:number},reduced:boolean) {
 const phase=clamp(age/RIG_SWAP_SECONDS),lift=Math.sin(Math.PI*clamp(phase/.88))*42*scale;
 const rig=conceptMiner(p,restingVehiclePose(),undefined,undefined,true);
 const render=(dx:number,dy:number,a:number,assembly:boolean)=>{
 for(const mark of rig){const center=mark.kind==='circle'?mark.x:mark.points.reduce((n,v)=>n+v[0],0)/mark.points.length;
 const group=center< -10?0:center>10?2:1;
 const q=assembly?clamp((phase-.25-group*.055)/.39):1;
 if(assembly&&q===0)continue;
 const ease=1-Math.pow(1-q,3),ox=dx+(assembly?(ship.x-x)*(1-ease):0),oy=dy+(assembly?(ship.y-y)*(1-ease)-Math.sin(q*Math.PI)*(35+group*15)*scale:0);
 const at=(u:number,v:number)=>({x:x+u*scale+ox,y:y+v*scale+oy});
 if(mark.kind==='circle'){const pt=at(mark.x,mark.y);g.fillStyle(mark.color,mark.alpha*a);g.fillCircle(pt.x,pt.y,mark.r*scale);}
 else if(mark.kind==='line'){g.lineStyle(mark.width*scale,mark.color,mark.alpha*a);g.strokePoints(mark.points.map(([u,v])=>at(u,v)),false);}
 else{g.fillStyle(mark.color,mark.alpha*a);g.fillPoints(mark.points.map(([u,v])=>at(u,v)),true);}
 }
 };
 if(reduced){render(0,0,1,false);g.lineStyle(2,0x8be7dc,.8);g.strokeCircle(x,y,36*scale);return;}
 const away=clamp((phase-.12)/.28);
 if(away<1)render((ship.x-x)*away,(ship.y-y)*away-Math.sin(away*Math.PI)*30*scale,1-away*.7,false);
 render(0,0,1,true);
 // Small autonomous lift drones support the pilot while the new rig locks together.
 const py=y-8*scale-lift;
 for(const side of [-1,1]){const dx=x+side*19*scale;g.lineStyle(scale,0x8edfd5,.6);g.lineBetween(dx,py-10*scale,x,py+2*scale);g.fillStyle(0x536f78);g.fillRect(dx-5*scale,py-14*scale,10*scale,4*scale);g.fillStyle(0x90ece1,.7);g.fillTriangle(dx-2*scale,py-10*scale,dx+2*scale,py-10*scale,dx,py-5*scale);}
 g.fillStyle(0xe2b665);g.fillRoundedRect(x-3*scale,py-2*scale,6*scale,9*scale,scale);g.fillCircle(x,py-5*scale,3.5*scale);g.fillStyle(0x163748);g.fillRect(x-2*scale,py-6*scale,4*scale,2*scale);
 if(phase>.7){g.lineStyle(2,0x91f1d5,(1-phase)*2);g.strokeCircle(x,y,(28+(phase-.7)*30)*scale);}
}
