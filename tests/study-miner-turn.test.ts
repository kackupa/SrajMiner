import assert from 'node:assert/strict';
import { advanceVehiclePose, restingVehiclePose } from '../src/game/player/VehiclePose';
import { minerPoint, minerPartPoint, minerLocalLook, minerLampPoint } from '../src/game/player/MinerArt';
import { conceptMiner,minerGunSocket } from '../src/game/player/ConceptMiner';
import { Progress } from '../src/game/economy/Progress';
import { volumeFaces } from '../src/game/study/StudyVolume';
import { advanceForgeMotion, type ForgeMotion } from '../src/game/player/ForgeMotion';
import { aimStudyGun } from '../src/game/study/StudyGunAim';
import { forgeFacing,forgeElbow,forgeGunFold,advanceForgeGun,forgeCutterGoals,advanceForgeCutters } from '../src/game/player/ForgeArm';
import {StudyCharges} from '../src/game/study/StudyCharges';
import {UniformPlanet} from '../src/game/study/UniformPlanet';
import {CLAW_CHARGE_STUDY} from '../src/game/config';
import {StudyClawBrace} from '../src/game/study/StudyClawBrace';
import {StudyClawHandling,handlingGoal} from '../src/game/study/StudyClawHandling';
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

// A pressure cabin must retain visible width when the front face turns edge-on.
const contour=[[-17,-16],[-10,-23],[7,-23],[17,-15],[20,1],[14,12],[-8,12],[-17,4]];
for(const yaw of [0,.3,Math.PI/2,2.8,Math.PI]) {
 const pose={...restingVehiclePose(),yaw};
 const faces=volumeFaces(contour,14,(x,y,z)=>minerPoint(0,0,1,pose,false,x,y,z),0x55717a);
 const points=faces.flatMap(f=>f.points);
 assert(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))>13,'Cabin remains a volume through a reversal');
}
assert(conceptMiner(p,{...restingVehiclePose(),yaw:0}).some(m=>m.thickness===14));
assert(conceptMiner(p).every(m=>!m.thickness),'Normal campaign silhouette does not gain study geometry');
console.log('PASS dimensional miner: solid edge-on cabin, finite projection and opt-in geometry');

// The textured rig turns through frontal views. Shoulders must not collapse or
// swap sides, and moving socket anchors must not alter the weapon's world aim.
let motion:ForgeMotion|undefined;
let base={...restingVehiclePose(),yaw:0};
let lastYaw=0;
for(let frame=0;frame<150;frame++){
 const facing=frame<10?1:frame<45?-1:1;
 motion=advanceForgeMotion(motion,base,facing,facing*90,1/120);
 const animated={...base,yaw:motion.yaw,forge:motion};
 assert(Math.abs(motion.yaw-lastYaw)<.15,'turn and interrupted reversal remain continuous');
 lastYaw=motion.yaw;
 const left=minerPoint(0,0,1,animated,false,-18,-24),right=minerPoint(0,0,1,animated,false,18,-24);
 assert(right.x-left.x>29,'full shoulder span stays visible through frontal pivot');
 const target={x:-180,y:-100};
 const solved=aimStudyGun({x:0,y:0},1,p,animated,target);
 const dx=target.x-solved.muzzle.x,dy=target.y-solved.muzzle.y;
 assert(Math.abs(dx*solved.direction.y-dy*solved.direction.x)<.001,'projectile remains aimed from moving muzzle');
 assert(Number.isFinite(motion.heave)&&Math.abs(motion.lean)<1.1);
}
assert.equal(motion!.yaw,0,'reversed turn settles to requested view');
assert.equal(advanceForgeMotion(motion,base,-1,90,0),motion,'zero-time/paused pose does not advance');
const reduced=advanceForgeMotion(motion,base,-1,90,1/60,true);
assert.equal(reduced.yaw,Math.PI);assert.equal(reduced.chestRoll,0);assert.equal(reduced.pivot,0);
console.log('PASS Forge articulation: interrupted pivots, full shoulder span, moving muzzle aim, settled and reduced-motion states');

let flight:ForgeMotion|undefined;
const airborne={...restingVehiclePose(),grounded:false,gear:1,lift:1,lastVerticalSpeed:-200};
for(let i=0;i<120;i++)flight=advanceForgeMotion(flight,airborne,1,155,1/60);
assert(flight!.legTrail < -4,'Legs trail sideways flight');
assert(flight!.armLag < -2,'Idle arm responds to flight momentum');
const beforeReverse=flight!.legTrail;
flight=advanceForgeMotion(flight,airborne,-1,-155,1/60);
assert(Math.abs(flight.legTrail-beforeReverse)<1,'Reversal does not snap hanging limbs');
for(let i=0;i<240;i++)flight=advanceForgeMotion(flight,restingVehiclePose(),1,0,1/60);
assert(Math.abs(flight.legTrail)<.01&&Math.abs(flight.armLag)<.01,'Limbs settle after landing');
assert.equal(advanceForgeMotion(flight,airborne,1,155,1/60,true).legTrail,0);
console.log('PASS flight inertia, reversal continuity, landing settlement and reduced motion');

assert.equal(forgeFacing(1,-100,true,1),-1,'Aim left while walking right');
assert.equal(forgeFacing(-1,100,true,-1),1,'Aim right while walking left');
assert.equal(forgeFacing(-1,3,true,1),-1,'Centre band preserves facing');
assert.equal(forgeFacing(1,0,false,-1),-1,'No pointer retains keyboard facing');
for(const face of [-1,1]){
 const elbows=[];
 for(const angle of [-1.2,0,1.2]){
  const shoulder={x:18*face,y:-24},wrist={x:shoulder.x+Math.cos(angle)*26*face,y:shoulder.y+Math.sin(angle)*26};
  const elbow=forgeElbow(shoulder,wrist,face);elbows.push(elbow);
  assert(Math.abs(Math.hypot(elbow.x-shoulder.x,elbow.y-shoulder.y)-18)<1e-8,'Upper arm retains length');
  assert(Math.abs(Math.hypot(elbow.x-wrist.x,elbow.y-wrist.y)-14)<1e-8,'Compact forearm retains length');
 }
 assert(Math.hypot(elbows[0].x-elbows[2].x,elbows[0].y-elbows[2].y)>15,'Upper arm sweeps with aim instead of keeping elbow fixed');
}
for(const yaw of [0,.8,Math.PI/2,2.4,Math.PI])for(const bank of [-.28,0,.28])for(const angle of [-3,-1.2,.2,1.6,2.8]){
 const m=advanceForgeMotion(undefined,restingVehiclePose(),1,0,0);
 const rig={...restingVehiclePose(),yaw,bank,forge:m};
 const target={x:Math.cos(angle)*180,y:Math.sin(angle)*180};
 const aimed=aimStudyGun({x:0,y:0},1,p,rig,target);
 const dx=target.x-aimed.muzzle.x,dy=target.y-aimed.muzzle.y;
 assert(Math.abs(dx*aimed.direction.y-dy*aimed.direction.x)<1e-8,'Shoulder-mounted shot stays aligned during turns and banking');
 assert(dx*aimed.direction.x+dy*aimed.direction.y>0);
}
console.log('PASS cursor facing, backpedalling, centre stability, full arm articulation and turning muzzle alignment');

for(const face of [-1,1])for(const vertical of [-1,1]){
 const aimPose={...restingVehiclePose(),lookX:face*.3,lookY:vertical};
 let head=advanceForgeMotion(undefined,aimPose,face,0,0);
 const first=advanceForgeMotion(head,aimPose,face,0,1/60);
 assert(Math.abs(first.headTilt)<.15,'Head turns smoothly rather than snapping');
 for(let i=0;i<100;i++)head=advanceForgeMotion(head,aimPose,face,0,1/60);
 assert(Math.abs(head.headTilt)<=.38,'Neck has a bounded range');
 assert.equal(Math.sign(head.headTilt),face*vertical,'Head follows up/down in either facing');
 assert.equal(advanceForgeMotion(head,aimPose,face,0,0),head,'Paused head remains still');
 assert.equal(advanceForgeMotion(head,aimPose,face,0,1/60,true).headTilt,.38*face*vertical,'Reduced motion sets direct pose');
}
console.log('PASS head aim direction, smoothing, neck limits, pause and reduced motion');

for(const face of [-1,1])for(const angle of [-2,-.5,.5,2]){
 const rig={...restingVehiclePose(),yaw:face<0?Math.PI:0,lookX:Math.cos(angle),lookY:Math.sin(angle),forge:advanceForgeMotion(undefined,restingVehiclePose(),face,0,0)};
 const stowed=minerGunSocket(p,{...rig,drill:1});
 assert(Math.hypot(stowed.origin.x-stowed.pivot.x,stowed.origin.y-stowed.pivot.y)<14,'Gun hand retracts beside the body');
 assert(Math.abs(stowed.dx)<1e-8&&stowed.dy<-.999,'Stowed barrel points upward out of the drilling line');
 const deployed=minerGunSocket(p,rig),ready=minerGunSocket(p,{...rig,drill:.04});
 assert.equal(forgeGunFold(.04),0);
 assert(Math.abs((ready.origin.x-ready.pivot.x)-(deployed.origin.x-deployed.pivot.x))<1e-8,'Ready pose restores aimed arm reach');
}
let switching=restingVehiclePose();
for(let i=0;i<30;i++)switching=advanceVehiclePose(switching,{...input,drilling:true},1/60);
assert(forgeGunFold(switching.drill)>.95,'Hold drill smoothly folds gun');
for(let i=0;i<30;i++)switching=advanceVehiclePose(switching,{...input,drilling:false},1/60);
assert.equal(forgeGunFold(switching.drill),0,'Release restores firing-ready pose');
console.log('PASS drill priority pose, retracted gun, raised safe barrel and smooth restoration');

for(const fps of [30,60,120]){
 let deployment=0;
 assert.equal(forgeGunFold(0,deployment),1,'Idle primary is tucked away');
 for(let frame=0;frame<fps/10;frame++)deployment=advanceForgeGun(deployment,true,false,1/fps);
 assert(deployment>0&&deployment<1,'Extension has a visible intermediate pose');
 assert(forgeGunFold(0,deployment)>0,'No firing before the aimed pose');
 for(let frame=0;frame<fps/5;frame++)deployment=advanceForgeGun(deployment,true,false,1/fps);
 assert.equal(deployment,1);assert.equal(forgeGunFold(0,deployment),0);
 const interrupted=advanceForgeGun(deployment,true,true,1/fps);
 assert(interrupted<deployment,'Drill wins over held fire and starts retraction');
 assert.equal(advanceForgeGun(interrupted,false,false,0),interrupted,'Pause freezes mechanism');
 for(let frame=0;frame<fps/2;frame++)deployment=advanceForgeGun(deployment,false,false,1/fps);
 assert.equal(deployment,0,'Release fully retracts the primary');
}
console.log('PASS primary deployment: idle stow, delayed firing, drill priority, pause and frame-rate independence');

for(const fps of [30,60,120])for(const face of [-1,1]){
 const idle={...restingVehiclePose(),yaw:face<0?Math.PI:0};
 let arms=forgeCutterGoals(idle);
 assert(Math.hypot(arms[0].x,arms[0].y)<16,'Idle wrists tuck close to shoulders');
 const flying={...idle,gear:1,grounded:false};
 for(let i=0;i<fps;i++)arms=advanceForgeCutters(arms,flying,1/fps);
 assert(arms[0].y<9,'Flying folds wrists upwards');
 for(const angle of [-Math.PI/2,0,Math.PI/2,Math.PI]){
  const drilling={...idle,drill:1,drillAim:{x:Math.cos(angle)*90,y:Math.sin(angle)*90}};
  const before={...arms[0]};arms=advanceForgeCutters(arms,drilling,1/fps);
  assert(Math.hypot(arms[0].x-before.x,arms[0].y-before.y)<5,'Heavy wrist does not snap on activation');
  for(let i=0;i<fps;i++)arms=advanceForgeCutters(arms,drilling,1/fps);
  for(const [i,arm] of arms.entries()){
   const distance=Math.hypot(arm.x,arm.y);
   assert(i===0?distance>25&&distance<=29:distance>=8-1e-8&&distance<18,'Drill reaches while utility wrist stays close to the chest');
   const elbow=forgeElbow({x:0,y:0},arm,i===0?1:-1);
   assert(Math.abs(Math.hypot(elbow.x,elbow.y)-18)<1e-7);
   assert(Math.abs(Math.hypot(elbow.x-arm.x,elbow.y-arm.y)-14)<1e-7);
   assert(Math.abs(Math.sin(arm.angle-angle))<(i===0?.08:.13),'Drill faces the cut; claw reaches beside it');
  }
 }
 const near=forgeCutterGoals({...idle,drill:1,drillAim:{x:face*25,y:0}});
 assert(Math.hypot(near[0].x,near[0].y)<20,'Nearby work keeps a deeper elbow bend');
 assert.equal(advanceForgeCutters(arms,idle,0),arms,'Pause freezes wrist suspension');
 for(let i=0;i<fps*2;i++)arms=advanceForgeCutters(arms,idle,1/fps);
 assert(Math.abs(arms[0].x-forgeCutterGoals(idle)[0].x)<.02,'Release settles into tucked pose');
}
console.log('PASS cutter wrist suspension, tucked idle/flight, directional reach, fixed bone lengths, pause and return at 30/60/120 Hz');

const chargeWorld=new UniformPlanet(),origin={x:300,y:-Math.sqrt(1760**2-300**2)-26},aim={x:300,y:origin.y+60};
for(const fps of [30,60,120]){
 const charges=new StudyCharges(),initial=charges.supply;
 assert(!charges.begin(chargeWorld,0,origin,{x:300,y:origin.y-100}),'No charge placed in empty sky');
 assert(charges.begin(chargeWorld,0,origin,aim));
 assert(!charges.begin(chargeWorld,0,origin,aim),'Repeated press does not queue duplicate charges');
 const point={...charges.pending!.point};
 for(let i=0;i<fps;i++)charges.step(chargeWorld,0,1/fps,origin,origin);
 assert.equal(charges.supply,initial,'A hand that has not reached rock cannot spend a charge');
 charges.step(chargeWorld,0,1/fps,origin,point);
 assert.equal(charges.supply,initial-1);assert.equal(charges.placed.length,1);
 const fuse=charges.placed[0].fuse;
 charges.step(chargeWorld,0,0,origin,point);assert.equal(charges.placed[0].fuse,fuse,'Pause freezes the fuse');
 charges.step(chargeWorld,1,.05,origin,point);assert.equal(charges.placed[0].fuse,fuse,'Other planet cannot detonate this charge');
 let blasts=0;for(let i=0;i<fps*(CLAW_CHARGE_STUDY.fuse+1);i++)blasts+=charges.step(chargeWorld,0,1/fps,origin,point).blasts.length;
 assert.equal(blasts,1,'Exactly one blast per released charge');
 assert(charges.begin(chargeWorld,0,origin,aim));
 assert(charges.step(chargeWorld,0,.05,{x:origin.x+100,y:origin.y},point).cancelled);
 assert.equal(charges.supply,initial-1,'Moving out of reach cancels without spending');
}
console.log('PASS claw charge placement: reachable rock, hand arrival, single spend, cancellation, paused fuse, world isolation and one blast at 30/60/120 Hz');

const brace=new StudyClawBrace();
let intact=true;
const floor={solidAt:(p:{x:number;y:number})=>intact&&p.y>=25};
const support=brace.update(floor,{x:0,y:0},{x:0,y:1},true)!;
assert(support&&!floor.solidAt(support.point)&&floor.solidAt(support.support),'Fingers contact exposed rock, not empty air');
assert.equal(brace.update(floor,{x:2,y:1},{x:1,y:0},true),support,'Grip stays fixed in world space while body moves');
intact=false;assert.equal(brace.update(floor,{x:0,y:0},{x:0,y:1},true),undefined,'Destroyed support releases the hand');
intact=true;brace.update(floor,{x:0,y:0},{x:0,y:1},true);
assert.equal(brace.update(floor,{x:0,y:-100},{x:0,y:1},true),undefined,'Walking/flying out of reach releases the grip');
brace.update(floor,{x:0,y:0},{x:0,y:1},true);
assert.equal(brace.update(floor,{x:0,y:0},{x:0,y:1},false),undefined,'Stopping drill releases the brace');
assert.equal(brace.update({solidAt:()=>false},{x:0,y:0},{x:0,y:1},true),undefined,'No bracing against empty air');
const blocked={solidAt:(p:{x:number;y:number})=>(p.y>=5&&p.y<8)||p.y>=25};
const blockedContact=brace.update(blocked,{x:0,y:0},{x:0,y:1},true);
assert(!blockedContact||blockedContact.support.y<8,'Cannot reach through a close wall to brace beyond it');
console.log('PASS claw bracing: exposed support, anchored contact, destroyed rock, reach, release and occlusion');

for(const fps of [30,60,120]){
 const handling=new StudyClawHandling();handling.enqueue('copper',{x:1,y:2});
 const age=handling.current!.age;handling.step(0);assert.equal(handling.current!.age,age,'Pause freezes handling');
 for(let i=0;i<30;i++)handling.enqueue(i%2?'rock':'iron',{x:i,y:2});
 assert.equal(handling.pending!.material,'iron','Ore is not hidden by subsequent dirt in a combined scoop');
 const events:string[]=[];
 for(let i=0;i<fps*3;i++){const e=handling.step(1/fps);if(e)events.push(e);}
 assert.deepEqual(events,['copper','iron'],'A burst of cuts produces two bounded visual deposits, never a long queue');
 assert.equal(handling.completed,2);
 handling.enqueue('rock',{x:0,y:0});let throws=0;
 for(let i=0;i<fps;i++)if(handling.step(1/fps)==='rock')throws++;
 assert.equal(throws,1,'Dirt releases exactly once');
 handling.enqueue('silver',{x:0,y:0});handling.step(1/fps,true);
 assert(!handling.current&&!handling.pending,'Charge/boarding interruption clears visual work');
 assert.equal(handling.step(.05),undefined,'Interrupted work never emits a delayed deposit');
 handling.enqueue('copper',{x:0,y:0});
 for(const face of [-1,1])for(let i=0;i<fps;i++){
  const h={...handling.current!,age:i/fps};const goal=handlingGoal(h,{x:20*face,y:14,angle:.5},face);
  assert(Number.isFinite(goal.angle)&&Math.hypot(goal.x,goal.y)<29,'Handling stays within the articulated arm reach in both directions');
 }
}
console.log('PASS claw handling: pause, coalescing, ore priority, one release, interruption and bounded poses at 30/60/120 Hz');

for(const fps of [30,60,120])for(const direction of [-1,1]){
 const thrust={...restingVehiclePose(),grounded:false,gear:1,lift:1,strafe:direction};
 let body:ForgeMotion|undefined;
 for(let frame=0;frame<fps;frame++)body=advanceForgeMotion(body,thrust,-direction,direction*155,1/fps);
 assert(body!.chestRoll*direction>.15,'Chest leans into thrust even while looking backwards');
 assert(body!.armLag*direction<-5&&body!.legTrail*direction<-8,'Arms and legs visibly trail the booster direction');
 assert(Math.abs(body!.chestRoll)>Math.abs(body!.hipRoll),'Chest leads the heavier pelvis');
 const before=body!;
 body=advanceForgeMotion(body,{...thrust,strafe:-direction},direction,-direction*155,1/fps);
 assert(Math.abs(body.legTrail-before.legTrail)<1&&Math.abs(body.chestRoll-before.chestRoll)<.06,'Reversal keeps inertia rather than snapping the limbs');
 assert.equal(advanceForgeMotion(body,thrust,direction,155,0),body,'Pause freezes the complete response');
 for(let frame=0;frame<fps*2;frame++)body=advanceForgeMotion(body,{...thrust,strafe:0},direction,0,1/fps);
 assert(Math.abs(body.armLag)<.01&&Math.abs(body.legTrail)<.01&&Math.abs(body.chestRoll)<.01,'Release settles in mid-air without requiring a landing');
 const still=advanceForgeMotion(body,thrust,direction,155,1/fps,true);
 assert.equal(still.armLag,0);assert.equal(still.legTrail,0);assert.equal(still.chestRoll,0);
}
console.log('PASS booster body response: input-led lean, counter-facing inertia, separated chest/hips, reversal, airborne settle, pause and reduced motion at 30/60/120 Hz');
