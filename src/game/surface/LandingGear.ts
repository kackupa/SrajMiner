/** Surface heights in the mothership artwork's local coordinates (before its 1.5 scale). */
export type LandingSurface = { height:(x:number)=>number; contact:number };
export function landingFoot(anchor:number,gear:number,surface?:LandingSurface) {
 const x=anchor+Math.sign(anchor)*(12-gear*10),parked=-4-gear*25;
 const blend=Math.max(0,Math.min(1,surface?.contact??0));
 const ground=surface?.height(x)??parked+5;
 const y=parked+(ground-5-parked)*blend;
 const angle=surface&&blend>0?Math.atan2(surface.height(x+1)-surface.height(x-1),2)*blend:0;
 const c=Math.cos(angle),s=Math.sin(angle);
 // The pad rotates about its sole, keeping ground contact while the piston extends.
 const pad=(u:number,v:number)=>[x+u*c-v*s,y+5+u*s+v*c];
 return {x,y,angle,pad};
}

/** The permanent cross-section crust supports the ship even above excavated tunnels. */
export function roundLandingSurface(radius:number,shipRadius:number):LandingSurface {
 const altitude=Math.max(0,shipRadius-radius-8),q=Math.min(1,altitude/32);
 return {
  height:x=>(shipRadius-Math.sqrt(Math.max(0,radius*radius-(x*1.5)**2)))/1.5,
  contact:1-q*q*(3-2*q),
 };
}
