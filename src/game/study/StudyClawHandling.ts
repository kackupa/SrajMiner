import {CLAW_HANDLING_STUDY as C} from '../config';
import type {Point,StudyMaterial} from './UniformPlanet';
type Haul={material:StudyMaterial;source:Point;age:number;released:boolean;units:number};
/** Presentation only. Mining credits inventory immediately; this never awards ore. */
export class StudyClawHandling {
 current?:Haul;
 pending?:Haul;
 completed=0;
 enqueue(material:StudyMaterial,source:Point){
  const haul={material,source:{...source},age:0,released:false,units:1};
  if(!this.current){this.current=haul;return;}
  // One bounded follow-up scoop; valuable material takes precedence over spoil.
  if(!this.pending)this.pending=haul;
  else {this.pending.units++;if(material!=='rock'){this.pending.material=material;this.pending.source={...source};}}
 }
 step(dt:number,interrupted=false){
  if(interrupted){this.current=undefined;this.pending=undefined;return;}
  const h=this.current,step=Math.max(0,Math.min(.05,dt));if(!h||!step)return;
  h.age+=step;
  const release=h.material==='rock'?C.dirtRelease:C.oreRelease;
  let event:StudyMaterial|undefined;
  if(!h.released&&h.age>=release){h.released=true;event=h.material;}
  if(h.age>=C.duration){this.completed++;this.current=this.pending;this.pending=undefined;}
  return event;
 }
}

const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Short weighted carry, then stow or toss. Only the utility arm is driven. */
export function handlingGoal(h:Haul,pickup:Point&{angle:number},face:number){
 const ore=h.material!=='rock',age=h.age;
 const stow={x:-12*face,y:2,angle:Math.atan2(12,2*face)};
 const windup={x:-8*face,y:7,angle:Math.atan2(1,-face)};
 const toss={x:18*face,y:-6,angle:face>0?-.3:Math.PI+.3};
 const target=ore?stow:age<.3?windup:toss;
 const blend=smooth((age-(ore?C.scoop:age<.3?C.scoop:.3))/(ore?.25:age<.3?.12:.1));
 const from=!ore&&age>=.3?windup:pickup;
 const delta=Math.atan2(Math.sin(target.angle-from.angle),Math.cos(target.angle-from.angle));
 return {x:from.x+(target.x-from.x)*blend,y:from.y+(target.y-from.y)*blend,angle:from.angle+delta*blend,holding:false};
}
