import assert from 'node:assert/strict';
import { TunnelLights } from '../src/game/building/TunnelLights';
import { findBuildSite, crossedStructureDeck, type UndergroundStructure } from '../src/game/building/UndergroundStructures';
import { restoreMapState } from '../src/game/campaign/MapState';
import { STARTER_PLANET_CHART } from '../src/game/config';
import { migrateSave, validateSave } from '../src/game/save/SaveManager';
import { Progress, emptyCargo } from '../src/game/economy/Progress';
import { defaultLoadout } from '../src/game/economy/Loadout';
import type { TileWorld } from '../src/game/world/TileWorld';

let wall=true;
const world={planetChart:undefined,farSurfaceRow:100,destroyed:new Set<string>(),discovered:new Set<string>(),
  get(x:number,y:number){return {x,y,type:wall&&x===9?'rock':'empty'};}} as TileWorld;
const lamp:UndergroundStructure={id:'light:260:260',kind:'light',x:260,y:260,integrity:2};
const lights=new TunnelLights();
lights.update(world,[lamp],lamp,1);
assert(lights.lit.has('9,6'),'exposed wall is lit');
assert(!lights.lit.has('10,6'),'cannot reveal through rock');
assert(lights.lit.has('3,6')&&lights.lit.has('6,3')&&lights.lit.has('6,9'),'light surrounds the lamp');
lights.update(world,[lamp],{x:3000,y:3000},1);
assert(lights.lit.has('9,6'),'light remains on after miner leaves');
wall=false; world.destroyed.add('9,6'); lights.update(world,[lamp],lamp,1);
assert(lights.lit.has('10,6'),'mining exposes more of the chamber');
lights.update(world,[],lamp,1);
assert.equal(lights.lit.size,0,'removed lamps stop illuminating');
assert(world.discovered.has('10,6'),'explored terrain remains surveyed');
assert.equal(crossedStructureDeck([lamp],260,240,300,1,16,false),undefined,'lamp never blocks movement');

const map=restoreMapState(undefined,'cryo-shelf',271026,STARTER_PLANET_CHART).world;
for(let y=8;y<=12;y++)for(let x=20;x<=28;x++)map.destroyed.add(`${x},${y}`);
map.chunks.clear();
const site=findBuildSite(map,900,420,1,'light',[]);
assert(site);
assert.equal(findBuildSite(map,900,420,1,'light',[{...lamp,...site}]),undefined,'duplicate placement cannot consume materials');
const p=new Progress();
export const lightSave={
  version:38 as const,mothershipHull:3000,minerDisabled:false,loadout:defaultLoadout(),shipCargo:emptyCargo(),
  specialistModules:{reinforcedHull:false,efficientCooling:false},extraction:{},deliveries:{},productionUpdatedAt:1,solarPosition:null,
  planetChart:STARTER_PLANET_CHART,campaignSeed:271026,activeMap:'cryo-shelf' as const,
  maps:{'cryo-shelf':{seed:271026,x:900,y:420,maxDepth:120,destroyed:[...map.destroyed],discovered:[],drops:[],activeCharge:null,structures:[] as UndergroundStructure[],warehouse:emptyCargo()}},
  money:0,levels:{...p.levels},fuel:p.fuel,hull:p.hull,cargo:{...emptyCargo(),copper:4,iron:4},maxDepth:120,
  artifact:false,milestones:['mothership-origin'],shipComponents:[],routeFragments:[],coreFuel:0,mothershipBoarded:false,charges:0,
  ownedPaints:[...p.ownedPaints],selectedPaint:p.selectedPaint,salvageMagnet:false,ownedSuits:[...p.ownedSuits],selectedSuit:p.selectedSuit,
  ownedDecals:[...p.ownedDecals],selectedDecal:p.selectedDecal,ownedProfiles:[...p.ownedProfiles],selectedProfile:p.selectedProfile,
  specialization:p.specialization,stasisModule:false,returnWinch:false,escapeSuit:false,pilotEscaping:false,grappleOwned:false,
};
assert(validateSave(lightSave));
const legacy={...lightSave,version:37};
const migrated=migrateSave(legacy)!;
assert.equal(migrated.version,38);
assert.deepEqual(migrated.maps,legacy.maps,'existing buildings and tunnels survive migration unchanged');
assert.deepEqual(migrated.cargo,legacy.cargo,'migration never changes ore');
const saved=structuredClone(lightSave);saved.maps['cryo-shelf'].structures=[{...lamp,...site}];
assert(validateSave(JSON.parse(JSON.stringify(saved))),'built light round trips through save validation');
console.log('PASS tunnel lights: placement, collision, occlusion, excavation, persistent light, removal, save migration');
