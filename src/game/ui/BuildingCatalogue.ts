import { UNDERGROUND_BUILDING, EXTRACTOR_TIERS, ORES, MAPS, SURFACE_RAID, TURRET_TIERS, type MapId, type Ore } from '../config';
import { structureIntegrity, type StructureKind, type UndergroundStructure } from '../building/UndergroundStructures';
import { planetaryMaterials } from '../building/PlanetaryMaterials';
import type { Cargo } from '../economy/Progress';
import { buildingArt } from './BuildingArt';
export const BUILD_GROUPS = {
  Underground: ['service', 'platform', 'turret'],
  Services: ['habitat', 'trade-post'],
  'Mining & storage': ['extractor', 'warehouse'],
  Defence: ['wall', 'turret', 'fort'],
} as const;
export type BuildGroup = keyof typeof BUILD_GROUPS;
const groupGuide: Record<BuildGroup, [string, string]> = {
  Services: ['Keep your operation running', 'Recharge and repair at a camp. Sell ore through a market uplink.'],
  'Mining & storage': ['Produce and store ore', 'Automate extraction and expand shared planetary storage.'],
  Defence: ['Defend your colony', 'Protect valuable buildings with pylons and reinforce them with a fort.'],
  Underground: ['Build below the surface', 'Create a safe shelter, a landing deck or a defensive position.'],
};
const descriptions: Partial<Record<StructureKind, [string, string, string]>> = {
  service: ['Underground shelter', 'Build in a cleared chamber. Enter with E to escape creatures and recover automatically while the world keeps running.', 'hull'],
  platform: ['Anchor deck', 'A landing deck for your underground operation.', 'hull'],
  habitat: ['Mining camp', 'A service base wherever you need one. Recharge and repair your miner here.', 'hull'],
  'trade-post': ['Market uplink', 'Sell your haul and connect this planet to trade. No mining camp required.', 'scanner'],
  warehouse: ['Ore warehouse', 'Expand this planet’s shared storage by 40 units. Upgrade it later for more room.', 'cargo'],
  extractor: ['Automated extractor', `Place over a copper or iron seam. Needs a warehouse: adds 0.5 ore every ${Math.ceil(1800 / EXTRACTOR_TIERS[0].rate)} seconds. Move when depleted; pauses when storage is full.`, 'drill'],
  turret: ['Defence pylon', 'Protect nearby buildings from raiders. Place it where your colony needs cover.', 'scanner'],
  wall: ['Perimeter wall', 'Connect or stack protective blocks. Your miner can cross freely.', 'hull'],
  gate: ['Security gate', 'A protected entrance that opens as your miner approaches.', 'hull'],
  fort: ['Colony fort', 'A reinforced command post that strengthens nearby pylons. Establish a defended outpost near creature territories.', 'hull'],
};
export function buildingCatalogue(group: BuildGroup, selected: StructureKind, cargo: Cargo, storage: Cargo, money: number, structures: readonly UndergroundStructure[], map: MapId, managedIndex = 0, ship?: Cargo, siteReason = '') {
 const keys = BUILD_GROUPS[group] as readonly StructureKind[], id = keys.includes(selected) ? selected : keys[0],
   info = descriptions[id]!, cost = UNDERGROUND_BUILDING[id], total = planetaryMaterials(cargo, storage, ship), owned = structures.filter(s => s.kind === id),
   affordable = money >= cost.credits && Object.entries(cost.materials).every(([o,n]) => total[o as Ore] >= n),
   existing = owned[managedIndex % Math.max(1, owned.length)],
   damaged = existing && (existing.integrity ?? structureIntegrity(id)) < structureIntegrity(id),
   upgrade = existing?.kind === 'turret' ? TURRET_TIERS[existing.level ?? 1] : undefined;
 return `<section class="modal build-catalogue" role="dialog" aria-modal="true" aria-label="Build catalogue"><header class="build-top"><button id="catalogue-back">← Mothership</button><button id="catalogue-colony">Colony</button><div><small>${MAPS[map].name} / BUILD YARD</small><h1>Build structures</h1></div><button id="close">Return to mine</button></header><nav class="build-tabs" aria-label="Building categories">${(group==='Underground'?['Underground']:Object.keys(BUILD_GROUPS).filter(g=>g!=='Underground')).map(g=>`<button data-build-group="${g}" aria-pressed="${g===group}">${g}</button>`).join('')}</nav><div class="build-body"><nav class="build-choices" aria-label="Buildings">${keys.map(k=>`<button data-build-choice="${k}" aria-pressed="${k===id}"><b>${descriptions[k]![0]}</b><small>${structures.filter(s=>s.kind===k).length} built</small></button>`).join('')}<div class="build-survey"><small>${group}</small><b>${groupGuide[group][0]}</b><p>${groupGuide[group][1]}</p><p>All structures are available. Choose what you need.</p></div></nav><article class="build-detail"><div class="build-art">${buildingArt(id)}</div><div class="build-description"><small>CHOOSE YOUR SITE · ${owned.length} BUILT</small><h2>${info[0]}</h2><p>${info[1]}</p></div><div class="build-materials"><span>Miner + Ship + Planet</span>${Object.entries(cost.materials).map(([o,n])=>`<div class="${total[o as Ore]<n?'short':'ready'}"><b>${ORES[o as Ore].name}</b><span>${total[o as Ore]} / ${n}${total[o as Ore]<n?` · Need ${n-total[o as Ore]}`:' · Ready'}</span></div>`).join('')}<div class="${money<cost.credits?'short':'ready'}"><b>Kredits</b><span>${cost.credits ? `${money} / ${cost.credits}${money<cost.credits ? ` · Need ${cost.credits-money}` : ' · Ready'}` : 'No Kredits needed'}</span></div></div><button class="primary build-place" id="build-${id}" ${!affordable||siteReason?'disabled':''}>${!affordable?'Collect missing materials':siteReason?'Find a clear build site':group==='Underground'?'Build here':'Choose placement →'}</button>${existing ? `<div class="build-maintenance"><span>Built ${managedIndex % owned.length + 1}/${owned.length}</span>${owned.length>1?'<button id="manage-next">Next building →</button>':''}${damaged?`<button id="repair-${encodeURIComponent(existing.id)}" ${money<SURFACE_RAID.repairCredits?'disabled':''}>Repair · ${SURFACE_RAID.repairCredits}</button>`:''}${upgrade?`<button id="upgrade-turret-${encodeURIComponent(existing.id)}" ${money<upgrade.upgradeCredits?'disabled':''}>Upgrade · ${upgrade.upgradeCredits}</button>`:''}${id==='warehouse'||id==='extractor'?'<button id="catalogue-storage">Manage storage</button>':''}</div>`:''}</article></div><footer class="build-bottom">${siteReason || 'Build in any order. Materials are spent only after placement. Ship ore travels with you; warehouse ore stays on this planet.'}</footer></section>`;
}
