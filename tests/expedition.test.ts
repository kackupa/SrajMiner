import assert from 'node:assert/strict';
import { CIVILISATION_KEYS, ORE_KEYS, ORES, MAPS } from '../src/game/config';
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
for(const map of ['cryo-shelf','mars-frontier'] as const){
 const world=new TileWorld(4201,[],[],map);
 for(let y=0;y<120;y++)for(let x=0;x<48;x++){
  const tile=world.get(x,y);if(!tile.ore)continue;
  assert.ok(MAPS[map].oreFactors[tile.ore]>0);
  if(tile.ore==='cryocrystal'){assert.equal(map,'cryo-shelf');assert.ok(y*12>=ORES.cryocrystal.min);crystal++;}
  if(tile.ore==='titanium'){assert.ok(y*12>=ORES.titanium.min);titanium++;}
 }
}
assert.ok(crystal>0);assert.ok(titanium>0);
console.log('PASS civilisation shipments, bounded premiums, immutable cargo, ore geography, and Codex links');
