import assert from 'node:assert/strict';
import { Progress, emptyCargo } from '../src/game/economy/Progress';
import { cargoTotal, quoteFreight, transferFreight } from '../src/game/economy/Freight';
import { spendPlanetaryMaterials } from '../src/game/building/PlanetaryMaterials';
import { migrateSave, validateSave, parseSaveFile, SaveManager } from '../src/game/save/SaveManager';
import { travelQuote, commitTravel, productionInterval } from '../src/game/campaign/Travel';
import { STARTER_PLANET_CHART } from '../src/game/config';
const p = new Progress();
const legacy = { ...p, version: 31, extraction: { 'cryo-shelf:near:0': 3.5 }, productionUpdatedAt: 1234, solarPosition: null,
  planetChart: STARTER_PLANET_CHART, campaignSeed: 42, activeMap: 'prism-fault', mothershipBoarded: false,
  maps: Object.fromEntries(['cryo-shelf','mars-frontier','prism-fault'].map((id,i)=>[id, {
    seed:i, x:680, y:-22, maxDepth:0, destroyed:['24,0'], discovered:[], drops:[], activeCharge:null, structures:[], warehouse:{...emptyCargo(),copper:80.5+i}, planetChart:STARTER_PLANET_CHART,
  }])), levels:{...p.levels,drill:17}, cargo:{...emptyCargo(),iron:100.5}, coreFuel:7.25 };
delete (legacy as any).shipCargo; delete (legacy as any).specialistModules;
const migrated=migrateSave(legacy)!; assert.ok(migrated); assert.equal(migrated.version,32);
assert.deepEqual(migrated.maps,legacy.maps); assert.equal(migrated.cargo.iron,100.5); assert.equal(migrated.coreFuel,7.25);
assert.deepEqual(migrated.shipCargo,emptyCargo()); assert.deepEqual(migrateSave(migrated),migrated);
assert.deepEqual(parseSaveFile(JSON.stringify(migrated)),migrated);
const restored=new Progress();new SaveManager().restore(restored,migrated);assert.equal(restored.cargo.iron,100.5);
for(const shipCargo of [{...emptyCargo(),iron:NaN},{...emptyCargo(),iron:-.5},{...emptyCargo(),iron:.25},{...emptyCargo(),unknown:1}]) assert.equal(validateSave({...migrated,shipCargo}),false);
assert.equal(validateSave({...migrated,specialistModules:{reinforcedHull:false,efficientCooling:false,other:true}}),false);
assert.equal(validateSave({...migrated,specialistModules:{reinforcedHull:1,efficientCooling:false}}),false);
for(const save of [()=>false,()=>{throw Error('disk full')}]) {
  const a={...emptyCargo(),copper:80.5},b=emptyCargo(),before=JSON.stringify([a,b]);
  assert.equal(transferFreight(a,b,'copper',.5,50,true,save),0);assert.equal(JSON.stringify([a,b]),before);
}
const a={...emptyCargo(),copper:80.5},b=emptyCargo();
assert.equal(transferFreight(a,b,'copper',.5,50,true,()=>true),.5);
assert.equal(transferFreight(a,b,'copper',Number.MAX_SAFE_INTEGER,50,true,()=>true),49.5);
assert.equal(cargoTotal(a)+cargoTotal(b),80.5);
for(const amount of [0,-1,NaN,Infinity]) assert.equal(quoteFreight(a,b,'copper',amount,50,true).moved,0);
assert.equal(quoteFreight(a,emptyCargo(),'copper',1,50,false).moved,0);
assert.equal(quoteFreight(b,a,'copper',1,0,true).moved,0);
const payment=spendPlanetaryMaterials({...emptyCargo(),iron:1},{...emptyCargo(),iron:10},{iron:6},{...emptyCargo(),iron:3})!;
assert.equal(payment.cargo.iron,0);assert.equal(payment.ship!.iron,0);assert.equal(payment.storage.iron,8);
assert.equal(travelQuote('cryo-shelf','mars-frontier',1,[]).canDepart,false);
assert.equal(travelQuote('cryo-shelf','mars-frontier',2,[]).balance,1);
assert.equal(travelQuote('mars-frontier','cryo-shelf',1,['core-cryo']).canDepart,true);
assert.equal(travelQuote('cryo-shelf','cryo-shelf',4,[]).cost,0);
assert.equal(travelQuote('cryo-shelf','prism-fault',100,[]).canDepart,false);
for(const save of [()=>false,()=>{throw Error('disk full')}]) assert.equal(commitTravel({fuel:4},{fuel:3},save),undefined);
assert.deepEqual(productionInterval(10000,5000,43200),{seconds:0,watermark:10000});
assert.deepEqual(productionInterval(10000,11000,43200),{seconds:1,watermark:11000});
console.log('PASS Frontier: conservative migration, exact freight, overflow, local pool, travel policy and monotonic clock');
const { accumulateLocalProduction, accumulateAutomatedProduction } = await import('../src/game/economy/Warehouse');
const rigs: import('../src/game/building/UndergroundStructures').UndergroundStructure[] = [
  {id:'warehouse',kind:'warehouse',x:500,y:0,level:1}, {id:'extractor',kind:'extractor',x:100,y:0,level:1},
];
const planet={...emptyCargo(),copper:39},ship={...emptyCargo(),iron:49},ledger:Record<string,number>={};
accumulateLocalProduction(rigs,planet,ship,'cryo-shelf',3600,ledger);
assert.equal(cargoTotal(planet),40);assert.equal(cargoTotal(ship),50);assert.equal(ledger['cryo-shelf:near:0'],2);
const beforeAway=JSON.stringify(ship);
accumulateAutomatedProduction(rigs,planet,'cryo-shelf',3600,0,ledger);assert.equal(JSON.stringify(ship),beforeAway);assert.equal(cargoTotal(planet),40);
const noWarehouse=[{...rigs[1],productionFraction:.3}],cache=emptyCargo();
accumulateAutomatedProduction(noWarehouse,cache,'cryo-shelf',3600,0,{});assert.equal(cargoTotal(cache),0);assert.equal(noWarehouse[0].productionFraction,0);
const { installRigUpgrade }=await import('../src/game/economy/RigUpgrade');
const { deliverColonyOrder,colonyOrders }=await import('../src/game/economy/ColonyOrders');
for(const save of [()=>false,()=>{throw Error('disk full')}]) {
 const rig=new Progress(),stock=emptyCargo();rig.shipCargo={...emptyCargo(),copper:12,iron:3};const before=JSON.stringify({rig,stock});
 assert.equal(installRigUpgrade(rig,stock,'drill',save),false);assert.equal(JSON.stringify({rig,stock}),before);
 assert.equal(deliverColonyOrder(rig,stock,'cryo-shelf',colonyOrders('cryo-shelf')[0].id,save),false);assert.equal(JSON.stringify({rig,stock}),before);
}
console.log('PASS Frontier: split production sinks, off-world capacity, no-warehouse pause, ship-funded rollback');
const {coreExtractionStep}=await import('../src/game/campaign/RenewableFuel');
let work=0,fuel=2;
for(let i=0;i<100;i++){const tick=coreExtractionStep(work,.1,true,true,true,fuel);work=tick.elapsed;fuel+=tick.reward;}
assert.equal(fuel,3);assert.equal(work,0);
assert.equal(coreExtractionStep(9.9,.1,false,true,true,2).reward,0);
assert.equal(coreExtractionStep(9.9,.1,true,false,true,2).reward,0);
assert.equal(coreExtractionStep(9.9,.1,true,true,false,2).elapsed,0);
assert.equal(coreExtractionStep(9.9,.1,true,true,true,4).reward,0);
assert.equal(coreExtractionStep(9.9,.1,true,true,true,7).reward,0);
assert.equal(coreExtractionStep(0,.1,true,true,true,2).reward,0,'reloaded work starts from zero');
console.log('PASS Frontier: renewable core duration, exposure/recovery gate, interruption and legacy ceiling');
const { installSpecialist }=await import('../src/game/economy/SpecialistModules');
for(const save of [()=>false,()=>{throw Error('disk full')}]){
 const rig=new Progress(),stock={...emptyCargo(),iron:4};rig.cargo.nickel=1;rig.shipCargo={...emptyCargo(),nickel:3,iron:2};rig.hull=50;
 const before=JSON.stringify({rig,stock});assert.equal(installSpecialist(rig,stock,'reinforcedHull',true,save),false);assert.equal(JSON.stringify({rig,stock}),before);
}
const rig=new Progress(),stock={...emptyCargo(),iron:6,copper:4};rig.shipCargo.nickel=4;rig.shipCargo.cryocrystal=4;rig.hull=50;
assert.equal(installSpecialist(rig,stock,'reinforcedHull',false,()=>true),false);
assert.equal(installSpecialist(rig,stock,'reinforcedHull',true,()=>true),true);assert.equal(rig.max('hull'),120);assert.equal(rig.hull,60);
assert.equal(installSpecialist(rig,stock,'reinforcedHull',true,()=>true),false);assert.equal(rig.max('hull'),120);
assert.equal(installSpecialist(rig,stock,'efficientCooling',true,()=>true),true);assert.equal(rig.hull,60);assert.equal(rig.shipCargo.cryocrystal,0);
const restoredModules=new Progress();new SaveManager().restore(restoredModules,{...migrated,specialistModules:{...rig.specialistModules},hull:rig.hull,cargo:rig.cargo,shipCargo:rig.shipCargo});assert.equal(restoredModules.max('hull'),120);assert.equal(restoredModules.hull,60);
rig.levels.hull=2;const basic=new Progress();basic.levels.hull=2;assert.equal(rig.max('hull'),basic.max('hull')*1.2);
const { MiningSystem }=await import('../src/game/mining/MiningSystem');const { TileWorld }=await import('../src/game/world/TileWorld');
const normal=new Progress(),cooled=new Progress();cooled.specialistModules.efficientCooling=true;
for(const current of [normal,cooled])new MiningSystem(new TileWorld(42),current).update(.1,{x:24,y:0,type:'hard',hardness:100},()=>{});
assert.ok(Math.abs((140-cooled.fuel)/(140-normal.fuel)-.9)<1e-8);
assert.equal(cooled.max('engine'),normal.max('engine'));assert.equal(cooled.drillTime(1),normal.drillTime(1));
console.log('PASS Frontier: specialist exact costs, once-only stats, no heal, rollback, reload and drilling-only energy');
const legacyOver=new Progress();new SaveManager().restore(legacyOver,{...migrated,fuel:1000,hull:500});
const oldMoney=legacyOver.money;assert.equal(legacyOver.serviceAll(),true);assert.equal(legacyOver.money,oldMoney);assert.equal(legacyOver.fuel,1000);assert.equal(legacyOver.hull,500);
const compactMars=new TileWorld(42,[],[],'mars-frontier',STARTER_PLANET_CHART);
let nickelCells=0;for(let y=0;y<STARTER_PLANET_CHART.radiusRows;y++)for(let x=0;x<STARTER_PLANET_CHART.columns;x++)if(compactMars.get(x,y).ore==='nickel')nickelCells++;
assert.ok(nickelCells>4,'compact Mars actually generates reachable nickel');
console.log('PASS Frontier: legacy excess battery/hull retained without service credits; compact Mars nickel generated');
const {localProductionRoom}=await import('../src/game/economy/Warehouse');
assert.equal(localProductionRoom([],{...emptyCargo(),iron:90.5},emptyCargo()),50,'legacy local overflow does not conceal free ship capacity');
const overflowStock={...emptyCargo(),iron:90.5},overflowShip=emptyCargo();
accumulateLocalProduction([{id:'e',kind:'extractor',x:100,y:0,level:1}],overflowStock,overflowShip,'cryo-shelf',3600,{});
assert.equal(overflowStock.iron,90.5);assert.equal(overflowShip.copper,24);
