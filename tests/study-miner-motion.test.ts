import assert from 'node:assert/strict';
import { findFootContact, StudyMinerMotion } from '../src/game/study/StudyMinerMotion';
import { conceptMiner, rigidDrillDirection, minerBodyOffset } from '../src/game/player/ConceptMiner';
import { restingVehiclePose } from '../src/game/player/VehiclePose';
import { Progress } from '../src/game/economy/Progress';

const flat=findFootContact(0,27,(_x,y)=>y>=24);
assert(flat.supported && flat.offset<0);
assert.equal(flat.angle,0);
const slope=findFootContact(0,27,(x,y)=>y>=27+x*.15);
assert(slope.supported && slope.angle>0 && slope.angle<=.22);
assert.equal(findFootContact(0,27,()=>false).supported,false,'no foot stretches across empty air');
assert.equal(findFootContact(0,27,()=>true).supported,false,'vertical walls are not footholds');
assert.equal(findFootContact(0,27,(_x,y)=>y>=60).supported,false,'long drops do not stretch legs');
const motion=new StudyMinerMotion(),pose=restingVehiclePose();
pose.stride=1;
for(let i=0;i<60;i++){pose.phase=i/60;motion.update(pose,[flat,slope],1/60,false);}
assert(Math.abs(motion.lean)<=.12 && motion.contact.feet.every(f=>Math.abs(f.offset)<=14));
motion.update(pose,[flat,slope],1/60,true);
assert.equal(motion.contact.settle,0);
assert.deepEqual(motion.update({...pose,phase:10},[flat,slope],.05,true),[],'reduced motion suppresses grit emissions');
motion.reset();assert.equal(motion.lean,0);
const idle=rigidDrillDirection({x:1,y:0},0);
assert.deepEqual(rigidDrillDirection({x:-1,y:-1},0),idle,'parked bit ignores cursor movement');
for(let i=0;i<=100;i++) {
 const dir=rigidDrillDirection({x:-idle.x,y:-idle.y},i/100);
 assert(Math.abs(Math.hypot(dir.x,dir.y)-1)<1e-9,'opposite aim cannot collapse or bend the spindle');
}
const p=new Progress(),contact=motion.contact;
const drillLines=(phase:number)=>{
 const pose={...restingVehiclePose(),phase};
 return conceptMiner(p,pose,{x:1,y:0},undefined,false,contact).slice(-4).map(mark=>{
  assert.equal(mark.kind,'line');if(mark.kind!=='line')throw Error();
  return mark.points.map(([x,y])=>[Number(x.toFixed(6)),Number((y-minerBodyOffset(p,pose)).toFixed(6))]);
 });
};
assert.deepEqual(drillLines(0),drillLines(3.33),'idle flutes stay rigid relative to the moving chassis');
console.log('PASS study miner: bounded independent feet, slope contact, gaps/walls, reduced motion, rigid parked and aimed spindle');
