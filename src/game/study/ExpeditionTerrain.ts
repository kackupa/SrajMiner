import { SURFACE_EXPEDITION as E, UNIFORM_PLANET_STUDY as C } from '../config';
import type { Point } from './UniformPlanet';

const delta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mound=(angle:number,center:number,width:number)=>{
  const t=Math.abs(delta(angle,center))/width;
  return t>=1?0:(1+Math.cos(t*Math.PI))*.5;
};
/** Broad slopes and distinct landmarks, with the starter ship's apron intact. */
export function expeditionRadius(angle:number){
 const apron=1-mound(angle,-.255,.3);
 const background=(18*Math.sin(angle*5)+14*Math.sin(angle*9+.4))*apron;
 return C.radius+background+E.ridgeHeight*mound(angle,E.ridge,.16)
  -E.craterDepth*mound(angle,E.crater,.19)+E.mountainHeight*mound(angle,E.mountain,.2)
  +115*mound(angle,1.7,.24)-65*mound(angle,2.3,.2)+145*mound(angle,-1.35,.22);
}
export const radialPoint=(angle:number,radius:number):Point=>({x:Math.sin(angle)*radius,y:-Math.cos(angle)*radius});
export const surfaceAngle=(p:Point)=>Math.atan2(p.x,-p.y);
export function expeditionCave(p:Point){
 const angle=surfaceAngle(p),depth=expeditionRadius(angle)-Math.hypot(p.x,p.y);
 // Leave an actual stone roof under the wreck, not a cosmetic crust line over
 // an empty cell. The adjacent mouth remains open and this roof is still mineable.
 if(angle>.305&&angle<.59&&depth<70)return false;
 // Open mouth in the crater's west wall; a sloping passage joins a broad chamber
 // with a second opening beneath the ridge. All carve decisions are deterministic.
 const segment=(a:Point,b:Point,width:number)=>{
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<width;
 };
 return segment({x:330,y:-1800},{x:430,y:-1510},55)
  ||segment({x:430,y:-1510},{x:790,y:-1420},68)
  ||segment({x:790,y:-1420},{x:920,y:-1600},55)
  ||segment({x:460,y:-1660},{x:460,y:-1490},55)
  ||((p.x-590)/225)**2+((p.y+1450)/110)**2<1;
}
