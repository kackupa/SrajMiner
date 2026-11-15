import type {VehiclePose} from './VehiclePose';
import type {Progress} from '../economy/Progress';
import {minerBodyOffset} from './ConceptMiner';
import {minerPoint,minerPartPoint} from './MinerArt';
import {forgeCutterGoals} from './ForgeArm';
export const CLAW_SCALE=.78;
export const CLAW_GRIP=16*CLAW_SCALE;
export const CLAW_CONTACT=21*CLAW_SCALE;
export function forgeCargoHatch(p:Progress,pose:VehiclePose){
 return minerPoint(0,0,1,pose,false,8*Math.cos(pose.yaw??0),-10+minerBodyOffset(p,pose),3);
}

/** Shared by rendering and charge placement; coordinates are in the miner's art space. */
export function forgeClawSocket(p:Progress,pose:VehiclePose){
 const arm=pose.forge?.cutters?.[1]??forgeCutterGoals(pose)[1];
 const anchor={x:18*Math.cos(pose.yaw??0),y:-24+minerBodyOffset(p,pose)};
 const shoulder=minerPoint(0,0,1,pose,false,anchor.x,anchor.y,3);
 const wrist=minerPartPoint(0,0,1,pose,false,anchor.x+arm.x,anchor.y+arm.y,anchor,3);
 const angle=arm.angle+pose.bank;
 const tip=(d:number)=>({x:wrist.x+Math.cos(angle)*d,y:wrist.y+Math.sin(angle)*d});
 return {shoulder,wrist,angle,grip:tip(CLAW_GRIP),contact:tip(CLAW_CONTACT)};
}

/** Three fingers built from shaded volumes, sorted in depth around a rotary palm. */
export function drawForgeClaw(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,yaw:number,open:number,holding=false,material?:string){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(CLAW_SCALE,CLAW_SCALE);
 const roll=.45+Math.sin(yaw)*.5;
 const project=(X:number,Y:number,Z:number)=>({x:X-Z*.28,y:Y*.92+Z*.36});
 const radial=(r:number,a:number)=>({y:Math.cos(a+roll)*r,z:Math.sin(a+roll)*r});
 const rod=(a:{x:number;y:number},b:{x:number;y:number},width:number,metal=false)=>{
  const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));
  ctx.fillStyle='#101f26';ctx.beginPath();ctx.roundRect(-1,-width/2-1,l+2,width+2,1.8);ctx.fill();
  const fill=ctx.createLinearGradient(0,-width/2,0,width/2);
  [[0,metal?'#e2e8d8':'#ffe0a0'],[.25,metal?'#9cafac':'#dca349'],[.65,metal?'#52696b':'#9b682e'],[1,metal?'#24383c':'#513a25']].forEach(([n,c])=>fill.addColorStop(n as number,c as string));
  ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(0,-width/2,l,width,1.5);ctx.fill();
  ctx.strokeStyle='#fff1bf55';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(1,-width*.32);ctx.lineTo(l-1,-width*.32);ctx.stroke();
  ctx.restore();
 };
 const hub=(p:{x:number;y:number},r:number)=>{const fill=ctx.createRadialGradient(p.x-r*.3,p.y-r*.4,.2,p.x,p.y,r);fill.addColorStop(0,'#d9d4ad');fill.addColorStop(.35,'#8a9a94');fill.addColorStop(.5,'#263b42');fill.addColorStop(.8,'#bc883e');fill.addColorStop(1,'#172b32');ctx.fillStyle=fill;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();};
 const fingers=[0,1,2].map(i=>{const a=i*Math.PI*2/3;const r0=radial(4,a),r1=radial(5+open*4,a),r2=radial(1.5+open*8,a);return {depth:r1.z,a:project(6,r0.y,r0.z),b:project(14,r1.y,r1.z),c:project(22,r2.y,r2.z)};}).sort((a,b)=>a.depth-b.depth);
 const finger=(f:typeof fingers[number])=>{rod(f.a,f.b,4.4);rod(f.b,f.c,3.2,true);hub(f.a,2.6);hub(f.b,2);const pad={x:f.c.x-1.7,y:f.c.y*.76};rod(f.c,pad,2.5,true);};
 fingers.filter(f=>f.depth<0).forEach(finger);
 rod({x:-3,y:0},{x:7,y:0},11);hub({x:-1,y:0},4.1);
 ctx.fillStyle='#2b444b';ctx.beginPath();ctx.roundRect(2,-2.6,4.4,5.2,1);ctx.fill();ctx.fillStyle='#8bd8ce';ctx.fillRect(3,-1.5,1,3);
 if(holding){rod({x:12,y:0},{x:20,y:0},8,true);ctx.fillStyle='#d4a455';ctx.fillRect(13,-4,2,8);ctx.fillStyle='#ffc578';ctx.beginPath();ctx.arc(18,-2,1,0,Math.PI*2);ctx.fill();}
 if(material){
  const color=material==='copper'?'#d99c60':material==='silver'?'#d5e3dd':material==='iron'?'#9bb7b9':'#637985';
  ctx.fillStyle='#23333b';ctx.beginPath();ctx.moveTo(10,-3);ctx.lineTo(14,-6);ctx.lineTo(21,-3);ctx.lineTo(23,2);ctx.lineTo(17,6);ctx.lineTo(11,3);ctx.closePath();ctx.fill();
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(11,-3);ctx.lineTo(15,-5);ctx.lineTo(21,-2);ctx.lineTo(17,2);ctx.lineTo(12,1);ctx.closePath();ctx.fill();
  ctx.fillStyle=material==='rock'?'#84949a':'#def2dc';ctx.fillRect(14,-3,2,1);
 }
 fingers.filter(f=>f.depth>=0).forEach(finger);
 ctx.restore();
}
