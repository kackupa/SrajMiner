import assert from 'node:assert/strict';
import { advanceVehiclePose, restingVehiclePose } from '../src/game/player/VehiclePose';
import { minerPoint, minerPartPoint, minerLocalLook, minerLampPoint } from '../src/game/player/MinerArt';
import { conceptMiner } from '../src/game/player/ConceptMiner';
import { Progress } from '../src/game/economy/Progress';
const input={sideSpeed:0,verticalSpeed:0,facing:-1,thrust:false,grounded:true,drilling:false,paused:false,reducedMotion:false,mechanicalTurn:true};
let pose={...restingVehiclePose(),yaw:0};
let previous=minerPoint(0,0,1,pose,false,20,-10);
for(let i=0;i<53;i++) {
 pose=advanceVehiclePose(pose,input,1/240) as typeof pose;
 const point=minerPoint(0,0,1,pose,false,20,-10);
 assert(Math.hypot(point.x-previous.x,point.y-previous.y)<1.3,'no mirror discontinuity during yaw');previous=point;
}
assert.equal(pose.yaw,Math.PI,'full reversal finishes in 0.22 seconds');
const before=pose.yaw;
pose=advanceVehiclePose(pose,{...input,facing:1},1/60) as typeof pose;
assert(pose.yaw<before && pose.yaw>0,'reverse direction starts immediately from current yaw');
assert.equal(advanceVehiclePose(pose,{...input,paused:true},1),pose,'pause freezes turn');
assert.equal(advanceVehiclePose(pose,{...input,reducedMotion:true,facing:1},1/60).yaw,0,'reduced motion uses final pose without animated rotation');
assert.equal(advanceVehiclePose(restingVehiclePose(),{...input,mechanicalTurn:false},1/60).yaw,undefined,'normal rendering remains unchanged');
const p=new Progress();p.loadout.fitted.weapon='machine-gun';
for(const yaw of [0,.5,Math.PI/2,2.5,Math.PI])for(const angle of [-2,-.4,.7,2]) {
 const pose={...restingVehiclePose(),yaw,bank:.18,lookX:Math.cos(angle),lookY:Math.sin(angle)};
 const marks=conceptMiner(p,minerLocalLook(pose,false));
 const lens=marks.find(m=>m.kind==='poly'&&m.color===0xffd782)!;
 assert(lens.kind==='poly' && lens.anchor);
 const center=lens.points.reduce((a,v)=>({x:a.x+v[0]/lens.points.length,y:a.y+v[1]/lens.points.length}),{x:0,y:0});
 const at=(u:number,v:number)=>minerPartPoint(0,0,1,pose,false,u,v,lens.anchor);
 const visible=at(center.x,center.y), beam=minerLampPoint(0,0,1,p,pose,false);
 assert(Math.hypot(visible.x-beam.x,visible.y-beam.y)<1e-8,'beam remains at the lens even edge-on');
 const pivot=at(lens.anchor.x,lens.anchor.y);
 const facing=Math.atan2(visible.y-pivot.y,visible.x-pivot.x);
 assert(Math.abs(Math.atan2(Math.sin(facing-angle),Math.cos(facing-angle)))<1e-8,'lamp always tracks world aim');
 const barrel=marks.find(m=>m.kind==='line'&&m.anchor&&m.width===1.8)!;
 assert(barrel.kind==='line');
 const a=minerPartPoint(0,0,1,pose,false,...barrel.points[0] as [number,number],barrel.anchor);
 const b=minerPartPoint(0,0,1,pose,false,...barrel.points[1] as [number,number],barrel.anchor);
 assert(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-12)<1e-8,'gun barrel never shrinks during rotation');
 assert(Math.abs((b.x-a.x)/12-Math.cos(angle))<1e-8 && Math.abs((b.y-a.y)/12-Math.sin(angle))<1e-8,'gun keeps tracking aim during turn');
}
console.log('PASS miner turn: continuous yaw, duration, reversals, pause, reduced motion, legacy path, rigid weapon and attached aimed lamp');
