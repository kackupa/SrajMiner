import assert from 'node:assert/strict';
import { CIVILISATION_KEYS, ORE_KEYS, ORES, MAPS, PLANET_CHART } from '../src/game/config';
import { migrateSave, validateSave, SaveManager } from '../src/game/save/SaveManager';
import { Progress, emptyCargo } from '../src/game/economy/Progress';
import { quoteCivilianShipment, settleCivilianShipment, civilisationProject } from '../src/game/economy/Civilisations';
import { TileWorld } from '../src/game/world/TileWorld';
import { codexEntries } from '../src/game/ui/Codex';
const cargo={...emptyCargo(),copper:30,nickel:8};
const request={...emptyCargo(),copper:24};
const quote=quoteCivilianShipment(cargo,request,'helion',{});
assert.equal(quote.gross,432);assert.equal(quote.bonus,151);assert.equal(quote.total,583);
const settled=settleCivilianShipment(cargo,request,'helion',{});
assert.equal(settled.remaining.copper,6);assert.equal(cargo.copper,30);
assert.equal(civilisationProject('helion',settled.deliveries).name,'Harbour rail extension');
assert.equal(quoteCivilianShipment(cargo,request,'helion',settled.deliveries).bonus,0);
assert.equal(quoteCivilianShipment(cargo,{...request,copper:Infinity},'helion',{}).total,0);
assert.equal(quoteCivilianShipment(cargo,{...request,copper:999},'helion',{}).shipment.copper,30);
assert.equal(quoteCivilianShipment(cargo,{...request,copper:1.7},'helion',{}).shipment.copper,1.5);
const entries=codexEntries(new Progress());
assert.ok(entries.length>=28);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
for(const e of entries)for(const id of e.related)assert.ok(entries.some(other=>other.id===id),'Missing codex link: '+id);
for(const id of CIVILISATION_KEYS)assert.ok(entries.some(e=>e.id===id));
for(const ore of ORE_KEYS)assert.ok(entries.some(e=>e.id==='ore-'+ore));
let crystal=0,titanium=0;
for(const map of ['cryo-shelf','hull-graveyard'] as const){
 const world=new TileWorld(4201,[],[],map);
 for(let y=0;y<120;y++)for(let x=0;x<48;x++){
  const tile=world.get(x,y);if(!tile.ore)continue;
  assert.ok(MAPS[map].oreFactors[tile.ore]>0);
  if(tile.ore==='cryocrystal'){assert.equal(map,'cryo-shelf');assert.ok(y*12>=ORES.cryocrystal.min);crystal++;}
  if(tile.ore==='titanium'){assert.ok(y*12>=ORES.titanium.min);titanium++;}
 }
}
assert.ok(crystal>0);assert.ok(titanium>0);
const p=new Progress(), legacyOre={copper:12.5,iron:4,silver:2,gold:0,diamond:1};
const migrated=migrateSave({...p,version:29,productionUpdatedAt:1,solarPosition:null,planetChart:PLANET_CHART,
 campaignSeed:1,activeMap:'cryo-shelf',mothershipBoarded:false,cargo:legacyOre,
 maps:{'cryo-shelf':{seed:1,x:680,y:-22,maxDepth:0,destroyed:[],discovered:[],drops:[],activeCharge:null,structures:[],warehouse:{...legacyOre,copper:40}}}});
assert.ok(migrated,'legacy five-ore inventory remains loadable');
assert.deepEqual(migrated.cargo,{...emptyCargo(),...legacyOre});
assert.equal(migrated.maps['cryo-shelf']?.warehouse.copper,40);
assert.equal(migrated.maps['cryo-shelf']?.warehouse.cryocrystal,0);
assert.deepEqual(migrated.deliveries,{});
const delivered={...migrated,deliveries:{'helion:copper':24}};
assert.ok(validateSave(delivered));
const restored=new Progress();new SaveManager().restore(restored,delivered);
assert.deepEqual(restored.deliveries,delivered.deliveries);
assert.equal(validateSave({...delivered,deliveries:{'helion:copper':-1}}),false);
console.log('PASS civilisation shipments, bounded premiums, immutable cargo, ore geography, and Codex links');
