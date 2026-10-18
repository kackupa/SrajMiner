import { type CivilisationId } from '../config';
import type { Cargo, Progress } from './Progress';
import { settleCivilianShipment } from './Civilisations';
/** Commit one named inventory sale; other inventories are never debited. */
export function sellInventory(p: Progress, stock: Cargo, buyer: CivilisationId, requested: Cargo, save:()=>boolean) {
 const previous={stock:{...stock},money:p.money,deliveries:p.deliveries};
 const result=settleCivilianShipment(stock,requested,buyer,p.deliveries);
 if(!result.total)return 0;
 Object.assign(stock,result.remaining);p.money+=result.total;p.deliveries=result.deliveries;
 let saved=false;try{saved=save();}catch{saved=false;}
 if(!saved){Object.assign(stock,previous.stock);p.money=previous.money;p.deliveries=previous.deliveries;return 0;}
 return result.total;
}
