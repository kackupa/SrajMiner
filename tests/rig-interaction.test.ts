import assert from 'node:assert/strict';
import { captureCargoSources, crateLaunchTime } from '../src/game/surface/CargoHandling';
import { UniformPlanet, UniformMiner } from '../src/game/study/UniformPlanet';
import { UniformDrill } from '../src/game/study/UniformDrill';
import { advanceVehiclePose, restingVehiclePose, mechanicalFootstep } from '../src/game/player/VehiclePose';
import { UNIFORM_PLANET_STUDY as C } from '../src/game/config';

const sources:{x:number;y:number}[]=[];
captureCargoSources(sources,0,6,{x:0,y:0});assert.equal(sources.length,0);
for(let i=0;i<6;i++)captureCargoSources(sources,crateLaunchTime(i),6,{x:100+i*25,y:-i*10});
assert.deepEqual(sources,Array.from({length:6},(_,i)=>({x:100+i*25,y:-i*10})));
captureCargoSources(sources,3,6,{x:999,y:999});assert.equal(sources[0].x,100,'in-flight sources stay fixed');

const world=new UniformPlanet(),drill=new UniformDrill(),from={x:0,y:-600};
let face=world.drillFace(from,{x:1,y:0});assert(face.length>=2,'fixture spans two adjacent blocks');
assert.equal(drill.step(face,true,.2,.32,()=>0,()=>true),undefined);
const first=drill.target;
const cut=drill.step([...face].reverse(),true,.13,.32,()=>0,()=>true);
assert.equal(cut,first,'tiny aim changes preserve progress on exposed block');
assert(cut);world.remove(cut);assert.equal(world.excavated.size,1,'one block for one cycle');
face=world.drillFace(from,{x:1,y:0});
assert.equal(drill.step(face,true,.1,.32,()=>0,()=>true),undefined,'neighbour needs its own cycle');
assert.equal(drill.step(face,true,.4,.32,()=>0,()=>false),undefined,'full cargo cannot mine ore');
drill.step(face,false,.1,.32,()=>0,()=>true);assert.equal(drill.elapsed,0);

// Retain a navigable body-width tunnel even though each cut removes only one cell.
const tunnel=new UniformPlanet(),rig=new UniformMiner(),cutter=new UniformDrill();
for(let i=0;i<1800;i++){
 const out=rig.basis().out,face=tunnel.drillFace(rig,{x:-out.x,y:-out.y});
 const cut=cutter.step(face,true,1/120,C.drillSeconds,()=>0,()=>true);
 if(cut)tunnel.remove(cut);
 rig.step(tunnel,0,false,1/120);assert(!tunnel.collides(rig));
}
assert(Math.hypot(rig.x,rig.y)<C.radius-300);
for(let i=0;i<1000;i++)rig.step(tunnel,0,true,1/120);
assert(Math.hypot(rig.x,rig.y)>C.radius,'single-block drill still allows a return home');
for(const angle of [0,.7,1.6,3,4.4]){
 const out={x:Math.cos(angle),y:Math.sin(angle)},tangent={x:-out.y,y:out.x};
 const rising={x:tangent.x+out.x*.3,y:tangent.y+out.y*.3};
 assert(world.drillDirectionAllowed({x:out.x*1776,y:out.y*1776},rising));
 assert(!world.drillDirectionAllowed({x:out.x*1776,y:out.y*1776},out),'no outward drilling');
 assert(!world.drillDirectionAllowed({x:out.x*700,y:out.y*700},rising),'no new underground ceiling drilling');
}
const input={sideSpeed:100,verticalSpeed:0,facing:1,thrust:false,grounded:true,drilling:false,paused:false,reducedMotion:false,mechanicalTurn:true};
let pose=restingVehiclePose();for(let i=0;i<60;i++)pose=advanceVehiclePose(pose,input,1/60);
assert(Math.abs(pose.bank)<.04,'grounded cabin is steady');
const phase=pose.walkPhase;pose=advanceVehiclePose(pose,{...input,sideSpeed:0},.05);
assert.equal(pose.walkPhase,phase,'blocked/stationary rig does not march');
for(let i=0;i<100;i++){
 const p={...pose,stride:1,walkPhase:i*Math.PI*2/100};
 const a=mechanicalFootstep(p,0),b=mechanicalFootstep(p,1);
 assert(a.lift<.001||b.lift<.001,'at least one foot stays planted');
}
console.log('PASS moving cargo origins, single-block cuts, aim stability, tunnel return, curved tangent allowance and alternating distance-driven gait');

// Downward thrust is radial on both hemispheres, and quickly reverses a climb.
for(const angle of [0,.8,2,3.7,5]){
 const world=new UniformPlanet(),a=new UniformMiner(),free=new UniformMiner();
 const origin={x:Math.cos(angle)*(C.radius+300),y:Math.sin(angle)*(C.radius+300)};
 a.teleport(origin);free.teleport(origin);a.fallSpeed=free.fallSpeed=-C.flightSpeed;
 for(let i=0;i<30;i++){a.step(world,0,false,1/120,true);free.step(world,0,false,1/120);}
 assert(a.fallSpeed>75,'S reverses full ascent within a quarter second');
 assert(free.fallSpeed<0,'gravity alone would still be climbing');
 assert(a.diving);
 for(let i=0;i<80;i++)a.step(world,0,false,1/120,true);
 assert(a.fallSpeed<=C.diveSpeed);
 const speed=a.fallSpeed;a.step(world,0,false,1/120);
 assert(!a.diving);assert(Math.abs(a.fallSpeed-speed)<=C.gravity/120+.001,'release does not snap velocity');
 for(let i=0;i<70;i++)a.step(world,0,true,1/120,true);
 assert(a.fallSpeed<0&&!a.diving,'W brakes and overrides simultaneous S');
 for(let i=0;i<150;i++){a.step(world,0,false,.1,true);assert(!world.collides(a),'full-speed dive cannot penetrate crust');}
 assert(a.grounded&&!a.diving);assert.equal(world.excavated.size,0,'thrusters never excavate or produce ore');
}
const coreWorld=new UniformPlanet(),diver=new UniformMiner();diver.teleport({x:0,y:-220});
for(let i=0;i<120;i++){diver.step(coreWorld,0,false,.1,true);assert(!coreWorld.collides(diver),'dive stops on core');}
assert(diver.grounded);
let divePose=restingVehiclePose();
for(let i=0;i<20;i++)divePose=advanceVehiclePose(divePose,{...input,grounded:false,downThrust:true},1/60);
assert((divePose.dive??0)>.95&&divePose.lift<.01,'reverse jets replace upward lift effects');
console.log('PASS radial down-thrust: rapid reversal, bounded speed, smooth release, W override, intact crust/core collisions and reverse exhaust');
