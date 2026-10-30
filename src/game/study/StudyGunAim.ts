import type { Progress } from '../economy/Progress';
import type { VehiclePose } from '../player/VehiclePose';
import { minerGunSocket } from '../player/ConceptMiner';
import { minerGunPoint, minerLocalLook, minerPartPoint, minerWidth } from '../player/MinerArt';
import type { Point } from './UniformPlanet';

/** Aim the articulated barrel at a screen point independently of body turn smoothing. */
export function aimStudyGun(at:Point,scale:number,p:Progress,pose:VehiclePose,target:Point) {
 const socket=minerGunSocket(p,minerLocalLook(pose,false));
 const base=minerPartPoint(at.x,at.y,scale,pose,false,
  socket.origin.x-socket.dx*(4-pose.fire*3),
  socket.origin.y-socket.dy*(7-pose.fire*3),pose.yaw===undefined?undefined:socket.pivot);
 const c=Math.cos(pose.bank),s=Math.sin(pose.bank),width=pose.yaw===undefined?minerWidth(pose):1;
 const x=target.x-base.x,y=target.y-base.y;
 const tx=(x*c+y*s)/(scale*width),ty=(-x*s+y*c)/scale;
 let angle=Math.atan2(ty,tx);
 // The receiver rises 3 extra local units as the arm aims vertically.
 // Solve at the receiver, not the miner centre, so near shots also meet the cursor.
 if(Math.hypot(tx,ty)>8)for(let i=0;i<16;i++)angle=Math.atan2(ty-3*Math.sin(angle),tx);
 const dx=Math.cos(angle)*width,dy=Math.sin(angle);
 const aimed={...pose,lookX:dx*c-dy*s,lookY:dx*s+dy*c};
 const muzzle=minerGunPoint(at.x,at.y,scale,p,aimed,false);
 return {pose:aimed,muzzle,direction:{x:aimed.lookX,y:aimed.lookY}};
}
