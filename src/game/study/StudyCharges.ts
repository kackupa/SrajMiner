import {CLAW_CHARGE_STUDY as C, type StudyWeaponSpec} from '../config';
import type {Point,UniformPlanet} from './UniformPlanet';
export const chargeSpec:StudyWeaponSpec={id:'charge',name:'Placed charge',slot:'secondary',description:'',role:'',credits:0,iron:0,copper:0,silver:0,cooldown:0,speed:0,range:0,tracer:0,damage:C.damage,armor:.8,blast:C.radius,color:0xffbd76,length:0};
export type PlacedCharge={point:Point;normal:Point;world:number;fuse:number};
/** Disposable consumables: consume only when a hand actually reaches intact rock. */
export class StudyCharges {
 supply:number=C.supply;
 pending?:PlacedCharge & {age:number};
 placed:PlacedCharge[]=[];
 find(world:UniformPlanet,origin:Point,aim:Point){
  const length=Math.hypot(aim.x-origin.x,aim.y-origin.y);if(length<.001)return;
  const dir={x:(aim.x-origin.x)/length,y:(aim.y-origin.y)/length};
  if(world.solidAt(origin))return;
  for(let d=2;d<=C.reach;d+=1){
   const point={x:origin.x+dir.x*d,y:origin.y+dir.y*d};
   if(!world.solidAt(point))continue;
   if(d<C.minReach||!world.at(point))return;
   return {point:{x:point.x-dir.x*1.5,y:point.y-dir.y*1.5},normal:{x:-dir.x,y:-dir.y}};
  }
 }
 begin(world:UniformPlanet,index:number,origin:Point,aim:Point){
  if(this.pending||this.supply<=0)return false;
  const site=this.find(world,origin,aim);if(!site)return false;
  this.pending={...site,world:index,fuse:C.fuse,age:0};return true;
 }
 cancel(){this.pending=undefined;}
 step(world:UniformPlanet,index:number,dt:number,origin:Point,grip:Point){
  const step=Math.max(0,Math.min(.05,dt));
  if(!step)return {blasts:[],released:false,cancelled:false};
  const pending=this.pending;
  let released=false,cancelled=false;
  if(pending){
   pending.age+=step;
   const support={x:pending.point.x-pending.normal.x*2,y:pending.point.y-pending.normal.y*2};
   if(pending.world!==index||Math.hypot(origin.x-pending.point.x,origin.y-pending.point.y)>C.reach+3||pending.age>C.placementTimeout||!world.solidAt(support)){
    this.cancel();cancelled=true;
   }else if(pending.age>=C.placementSeconds&&Math.hypot(grip.x-pending.point.x,grip.y-pending.point.y)<3){
    this.supply--;this.placed.push({...pending});this.cancel();released=true;
   }
  }
  const blasts:Point[]=[];
  this.placed=this.placed.filter(charge=>{
   if(charge.world!==index)return true;
   // A newly released charge receives its full fuse.
   if(charge!==this.placed[this.placed.length-1]||!released)charge.fuse-=step;
   if(charge.fuse>0)return true;
   blasts.push(charge.point);return false;
  });
  return {blasts,released,cancelled};
 }
}
