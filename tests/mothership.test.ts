import assert from 'node:assert/strict';
import {SurfaceRaid} from '../src/game/world/SurfaceRaid';
import {TileWorld} from '../src/game/world/TileWorld';
import {MOTHERSHIP, SURFACE_RAID} from '../src/game/config';
const world=new TileWorld(8128);
let shots=0;const ship={x:555,y:0,onFire:()=>shots++};
const enemy=(x:number,y=-26)=>({x,y,targetId:'player',health:2,timer:20,phase:0,hitFlash:0,drillCooldown:0});
const raid=new SurfaceRaid(1,'cryo-shelf');raid.active=enemy(650);
const step=(dt:number,s:typeof ship|undefined=ship)=>raid.update(dt,true,world,[],undefined,{x:555,y:-22},true,s);
step(.01);assert.equal(shots,1);assert.equal(raid.active?.health,1);
step(.1);assert.equal(shots,1,'cooldown prevents continuous damage');
assert.equal(step(MOTHERSHIP.defenceReload)?.type,'intercepted');assert.equal(shots,2);assert.equal(raid.active,undefined);
raid.active=enemy(555+MOTHERSHIP.defenceRange+50);step(2);assert.equal(shots,2,'out of range');
raid.active=enemy(555,-MOTHERSHIP.defenceAltitude-30);step(2);assert.equal(shots,2,'high targets out of reach');
raid.active=enemy(650);raid.update(2,false,world,[],undefined,{x:555,y:100},true,ship);assert.equal(shots,2,'underground retreat never fires');
const absent=new SurfaceRaid(2,'cryo-shelf');absent.active=enemy(650);absent.update(.1,true,world,[],undefined,{x:555,y:-22},true);assert.equal(absent.active?.health,2,'no landed ship no protection');
console.log('PASS mothership range, altitude, cooldown, damage, retreat and absent-ship protection');

const natural=new SurfaceRaid(3,'cryo-shelf');
for(let i=0;i<Math.ceil(SURFACE_RAID.firstWarningSeconds*10)+1;i++)natural.update(.1,true,world,[],undefined,{x:555,y:-22},true);
assert.ok(natural.active,'natural surface arrival needs no debug trigger');
assert.ok(natural.active!.y < -100,'flyer approaches above the surface');
for(let i=0;i<100;i++)natural.update(.1,true,world,[],undefined,{x:555,y:-22},true);
assert.ok(!natural.active || natural.active.y > -60,'flyer descends to attack after warning');
console.log('PASS natural flyer arrival, elevated approach and dive');

// Player-hunting encounters also pressure nearby economic buildings on alternate visits.
import type {UndergroundStructure} from '../src/game/building/UndergroundStructures';
for(const kind of ['warehouse','trade-post','extractor'] as const){
 const r=new SurfaceRaid(4,'cryo-shelf'),buildings:UndergroundStructure[]=[{id:kind,kind,x:1000,y:0,integrity:2}];
 let e;for(let i=0;i<600&&!e;i++)e=r.update(.1,true,world,buildings,undefined,{x:1000,y:-22},true);
 assert.equal(r.active?.targetId,'player');r.active=undefined;
 e=r.update(.1,true,world,buildings,undefined,{x:1000,y:-22},true);
 assert.equal(e?.type,'warning');assert.equal(r.active?.targetId,kind);
 r.active!.x=1000;r.active!.y=-26;r.active!.timer=0;
 assert.equal(r.update(.1,true,world,buildings,undefined,{x:1000,y:-22},true)?.type,'damaged');assert.equal(buildings[0].integrity,1);
 r.active={...enemy(1000),targetId:kind,timer:0};
 assert.equal(r.update(.1,true,world,buildings,undefined,{x:1000,y:-22},true)?.type,'destroyed');assert.equal(buildings.length,0);
}
console.log('PASS territorial encounters damage and destroy warehouses, uplinks and extractors in player-hunting mode');

let hits=0;const siege=new SurfaceRaid(5,'cryo-shelf');siege.active={...enemy(555),targetId:'mothership',health:8,timer:0};
assert.equal(siege.update(.1,true,world,[],undefined,{x:555,y:-22},true,{...ship,onHit:()=>hits++})?.type,'ship-hit');
assert.equal(hits,1);assert.equal(siege.active,undefined);
const safeSiege=new SurfaceRaid(6,'cryo-shelf');safeSiege.active={...enemy(555),targetId:'mothership',health:8,timer:0};
safeSiege.update(.1,false,world,[],undefined,{x:555,y:100},true,{...ship,onHit:()=>hits++});assert.equal(hits,1,'no ship damage during underground retreat');
console.log('PASS mothership siege hits once and respects underground retreat');
import {createSurfaceTerrain} from '../src/game/world/SurfaceTerrain';
const homeWorld=new TileWorld(7);homeWorld.terrain=createSurfaceTerrain(homeWorld);
const homeSiege=new SurfaceRaid(7,'cryo-shelf');let arrival;
for(let i=0;i<Math.ceil((MOTHERSHIP.raidInterval+60)*10)+2;i++){const e=homeSiege.update(.1,true,homeWorld,[],undefined,{x:555,y:-22},true,{...ship,onHit:()=>{}});if(e?.type==='warning'&&e.target.id==='mothership'){arrival=e;break;}}
assert.equal(arrival?.target.id,'mothership','home siege naturally targets the carrier after its interval');
console.log('PASS natural mothership siege warning after active surface interval');
