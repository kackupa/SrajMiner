import { FLEET_STUDY } from '../config';
import type { Point } from './UniformPlanet';

type Bullet = Point & { dx:number;dy:number;distance:number;tail:Point };
type Ballistics = {cooldown:number;speed:number;range:number;tracer:number};
/** Disposable ballistics; the scene decides what an impact does to terrain. */
export class StudyGun {
 bullets:Bullet[]=[];
 shots=0;
 hits=0;
 private cooldown=0;
 constructor(private config:Ballistics=FLEET_STUDY.starterGun) {}
 configure(config:Ballistics) { this.config=config;this.bullets=[];this.cooldown=Math.max(this.cooldown,config.cooldown); }
 ready(dt:number) { return this.cooldown<=Math.min(.05,Math.max(0,dt)); }
 step(dt:number,fire:boolean,muzzle:Point,direction:Point,solid:(p:Point)=>boolean,base=muzzle) {
  const cfg=this.config,step=Math.min(.05,Math.max(0,dt));
  this.cooldown=Math.max(0,this.cooldown-step);
  let fired=false;
  const impacts:Point[]=[];
  const norm=Math.hypot(direction.x,direction.y);
  if(fire&&this.cooldown<=0&&norm>.001) {
   this.cooldown=cfg.cooldown;this.shots++;fired=true;
   let source=muzzle;
   const span=Math.max(1,Math.ceil(Math.hypot(muzzle.x-base.x,muzzle.y-base.y)/2));
   for(let i=0;i<=span;i++){const p={x:base.x+(muzzle.x-base.x)*i/span,y:base.y+(muzzle.y-base.y)*i/span};if(solid(p)){source=p;break;}}
   this.bullets.push({...source,dx:direction.x/norm,dy:direction.y/norm,distance:0,tail:{...source}});
  }
  this.bullets=this.bullets.filter(b=>{
   const travel=Math.min(cfg.speed*step,cfg.range-b.distance);
   b.tail={x:b.x-b.dx*Math.min(b.distance,cfg.tracer),y:b.y-b.dy*Math.min(b.distance,cfg.tracer)};
   // Sweep even at low frame rates, including a muzzle touching rock.
   const pieces=Math.max(1,Math.ceil(travel/2)),start={x:b.x,y:b.y};
   for(let i=0;i<=pieces;i++) {
    const t=travel*i/pieces,point={x:start.x+b.dx*t,y:start.y+b.dy*t};
    if(solid(point)){impacts.push(point);this.hits++;return false;}
   }
   b.x+=b.dx*travel;b.y+=b.dy*travel;b.distance+=travel;
   return b.distance<cfg.range;
  });
  return {fired,impacts};
 }
}
