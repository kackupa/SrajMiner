import assert from 'node:assert/strict';
import { planetaryMaterials, spendPlanetaryMaterials } from '../src/game/building/PlanetaryMaterials';
import { emptyCargo } from '../src/game/economy/Progress';
import { COMMON_ORES, PLANET_EXCLUSIVE_ORES, MAPS, ORE_KEYS, UNDERGROUND_BUILDING, type MapId } from '../src/game/config';
import { TileWorld } from '../src/game/world/TileWorld';
import { accumulateAutomatedProduction } from '../src/game/economy/Warehouse';
import { validateSurfaceStructureSite, type UndergroundStructure } from '../src/game/building/UndergroundStructures';
const cargo = {...emptyCargo(), copper: .5, iron: 1}, stock = {...emptyCargo(), copper: 8, iron: 8, silver: 4};
const paid = spendPlanetaryMaterials(cargo, stock, {copper: 3, iron: 2})!;
assert.equal(paid.cargo.copper,0); assert.equal(paid.storage.copper,5.5);
assert.equal(paid.storage.iron,7); assert.equal(cargo.copper,.5); assert.equal(stock.copper,8);
assert.equal(spendPlanetaryMaterials(cargo,stock,{diamond:1}),undefined);
assert.equal(spendPlanetaryMaterials(cargo,stock,{copper:Infinity}),undefined);
assert.equal(spendPlanetaryMaterials(cargo,stock,{copper:-1}),undefined);
for(const ore of ORE_KEYS) assert.equal(paid.cargo[ore]+paid.storage[ore],cargo[ore]+stock[ore]-({copper:3,iron:2}[ore as 'copper'|'iron']??0));
const worlds = Object.keys(MAPS) as MapId[];
for(const map of worlds){
 const exclusive=PLANET_EXCLUSIVE_ORES[map];
 for(const ore of COMMON_ORES) assert.ok(MAPS[map].oreFactors[ore]>0);
 assert.equal(worlds.filter(m=>MAPS[m].oreFactors[exclusive]>0).length,1);
 const found=new Set<string>(), world=new TileWorld(4201,[],[],map);
 for(let y=0;y<180;y++)for(let x=0;x<64;x++){const tile=world.get(x,y);if(tile.ore){found.add(tile.ore);assert.ok((COMMON_ORES as readonly string[]).includes(tile.ore)||tile.ore===exclusive,map+': foreign deposit '+tile.ore);}}
 assert.ok(found.has(exclusive),map+' exclusive occurs');
 for(const ore of COMMON_ORES) assert.ok(found.has(ore));
}
for(const kind of ['habitat','trade-post','warehouse','extractor','fort','turret','wall','gate'] as const){for(const ore of Object.keys(UNDERGROUND_BUILDING[kind].materials))assert.ok((COMMON_ORES as readonly string[]).includes(ore));}
const world=new TileWorld(2,[],[],'cryo-shelf');
assert.equal(validateSurfaceStructureSite(world,'trade-post',{x:1800,y:0},[],planetaryMaterials(cargo,stock),0).valid,true,'market placement needs no camp');
assert.equal(validateSurfaceStructureSite(world,'extractor',{x:1800,y:0},[],planetaryMaterials(cargo,stock),0).valid,true,'extractor needs no warehouse');
const facilities:UndergroundStructure[]=[{id:'extractor:1',kind:'extractor',x:1800,y:0,level:1}], hold=emptyCargo();
accumulateAutomatedProduction(facilities,hold,'cryo-shelf',3600,24);
assert.equal(ORE_KEYS.reduce((n,o)=>n+hold[o],0),2,'extractor can use mothership hold');
const full={...emptyCargo(),copper:24};accumulateAutomatedProduction(facilities,full,'cryo-shelf',3600,24);assert.equal(full.copper,24);assert.equal(facilities[0].productionFraction,0);
console.log('PASS sandbox: pooled fractional materials, atomic shortage, common/exclusive geography, open placement, hold production and full-storage pause');
