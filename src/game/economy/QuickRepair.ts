import type { Progress } from './Progress';
/** Same service price as the bay, committed once before the cosmetic exchange. */
export function quickRepair(p:Progress,save:()=>boolean):boolean {
 if(p.hull>=p.max('hull')&&p.fuel>=p.max('fuel'))return false;
 const before={money:p.money,hull:p.hull,fuel:p.fuel};
 if(!p.serviceAll())return false;
 try {if(save())return true;} catch {}
 Object.assign(p,before);return false;
}
