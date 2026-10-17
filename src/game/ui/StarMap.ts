import { MAPS, ORE_KEYS, ORES, CIVILISATIONS, type MapId, type CivilisationId } from '../config';
import { planetArt } from './PlanetArt';


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
  return `<span class="star-kicker">${w.civilian ? 'CIVILISED WORLD / TRADE' : 'FRONTIER WORLD / MINING'}</span><div class="star-portrait">${planetArt(w.id, w.civilian ? 2 : 0)}</div><h2>${name(w)}</h2><p>${w.civilian ? CIVILISATIONS[w.id as CivilisationId].description : 'Establish an outpost. Extract valuable ore. Grow your mining operation across the frontier.'}</p><div class="star-detail-box"><b>${w.civilian ? 'Supply their expansion' : 'Resource survey'}</b><div class="star-ores">${[...new Set(ores)].slice(0, 4).map(o => `<span>${ORES[o].name}</span>`).join('')}</div></div><span class="star-coming">${w.id === current ? 'YOUR CURRENT WORLD' : 'NETWORK EXPANSION / COMING SOON'}</span><small>${w.civilian ? 'Planned trade routes connect your mines to civilian demand.' : 'This preview charts the future mining and trade network.'} Select the exchange to preview multiplayer.</small>`;
}
export function starMapMarkup(current: MapId) {
 return `<section class="modal star-map-screen" role="dialog" aria-modal="true" aria-label="Star map"><header class="star-top"><button id="star-map-back" aria-label="Back to mothership">← Mothership</button><div><span class="star-kicker">ORE FRONTIER / NETWORK PREVIEW</span><h1>Star map</h1></div><button id="close">Return to mine <span>Esc</span></button></header><div class="star-layout"><div class="star-chart" aria-label="Mining and trading worlds"><div class="star-chart-caption"><b>THE NEXT FRONTIER</b><span>Mine worlds. Supply civilisations.</span></div><svg class="star-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="45" cy="48" rx="40" ry="32"/><ellipse cx="45" cy="48" rx="28" ry="22"/>${worlds.map(w=>`<path data-route="${w.id}" d="M45 48 Q${w.x} 48 ${w.x} ${w.y}"/>`).join('')}</svg>${worlds.map(w=>`<button class="star-world ${w.civilian ? 'civilian' : 'mining'}" style="--x:${w.x}%;--y:${w.y}%" data-star-world="${w.id}" aria-pressed="${w.id===current}"><span class="star-orb">${planetArt(w.id, w.civilian ? 2 : 0)}</span><b>${name(w)}</b><small>${w.id===current?'◆ YOU ARE HERE':w.civilian?'TRADE WORLD':'MINING WORLD'}</small></button>`).join('')}<button class="star-exchange" data-star-world="exchange" aria-pressed="false"><i>⇄</i><b>PLAYER EXCHANGE</b><small>COMING SOON</small></button><div class="star-legend"><span>◇ Mining</span><span>◉ Civilisation</span><span>Route concepts</span></div></div><aside class="star-inspector" aria-label="Selected destination" aria-live="polite">${detail(current,current)}</aside></div></section>`;
}
export function bindStarMap(root: Element, current: MapId) {
 const select = (id: string) => {
   root.querySelectorAll<HTMLButtonElement>('[data-star-world]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.starWorld === id)));
   root.querySelectorAll<SVGPathElement>('[data-route]').forEach(p => p.classList.toggle('active', id === 'exchange' || p.dataset.route === id));
   root.querySelector('.star-inspector')!.innerHTML = detail(id, current);
 };
 root.querySelectorAll<HTMLButtonElement>('[data-star-world]').forEach(b => b.onclick = () => select(b.dataset.starWorld!));
 select(current);
}
