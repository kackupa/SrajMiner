import { UNDERGROUND_BUILDING, ORES, MAPS, COMMON_ORES, PLANET_EXCLUSIVE_ORES, SURFACE_RAID, TURRET_TIERS, type MapId, type Ore } from '../config';
import { structureIntegrity, type StructureKind, type UndergroundStructure } from '../building/UndergroundStructures';
import { planetaryMaterials } from '../building/PlanetaryMaterials';
import type { Cargo } from '../economy/Progress';
import { buildingArt } from './BuildingArt';
export const BUILD_GROUPS = {
  Mining: ['extractor'], Storage: ['warehouse'], Services: ['habitat', 'trade-post'], Defence: ['turret', 'wall', 'gate', 'fort'],
} as const;
export type BuildGroup = keyof typeof BUILD_GROUPS;
const descriptions: Partial<Record<StructureKind, [string, string, string]>> = {
  habitat: ['Mining camp', 'A service base wherever you need one. Recharge and repair your miner here.', 'hull'],
  'trade-post': ['Market uplink', 'Sell your haul and connect this planet to trade. No mining camp required.', 'scanner'],
  warehouse: ['Ore warehouse', 'Expand this planet’s shared storage by 40 units. Upgrade it later for more room.', 'cargo'],
  extractor: ['Automated extractor', 'Survey a deep copper or iron seam before placing. Produces 24 ore/hour into planetary storage. Move when depleted; pauses when full.', 'drill'],
  turret: ['Defence pylon', 'Protect nearby buildings from raiders. Place it where your colony needs cover.', 'scanner'],
  wall: ['Perimeter wall', 'Connect or stack protective blocks. Your miner can cross freely.', 'hull'],
  gate: ['Security gate', 'A protected entrance that opens as your miner approaches.', 'hull'],
  fort: ['Colony fort', 'A reinforced command post that strengthens nearby pylons. Building one attracts more frequent raids.', 'hull'],
};
export function buildingCatalogue(group: BuildGroup, selected: StructureKind, cargo: Cargo, storage: Cargo, money: number, structures: readonly UndergroundStructure[], map: MapId, managedIndex = 0, ship?: Cargo) {
 const keys = BUILD_GROUPS[group] as readonly StructureKind[], id = keys.includes(selected) ? selected : keys[0],
   info = descriptions[id]!, cost = UNDERGROUND_BUILDING[id], total = planetaryMaterials(cargo, storage, ship), owned = structures.filter(s => s.kind === id),
   limit = 'maxPerMap' in cost ? cost.maxPerMap : 1, full = owned.length >= limit || structures.length >= UNDERGROUND_BUILDING.maxStructuresPerMap,
   affordable = money >= cost.credits && Object.entries(cost.materials).every(([o,n]) => total[o as Ore] >= n),
   existing = owned[managedIndex % Math.max(1, owned.length)],
   damaged = existing && (existing.integrity ?? structureIntegrity(id)) < structureIntegrity(id),
   upgrade = existing?.kind === 'turret' ? TURRET_TIERS[existing.level ?? 1] : undefined;
 return `<section class="modal build-catalogue" role="dialog" aria-modal="true" aria-label="Build catalogue"><header class="build-top"><button id="catalogue-back">← Mothership</button><button id="catalogue-colony">Colony</button><div><small>${MAPS[map].name} / BUILD YARD</small><h1>Build your way.</h1></div><button id="close">Return to mine</button></header><nav class="build-tabs" aria-label="Building categories">${Object.keys(BUILD_GROUPS).map(g=>`<button data-build-group="${g}" aria-pressed="${g===group}">${g}</button>`).join('')}</nav><div class="build-body"><nav class="build-choices" aria-label="Buildings">${keys.map(k=>`<button data-build-choice="${k}" aria-pressed="${k===id}"><b>${descriptions[k]![0]}</b><small>${structures.filter(s=>s.kind===k).length} built</small></button>`).join('')}<div class="build-survey"><small>ON EVERY WORLD</small><p>${COMMON_ORES.map(o=>ORES[o].name).join(' · ')}</p><small>ONLY HERE</small><b>${ORES[PLANET_EXCLUSIVE_ORES[map]].name}</b><p>Mine the planetary core for travel fuel.</p></div></nav><article class="build-detail"><div class="build-art">${buildingArt(id)}</div><div class="build-description"><small>CHOOSE YOUR SITE · ${owned.length}/${limit} BUILT</small><h2>${info[0]}</h2><p>${info[1]}</p></div><div class="build-materials"><span>Miner + Ship + Planet</span>${Object.entries(cost.materials).map(([o,n])=>`<div class="${total[o as Ore]<n?'short':''}"><b>${ORES[o as Ore].name}</b><span>${total[o as Ore]} / ${n}${total[o as Ore]<n?` · Need ${n-total[o as Ore]}`:' · Ready'}</span></div>`).join('')}<div class="${money<cost.credits?'short':''}"><b>Credits</b><span>${cost.credits ? `${money} / ${cost.credits}` : 'No credits needed'}</span></div></div><button class="primary build-place" id="build-${id}" ${full||!affordable?'disabled':''}>${full?'Building limit reached':!affordable?'Collect missing materials':'Choose placement →'}</button>${existing ? `<div class="build-maintenance"><span>Built ${managedIndex % owned.length + 1}/${owned.length}</span>${owned.length>1?'<button id="manage-next">Next building →</button>':''}${damaged?`<button id="repair-${encodeURIComponent(existing.id)}" ${money<SURFACE_RAID.repairCredits?'disabled':''}>Repair · ${SURFACE_RAID.repairCredits}</button>`:''}${upgrade?`<button id="upgrade-turret-${encodeURIComponent(existing.id)}" ${money<upgrade.upgradeCredits?'disabled':''}>Upgrade · ${upgrade.upgradeCredits}</button>`:''}${id==='warehouse'||id==='extractor'?'<button id="catalogue-storage">Manage storage</button>':''}</div>`:''}</article></div><footer class="build-bottom">Build in any order. Materials are spent only after placement. Stored ore stays on its planet.</footer></section>`;
}
