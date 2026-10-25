import assert from 'node:assert/strict';
import { traceWorkLamp } from '../src/game/world/WorkLamp';
import type { TileWorld } from '../src/game/world/TileWorld';
const world={planetChart:undefined,farSurfaceRow:100,get(x:number,y:number){return {x,y,type:x===6?'rock':'empty'};}} as TileWorld;
const from={x:100,y:100};
const right=traceWorkLamp(world,from,{x:500,y:100});
assert.ok(right.lit.has('6,2'),'first wall face is illuminated');
assert.ok([...right.lit].every(k=>Number(k.split(',')[0])<=6),'rock occludes everything behind it');
const left=traceWorkLamp(world,from,{x:0,y:100});
assert.ok(!left.lit.has('6,2'),'moving the lamp removes the old cone');
const up=traceWorkLamp(world,from,{x:100,y:-500});
assert.ok([...up.lit].every(k=>Number(k.split(',')[1])>=0),'sky never adds invalid save discovery keys');
assert.equal(right.ends.length,41,'bounded ray fan');
console.log('PASS work lamp: directional reveal, rock occlusion, sky filtering and bounded fan');

// The visible lens and ray origin must coincide through turns and suspension.
import { Progress } from '../src/game/economy/Progress';
import { conceptMiner } from '../src/game/player/ConceptMiner';
import { minerLampPoint, minerLocalLook, minerPoint } from '../src/game/player/MinerArt';
import { restingVehiclePose } from '../src/game/player/VehiclePose';
const progress=new Progress();
for(const turn of [-1,1])for(const angle of [-1.4,0,1.4])for(const bank of [-.25,.25]){
 const pose={...restingVehiclePose(),turn,bank,landing:.8,drill:.6,lookX:Math.cos(angle)*turn,lookY:Math.sin(angle)};
 const mark=conceptMiner(progress,minerLocalLook(pose,false)).find(m=>m.kind==='poly'&&m.color===0xffd782)!;
 assert.equal(mark.kind,'poly');
 if(mark.kind!=='poly')throw new Error('Missing lens');
 const local=mark.points.reduce((p,q)=>({x:p.x+q[0]/mark.points.length,y:p.y+q[1]/mark.points.length}),{x:0,y:0});
 const rendered=minerPoint(100,100,2,pose,false,local.x,local.y);
 const origin=minerLampPoint(100,100,2,progress,pose,false);
 assert.ok(Math.hypot(rendered.x-origin.x,rendered.y-origin.y)<1e-8,'beam starts at moving lens');
}
console.log('PASS articulated lamp: lens and beam remain attached through pitch, facing, banking and landing');
