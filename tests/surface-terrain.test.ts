import { PlayerPod } from '../src/game/player/PlayerPod';
import { Progress } from '../src/game/economy/Progress';
import assert from 'node:assert/strict';
import { TileWorld } from '../src/game/world/TileWorld';
import { createSurfaceTerrain, surfaceNests, naturalCave } from '../src/game/world/SurfaceTerrain';
import { restoreMapState, snapshotMapState } from '../src/game/campaign/MapState';
import { SurfaceRaid } from '../src/game/world/SurfaceRaid';
import { emptyCargo } from '../src/game/economy/Progress';
import { WORLD } from '../src/game/config';
const chart={columns:126,radiusRows:40};
const w=new TileWorld(3880665266,[],[],'cryo-shelf',chart);w.terrain=createSurfaceTerrain(w);
assert.ok(new Set(w.terrain.heights).size>=3,'real collision relief');
assert.equal(w.surfaceHeight(555,0),0,'ship pad remains level');
assert.deepEqual(createSurfaceTerrain(w),w.terrain,'deterministic');
for(let x=0;x<w.widthTiles;x++)for(const far of [false,true]){
 const y=w.surfaceHeight((x+.5)*40,far?w.farSurfaceY:0),g=far?-1:1;
 assert.equal(w.solid(x,Math.floor((y-g*20)/40)),false,'sky above relief is empty');
}
assert.ok(w.terrain.caves.length>0);
const mouth=w.terrain.caves[0],height=w.terrain.heights[mouth];
assert.ok(naturalCave(w,mouth,height));assert.ok(naturalCave(w,mouth+3,height+7),'connected chamber');
const old={seed:123,x:555,y:-22,maxDepth:200,destroyed:['65,2','65,9'],discovered:[],clearedCaves:[],drops:[],activeCharge:null,structures:[{id:'old',kind:'warehouse' as const,x:2100,y:0}],warehouse:emptyCargo(),planetChart:chart};
const restored=restoreMapState(old,'cryo-shelf',1).world;
assert.equal(restored.surfaceHeight(2100,0),0,'existing foundation kept');
assert.equal(restored.surfaceHeight(65.5*40,0),0,'old shaft rim kept');
assert.equal(restored.get(65,9).type,'empty','old excavation kept');
const saved=snapshotMapState(old,restored,555,-22,200,[],undefined,old.structures);
assert.deepEqual(restoreMapState(saved,'cryo-shelf',999).world.terrain,restored.terrain,'profile frozen on reload');
const raid=new SurfaceRaid(w.seed,w.mapId),nest=surfaceNests(w)[0];
for(let i=0;i<700;i++)raid.update(.1,true,w,[],undefined,{x:555,y:-22},true);
assert.equal(raid.active,undefined,'no creature spawning at home before the human raid grace ends');
raid.update(.1,true,w,[],undefined,{x:nest.x,y:nest.y-22},true);
assert.equal(raid.active?.nestId,nest.id,'entering territory wakes its inhabitant');
raid.repel();assert.ok(w.clearedTerritories.has(nest.id));
raid.update(.1,true,w,[],undefined,{x:nest.x,y:nest.y-22},true);assert.equal(raid.active,undefined,'cleared territory stays clear');
const clearedSave=snapshotMapState(undefined,w,555,-22,0,[]);
assert.ok(restoreMapState(clearedSave,w.mapId,1).world.clearedTerritories.has(nest.id),'clearing survives reload');
console.log('PASS terrain, entrances, saved buildings/tunnels, frozen reload, territory activation and clearing');

// Surface docking must follow relief and leave natural cave mouths open.
const landColumn=w.terrain.heights.findIndex((height,i)=>i<w.widthTiles&&height>=2&&w.solid(i,height));
const pod=new PlayerPod(w,new Progress());pod.x=(landColumn+.5)*40;pod.y=-22;pod.docked=false;
for(let i=0;i<180;i++)pod.update(1/60,{left:false,right:false,up:false,down:false},()=>{});
assert.ok(pod.y>0,'miner settles into a terrain dip instead of hovering at the old flat surface');
assert.ok(pod.y<=w.surfaceHeight(pod.x,pod.y),'miner remains above the ground');
const cavePod=new PlayerPod(w,new Progress());cavePod.x=(mouth+.5)*40;cavePod.y=height*40-22;cavePod.docked=false;
for(let i=0;i<90;i++)cavePod.update(1/60,{left:false,right:false,up:false,down:false},()=>{});
assert.ok(cavePod.y>height*40+30,'cave entrance has no invisible surface landing deck');
console.log('PASS miner follows relief and enters natural cave mouths');
// A nest targets an extractor in its own territory on a building encounter.
w.clearedTerritories.delete(nest.id);
const outpostRaid=new SurfaceRaid(w.seed,w.mapId);
const outpost=[{id:'extractor:territory',kind:'extractor' as const,x:nest.x,y:nest.y,level:1},{id:'warehouse:territory',kind:'warehouse' as const,x:nest.x+80,y:nest.y}];
outpostRaid.update(.1,true,w,outpost,undefined,{x:nest.x,y:nest.y-22},false);
assert.equal(outpostRaid.active?.targetId,'extractor:territory');
for(let i=0;i<25;i++)outpostRaid.update(.1,false,w,outpost,undefined,{x:nest.x,y:nest.y+400},false);
assert.equal(outpostRaid.active,undefined,'underground retreat ends the outpost encounter');
assert.equal(outpost.length,2,'retreat does not secretly damage outposts');
console.log('PASS territorial extractor targeting and safe underground retreat');

// Foundations bridge gentle relief without excavating or moving saved structures.
import { surfaceFoundation, validateSurfaceStructureSite } from '../src/game/building/UndergroundStructures';
import { expandSurfaceNests } from '../src/game/world/SurfaceTerrain';
const fw=new TileWorld(123,[],[],'cryo-shelf',chart);fw.terrain={heights:Array(252).fill(0),caves:[],nests:[]};
fw.terrain.heights[61]=1;fw.terrain.heights[62]=2;
const originalProfile=[...fw.terrain.heights],base=surfaceFoundation(fw,'warehouse',{x:61*40,y:40});
assert.ok(base.valid);assert.equal(base.y,0);assert.ok(base.feet.some(f=>f.y>base.y));assert.deepEqual(fw.terrain.heights,originalProfile);
const rich={...emptyCargo(),iron:100,copper:100,silver:100};
assert.equal(validateSurfaceStructureSite(fw,'warehouse',base,[],rich,10000).valid,true);
assert.equal(validateSurfaceStructureSite(fw,'warehouse',base,[{id:'old',kind:'warehouse',x:base.x,y:base.y}],rich,10000).valid,false);
const protectedBuilding={x:70*40,y:0};expandSurfaceNests(fw,[protectedBuilding]);
assert.ok(fw.terrain.nests.length>0);assert.ok(fw.terrain.nests.every(i=>Math.abs(i-70)*40>=390));
const nestCount=fw.terrain.nests.length;expandSurfaceNests(fw,[protectedBuilding]);assert.equal(fw.terrain.nests.length,nestCount,'nest expansion idempotent');
const melee=new SurfaceRaid(fw.seed,fw.mapId),den=surfaceNests(fw)[0];
melee.update(.1,true,fw,[],undefined,{x:den.x,y:den.y-22},true);
assert.ok(melee.active);melee.active!.x=den.x+30;melee.active!.y=-22;melee.active!.health=1;
assert.equal(melee.hitByDrill(fw,den.x,-22,1,0,70),true);assert.ok(fw.clearedTerritories.has(den.id),'drill kill clears the territory');
console.log('PASS automatic foundations, retained terrain, protected extra nests and drill territory clear');
