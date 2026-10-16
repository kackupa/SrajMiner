import { UPGRADES, UPGRADE_KEYS, upgradeValue, upgradeGateLabel, DRILL_TIERS, drillVisualTier, drillReachTiles, drillWidth, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, ESCAPE_SUIT, SPECIALIZATIONS, SPECIALIZATION_KEYS, MAPS, type Upgrade, type MapId } from '../config';
import type { Progress } from '../economy/Progress';
import { podPortrait } from './PodPortrait';

export const credits = (n: number) => `$${Math.ceil(n).toLocaleString()}`;
const number = (n: number) => Number(n.toFixed(2)).toLocaleString();
export type WorkshopSection = 'miner' | 'equipment' | 'pilot';
export const CAMP_MENUS = ['hub', 'more', 'codex', 'sell', 'service', 'upgrades', 'paints', 'archive', 'shipyard', 'destinations', 'warehouse', 'construction'];
const labels: Record<string, [string, string]> = {
  hub: ['Mothership', 'Prepare your next run'],
  more: ['Explore & customise', 'Optional expedition tools'],
  codex: ['Expedition Codex', 'Engineering & frontier history'],
  sell: ['Teletrade', 'Sell your haul'], service: ['Service bay', 'Recharge & repair'],
  upgrades: ['Workshop', 'Upgrade your miner'], paints: ['Paint shop', 'Make it yours'],
  archive: ['Mining log', 'Your progress'], shipyard: ['Core drive', 'Your way to other worlds'],
  destinations: ['Worlds', 'Plan your next landing'], warehouse: ['Warehouse', 'Store your ore'],
  construction: ['Build yard', 'Grow your outpost'],
};

/** Original line illustrations, deliberately readable at both card and detail sizes. */
export function equipmentArt(kind: string) {
  const paths: Record<string, string> = {
    drill: '<path d="M51 30h78v25H51zM58 55h64l-32 75z"/><path d="m59 64 54 12m-45 8 35 8m-26 9 15 7M66 24v-9m48 9v-9"/>',
    fuel: '<rect x="52" y="32" width="76" height="91" rx="19"/><path d="M72 32V20h36v12M52 55h76M52 102h76M68 70h18v18H68zM111 68v23"/>',
    cargo: '<path d="M37 47h106v75H37zM37 47l18-23h70l18 23M68 47v75m44-75v75M45 109h17m56 0h17M75 24v14h30V24"/>',
    hull: '<path d="m90 18 52 24v38c0 24-25 43-52 55-27-12-52-31-52-55V42zM90 35l35 17v28c0 14-17 31-35 40-18-9-35-26-35-40V52z"/><path d="M90 35v85M55 72h70"/>',
    engine: '<path d="M62 25h56v67H62zM62 48H49v56h19m50-56h13v56h-19M67 92l-8 16h62l-8-16M74 112l16 25 16-25M72 39h36M72 51h36M72 63h36"/>',
    scanner: '<path d="M51 122h78M90 120V87M51 38a53 53 0 0 0 78 49zM94 72l26-33M113 28a23 23 0 0 1 27 25M121 16a36 36 0 0 1 32 42"/><circle cx="120" cy="39" r="4"/>',
    grapple: '<circle cx="67" cy="54" r="28"/><circle cx="67" cy="54" r="14"/><path d="M94 54h23v48c0 29-41 32-41 5V93m0 0-10 15m10-15 11 13M45 86v34h38"/>',
    charges: '<path d="M59 46h62v76H59zM71 46V32h38v14M75 30c0-16 34-21 34-7M59 63h62M59 106h62m-23-36-22 23h18l-12 17"/>',
    magnet: '<path d="M44 35h26v48a20 20 0 0 0 40 0V35h26v48a46 46 0 0 1-92 0zM44 57h26m40 0h26M80 30l10 11 10-11"/>',
    stasis: '<circle cx="90" cy="77" r="43"/><circle cx="90" cy="77" r="25"/><path d="M90 15v22m0 80v22M29 77h22m78 0h22M80 66v22m20-22v22"/>',
    'return-winch': '<rect x="46" y="39" width="88" height="61" rx="8"/><path d="M62 39v61m14-61v61m14-61v61m14-61v61m14-61v61M90 100v19c0 18 23 18 23 0M38 48v43m104-43v43"/>',
    'escape-suit': '<path d="M66 63h48l17 43-15 10-8-25v42H91v-28h-7v28H67V91l-9 25-14-10z"/><rect x="67" y="20" width="46" height="43" rx="17"/><path d="M76 33h28v14H76z"/>',
  };
  return `<svg class="equipment-art" viewBox="0 0 180 150" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths[kind] ?? paths.cargo}</g></svg>`;
}

export function campDock() {
  return `<nav class="station-dock camp-dock" id="station-dock" aria-label="Mining camp services">
    <header class="camp-dock-head"><span class="camp-live">● MOTHERSHIP SERVICES</span><h2>Expedition hub.</h2><span id="town-status">Landed expedition hub</span></header>
    <div class="camp-quick-label">QUICK SERVICES</div><div class="camp-dock-actions">
      <button id="open-sell"><span class="camp-action-icon">↗</span><span><b>Sell ore</b><small id="camp-sell-hint">Turn your haul into credits</small></span><span class="camp-arrow">›</span></button>
      <button id="open-service"><span class="camp-action-icon">＋</span><span><b>Recharge & repair</b><small id="camp-service-hint">Get ready for another run</small></span><span class="camp-arrow">›</span></button>
      <button id="open-upgrades"><span class="camp-action-icon">⚙</span><span><b>Upgrade miner</b><small>Better tools. Longer expeditions.</small></span><span class="camp-arrow">›</span></button>
    </div>
    <button id="open-full-services" class="camp-full-services">Open mothership <span aria-hidden="true">→</span></button><p class="camp-dock-foot">Choose a service · Your expedition pauses inside</p>
  </nav>`;
}

export function campShell(name: string, title: string, subtitle: string, content: string, p: Progress,
  mapId: MapId, links: string[], notice: string) {
  return `<section class="modal camp-screen camp-${name}" role="dialog" aria-modal="true" aria-label="${labels[name]?.[0] ?? title}">
    <header class="camp-top"><div><span class="camp-live">● EXPEDITION / ${MAPS[mapId].name}</span><b>${p.milestones.includes('mothership-origin') ? 'Mothership operations' : 'Mining camp'}</b></div><div class="camp-wallet"><small>YOUR CREDITS</small><strong>${credits(p.money)}</strong></div><button id="close" class="close camp-exit" aria-label="Return to mine">Return to mine <kbd>Esc</kbd></button></header>
    <aside class="camp-sidebar"><select id="camp-select" aria-label="Choose ship service">${(links.includes(name) ? links : [name, ...links]).map(key => `<option value="${key}" ${key === name ? 'selected' : ''}>${labels[key]?.[0] ?? key}</option>`).join('')}</select><div class="camp-rig">${podPortrait(p)}<span>YOUR MINER · ${Math.round(p.hull / p.max('hull') * 100)}% HULL</span></div><nav aria-label="Camp services">${links.map(key => `<button id="camp-nav-${key}" aria-current="${key === name ? 'page' : 'false'}"><span>${labels[key]?.[0] ?? key}</span><span aria-hidden="true">${key === name ? '●' : '›'}</span></button>`).join('')}</nav></aside>
    <main class="camp-main"><header class="camp-heading"><span class="eyebrow">${labels[name]?.[0] ?? 'CAMP SERVICES'}</span><h2>${title}</h2><p>${subtitle}</p></header><div id="camp-notice" class="camp-notice ${notice ? '' : 'is-empty'}" role="status" aria-live="polite">${notice}</div><div class="camp-content">${content}</div></main>
    <footer class="camp-bottom"><span>● Expedition paused · Purchases save automatically</span><span>MOTHERSHIP / FIELD OPERATIONS</span></footer>
  </section>`;
}

export function servicePanel(p: Progress, rechargeAvailable = true) {
  const hullCost = p.serviceCost('hull'), needsCharge = p.fuel < p.max('fuel'), needsRepair = p.hull < p.max('hull');
  return `<p class="camp-section-intro">Your rig runs on a battery. Return to the mothership to recharge for free. Planetary core fuel powers the mothership’s travel.</p><div class="camp-service-grid">
    <article class="camp-service-card">${equipmentArt('fuel')}<span class="eyebrow">RIG BATTERY</span><h3>${Math.ceil(p.fuel / p.max('fuel') * 100)}<small>% charged</small></h3><div class="camp-gauge"><i style="width:${p.fuel / p.max('fuel') * 100}%"></i></div><p>${rechargeAvailable ? 'Mothership charging connection ready.' : 'Return to the mothership to recharge.'}</p><button id="service-fuel" ${!needsCharge || !rechargeAvailable ? 'disabled' : ''}>${!needsCharge ? 'Fully charged' : rechargeAvailable ? 'Recharge · Free' : 'Mothership required'}</button></article>
    <article class="camp-service-card">${equipmentArt('hull')}<span class="eyebrow">HULL CONDITION</span><h3>${Math.ceil(p.hull / p.max('hull') * 100)}<small>% intact</small></h3><div class="camp-gauge"><i style="width:${p.hull / p.max('hull') * 100}%"></i></div><p>Repair damage from your last run.</p><button id="service-hull" ${!needsRepair || p.money < hullCost ? 'disabled' : ''}>${needsRepair ? `Repair · ${credits(hullCost)}` : 'No repairs needed'}</button>${p.money < hullCost ? `<small class="purchase-reason">Need ${credits(hullCost - p.money)} more. Recharging is still free.</small>` : ''}</article>
    </div><div class="camp-checkout"><div><b>Ready for another run</b><small>Recharging costs no credits. ${needsRepair ? `Hull repairs: ${credits(hullCost)}.` : 'Hull is fully repaired.'}</small></div><button id="service-all" class="primary" ${!rechargeAvailable || !needsCharge && !needsRepair || p.money < hullCost ? 'disabled' : ''}>Recharge & repair · ${credits(hullCost)}</button></div>`;
}

const upgradeCopy: Record<Upgrade, [string, string]> = {
  drill: ['Cut through rock faster.', 'Cutting speed'], fuel: ['Mine longer between recharges.', 'Battery capacity'],
  cargo: ['Bring more ore home on every trip.', 'Cargo capacity'], hull: ['Give your miner more protection from impacts.', 'Hull strength'],
  engine: ['Climb faster and get more thrust when braking.', 'Thrust'], scanner: ['See valuable deposits from farther away.', 'Survey radius'],
  grapple: ['A safety hook catches rock above you during dangerous falls.', 'Hook reach'],
};

export function workshopPanel(p: Progress, selected: Upgrade, section: WorkshopSection) {
  const switcher = `<nav class="workshop-sections" aria-label="Workshop departments">${(['miner', 'equipment', 'pilot'] as const).map(key => `<button id="workshop-${key}" aria-pressed="${section === key}">${key === 'miner' ? 'Miner upgrades' : key === 'equipment' ? 'Equipment' : 'Pilot setup'}</button>`).join('')}</nav>`;
  if (section === 'equipment') {
    const items = [
      { key: 'charges', name: 'Mining charges', cost: CHARGE.packCost, owned: false, label: `${p.charges} in cargo`, copy: `Drop with Q to blast nearby rock. ${CHARGE.fuseSeconds.toFixed(1)}s fuse. Collect the loose ore afterwards.`, action: `Buy ${CHARGE.packSize} charges` },
      { key: 'magnet', name: 'Salvage magnet', cost: SALVAGE_MAGNET.cost, owned: p.salvageMagnet, label: 'Permanent equipment', copy: 'Pull loose ore toward you through open tunnels. You still need space in your cargo bay.', action: 'Install' },
      { key: 'stasis', name: 'Stasis module', cost: STASIS_MODULE.cost, owned: p.stasisModule, label: 'Permanent equipment', copy: `Hold X to stop your fall underground. Uses ${STASIS_MODULE.fuelPerSecond} charge each second.`, action: 'Install' },
      { key: 'return-winch', name: 'Surface winch', cost: RETURN_WINCH.cost, owned: p.returnWinch, label: 'Permanent equipment', copy: `Hold R to pull home through a clear tunnel. ${RETURN_WINCH.pullMultiplier}× faster, using ${RETURN_WINCH.fuelMultiplier}× battery use.`, action: 'Install' },
      { key: 'escape-suit', name: 'Escape suit', cost: ESCAPE_SUIT.cost, owned: p.escapeSuit, label: 'Single use', copy: 'Eject with a jetpack if your miner is destroyed. Reach the surface or a service beacon to survive.', action: 'Pack suit' },
    ];
    return `${switcher}<p class="camp-section-intro">Optional tools for your next expedition. Buy only what you need.</p><div class="equipment-grid">${items.map(item => `<article class="equipment-card">${equipmentArt(item.key)}<span class="eyebrow">${item.owned ? 'INSTALLED ✓' : item.label}</span><h3>${item.name}</h3><p>${item.copy}</p><div class="equipment-buy"><b>${credits(item.cost)}</b><button id="buy-${item.key}" ${item.owned || p.money < item.cost ? 'disabled' : ''}>${item.owned ? 'Installed' : item.action}</button></div><small class="purchase-reason">${item.owned ? 'Ready to use.' : p.money < item.cost ? `Need ${credits(item.cost - p.money)} more` : `${credits(p.money - item.cost)} left after purchase`}</small></article>`).join('')}</div>`;
  }
  if (section === 'pilot') return `${switcher}<p class="camp-section-intro">Choose a focus for your next run. Switching is free at camp.</p><div class="pilot-grid">${SPECIALIZATION_KEYS.map(key => {
    const path = SPECIALIZATIONS[key], active = key === p.specialization,
      capacity = Math.round(p.max('cargo') * path.cargoMultiplier / SPECIALIZATIONS[p.specialization].cargoMultiplier * 2) / 2,
      blocked = p.count > capacity;
    return `<article class="pilot-card ${active ? 'is-selected' : ''}"><span class="eyebrow">${active ? 'YOUR CURRENT SETUP' : 'FREE TO SWITCH'}</span><h3>${path.name}</h3><p>${path.description}</p><button id="specialization-${key}" aria-pressed="${active}" ${active || blocked ? 'disabled' : ''}>${active ? 'Selected ✓' : 'Choose setup'}</button>${blocked ? `<small class="purchase-reason">Sell ${number(p.count - capacity)} ore first so your cargo fits.</small>` : ''}</article>`;
  }).join('')}</div>`;
  const u = UPGRADES[selected], level = p.levels[selected], cost = p.cost(selected),
    current = p.max(selected), next = selected === 'cargo'
      ? Math.round(upgradeValue(selected, level + 1) * SPECIALIZATIONS[p.specialization].cargoMultiplier * 2) / 2
      : upgradeValue(selected, level + 1),
    locked = !p.canBuyUpgrade(selected), enough = p.money >= cost, install = selected === 'grapple' && !p.grappleOwned;
  const stat = (n: number) => `${number(n)}${u.unit}`;
  return `${switcher}<div class="workshop-layout"><nav class="upgrade-picker" aria-label="Miner components">${UPGRADE_KEYS.map(key => `<button id="choose-${key}" aria-pressed="${key === selected}"><span class="component-icon">${equipmentArt(key)}</span><span><b>${UPGRADES[key].name}</b><small>${key === 'grapple' && !p.grappleOwned ? 'Not installed' : `Level ${p.levels[key]}`}</small></span><span class="component-cost">${p.canBuyUpgrade(key) ? credits(p.cost(key)) : 'Locked'}</span></button>`).join('')}</nav>
    <article class="upgrade-detail"><div class="component-stage"><span class="eyebrow">WORKSHOP / PARTS & INSTALLATION</span>${equipmentArt(selected)}<span class="component-stage-label">${install ? 'NEW EQUIPMENT' : `LEVEL ${level} → ${level + 1}`}</span></div>
    <div class="component-info"><h3>${u.name}</h3><button class="text-button" data-codex="${selected}">Read about this technology ↗</button><p>${upgradeCopy[selected][0]}</p><div class="stat-comparison" aria-label="${upgradeCopy[selected][1]} comparison"><div><small>${install ? 'CURRENT' : 'NOW'}</small><strong>${install ? 'Not installed' : stat(current)}</strong></div><span aria-hidden="true">→</span><div><small>AFTER ${install ? 'INSTALLATION' : 'UPGRADE'}</small><strong>${stat(next)}</strong></div></div>
    ${selected === 'drill' ? `<p class="component-extra">${DRILL_TIERS[drillVisualTier(level + 1) - 1]!.name} · ${number(drillReachTiles(level + 1))} tile reach · ${drillWidth(level + 1)}-wide cut</p>` : ''}
    <div class="component-checkout"><div><small>PRICE · INSTALLATION INCLUDED</small><b>${credits(cost)}</b></div><button id="buy-${selected}" class="primary" ${locked || !enough ? 'disabled' : ''}>${locked ? 'Locked' : install ? 'Install equipment' : 'Buy upgrade'}</button></div>
    <p class="purchase-reason">${locked ? `Unlocks after: ${upgradeGateLabel(level + 1)?.toLowerCase()}.` : !enough ? `Need ${credits(cost - p.money)} more. Sell ore to earn credits.` : `${credits(p.money - cost)} left after purchase. Fitted immediately.`}</p></div></article></div>`;
}
