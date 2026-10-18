import { MAPS, PLANET_EXCLUSIVE_ORES, ORE_KEYS, ORES, CIVILISATIONS, type MapId, type CivilisationId } from '../config';
import { planetArt } from './PlanetArt';
import { FRONTIER } from '../config';
import { coreRecovered, travelQuote } from '../campaign/Travel';
import type { SolarPlanetIntel } from '../campaign/SolarSystem';
export type StarMapOptions = {
 fuel:number; milestones:readonly string[]; docked:boolean; intel:Record<MapId,SolarPlanetIntel>;
 depart:(id:MapId,recovery?:'relocate'|'tow')=>boolean;
};


type World = { id: MapId | CivilisationId; x: number; y: number; civilian?: boolean };
const worlds: World[] = [
  { id: 'mars-frontier', x: 17, y: 22 }, { id: 'cryo-shelf', x: 43, y: 15 },
  { id: 'hull-graveyard', x: 70, y: 20 }, { id: 'vesper-9', x: 15, y: 53 },
  { id: 'cinder-vale', x: 33, y: 78 }, { id: 'prism-fault', x: 60, y: 79 },
  { id: 'helion', x: 87, y: 43, civilian: true }, { id: 'kepler', x: 87, y: 76, civilian: true },
  { id: 'verdant', x: 13, y: 85, civilian: true }, { id: 'lyra', x: 65, y: 49, civilian: true },
];
const name = (w: World) => w.civilian ? CIVILISATIONS[w.id as CivilisationId].name : MAPS[w.id as MapId].name;
function detail(id: string, current: MapId) {
  const w = worlds.find(w => w.id === id);
  if (!w) return `<span class="star-kicker">MULTIPLAYER / PLANNED</span><div class="exchange-emblem">⇄</div><h2>A frontier built<br>by players.</h2><p>Mine your worlds. Supply someone else’s empire.</p><div class="star-detail-box"><b>Player exchange</b><p>Buy and sell ore through shared player orders. Build a mining business around what other players need.</p></div><span class="star-coming">COMING SOON</span><small>Network preview. No live orders or player activity shown. Tokenomics TBD.</small>`;
  const ores = w.civilian ? CIVILISATIONS[w.id as CivilisationId].projects.map(p => p.ore) : ORE_KEYS.filter(o => MAPS[w.id as MapId].oreFactors[o] > 0).sort((a, b) => MAPS[w.id as MapId].oreFactors[b] - MAPS[w.id as MapId].oreFactors[a]);
  return `<span class="star-kicker">${w.civilian ? 'CIVILISED WORLD / TRADE' : 'FRONTIER WORLD / MINING'}</span><div class="star-portrait">${planetArt(w.id, w.civilian ? 2 : 0)}</div><h2>${name(w)}</h2><p>${w.civilian ? CIVILISATIONS[w.id as CivilisationId].description : `${ORES[PLANET_EXCLUSIVE_ORES[w.id as MapId]].name} is found only here. Copper, iron and silver supply construction on every world. Mine the core for travel fuel.`}</p><div class="star-detail-box"><b>${w.civilian ? 'Supply their expansion' : 'Resource survey'}</b><div class="star-ores">${[...new Set(ores)].slice(0, 4).map(o => `<span>${ORES[o].name}${!w.civilian && o === PLANET_EXCLUSIVE_ORES[w.id as MapId] ? ' · Exclusive' : ''}</span>`).join('')}</div></div><span class="star-coming">${w.id === current ? 'YOUR CURRENT WORLD' : 'NETWORK EXPANSION / COMING SOON'}</span><small>${w.civilian ? 'Planned trade routes connect your mines to civilian demand.' : 'This preview charts the future mining and trade network.'} Select the exchange to preview multiplayer.</small>`;
}
export function starMapMarkup(current: MapId) {
 return `<section class="modal star-map-screen" role="dialog" aria-modal="true" aria-label="Star map"><header class="star-top"><button id="star-map-back" aria-label="Back to mothership">← Mothership</button><div><span class="star-kicker">ORE FRONTIER / NETWORK PREVIEW</span><h1>Star map</h1></div><button id="close">Return to mine <span>Esc</span></button></header><div class="star-layout"><div class="star-chart" aria-label="Mining and trading worlds"><div class="star-chart-caption"><b>THE FRONTIER SYSTEM</b><span>Mining colonies · Civilised worlds</span></div><svg class="star-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${worlds.map(w => { const r = Math.hypot(w.x - 50, (w.y - 48) / .85); return `<ellipse cx="50" cy="48" rx="${r}" ry="${r * .85}"/>`; }).join('')}</svg><div class="system-sun" aria-label="Central star"><div class="sun-sphere"></div><span>FRONTIER PRIME</span><small>G-TYPE STAR</small></div>${worlds.map(w=>`<button class="star-world ${w.civilian ? 'civilian' : 'mining'}" style="--x:${w.x}%;--y:${w.y}%" data-star-world="${w.id}" aria-pressed="${w.id===current}"><span class="star-orb">${planetArt(w.id, w.civilian ? 2 : 0)}</span><b>${name(w)}</b><small>${w.id===current?'◆ YOU ARE HERE':w.civilian?'INHABITED':'MINING WORLD'}</small></button>`).join('')}<button class="star-exchange" data-star-world="exchange" aria-pressed="false"><i>⇄</i><b>PLAYER EXCHANGE</b><small>COMING SOON</small></button><div class="star-legend"><span>◇ Mining</span><span>◉ Inhabited</span><span>Orbits / not to scale</span></div></div><aside class="star-inspector" aria-label="Selected destination" aria-live="polite">${detail(current,current)}</aside></div></section>`;
}
export function bindStarMap(root: Element, current: MapId, options?: StarMapOptions) {
 let selected=current as string,tab='survey',confirmation=false;
 const inspector=root.querySelector('.star-inspector')!;
 const draw=()=>{
  if(!options){inspector.innerHTML=detail(selected,current);return;}
  const w=worlds.find(w=>w.id===selected);
  if(!w||w.civilian){inspector.innerHTML=detail(selected,current);return;}
  const id=w.id as MapId,live=FRONTIER.worlds.includes(id),intel=options.intel[id],quote=travelQuote(current,id,options.fuel,options.milestones);
  const legacy=!FRONTIER.worlds.includes(current),tow=!legacy&&current!=='cryo-shelf'&&!coreRecovered(current,options.milestones)&&!FRONTIER.worlds.some(world=>travelQuote(current,world,options.fuel,options.milestones).canDepart);
  const recovery=id==='cryo-shelf'&&(legacy||tow)?legacy?'relocate':'tow':undefined;
  const canDepart=options.docked&&(quote.canDepart||!!recovery);
  const totals=intel?.warehouse?ORE_KEYS.filter(o=>intel.warehouse![o]>0).map(o=>`${intel.warehouse![o]} ${ORES[o].name}`).join(' · '):'Empty';
  inspector.innerHTML=`<span class="star-kicker">${id===current?'CURRENT WORLD':intel?.visited?'VISITED COLONY':live?'LIVE DESTINATION':'COMING SOON'}</span><h2>${MAPS[id].name}</h2><nav class="star-tabs" aria-label="Destination information"><button id="star-survey" aria-pressed="${tab==='survey'}">Survey</button><button id="star-colony" aria-pressed="${tab==='colony'}">Colony</button></nav>${tab==='survey'?`<p>${ORES[PLANET_EXCLUSIVE_ORES[id]].name} · Exclusive<br>Copper, iron and silver for construction.</p>`:`<p>${intel?.visited?`${intel.facilities} extractors · ${intel.production??'No production'}<br>Stock: ${intel?.warehouse?ORE_KEYS.reduce((n,o)=>n+intel.warehouse![o],0):0} ore`:'No colony established.'}</p><small>Remote overview is read-only.</small>`}<div class="star-fuel"><b>${options.fuel} fuel aboard</b><span>${recovery?'Free recovery. All inventory and colonies retained.':`${quote.cost} outward${quote.reserve?' + 1 return reserve':''} · After: ${Math.max(0,quote.balance)}`}</span></div><button id="star-depart" class="primary" ${canDepart?'':'disabled'}>${confirmation?'Confirm recovery':recovery==='relocate'?'Relocate to Cryo':recovery==='tow'?'Emergency tow':id===current?'Current world':!live?'Coming soon':!options.docked?'Dock to depart':!quote.canDepart?'More core fuel required':'Depart'}</button><small>${legacy?'Legacy colony retained. Return to this world is unavailable in this release.':id===current&&!coreRecovered(current,options.milestones)?'Mine this world’s core to earn four travel fuel units.':confirmation?'Fuel and money unchanged. Your old colony remains saved.':'Departures cost 1 fuel. Recover exposed cores to refuel.'}</small>`;
  const click=(key:string,fn:()=>void)=>{const b=root.querySelector<HTMLButtonElement>('#'+key);if(b)b.onclick=fn;};
  click('star-survey',()=>{tab='survey';draw();});click('star-colony',()=>{tab='colony';draw();});
  click('star-depart',()=>{if(!canDepart)return;if(recovery&&!confirmation){confirmation=true;draw();return;} options.depart(id,recovery);});
 };
 const select = (id: string) => {
   selected=id;confirmation=false;
   root.querySelectorAll<HTMLButtonElement>('[data-star-world]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.starWorld === id)));
   root.querySelectorAll<SVGPathElement>('[data-route]').forEach(p => p.classList.toggle('active', id === 'exchange' || p.dataset.route === id));
   draw();
   const svg=root.querySelector('.star-routes');svg?.querySelector('.selected-route')?.remove();
   const from=worlds.find(w=>w.id===current),to=worlds.find(w=>w.id===id);
   if(from&&to&&from!==to&&FRONTIER.worlds.includes(id as MapId)) svg?.insertAdjacentHTML('beforeend',`<path class="selected-route" d="M${from.x},${from.y} L${to.x},${to.y}"/>`);
 };
 root.querySelectorAll<HTMLButtonElement>('[data-star-world]').forEach(b => b.onclick = () => select(b.dataset.starWorld!));
 root.querySelector('.star-top .star-kicker')!.textContent='ORE FRONTIER / TWO WORLD EXPEDITION';
 root.querySelectorAll<HTMLButtonElement>('[data-star-world]').forEach(b=>{const label=b.querySelector('small');if(label&&b.dataset.starWorld!==current)label.textContent=FRONTIER.worlds.includes(b.dataset.starWorld as MapId)?'LIVE DESTINATION':'COMING SOON';});
 select(current);
}
