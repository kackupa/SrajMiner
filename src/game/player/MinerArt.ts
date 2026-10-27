import { ejectorKick } from '../surface/CargoHandling';
import type Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import type { VehiclePose } from './VehiclePose';
import { conceptMiner, minerLampSocket } from './ConceptMiner';

export function minerPoint(x:number,y:number,scale:number,pose:VehiclePose,reducedMotion:boolean,u:number,v:number) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const recoil=reducedMotion?0:Math.sin(pose.phase*43)*pose.drill*.35;
 const flip=pose.turn<-.05?-1:1,width=.72+.28*Math.abs(pose.turn);
 return {x:x+(u*flip*width*c-v*s)*scale,y:y+(u*flip*width*s+v*c+recoil)*scale};
}
export function minerLocalLook(pose:VehiclePose,reducedMotion:boolean) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const flip=pose.turn<-.05?-1:1,width=.72+.28*Math.abs(pose.turn);
 return {...pose,lookX:(pose.lookX*c+pose.lookY*s)*flip/width,lookY:-pose.lookX*s+pose.lookY*c};
}
export function minerLampPoint(x:number,y:number,scale:number,p:Progress,pose:VehiclePose,reducedMotion:boolean) {
 const {lens}=minerLampSocket(p,minerLocalLook(pose,reducedMotion));
 return minerPoint(x,y,scale,pose,reducedMotion,lens.x,lens.y);
}

/** Same articulated model as the workshop, animated without changing physics. */
export function drawMiner(g:Phaser.GameObjects.Graphics,x:number,y:number,scale:number,p:Progress,pose:VehiclePose,reducedMotion:boolean,aim?:{x:number;y:number},unload?:{age:number;count:number}) {
 const bank=reducedMotion?0:pose.bank,c=Math.cos(bank),s=Math.sin(bank);
 const flip=pose.turn<-.05?-1:1, width=.72+.28*Math.abs(pose.turn);
 const at=(u:number,v:number)=>minerPoint(x,y,scale,pose,reducedMotion,u,v);
 // Inverse-transform aim so body banking never changes where the drill points.
 const localAim=aim?{x:(aim.x*c+aim.y*s)*flip/width,y:-aim.x*s+aim.y*c}:undefined;
 const look=minerLocalLook(pose,reducedMotion);
 const kick=unload&&!reducedMotion?ejectorKick(unload.age,unload.count):0;
 for(const mark of conceptMiner(p,{...look,landing:look.landing+kick*.35},localAim,unload?{age:reducedMotion?.5:unload.age,kick}:undefined)){
  if(mark.kind==='circle'){const pt=at(mark.x,mark.y);g.fillStyle(mark.color,mark.alpha);g.fillCircle(pt.x,pt.y,mark.r*scale);}
  else if(mark.kind==='line'){g.lineStyle(mark.width*scale,mark.color,mark.alpha);g.strokePoints(mark.points.map(([u,v])=>at(u,v)),false);}
  else{g.fillStyle(mark.color,mark.alpha);g.fillPoints(mark.points.map(([u,v])=>at(u,v)),true);}
 }
}
