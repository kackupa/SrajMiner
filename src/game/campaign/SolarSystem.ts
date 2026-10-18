import { atlasMarkup, planetArt } from '../ui/PlanetArt';
import { CIVILISATIONS, CIVILISATION_KEYS, CORE_RELICS, type CivilisationId } from '../config';
import { MAPS, ORES, SOLAR_SYSTEM, vesperChapterUnlocked, type MapId, type Ore } from '../config';
export type SolarPlanetIntel = {
  visited: boolean;
  tradingPost: boolean;
  warehouse: Record<Ore, number> | null;
  facilities: number;
  production?: string;
};
export type SolarCommanderIntel = { credits: number; cargo: number; cargoCapacity: number };
export type SolarPosition = { x: number; y: number };
export const planetPosition = (id: MapId): SolarPosition => SOLAR_SYSTEM.planets[id];
export const distance = (a: SolarPosition, b: SolarPosition) => Math.hypot(a.x - b.x, a.y - b.y);
export const solarRouteFuel = (from: SolarPosition, to: SolarPosition) =>
  Math.max(0, distance(from, to) - SOLAR_SYSTEM.landingRadius) / SOLAR_SYSTEM.distancePerFuel;
export function solarDestinationUnlocked(id: MapId, currentMap: MapId, shipComplete: boolean, milestones: string[]) {
  if (id === currentMap) return true;
  return shipComplete && (id !== 'vesper-9' || vesperChapterUnlocked(milestones));
}

/** Route review and explicit departure. Browsing never spends fuel. */
export class SolarView {
  root = document.createElement('section');
  selected: MapId = 'cryo-shelf';
  private selectedBuyer?: CivilisationId;
  private lastDraw?: Parameters<SolarView['draw']>;
  private signature = '';
  private travelling = false;
  private timer?: number;
  constructor(private land: (id: MapId) => void) {
    this.root.className = 'solar-flight expedition-flight';
    this.root.setAttribute('role','dialog'); this.root.setAttribute('aria-label','Mothership flight deck');
    document.body.append(this.root);
  }
  destroy() { if(this.timer) window.clearTimeout(this.timer); this.root.remove(); }
  draw(p: SolarPosition, fuel: number, milestones: string[], currentMap: MapId, shipComplete: boolean,
    intel: Record<MapId, SolarPlanetIntel>, commander: SolarCommanderIntel) {
    if(!this.lastDraw) this.selected=currentMap;
    this.lastDraw=[p,fuel,milestones,currentMap,shipComplete,intel,commander];
    const signature=JSON.stringify([fuel,currentMap,shipComplete,milestones,this.selected,this.selectedBuyer,intel,commander]);
    if(this.signature===signature || this.travelling) return;
    this.signature=signature;
    const id=this.selected, info=intel[id], cost=solarRouteFuel(p,planetPosition(id)), unlocked=solarDestinationUnlocked(id,currentMap,shipComplete,milestones);
    const enough=cost<=fuel+1e-8, buyer=this.selectedBuyer ? CIVILISATIONS[this.selectedBuyer] : undefined;
    const oreProfile=Object.entries(MAPS[id].oreFactors).filter(([,factor])=>factor>0).sort((a,b)=>b[1]-a[1]);
    const detail=buyer ? `<span class="eyebrow">CIVILIAN TRADING PARTNER</span><h2>${buyer.name}</h2>${planetArt(this.selectedBuyer!)}<p>${buyer.description}</p><dl><div><dt>Customer</dt><dd>${buyer.buyer}</dd></div><div><dt>Population</dt><dd>${buyer.population}</dd></div></dl><p>Trade through your Market uplink. This inhabited world is not a mining destination.</p>` : `<span class="eyebrow">${id===currentMap?'CURRENT WORLD':unlocked?'ROUTE CHARTED':'SURVEY TARGET'}</span><h2>${MAPS[id].name}</h2>${planetArt(id)}<p>${MAPS[id].strata.slice(0,2).join(' · ')}</p><dl><div><dt>Survey</dt><dd>${info.visited?'Visited':'Unvisited'}</dd></div><div><dt>Core</dt><dd>${milestones.includes(CORE_RELICS.find(core=>core.mapId===id)!.id)?'Recovered':'Not recovered'}</dd></div><div><dt>Your foothold</dt><dd>${info.tradingPost?'Market uplink online':'No market uplink'} · ${info.warehouse?'Warehouse built':'No warehouse'} · ${info.facilities} extractors</dd></div></dl><h3>Geological profile</h3><div class="resource-pills">${oreProfile.map(([ore])=>`<span style="--ore:${ORES[ore as Ore].hex}">${ORES[ore as Ore].name}</span>`).join('')}</div><p class="fine">Depth requirements still apply. Survey deposits with your miner before committing to an excavation.</p>`;
    this.root.innerHTML=`<header class="flight-header"><div><span class="eyebrow">MOTHERSHIP / NAVIGATION</span><h1>Your next horizon.</h1></div><button id="flight-return">Return to ${MAPS[currentMap].name}</button></header><div class="flight-layout"><main>${atlasMarkup(id,currentMap)}<section class="civilian-worlds"><h2>The worlds you supply</h2><div>${CIVILISATION_KEYS.map(key=>`<button data-civil-world="${key}" aria-pressed="${key===this.selectedBuyer}">${planetArt(key)}<b>${CIVILISATIONS[key].name}</b><small>${CIVILISATIONS[key].title}</small></button>`).join('')}</div></section></main><aside class="flight-intel">${detail}</aside></div><footer class="flight-route"><div><small>CORE FUEL ABOARD</small><b>${fuel.toFixed(2)}</b></div><span>→</span><div><small>JOURNEY COST</small><b>${buyer?'N/A':cost.toFixed(2)}</b></div><span>→</span><div><small>REMAINING</small><b>${buyer?'N/A':Math.max(0,fuel-cost).toFixed(2)}</b></div><button id="flight-depart" class="primary" ${buyer||!unlocked||!enough?'disabled':''}>${buyer?'Trade through Market uplink':!unlocked?id==='vesper-9'?'Recover five planetary cores':'Recover core fuel':!enough?'Insufficient core fuel':id===currentMap?'Land at current world':'Depart for '+MAPS[id].name}</button></footer>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-world]').forEach(node=>node.onclick=()=>{this.selected=node.dataset.world as MapId;this.selectedBuyer=undefined;this.signature='';this.draw(...this.lastDraw!);});
    this.root.querySelectorAll<HTMLButtonElement>('[data-civil-world]').forEach(node=>node.onclick=()=>{this.selectedBuyer=node.dataset.civilWorld as CivilisationId;this.signature='';this.draw(...this.lastDraw!);});
    this.root.querySelector<HTMLButtonElement>('#flight-return')!.onclick=()=>this.land(currentMap);
    this.root.querySelector<HTMLButtonElement>('#flight-depart')!.onclick=()=>{
      if(buyer||!unlocked||!enough||this.travelling)return;
      if(id===currentMap){this.land(id);return;}
      this.travelling=true;
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.root.innerHTML=`<div class="journey-transition"><span class="eyebrow">MINER SECURED / COURSE CONFIRMED</span><div class="journey-planets">${planetArt(currentMap)}<span class="journey-ship">▰ →</span>${planetArt(id)}</div><h1>Approaching ${MAPS[id].name}</h1><p>Departure → transit → landing · ${cost.toFixed(2)} core fuel</p><button id="skip-journey">Skip sequence</button></div>`;
      const arrive=()=>{if(!this.travelling)return;this.travelling=false;if(this.timer)window.clearTimeout(this.timer);this.land(id);};
      this.root.querySelector<HTMLButtonElement>('#skip-journey')!.onclick=arrive;
      this.timer=window.setTimeout(arrive,reduced?0:2400);
    };
  }
}
