import { SPECIALIST_MODULES, type SpecialistModule } from '../config';
import { spendPlanetaryMaterials } from '../building/PlanetaryMaterials';
import type { Cargo, Progress } from './Progress';
export function installSpecialist(p: Progress, planet: Cargo, module: SpecialistModule, docked: boolean, save:()=>boolean) {
 if(!docked||!Object.hasOwn(SPECIALIST_MODULES,module)||p.specialistModules[module])return false;
 const quote=spendPlanetaryMaterials(p.cargo,planet,SPECIALIST_MODULES[module].materials,p.shipCargo);
 if(!quote)return false;
 const before={cargo:{...p.cargo},ship:{...p.shipCargo},planet:{...planet},modules:{...p.specialistModules},hull:p.hull};
 const percentage=p.hull/p.max('hull');
 Object.assign(p.cargo,quote.cargo);Object.assign(p.shipCargo,quote.ship);Object.assign(planet,quote.storage);
 p.specialistModules[module]=true;
 if(module==='reinforcedHull')p.hull=percentage*p.max('hull');
 let saved=false;try{saved=save();}catch{}
 if(!saved){Object.assign(p.cargo,before.cargo);Object.assign(p.shipCargo,before.ship);Object.assign(planet,before.planet);p.specialistModules=before.modules;p.hull=before.hull;}
 return saved;
}
