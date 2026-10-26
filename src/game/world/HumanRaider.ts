import { HUMAN_RAID as C, WORLD } from '../config';
import { surfaceArcCoordinate, surfaceArcPoint, globeSurfaceDistance, type UndergroundStructure } from '../building/UndergroundStructures';
import type { TileWorld } from './TileWorld';
import { weaponRay } from '../player/Weapon';
export type HumanMotion = { kind:'ground'|'gunship'; aimX:number;aimY:number; moving:number; recoil:number; age:number; shot?:{from:{x:number;y:number};to:{x:number;y:number};age:number} };
export type HumanBody = {x:number;y:number;timer:number;human?:HumanMotion};
export function humanMuzzle(body:HumanBody,world:TileWorld){
 const h=body.human!, gravity=world.gravitySign(body.y),base={x:body.x,y:body.y-gravity*12};
 const length=Math.hypot(h.aimX-base.x,h.aimY-base.y)||1;
 return {x:base.x+(h.aimX-base.x)/length*30,y:base.y+(h.aimY-base.y)/length*30};
}
/** Local surface movement. Rigs stop at cliffs, open shafts and walls instead of tunnelling. */
export function advanceHuman(body:HumanBody,dt:number,world:TileWorld,target:{x:number;y:number},structures:UndergroundStructure[]){
 const h=body.human!;h.age+=dt;h.recoil=Math.max(0,h.recoil-dt);h.aimX=target.x;h.aimY=target.y;
 if(h.shot){h.shot.age+=dt;if(h.shot.age>=C.shotSeconds){const shot=h.shot;h.shot=undefined;return {impact:shot};}}
 body.timer-=dt;h.moving=0;
 const gravity=world.gravitySign(body.y),distance=globeSurfaceDistance(world,body.x,body.y,target.x,target.y);
 if(distance>C.range*.72){
 const circumference=world.widthTiles*WORLD.tile*2,arc=surfaceArcCoordinate(world,body.x,body.y),delta=((surfaceArcCoordinate(world,target.x,target.y)-arc+circumference*1.5)%circumference)-circumference/2;
 const next=surfaceArcPoint(world,arc+Math.sign(delta)*dt*(h.kind==='ground'?C.groundSpeed:C.flightSpeed),false),ground=world.surfaceHeight(next.x,next.y);
 const wall=structures.some(s=>(s.kind==='wall'||s.kind==='gate')&&globeSurfaceDistance(world,next.x,next.y,s.x,s.y)<38);
 const supported=world.solid(Math.floor(next.x/WORLD.tile),Math.floor((ground+gravity*3)/WORLD.tile));
 const clear=!world.solid(Math.floor(next.x/WORLD.tile),Math.floor((ground-gravity*22)/WORLD.tile));
 if(h.kind==='gunship'||(supported&&clear&&!wall&&Math.abs(ground-world.surfaceHeight(body.x,body.y))<24)){
 body.x=next.x;body.y=h.kind==='ground'?ground-gravity*22:body.y;h.moving=1;
 }
 }
 if(h.kind==='gunship'){const wanted=world.surfaceHeight(body.x,body.y)-gravity*(C.altitude+Math.sin(h.age*2)*8);body.y+=(wanted-body.y)*Math.min(1,dt*3);}
 if(body.timer<=0&&!h.shot&&distance<=C.range){
 const cover=structures.filter(s=>s.kind==='wall'||s.kind==='gate').map(s=>({x:s.x,y:s.y-world.gravitySign(s.y)*28}));
 const from=humanMuzzle(body,world),ray=weaponRay(world,from,target,C.range,[...cover,target]);
 if(ray.hit>=0){h.shot={from,to:ray.end,age:0};h.recoil=.22;body.timer=C.reload;}
 }
 return {};
}
