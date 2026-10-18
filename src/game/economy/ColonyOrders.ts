import { COLONY_ORDERS, MAPS, ORES, PLANET_EXCLUSIVE_ORES, type MapId } from '../config';
import { spendPlanetaryMaterials } from '../building/PlanetaryMaterials';
import type { Cargo, Progress } from './Progress';
export function colonyOrders(map: MapId) {
 return COLONY_ORDERS.map(order=>{const ore=order.ore==='exclusive'?PLANET_EXCLUSIVE_ORES[map]:order.ore;return {...order,ore,id:`colony-order:${map}:${order.key}`,reward:Math.round(ORES[ore].value*order.units*order.rewardMultiplier)};});
}
export const COLONY_ORDER_IDS=Object.keys(MAPS).flatMap(map=>colonyOrders(map as MapId).map(o=>o.id));
export function deliverColonyOrder(progress: Progress, storage: Cargo, map: MapId, id: string, save: ()=>boolean) {
 const order=colonyOrders(map).find(o=>o.id===id);
 if(!order||progress.milestones.includes(id))return false;
 const payment=spendPlanetaryMaterials(progress.cargo,storage,{[order.ore]:order.units}, progress.shipCargo);
 if(!payment)return false;
 const before={cargo:{...progress.cargo},ship:{...progress.shipCargo},storage:{...storage},money:progress.money,milestones:[...progress.milestones]};
 Object.assign(progress.cargo,payment.cargo);Object.assign(storage,payment.storage);Object.assign(progress.shipCargo,payment.ship);progress.money+=order.reward;progress.milestones.push(id);
 let saved=false;try{saved=save();}catch{}
 if(!saved){Object.assign(progress.cargo,before.cargo);Object.assign(storage,before.storage);Object.assign(progress.shipCargo,before.ship);progress.money=before.money;progress.milestones=before.milestones;}
 return saved;
}
