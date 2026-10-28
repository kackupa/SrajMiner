import { ejectorKick } from '../surface/CargoHandling';
import type Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import type { VehiclePose } from './VehiclePose';
import { conceptMiner, minerLampSocket } from './ConceptMiner';
import type { MinerGroundContact } from '../study/StudyMinerMotion';

export function minerWidth(pose:VehiclePose) {
 return pose.yaw===undefined?(pose.turn<-.05?-1:1)*(.72+.28*Math.abs(pose.turn)):Math.cos(pose.yaw);
}
export function minerPoint(x:number,y:number,scale:number,pose:VehiclePose,reducedMotion:boolean,u:number,v:number,depth=0) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const recoil=reducedMotion?0:Math.sin(pose.phase*43)*pose.drill*.35;
 const horizontal=u*minerWidth(pose)+depth*Math.sin(pose.yaw??0);
 return {x:x+(horizontal*c-v*s)*scale,y:y+(horizontal*s+v*c+recoil)*scale};
}
/** Tool anchors rotate with the cabin; their local geometry and aiming stay rigid. */
export function minerPartPoint(x:number,y:number,scale:number,pose:VehiclePose,reducedMotion:boolean,u:number,v:number,anchor?:{x:number;y:number},depth=0) {
 if(!anchor||pose.yaw===undefined)return minerPoint(x,y,scale,pose,reducedMotion,u,v,depth);
 const base=minerPoint(x,y,scale,pose,reducedMotion,anchor.x,anchor.y,depth),bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 return {x:base.x+((u-anchor.x)*c-(v-anchor.y)*s)*scale,y:base.y+((u-anchor.x)*s+(v-anchor.y)*c)*scale};
}
export function minerLocalLook(pose:VehiclePose,reducedMotion:boolean) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const width=pose.yaw===undefined?minerWidth(pose):1;
 return {...pose,lookX:(pose.lookX*c+pose.lookY*s)/width,lookY:-pose.lookX*s+pose.lookY*c};
}
export function minerLampPoint(x:number,y:number,scale:number,p:Progress,pose:VehiclePose,reducedMotion:boolean) {
 const {lens,pivot}=minerLampSocket(p,minerLocalLook(pose,reducedMotion));
 return minerPartPoint(x,y,scale,pose,reducedMotion,lens.x,lens.y,pivot);
}

/** Same articulated model as the workshop, animated without changing physics. */
export function drawMiner(g:Phaser.GameObjects.Graphics,x:number,y:number,scale:number,p:Progress,pose:VehiclePose,reducedMotion:boolean,aim?:{x:number;y:number},unload?:{age:number;count:number},ground?:MinerGroundContact) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const width=pose.yaw===undefined?minerWidth(pose):1;
 // Inverse-transform aim so body banking never changes where the drill points.
 const localAim=aim?{x:(aim.x*c+aim.y*s)/width,y:-aim.x*s+aim.y*c}:undefined;
 const look=minerLocalLook(pose,reducedMotion);
 const kick=unload&&!reducedMotion?ejectorKick(unload.age,unload.count):0;
 for(const mark of conceptMiner(p,{...look,landing:look.landing+kick*.35},localAim,unload?{age:reducedMotion?.5:unload.age,kick}:undefined,false,ground)){
  const at=(u:number,v:number)=>minerPartPoint(x,y,scale,pose,reducedMotion,u,v,mark.anchor,mark.depth);
  if(mark.kind==='circle'){const pt=at(mark.x,mark.y);g.fillStyle(mark.color,mark.alpha);g.fillCircle(pt.x,pt.y,mark.r*scale);}
  else if(mark.kind==='line'){g.lineStyle(mark.width*scale,mark.color,mark.alpha);g.strokePoints(mark.points.map(([u,v])=>at(u,v)),false);}
  else{g.fillStyle(mark.color,mark.alpha);g.fillPoints(mark.points.map(([u,v])=>at(u,v)),true);}
 }
}
