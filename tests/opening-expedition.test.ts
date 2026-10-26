import assert from 'node:assert/strict';
import { restoreMapState, snapshotMapState } from '../src/game/campaign/MapState';
import { STARTER_PLANET_CHART, RIG_ITEMS, PHYSICS } from '../src/game/config';
import { RockSwimmer } from '../src/game/world/RockSwimmer';
import { PlayerPod } from '../src/game/player/PlayerPod';
import { caveHome, caveSight } from '../src/game/world/CaveHabitat';
import { findBuildSite } from '../src/game/building/UndergroundStructures';
import { emptyCargo, Progress } from '../src/game/economy/Progress';
import { purchaseOrFit } from '../src/game/economy/Loadout';
for(const seed of [1,42,2829719020,999999]) {
 const {world}=restoreMapState(undefined,'cryo-shelf',seed,STARTER_PLANET_CHART);world.miningOnly=true;
 assert.equal(world.openingLayout,true);
 for(let y=0;y<6;y++)assert.equal(world.get(17,y).ore,y<3?'copper':'iron');
 for(let y=6;y<13;y++)assert.ok(world.solid(17,y),'starter shaft has no random pit');
 assert.ok(findBuildSite(world,1300,420,1,'service',[]),'safe chamber accepts shelter without excavation busywork');
 const nest=caveHome(world,3,2)!;assert.equal(nest.id,'42,16');
 assert.equal(caveSight(world,nest,{x:1300,y:420}),false,'rock separates nest from safe chamber');
 assert.equal(caveHome(world,2,1),undefined,'entrance chamber has no creature');
 const resident=new RockSwimmer(seed,'cryo-shelf',world);
 resident.update(.016,190,1680,660);assert.equal(resident.active?.kind,'rock-swimmer');
 for(let i=0;i<300;i++)resident.update(1/60,120,1300,420);
 assert.ok(Math.hypot(resident.active!.x-nest.x,resident.active!.y-nest.y)<55,'opening resident returns home when miner retreats');
 world.clearedCaves.add(nest.id);
 world.break(17,0);
 const state=snapshotMapState(undefined,world,700,-22,0,[]);
 const again=restoreMapState(state,'cryo-shelf',seed,STARTER_PLANET_CHART).world;again.miningOnly=true;
 assert.ok(again.clearedCaves.has('42,16'));
 assert.equal(again.get(17,0).type,'empty');assert.equal(again.get(17,1).ore,'copper');
 const legacy={...state};delete legacy.openingLayout;
 assert.equal(restoreMapState(legacy,'cryo-shelf',seed,STARTER_PLANET_CHART).world.openingLayout,false,'legacy map never gains new terrain');
}
for(const id of ['hauler','excavator','expedition-cell']) {
 const p=new Progress(),stock={...emptyCargo(),copper:6,iron:6};
 assert.match(purchaseOrFit(p,stock,id,()=>true),/purchased and fitted/);
 assert.equal(p.loadout.fitted[RIG_ITEMS.find(i=>i.id===id)!.slot],id);
}
console.log('PASS opening expedition: reachable starter choices, safe shelter chamber, separated nest, deterministic reload and legacy terrain');

const {world:descentWorld}=restoreMapState(undefined,'cryo-shelf',1,STARTER_PLANET_CHART);descentWorld.miningOnly=true;
for(let x=15;x<=20;x++)for(let y=0;y<=12;y++)descentWorld.break(x,y);
const progress=new Progress(),pod=new PlayerPod(descentWorld,progress);
const input={left:false,right:false,up:false,down:true};
pod.x=700;pod.y=100;pod.vy=400;pod.docked=false;pod.update(1/60,input,()=>{});
assert.ok(pod.vy<=PHYSICS.drillingDescent,'powered drilling brakes a shaft descent');
progress.fuel=0;pod.x=700;pod.y=100;pod.vy=400;pod.update(1/60,input,()=>{});
assert.ok(pod.vy>PHYSICS.drillingDescent,'empty battery cannot provide free braking');

// Three minutes of two complementary outposts funds one real loadout choice.
const {accumulateLocalProduction}=await import('../src/game/economy/Warehouse');
for(const id of ['hauler','excavator','machine-gun']) {
 const p=new Progress(),stock=emptyCargo(),ledger={},deliveries:number[]=[];
 const machines=[{id:'copper',kind:'extractor' as const,x:100,y:0,level:1},{id:'iron',kind:'extractor' as const,x:400,y:0,level:1}];
 accumulateLocalProduction(machines,stock,p.shipCargo,'cryo-shelf',180,ledger,(_id,_ore,units)=>deliveries.push(units));
 assert.equal(p.shipCargo.copper,6);assert.equal(p.shipCargo.iron,6);
 assert.equal(deliveries.reduce((a,b)=>a+b,0),12);
 assert.match(purchaseOrFit(p,stock,id,()=>true),/purchased and fitted/);
 assert.equal(p.loadout.fitted[RIG_ITEMS.find(i=>i.id===id)!.slot],id);
}
console.log('PASS three-minute outpost earnings fund hauling, drilling or combat choice');
