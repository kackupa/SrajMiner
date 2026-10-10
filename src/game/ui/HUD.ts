import { CORE, CORE_RELICS, vesperChapterUnlocked, ORES, ORE_KEYS, ORE_SILHOUETTES, UPGRADES, UPGRADE_KEYS, upgradeValue, upgradeGateLabel, SPECIALIZATIONS, SPECIALIZATION_KEYS, stratumAt, CAMPAIGN_MILESTONES, ROUTE_FRAGMENTS, ROUTE_SURVEY_REWARDS, ROUTE_SHIP_COMPONENTS, NAVIGATION_HASHES, CREW_ARCHIVE_CONCLUSION, SHIP_COMPONENTS, MAPS, REGION_FINDS, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, DESCENT_WARNING_SPEED, LASER_THERMAL, SURFACE_RAID, estimateWinchReturnFuel, POD_PAINTS, POD_PAINT_KEYS, PILOT_SUITS, PILOT_SUIT_KEYS, POD_DECALS, POD_DECAL_KEYS, POD_PROFILES, POD_PROFILE_KEYS, drillWidth, drillReachTiles, drillVisualTier, DRILL_TIERS, UNDERGROUND_BUILDING, type Upgrade, type ShipComponent, type MapId, type Ore, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from '../config';
import { parseSaveFile, type SaveData } from '../save/SaveManager';
import { Progress, type Cargo } from '../economy/Progress';
import type { SaleReceipt } from '../economy/Sale';
import type { Tile } from '../world/TileWorld';
import type { TileWorld } from '../world/TileWorld';
import type { PlayerPod } from '../player/PlayerPod';
import type { AudioMix } from '../audio/AudioSystem';
import { campaignMapRecords, coreSurveyProgress, crewArchiveRestored } from '../campaign/Records';
import { surfaceTownTier } from '../surface/SurfaceStation';
import { canAffordStructure, type StructureKind, type UndergroundStructure } from '../building/UndergroundStructures';
import { ESCAPE_SUIT } from '../config';
import { wrapPlanetTile } from '../world/PlanetChart';
import { tradeNetworkPremium } from '../config';
import { tradeRouteEdges, VESPER_SYSTEM_POSITIONS } from '../economy/TradeNetwork';
import { contractReady, marketContract, marketDemand, marketDemandBonus } from '../economy/MarketContracts';
import type { WarehouseDirection } from '../economy/Warehouse';
import { CARGO_TUG_PROJECT, VESPER_RELAY_PROJECT, cargoTugProgress, vesperRelayProgress } from '../economy/SystemProjects';
import { pauseScreen } from './PauseScreen';
export const flightWarning = (input: {
  surface: boolean;
  fuelRatio: number;
  hullRatio: number;
  descentSpeed: number;
  cargoFull: boolean;
}) => {
  if (input.surface) return '';
  if (input.fuelRatio < 0.23) return 'LOW FUEL — RETURN TO SURFACE';
  if (input.hullRatio < 0.25) return 'LOW HULL — THRUST TO BRAKE. RETURN FOR REPAIRS';
  if (input.descentSpeed >= DESCENT_WARNING_SPEED)
    return 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT';
  if (input.cargoFull) return 'CARGO FULL — RETURN TO SELL';
  return '';
};
export function campaignObjective(p: Progress, mapId: MapId, tradePostCount = 0, hasLocalTradePost = false) {
  if (p.pilotEscaping) return {
    title: 'EMERGENCY RETURN · PILOT ALIVE',
    body: 'Reach any planetary surface dock or a built service beacon to rescue the pilot.',
  };
  if (!p.shipComplete && mapId === 'cryo-shelf') {
    const nextSignal = ROUTE_FRAGMENTS.find((fragment) => !p.routeFragments.includes(fragment.id));
    if (nextSignal) return {
      title: `FARADAY ROUTE SIGNAL · ${p.routeFragments.length}/${ROUTE_FRAGMENTS.length}`,
      body: `NEXT: ${nextSignal.landmark.toUpperCase()} · ${nextSignal.row * 12} M. Drill the glowing data seam; each signal pays its matching ship-part claim.`,
    };
    return {
      title: `ASSEMBLE THE FARADAY · ${p.shipComponents.length}/${Object.keys(SHIP_COMPONENTS).length} SYSTEMS`,
      body: 'Sell ore and install the four launch systems at the Hab 07 Shipyard. The four signal claims cover the complete craft.',
    };
  }
  if (!p.shipComplete) return {
    title: `BUILD THE FARADAY · ${p.shipComponents.length}/${Object.keys(SHIP_COMPONENTS).length} SYSTEMS`,
    body: 'Sell ore and install all four launch systems at the Hab 07 Shipyard to unlock travel across the Vesper system.',
  };
  const core = CORE_RELICS.find((record) => record.mapId === mapId)!;
  if (!p.milestones.includes(core.id)) return {
    title: `PLANET CORE RECORD · ${MAPS[mapId].name.toUpperCase()}`,
    body: `Reach the center and drill the ${core.name}. Its $${core.bounty} archive claim and story record are permanent.`,
  };
  const recovered = CORE_RELICS.filter((record) => p.milestones.includes(record.id)).length;
  if (recovered === CORE_RELICS.length - 1 && !p.milestones.includes('core-vesper')) return {
    title: 'NEW CHAPTER CHARTED · VESPER-9',
    body: 'Five planetary cores reconstruct the missing coordinates. Travel to Vesper-9 and recover the Return Bloom to complete the six-world ledger.',
  };
  if (recovered === CORE_RELICS.length) return {
    title: `VESPER TRADE NETWORK · ${tradePostCount}/${Object.keys(MAPS).length}`,
    body: tradePostCount === Object.keys(MAPS).length
      ? 'All six planetary exchanges are linked. Remote posts add up to 40%; restore the Vesper Relay from stored ore for another 5%. Grow the colonies and defend your routes.'
      : `Build a Trading Post at the surface on ${tradePostCount === 0 ? 'your first world' : 'another world'} to establish the interplanetary ore exchange. ${hasLocalTradePost ? 'This colony is online; expand to another planet to earn linked-market premiums.' : 'Each remote member market raises sale value by 10%, up to 40%; the Vesper Relay can later add another 5%.'}`,
  };
  return {
    title: `FARADAY CORE LEDGER · ${recovered}/${CORE_RELICS.length}`,
    body: recovered === CORE_RELICS.length
      ? 'All planetary records are logged. Open the Archive at Hab 07 to read the reconstructed route home.'
      : 'This planet’s core record is secured. Use MAPS at Hab 07 to visit another world and recover its unique sample.',
  };
}
export function drawOreSymbol(ctx: CanvasRenderingContext2D, ore: keyof typeof ORES, x: number, y: number, size: number) {
  const half = size / 2;
  ctx.beginPath();
  switch (ORE_SILHOUETTES[ore]) {
    case 'chips':
      ctx.fillRect(x - half, y - half, size * 0.42, size * 0.42);
      ctx.fillRect(x + size * 0.08, y + size * 0.08, size * 0.42, size * 0.42);
      break;
    case 'bars':
      ctx.fillRect(x - half, y - size * 0.36, size, size * 0.25);
      ctx.fillRect(x - size * 0.34, y + size * 0.1, size * 0.84, size * 0.25);
      break;
    case 'spires':
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half * 0.72, y + half);
      ctx.lineTo(x - half * 0.72, y + half);
      ctx.closePath();
      ctx.fill();
      break;
    case 'nuggets':
      ctx.arc(x, y, half * 0.78, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'facets':
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half, y);
      ctx.lineTo(x, y + half);
      ctx.lineTo(x - half, y);
      ctx.closePath();
      ctx.fill();
      break;
  }
}
export type UIActions = {
  modeChanged: (paused: boolean) => void;
  serviceAll: () => boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  recoverStranded: () => boolean;
  save: () => void;
  sell: (buyerMapId?: MapId) => SaleReceipt | undefined;
  service: (key: 'fuel' | 'hull') => boolean;
  buy: (key: Upgrade) => boolean;
  buyCharges: () => boolean;
  buyMagnet: () => boolean;
  buyStasis: () => boolean;
  buyReturnWinch: () => boolean;
  buyEscapeSuit: () => boolean;
  buyPaint: (key: PodPaint) => boolean;
  selectPaint: (key: PodPaint) => boolean;
  buySuit: (key: PilotSuit) => boolean;
  selectSuit: (key: PilotSuit) => boolean;
  buyDecal: (key: PodDecal) => boolean;
  selectDecal: (key: PodDecal) => boolean;
  buyProfile: (key: PodProfile) => boolean;
  selectProfile: (key: PodProfile) => boolean;
  selectSpecialization: (key: Specialization) => boolean;
  rescue: () => void;
  newGame: () => void;
  mute: () => boolean;
  isMuted: () => boolean;
  audioMix: () => AudioMix;
  setAudioMix: (channel: keyof AudioMix, value: number) => void;
  atmosphereEnabled: () => boolean;
  setAtmosphereEnabled: (enabled: boolean) => void;
  buildShipComponent: (key: ShipComponent) => boolean;
  travelMap: (id: MapId) => boolean;
  buildStructure: (kind: StructureKind) => boolean;
  warehouseStock: (mapId?: MapId) => Cargo;
  warehouseMaps: () => MapId[];
  transferWarehouse: (ore: Ore, direction: WarehouseDirection, units: number, mapId?: MapId) => number;
  contributeSystemProject: () => boolean;
  contributeCargoTug: () => boolean;
  atWarehouse: () => boolean;
  placementActive: () => boolean;
  structures: () => readonly UndergroundStructure[];
  surfaceAccess: () => boolean;
  planetSurfaceAccess: () => boolean;
  sellAccess: () => boolean;
  serviceAccess: () => boolean;
  failureReason: () => 'fuel' | 'hull' | 'impact';
  tradeNetworkCount: () => number;
  tradePostMaps: () => readonly MapId[];
  hasTradePost: () => boolean;
  atTradePost: () => boolean;
  habitatCount: () => number;
  repairStructure: (id: string) => boolean;
  exportSave: () => SaveData | null;
  importSave: (save: SaveData) => boolean;
};
export class HUD {
  modal = 'intro';
  hasStarted = false;
  paused = true;
  nearSurface = true;
  onCrust = true;
  currentDepth = 0;
  docked = false;
  toastTimer = 0;
  displayedMoney = 80;
  lastSale?: SaleReceipt;
  selectedSaleBuyer: MapId = 'cryo-shelf';
  savedAt = 0;
  saveFailed = false;
  targetSignature = '';
  missionTipSignature = '';
  mapId: MapId = 'cryo-shelf';
  mapOpen = false;
  pendingImport?: SaveData;
  exportUrl?: string;
  exportFilename = '';
  styleSection: 'paint' | 'suit' | 'decal' | 'profile' = 'paint';
  warehouseSelectedOre: Ore = 'copper';
  warehouseUnits = 1;
  warehouseSourceMap: MapId = 'cryo-shelf';
  returnFocus: HTMLElement | null = null;
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    document.querySelector('#route-map-panel')!.classList.toggle('hidden', !this.mapOpen);
    document.querySelector('#map-toggle')!.setAttribute('aria-pressed', String(this.mapOpen));
  }
  drawMap(world: TileWorld, pod: PlayerPod) {
    if (!this.mapOpen) return;
    const canvas = document.querySelector<HTMLCanvasElement>('#route-map')!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width, height = canvas.height, columns = 48;
    const row = Math.max(0, Math.floor(pod.y / 40)), firstRow = Math.max(0, row - 22), lastRow = firstRow + 44;
    const firstColumn = Math.floor(pod.x / 40) - Math.floor(columns / 2);
    const cellW = width / columns, cellH = height / 44;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#101a20'; ctx.fillRect(0, 0, width, height);
    for (let y = firstRow; y < lastRow; y++)
      for (let x = 0; x < columns; x++) {
        const worldX = firstColumn + x;
        const canonical = world.planetChart
          ? wrapPlanetTile({ x: worldX, y }, world.planetChart.columns, world.planetChart.radiusRows)
          : { x: worldX, y };
        const key = `${canonical.x},${canonical.y}`;
        if (world.destroyed.has(key)) {
          ctx.fillStyle = '#94c7b5';
          ctx.fillRect(x * cellW, (y - firstRow) * cellH, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
        }
        // The scanner reveals only nearby geology. Keep markers within explored cells
        // so the map remains a survey aid rather than an ore detector for the whole world.
        if (world.discovered.has(key) && !world.destroyed.has(key)) {
          const tile = world.get(worldX, y);
          if (tile.ore || tile.signalHashId) {
            ctx.fillStyle = tile.signalHashId ? '#91f5e2' : tile.regionFind ? '#a6ffe3' : tile.geode ? '#e1a6ff' : `#${ORES[tile.ore!].color.toString(16).padStart(6, '0')}`;
            const cx = (x + 0.5) * cellW, cy = (y - firstRow + 0.5) * cellH;
            if (tile.signalHashId) {
              ctx.fillRect(cx - 2.2, cy - 2.2, 4.4, 4.4);
            } else if (tile.ore) {
              drawOreSymbol(ctx, tile.ore, cx, cy, 4.2);
              if (tile.geode || tile.regionFind) {
                ctx.strokeStyle = tile.geode ? '#e1a6ff' : '#a6ffe3';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(cx - 2.35, cy - 2.35, 4.7, 4.7);
              }
            }
          }
        }
      }
    if (firstRow === 0) {
      ctx.fillStyle = '#e5ba7f';
      ctx.fillRect(0, 1, width, 2);
    }
    ctx.fillStyle = '#f4d18e';
    ctx.beginPath();
    ctx.arc((pod.x / 40 - firstColumn) * cellW, (row - firstRow + 0.5) * cellH, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  setMap(id: MapId) {
    this.mapId = id;
    document.querySelector('#zone')!.textContent = MAPS[id].shortName;
    document.querySelector('.location-label .eyebrow')!.textContent = MAPS[id].shortName;
    document.querySelector('.location-label span:last-child')!.textContent = id === 'mars-frontier'
      ? 'MARS · FRONTIER OUTPOST'
      : `${id === 'cryo-shelf' ? 'VESPER-9' : 'FARADAY ROUTE'} · ${MAPS[id].name.toUpperCase()}`;
  }
  setMode(paused: boolean) {
    this.paused = paused;
    this.actions.modeChanged(paused);
    const button = document.getElementById('pause')!;
    const isMenuOpen = this.hasStarted && !!this.modal;
    button.textContent = isMenuOpen ? 'Ⅱ' : paused ? '▶' : 'Ⅱ';
    button.setAttribute('aria-label', isMenuOpen ? 'Close panel and resume game' : paused ? 'Resume game' : 'Pause game');
  }
  target(tile: Tile | undefined, ratio: number, warning: number, overflow?: { active: boolean; units: number; space: number }, laserVenting = false) {
    let panel = document.getElementById('drill-target');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'drill-target';
      panel.className = 'drill-target hidden';
      document.getElementById('viewport')!.appendChild(panel);
    }
    const signature = tile
      ? `${tile.x},${tile.y},${tile.oreUnits ?? 0},${tile.geode ? 1 : 0},${tile.regionFind ?? ''},${tile.signalHashId ?? ''},${tile.coreRelicId ?? ''},${this.p.levels.drill},${overflow?.active ? `${overflow.units}:${overflow.space}` : ''},${Math.round(ratio * 100)},${Math.ceil(warning * 10)},${laserVenting ? 1 : 0}`
      : '';
    if (signature === this.targetSignature) return;
    this.targetSignature = signature;
    panel.classList.toggle('hidden', !tile);
    if (!tile) return;
    const ore = tile.ore ? ORES[tile.ore] : undefined;
    const regionalFind = tile.regionFind ? REGION_FINDS[tile.regionFind] : undefined;
    const signalHash = tile.signalHashId ? NAVIGATION_HASHES.find((entry) => entry.id === tile.signalHashId) : undefined;
    const coreRelic = tile.coreRelicId ? CORE_RELICS.find((entry) => entry.id === tile.coreRelicId) : undefined;
    const name =
      (coreRelic ? coreRelic.name : undefined) ?? (tile.fragmentId ? 'Route data' : undefined) ?? (signalHash ? `Navigation hash · ${signalHash.name}` : undefined) ?? ore?.name ??
      (tile.type === 'hard' ? stratumAt(tile.y * 12, this.mapId) : tile.type === 'rock' ? 'Basalt' : stratumAt(tile.y * 12, this.mapId));
    const width = drillWidth(this.p.levels.drill);
    const units = tile.oreUnits ?? 1;
    const full = overflow?.active ?? (!!ore && this.p.count + units > this.p.max('cargo'));
    const overflowUnits = overflow?.active ? overflow.units : units;
    const cargoSpace = overflow?.active ? overflow.space : Math.max(0, this.p.max('cargo') - this.p.count);
    panel.classList.toggle('ore-warning', full);
    panel.classList.toggle('geode-target', !!tile.geode || !!regionalFind);
    panel.classList.toggle('core-target', !!coreRelic);
    panel.classList.toggle('laser-venting', laserVenting);
    const overflowWarning = full
      ? cargoSpace === 0
        ? `CARGO FULL — EXCESS ORE DROPS HERE. CLEAR THE ROUTE; RETURN AFTER SELLING TO COLLECT IT.`
        : `CARGO SHORT — ${cargoSpace} OF ${overflowUnits} UNITS FIT. THE REST DROPS HERE FOR YOUR RETURN TRIP.`
      : '';
    panel.innerHTML = `<div><b>${coreRelic ? '◈ PLANET CORE · ' : tile.geode ? '✦ PRISM GEODE · ' : regionalFind ? `✦ ${regionalFind.name} · ` : signalHash ? '◈ ARCHIVE HASH · ' : ''}${name.toUpperCase()}${ore && units !== 1 ? ` · +${units} UNITS` : ''}</b><span>${coreRelic ? `$${coreRelic.bounty} ARCHIVE SALVAGE CLAIM` : signalHash ? 'OPTIONAL HASH HAS NO CASH VALUE' : ore ? `$${ore.value} / unit` : 'NO ORE'} · ${width} BLOCK${width === 1 ? '' : 'S'} WIDE · ${this.p.drillTime(tile.hardness).toFixed(2)}s CUT</span></div><div class="cut-meter"><i style="width:${ratio * 100}%"></i></div><small>${full ? overflowWarning : laserVenting ? 'EMITTER VENTING · CUT PAUSED · RELEASE TO COOL FASTER' : coreRelic ? `${coreRelic.detail} · CUT TO RECORD PLANET · ${Math.round(ratio * 100)}%` : signalHash ? `${signalHash.detail} · CUTTING ${Math.round(ratio * 100)}%` : tile.geode ? `RARE CRYSTAL POCKET · GUARANTEED 3 UNITS · CUTTING ${Math.round(ratio * 100)}%` : regionalFind ? `${regionalFind.detail} · CUTTING ${Math.round(ratio * 100)}%` : `CUTTING ${Math.round(ratio * 100)}%`}</small>`;
  }
  constructor(
    public p: Progress,
    public actions: UIActions,
    public loaded: boolean,
    mapId: MapId = 'cryo-shelf',
    public getMapDepths: () => Partial<Record<MapId, number>> = () => ({}),
  ) {
    this.mapId = mapId;
    document.querySelector('#app')!.innerHTML = `
      <header class="topbar"><a class="brand" href="#" aria-label="Cold Signal"><span class="brand-mark">C<span>↧</span></span><span>COLD<span class="brand-light">SIGNAL</span><small>THE LOST ARK CAMPAIGN</small></span></a><div class="expedition"><i></i> PROSPECTOR ONLINE <span>/</span> <b id="zone">ICE MOON / CRYO SHELF</b></div><div class="top-actions"><button id="map-toggle" aria-label="Toggle explored map" title="Toggle explored map" aria-pressed="false">MAP</button><button id="audio" aria-label="Toggle sound" title="Toggle sound">SOUND ON</button><button id="audio-mix" aria-label="Open audio mixer" title="Open audio mixer">MIX</button><button id="pause" aria-label="Pause game">Ⅱ</button></div></header>
      <main id="viewport"><div id="game" aria-label="Mining campaign. Use WASD or arrow keys to fly. Hold left mouse button to aim and drill." role="application" tabindex="0"></div>
      <aside class="telemetry"><div class="eyebrow">POD TELEMETRY <span class="status-dot"></span></div><div class="meter-head"><span>FUEL</span><strong id="fuel-label"></strong></div><div class="meter"><i id="fuel-bar"></i></div><small id="return-estimate" class="return-estimate"></small><div class="meter-head"><span>HULL</span><strong id="hull-label"></strong></div><div class="meter hull"><i id="hull-bar"></i></div><div class="cargo-line"><span>▦ &nbsp;CARGO</span><strong id="cargo-label"></strong></div><div class="cargo-blocks" id="cargo-blocks"></div><div class="cargo-worth" id="cargo-worth"></div><div class="laser-thermal hidden" id="laser-thermal" role="status" aria-live="polite"><div><span id="laser-thermal-label">LASER HEAT</span><b id="laser-thermal-value">0%</b></div><div class="meter"><i id="laser-thermal-bar"></i></div></div><div class="tool-stock hidden" id="tool-stock"><span>Q · MINING CHARGE</span><b id="charge-count">0</b></div></aside>
      <aside class="depth-panel"><div class="eyebrow">CURRENT DEPTH</div><div class="depth-value"><span id="depth">0</span><small>m</small></div><div class="record">DEEPEST <span id="record">0m</span></div><div class="depth-rule"></div><div id="depth-note">SURFACE OPERATIONS</div><div id="gravity-note" aria-live="polite"></div></aside>
      <div class="location-label"><span class="eyebrow">ICE MOON / CRYO SHELF</span><span>VESPER-9 · FARADAY HAB-07</span></div>
      <div id="tip" class="mission-tip hidden" aria-live="polite"><span class="tip-icon">✦</span><div><b id="mission-headline"></b><span id="mission-body"></span></div></div>
      <div id="drill-target" class="drill-target hidden"></div><div id="route-map-panel" class="route-map-panel hidden"><div><b>EXPLORED TUNNELS</b><button id="map-close" aria-label="Close explored map">×</button></div><canvas id="route-map" width="240" height="220" aria-label="Map of explored tunnels and nearby surveyed ore"></canvas><div class="map-legend" aria-label="Ore map legend">${ORE_KEYS.map((key) => `<span><i class="ore-key ore-${ORE_SILHOUETTES[key]}" data-ore="${key}" role="img" aria-label="${ORES[key].name} marker" style="--ore-color:${ORES[key].hex}"></i>${ORES[key].name}</span>`).join('')}<span><i class="special"></i>Signature find</span><span><i class="hash"></i>Archive hash</span></div><small>Ore appears only after your scanner surveys nearby rock · M toggles map</small></div><div id="toast" role="status" aria-live="polite"></div><div id="low-warning" role="status"></div>
      <nav class="station-dock" id="station-dock" aria-label="Hab 07 services"><div class="dock-label"><i></i><div><b>HAB 07</b><span id="town-status">PROSPECTOR CAMP · TIER 0</span></div></div><div class="dock-main-actions" aria-label="Trade and improve"><button id="open-sell" title="Sell cargo"><span aria-hidden="true">↗</span>Sell ore</button><button id="open-service" title="Refuel and repair"><span aria-hidden="true">＋</span>Service</button><button id="open-upgrades" title="Improve the miner"><span aria-hidden="true">↑</span>Upgrades</button></div><div class="dock-more-label">EXPEDITION</div><div class="dock-more-actions" aria-label="Records and travel"><button id="open-archive" title="Signals and discoveries"><span aria-hidden="true">▤</span>Archive</button><button id="open-shipyard" title="Build the launch craft"><span aria-hidden="true">↗</span>Shipyard</button><button id="open-destinations" title="Travel between worlds"><span aria-hidden="true">⌖</span>Worlds</button><button id="open-paints" title="Change the miner's appearance"><span aria-hidden="true">✦</span>Style</button></div></nav>
      <input id="save-import-input" type="file" accept="application/json,.json" hidden /><div id="modal-layer" class="modal-layer"></div></main>
      <footer><div class="controls"><kbd>A</kbd><kbd>D</kbd> MOVE <span></span>HOLD LEFT CLICK · AIM + DRILL <span></span>WHEEL ZOOM <span></span><kbd>S</kbd> DOWN / DROP <span></span><kbd>W</kbd> THRUST <span></span><kbd>E</kbd> SELL / SERVICE <span></span><kbd>B</kbd> BUILD <span></span><kbd>R</kbd> WINCH <span></span><kbd>Q</kbd> CHARGE <span></span><kbd>X</kbd> STASIS <span></span><kbd>M</kbd> MAP <span></span><kbd>ESC</kbd> PAUSE</div><div class="bank"><span>BANKED CREDITS</span><b id="money">$80</b></div><div class="save-status" id="save-status">LOCAL SAVE · READY</div></footer>`;
    this.on('pause', () => actions.pause());
    this.on('audio', () => this.updateMuteButton(actions.mute()));
    this.updateMuteButton(actions.isMuted());
    this.on('open-sell', () => this.open('sell'));
    this.on('open-service', () => this.open('service'));
    this.on('open-upgrades', () => this.open('upgrades'));
    this.on('open-archive', () => this.open('archive'));
    this.on('open-shipyard', () => this.open('shipyard'));
    this.on('open-destinations', () => this.open('destinations'));
    this.on('open-paints', () => this.open('paints'));
    this.on('audio-mix', () => this.open('audio'));
    this.on('map-toggle', () => this.toggleMap());
    this.on('map-close', () => { if (this.mapOpen) this.toggleMap(); });
    document.querySelector<HTMLInputElement>('#save-import-input')!.addEventListener('change', async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (file.size > 32 * 1024 * 1024) {
        this.toast('Save file is too large to import.');
        return;
      }
      try {
        const imported = parseSaveFile(await file.text());
        if (!imported) throw new Error('Save version or data is not supported.');
        this.pendingImport = imported;
        this.open('import-confirm');
      } catch (error) {
        this.toast(error instanceof Error ? error.message : 'Could not read that save file.');
      }
    });
    document.querySelector('.brand')!.addEventListener('click', (e) => e.preventDefault());
    this.showIntro();
  }
  on(id: string, fn: () => void) {
    document.getElementById(id)?.addEventListener('click', fn);
  }
  private moveWarehouse(direction: WarehouseDirection, all = false) {
    const ore = document.querySelector<HTMLSelectElement>('#warehouse-ore')?.value as Ore | undefined;
    if (!ore || !ORE_KEYS.includes(ore)) return;
    this.warehouseSelectedOre = ore;
    const input = document.querySelector<HTMLInputElement>('#warehouse-units');
    this.warehouseUnits = input ? Math.max(0.5, Number(input.value) || 0.5) : this.warehouseUnits;
    const sourceMap = direction === 'withdraw' ? this.warehouseSourceMap : undefined;
    const moved = this.actions.transferWarehouse(ore, direction, all ? Number.MAX_SAFE_INTEGER : this.warehouseUnits, sourceMap);
    if (!moved) this.toast(direction === 'store' ? `No ${ORES[ore].name.toLowerCase()} available to store.` : 'No stored ore fits in the miner’s cargo hold.');
    this.renderModal();
  }
  private updateMuteButton(muted: boolean) {
    const button = document.querySelector<HTMLButtonElement>('#audio');
    if (!button) return;
    button.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    button.setAttribute('aria-pressed', String(muted));
  }
  open(name: string) {
    if (name === 'service' && !this.actions.serviceAccess()) return;
    if (name === 'sell' && !this.actions.sellAccess()) return;
    if (name === 'sell') this.selectedSaleBuyer = this.mapId;
    if (name === 'warehouse' && !this.actions.atWarehouse()) return;
    if (name === 'warehouse') this.warehouseSourceMap = this.mapId;
    if (name === 'upgrades' && !this.nearSurface) return;
    if (!this.modal) {
      const active = document.activeElement;
      this.returnFocus = active instanceof HTMLElement && active.getClientRects().length ? active : null;
    }
    this.modal = name;
    this.setMode(true);
    this.renderModal();
  }
  close() {
    this.modal = '';
    this.lastSale = undefined;
    if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
    this.exportUrl = undefined;
    this.exportFilename = '';
    this.setMode(false);
    document.querySelector('#modal-layer')!.innerHTML = '';
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected && target.getClientRects().length) target.focus();
    else (document.querySelector('#game') as HTMLElement).focus();
  }
  showIntro() {
    this.modal = 'intro';
    this.paused = true;
    const legacyMars = this.mapId === 'mars-frontier';
    const intro = legacyMars
      ? {
          eyebrow: 'INDEPENDENT PROSPECTOR PROGRAM / LEGACY SAVE',
          headline: 'FORTUNE FAVORS<br>THE <em>DEEP.</em>',
          dek: 'A small pod. A red planet. A whole lot beneath it.',
          loop: ['DIG', 'HAUL', 'UPGRADE'],
          briefing: 'Drill for ore. Watch your fuel. Fly home to sell your haul and build a better machine. Your tunnels stay yours.',
        }
      : {
          eyebrow: 'FARADAY RECOVERY PROGRAM / V0.2',
          headline: 'THE ARK IS LOST.<br>FIND THE <em>SIGNAL.</em>',
          dek: 'A buried generation ship. A cracked ice moon. A signal below.',
          loop: ['DRILL', 'RECOVER', 'REBUILD'],
          briefing: 'Your goal: recover all four glowing route signals from the Cryo Shelf’s deep chambers. Each signal pays one launch-ship part. Sell ordinary ore to upgrade your miner, install all four systems at the Shipyard, then travel across the Vesper system. Log five planetary cores to find the hidden sixth world, then recover its return signal. Your tunnels stay yours.',
        };
    const atlas = legacyMars ? '' : `<section class="intro-atlas" aria-label="Vesper system route map">
      <div class="atlas-heading"><span>VESPER SYSTEM</span><b>5 WORLDS · 1 HIDDEN CHAPTER</b></div>
      <div class="atlas-chart">
        <svg class="atlas-orbits" viewBox="0 0 560 158" aria-hidden="true"><ellipse cx="280" cy="80" rx="72" ry="26"/><ellipse cx="280" cy="80" rx="154" ry="49"/><ellipse cx="280" cy="80" rx="246" ry="73"/><path d="M25 80H535"/></svg>
        <button class="atlas-world selected" type="button" data-world="cryo-shelf" data-title="CRYO SHELF · RECOMMENDED START" data-copy="A compact 480 m-deep world gets new pilots to its core sooner. Recover four route signals; each funds one Faraday ship system." aria-pressed="true" style="--world-color:#9be5dc;--world-x:29%;--world-y:38%"><i class="world-disc ice"></i><span>CRYO SHELF</span><small>RECOMMENDED · 480 M DEEP</small></button>
        <button class="atlas-world locked" type="button" data-world="mars-frontier" data-title="MARS FRONTIER · LOCKED" data-copy="A rust-red world rich in thermal seams. Assemble the Faraday at Hab 07 to unlock the route." aria-pressed="false" style="--world-color:#dc9b73;--world-x:16%;--world-y:72%"><i class="world-disc mars"></i><span>MARS FRONTIER</span><small>SHIP REQUIRED</small></button>
        <button class="atlas-world locked" type="button" data-world="hull-graveyard" data-title="HULL GRAVEYARD · LOCKED" data-copy="A shattered ark world with broken decks and reactor salvage. Build all four ship systems to travel here." aria-pressed="false" style="--world-color:#b0c8b8;--world-x:74%;--world-y:23%"><i class="world-disc hull"></i><span>HULL GRAVEYARD</span><small>SHIP REQUIRED</small></button>
        <button class="atlas-world locked" type="button" data-world="prism-fault" data-title="PRISM FAULT · LOCKED" data-copy="A luminous crystal world with rare geodes. Finish the Faraday at the Cryo Shelf shipyard to reach it." aria-pressed="false" style="--world-color:#c8a9f7;--world-x:86%;--world-y:64%"><i class="world-disc prism"></i><span>PRISM FAULT</span><small>SHIP REQUIRED</small></button>
        <button class="atlas-world locked" type="button" data-world="cinder-vale" data-title="CINDER VALE · LOCKED" data-copy="A volcanic ember world of ashglass, obsidian, and sealed magma. Build the Faraday to reach it; its core holds one key in the route home." aria-pressed="false" style="--world-color:#ff9460;--world-x:50%;--world-y:82%"><i class="world-disc cinder"></i><span>CINDER VALE</span><small>SHIP REQUIRED</small></button>
        <button class="atlas-world locked" type="button" data-world="vesper-9" data-title="VESPER-9 · UNCHARTED" data-copy="The Faraday’s destination is absent from every star chart. Log the five known planetary cores to reconstruct its coordinates." aria-pressed="false" style="--world-color:#b2e98e;--world-x:50%;--world-y:15%"><i class="world-disc vesper"></i><span>VESPER-9</span><small>5 CORE RECORDS REQUIRED</small></button>
        <div class="atlas-sun" aria-label="Vesper star">✦</div>
      </div>
      <div class="atlas-preview" aria-live="polite"><b id="atlas-title">CRYO SHELF · FIRST DEPLOYMENT</b><p id="atlas-copy">A shorter 480 m route to the core. Recover four signals to fund the Faraday, then expand your colony network as you travel.</p></div>
      <div class="atlas-goal"><i>CAMPAIGN GOAL</i><span>RECOVER 4 SIGNALS <b>→</b> BUILD THE FARADAY <b>→</b> LOG 5 CORES <b>→</b> FIND VESPER-9</span></div>
    </section>`;
    const launchButton = `<button class="primary" id="launch">${this.loaded ? 'CONTINUE EXPEDITION' : 'BEGIN EXPEDITION'} <span>↗</span></button>`;
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal intro ${atlas ? 'intro-with-atlas' : ''}" role="dialog" aria-modal="true" aria-label="Expedition briefing"><div class="eyebrow">${intro.eyebrow}</div><div class="intro-symbol">✦</div><h1>${intro.headline}</h1><p>${intro.dek}</p>${atlas}${atlas ? launchButton : `<div class="intro-loop"><span>01 <b>${intro.loop[0]}</b></span><i>→</i><span>02 <b>${intro.loop[1]}</b></span><i>→</i><span>03 <b>${intro.loop[2]}</b></span></div><p class="briefing">${intro.briefing}</p>`}<details class="intro-help"><summary>How to play · controls and safety</summary><div class="intro-controls" aria-label="Game controls"><div><kbd>A</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>S</kbd><span>DESCEND / DRILL</span></div><div><kbd>W</kbd><span>THRUST UP</span></div><div><kbd>LMB</kbd><span>AIM · HOLD TO DRILL</span></div><div><kbd>E</kbd><span>SELL / SERVICE</span></div><div><kbd>B</kbd><span>BUILD AT SURFACE / DEPTH</span></div><div><kbd>M</kbd><span>EXPLORED MAP</span></div><div><kbd>ESC</kbd><span>PAUSE</span></div></div><p class="intro-risk">ORE FILLS CARGO · WATCH THE RETURN-FUEL ESTIMATE AND KEEP A RESERVE.</p><small class="intro-note">Q USES A MINING CHARGE · X USES STASIS · R USES THE OPTIONAL SURFACE WINCH</small></details>${atlas ? '' : launchButton}</section>`;
    document.querySelectorAll<HTMLButtonElement>('.atlas-world').forEach((node) => node.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.atlas-world').forEach((other) => {
        const selected = other === node;
        other.classList.toggle('selected', selected);
        other.setAttribute('aria-pressed', String(selected));
      });
      document.querySelector('#atlas-title')!.textContent = node.dataset.title ?? '';
      document.querySelector('#atlas-copy')!.textContent = node.dataset.copy ?? '';
    }));
    this.on('launch', () => {
      this.hasStarted = true;
      this.close();
      this.actions.start();
    });
    document.getElementById('launch')?.focus();
  }
  renderModal() {
    const name = this.modal,
      p = this.p;
    const active = document.activeElement;
    const previousFocusId = active instanceof HTMLElement && document.querySelector('.modal')?.contains(active) ? active.id : '';
    const receipt = name === 'sell' && !p.count ? this.lastSale : undefined;
    const saleCargo = receipt?.cargo ?? p.cargo;
    let title = '',
      sub = '',
      content = '';
    if (name === 'construction') {
      const planetSurface = this.actions.planetSurfaceAccess();
      title = planetSurface ? 'Grow a colony.' : 'Make a foothold.';
      sub = planetSurface ? 'PLANETARY BUILD YARD' : 'UNDERGROUND FABRICATOR';
      const structures = this.actions.structures();
      const materials = (kind: StructureKind) => Object.entries(UNDERGROUND_BUILDING[kind].materials)
        .map(([ore, units]) => `${units} ${ore.toUpperCase()}`).join(' · ');
      const platformCount = structures.filter((entry) => entry.kind === 'platform').length;
      const hasService = structures.some((entry) => entry.kind === 'service');
      const turretCount = structures.filter((entry) => entry.kind === 'turret').length;
      const habitatCount = structures.filter((entry) => entry.kind === 'habitat').length;
      const warehouseCount = structures.filter((entry) => entry.kind === 'warehouse').length;
      const wallCount = structures.filter((entry) => entry.kind === 'wall').length;
      const gateCount = structures.filter((entry) => entry.kind === 'gate').length;
      const damagedStructures = structures.filter((entry) => ['habitat', 'turret', 'wall', 'gate'].includes(entry.kind) &&
        (entry.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity);
      const option = (kind: StructureKind, label: string, description: string, owned: boolean) => {
        const cost = UNDERGROUND_BUILDING[kind];
        const affordable = canAffordStructure(kind, p.cargo, p.money);
        const blocked = !affordable || owned || structures.length >= UNDERGROUND_BUILDING.maxStructuresPerMap;
        const buttonText = owned ? 'ALREADY BUILT' : !affordable ? 'NEED ORE / CREDITS' : `BUILD · $${cost.credits}`;
        return `<article class="service-row"><div><b>${label}</b><small>${description}<br>BUILD COST · ${materials(kind)} + $${cost.credits}</small></div><button id="build-${kind}" ${blocked ? 'disabled' : ''}>${buttonText}</button></article>`;
      };
      if (planetSurface) {
        const networkCount = this.actions.tradeNetworkCount(), relayOnline = p.milestones.includes(VESPER_RELAY_PROJECT.completionMilestone),
          premium = Math.min(40, Math.max(0, networkCount - 1) * 10) + (relayOnline && networkCount >= 2 ? 5 : 0);
        const currentOrder = marketContract(this.mapId, p.milestones), order = currentOrder.order;
        const orderStatus = currentOrder.complete ? `${currentOrder.total}/${currentOrder.total} DELIVERIES · ALL BONUSES PAID` : `ORDER ${currentOrder.stage}/${currentOrder.total} · ${order.units} ${order.ore.toUpperCase()} · $${order.reward} BONUS`;
        const orderCopy = this.actions.hasTradePost()
          ? `LOCAL BUY ORDER · ${orderStatus}. Sell the required ore here in one visit.`
          : `NEXT BUY ORDER · ${orderStatus}. Build this planet’s Trading Post to deliver.`;
        const repairRows = this.nearSurface ? damagedStructures.map((entry) => `<article class="service-row"><div><b>REPAIR ${entry.kind.replace('-', ' ').toUpperCase()}</b><small>Restores full integrity · $${SURFACE_RAID.repairCredits}</small></div><button id="repair-${encodeURIComponent(entry.id)}" ${p.money < SURFACE_RAID.repairCredits ? 'disabled' : ''}>REPAIR</button></article>`).join('') : '';
        content = `<p>Build colony modules anywhere on this globe. Surface raiders telegraph their target; drill them, let a pylon intercept, or hold them at a wall. Gates lift for your miner.</p><div class="network-status"><b>PLANETARY BUY ORDER</b><span>${orderCopy}</span></div>${repairRows ? `<div class="upgrade-list">${repairRows}</div>` : ''}<div class="upgrade-list">${option('habitat', 'COLONY HABITAT', `${habitatCount}/${UNDERGROUND_BUILDING.habitat.maxPerMap} built. A permanent surface shelter with a nearby repair and refuel bay.`, habitatCount >= UNDERGROUND_BUILDING.habitat.maxPerMap)}${option('turret', 'DEFENSE PYLON', `${turretCount}/${UNDERGROUND_BUILDING.turret.maxPerMap} built. Intercepts rock swimmers and colony raiders in its 440 px guard radius.`, turretCount >= UNDERGROUND_BUILDING.turret.maxPerMap)}${option('trade-post', 'TRADING POST', this.actions.hasTradePost() ? 'This colony is connected to the Vesper exchange.' : 'A surface exchange node. Protected from raids so the trade objective cannot be permanently lost.', this.actions.hasTradePost())}${option('warehouse', 'ORE WAREHOUSE', `${warehouseCount ? 'Built · ' : 'One per planet · '}store selected ore safely here and withdraw it later.`, warehouseCount >= UNDERGROUND_BUILDING.warehouse.maxPerMap)}${option('wall', 'PERIMETER WALL', `${wallCount}/${UNDERGROUND_BUILDING.wall.maxPerMap} built. Adjacent segments connect; raiders must breach each segment. Your miner can cross freely.`, wallCount >= UNDERGROUND_BUILDING.wall.maxPerMap)}${option('gate', 'SECURITY GATE', `${gateCount}/${UNDERGROUND_BUILDING.gate.maxPerMap} built. A raider-blocking gap that lifts when your miner approaches.`, gateCount >= UNDERGROUND_BUILDING.gate.maxPerMap)}</div><div class="network-status"><b>INTERPLANETARY EXCHANGE · ${networkCount}/${Object.keys(MAPS).length} POSTS</b><span>${premium}% LINKED-WORLD SALE PREMIUM · ${networkCount < 2 ? 'BUILD ON A SECOND PLANET TO OPEN THE ROUTE' : 'ROUTES ACTIVE ACROSS THE VESPER SYSTEM'}</span></div><p class="fine">Press E at a habitat for service, Trading Post for sales, or Warehouse for ore storage. ${this.nearSurface ? `Damaged habitats, pylons, walls and gates can be repaired here for $${SURFACE_RAID.repairCredits}.` : 'Return to Hab 07 to repair damaged colony buildings.'} Structures persist per planet; use MAPS after completing the Faraday to visit other worlds.</p>`;
      } else {
        content = `<p>Build in a cleared cavern. Down drops through decks; local gravity decides which side catches you. Structures stay on this planet.</p><div class="upgrade-list">${option('platform', 'ANCHOR DECK', 'A five-tile landing and staging platform.', platformCount >= 12)}${option('service', 'REFUEL BEACON', 'One per planet. Press E nearby to refuel or repair at standard prices.', hasService)}${option('turret', 'SENTRY TURRET', `${turretCount}/3 built. Automatically intercepts rock swimmers in range.`, turretCount >= UNDERGROUND_BUILDING.turret.maxPerMap)}</div><p class="fine">Construction requires a 180 m+ site and open room around the build point.</p>`;
      }
    } else if (name === 'audio') {
      const mix = this.actions.audioMix();
      title = 'Tune the sound.';
      sub = 'AUDIO / LOCAL SETTINGS';
      content = `<p>Set the soundtrack and game effects to suit your speakers. Your levels are saved on this device.</p><div class="audio-mix-controls"><label for="music-volume"><span><b>MUSIC</b><output id="music-value">${mix.music}%</output></span><input id="music-volume" type="range" min="0" max="100" step="5" value="${mix.music}" /></label><label for="effects-volume"><span><b>EFFECTS</b><output id="effects-value">${mix.effects}%</output></span><input id="effects-volume" type="range" min="0" max="100" step="5" value="${mix.effects}" /></label></div><button id="audio-mute" class="primary">${this.actions.isMuted() ? 'SOUND OFF · TURN ON' : 'SOUND ON · MUTE'} <span>♪</span></button>`;
      content += `<div class="service-row"><div><b>CAVE ATMOSPHERE</b><small>Drifting dust and thruster wakes. Hidden with reduced motion.</small></div><button id="atmosphere-toggle" aria-label="Cave atmosphere" aria-pressed="${this.actions.atmosphereEnabled()}">${this.actions.atmosphereEnabled() ? 'ON' : 'OFF'}</button></div>`;
    } else if (name === 'sell') {
      title = 'A good day’s haul.';
      sub = receipt ? `SETTLEMENT RECEIPT / ${MAPS[receipt.soldAt].name.toUpperCase()} → ${MAPS[receipt.destination].name.toUpperCase()}` : `ORE EXCHANGE / ${MAPS[this.mapId].name.toUpperCase()}`;
      const atTradingPost = this.actions.atTradePost();
      const saleMarkets = this.actions.tradePostMaps(), selectedBuyer = receipt?.destination ??
        (atTradingPost && saleMarkets.includes(this.selectedSaleBuyer) ? this.selectedSaleBuyer : this.mapId),
        remoteBuyerChoice = atTradingPost && saleMarkets.length > 1;
      const relayOnline = p.milestones.includes(VESPER_RELAY_PROJECT.completionMilestone),
        tradePremium = receipt?.networkPremium ?? tradeNetworkPremium(p.cargoValue, this.actions.tradeNetworkCount(), atTradingPost, relayOnline);
      const currentOrder = marketContract(this.mapId, p.milestones), order = currentOrder.order, complete = currentOrder.complete;
      const demand = marketDemand(selectedBuyer, p.milestones), demandBonus = receipt?.localDemandBonus ?? marketDemandBonus(saleCargo, selectedBuyer, p.milestones, atTradingPost && saleMarkets.includes(selectedBuyer));
      const localBuyer = selectedBuyer === this.mapId;
      const deliversOrder = receipt ? receipt.contractReward > 0 : localBuyer && contractReady(p.cargo, p.milestones, this.mapId, atTradingPost);
      const orderReward = deliversOrder ? order.reward : 0;
      const orderText = receipt ? receipt.contractReward ? `BUY ORDER ${receipt.contractStage}/${currentOrder.total} COMPLETED` : 'NO BUY ORDER COMPLETED' : complete ? `PLANETARY BUY ORDERS · ${currentOrder.total}/${currentOrder.total} COMPLETE` : !localBuyer ? `LOCAL ORDER ${currentOrder.stage}/${currentOrder.total} · NOT INCLUDED` : `${atTradingPost ? 'LOCAL BUY ORDER' : 'BUY ORDER · TRADING POST REQUIRED'} ${currentOrder.stage}/${currentOrder.total} · ${order.units} ${order.ore.toUpperCase()} · ${saleCargo[order.ore]}/${order.units} ON BOARD · +$${order.reward}`;
      const buyerPicker = remoteBuyerChoice && !receipt ? `<label class="sale-buyer-label" for="sale-buyer">DESTINATION MARKET</label><select id="sale-buyer">${saleMarkets.map((id) => `<option value="${id}" ${id === selectedBuyer ? 'selected' : ''}>${MAPS[id].name.toUpperCase()}${id === this.mapId ? ' · LOCAL' : ' · LINKED BUYER'}</option>`).join('')}</select>` : '';
      content = `${buyerPicker}<div class="network-status"><b>${orderText}</b><span>${receipt ? receipt.contractReward ? `${receipt.contractUnits} ${receipt.contractOre.toUpperCase()} shipped locally · +$${receipt.contractReward} order reward.` : 'This settlement did not complete the local delivery order.' : complete ? 'This colony has fulfilled every standing delivery.' : !localBuyer ? 'Remote buyer chosen. The local delivery order is skipped for this sale.' : deliversOrder ? `This sale completes order ${currentOrder.stage} and pays its bonus.` : 'Bring the requested ore to this planet’s Trading Post.'}</span></div>${(receipt?.networkPremium || relayOnline && atTradingPost) ? `<div class="network-status"><b>${relayOnline ? 'VESPER RELAY ONLINE · ' : ''}LINKED-WORLD PREMIUM</b><span>+$${tradePremium} included in settlement.</span></div>` : ''}${(atTradingPost || receipt) ? `<div class="network-status"><b>${receipt ? `${MAPS[receipt.destination].name.toUpperCase()} BUYER DEMAND` : `${MAPS[selectedBuyer].name.toUpperCase()} DEMAND ${demand.stage}/${demand.total} · ${demand.ore.toUpperCase()}`}</b><span>${receipt ? `+$${demandBonus} buyer-demand bonus.` : `This market's demand bonus · +$${demandBonus}`}</span></div>` : ''}<div class="ore-list">${ORE_KEYS.map((k) => `<div><span><i style="background:${ORES[k].hex}"></i>${ORES[k].name}</span><span>× ${saleCargo[k]}</span><b>$${saleCargo[k] * ORES[k].value}</b></div>`).join('')}</div><div class="sale-total"><span>${receipt ? `SOLD HERE · ${MAPS[receipt.soldAt].shortName} → ${MAPS[receipt.destination].shortName}` : 'ESTIMATED PAYOUT'}</span><b>$${receipt?.total ?? p.cargoValue + tradePremium + orderReward + demandBonus}</b></div>${tradePremium ? `<p class="fine">LINKED-WORLD PREMIUM · +$${tradePremium}</p>` : ''}${demandBonus ? `<p class="fine">BUYER DEMAND BONUS · +$${demandBonus}</p>` : ''}${(receipt?.contractReward ?? orderReward) ? `<p class="fine">LOCAL BUY ORDER PAID · +$${receipt?.contractReward ?? orderReward}</p>` : ''}<button id="sell" class="primary" ${p.count ? '' : 'disabled'}>SELL CARGO <span>↗</span></button>`;
    } else if (name === 'warehouse') {
      title = 'Keep your best finds.';
      sub = `ORE WAREHOUSE / ${MAPS[this.mapId].name.toUpperCase()}`;
      const warehouseMaps = this.actions.warehouseMaps(), remoteWarehousesOnline = p.milestones.includes(CARGO_TUG_PROJECT.completionMilestone),
        selectedWarehouse = remoteWarehousesOnline && warehouseMaps.includes(this.warehouseSourceMap) ? this.warehouseSourceMap : this.mapId,
        stock = this.actions.warehouseStock(selectedWarehouse), localStock = this.actions.warehouseStock(this.mapId);
      const relay = vesperRelayProgress(p.milestones), relayStage = relay.next,
        canFundRelay = !!relayStage && relayStage.mapId === this.mapId && localStock[relayStage.ore] >= relayStage.units,
        relayCopy = relay.complete ? `ONLINE · linked Trading Posts earn an additional ${Math.round(VESPER_RELAY_PROJECT.relaySaleBonus * 100)}% sale premium.`
          : relayStage?.mapId === this.mapId ? `${relayStage.label} · CONTRIBUTE ${relayStage.units} ${relayStage.ore.toUpperCase()} FROM THIS WAREHOUSE.`
            : `NEXT · ${relayStage?.label} AT ${relayStage ? MAPS[relayStage.mapId].name.toUpperCase() : 'THE NEXT COLONY'}.`;
      const tug = cargoTugProgress(p.milestones), tugStage = tug.next,
        canFundTug = !!tugStage && tugStage.mapId === this.mapId && localStock[tugStage.ore] >= tugStage.units,
        tugCopy = tug.complete ? 'ONLINE · withdraw ore from any colony warehouse when you visit a warehouse.'
          : tugStage?.mapId === this.mapId ? `${tugStage.label} · CONTRIBUTE ${tugStage.units} ${tugStage.ore.toUpperCase()} FROM THIS WAREHOUSE.`
            : `NEXT · ${tugStage?.label} AT ${tugStage ? MAPS[tugStage.mapId].name.toUpperCase() : 'THE NEXT COLONY'}.`,
        remoteSourcePicker = remoteWarehousesOnline && warehouseMaps.length > 1
          ? `<label class="warehouse-source-label" for="warehouse-source">WITHDRAW FROM</label><select id="warehouse-source">${warehouseMaps.map((id) => `<option value="${id}" ${id === selectedWarehouse ? 'selected' : ''}>${MAPS[id].name.toUpperCase()}${id === this.mapId ? ' · LOCAL' : ' · REMOTE'}</option>`).join('')}</select>` : '';
      content = `<p>Choose an ore and move it between the miner and a secure planet store. Stored ore stays safe if the miner is lost. Store actions always use this colony; withdraw uses the selected warehouse.</p>${remoteSourcePicker}<div class="ore-list warehouse-stock">${ORE_KEYS.map((ore) => `<div><span><i style="background:${ORES[ore].hex}"></i>${ORES[ore].name}</span><span>MINER × ${p.cargo[ore]}</span><b>STORED × ${stock[ore]}</b></div>`).join('')}</div><div class="warehouse-transfer"><label for="warehouse-ore">SELECT ORE</label><select id="warehouse-ore">${ORE_KEYS.map((ore) => `<option value="${ore}" ${ore === this.warehouseSelectedOre ? 'selected' : ''}>${ORES[ore].name.toUpperCase()}</option>`).join('')}</select><label for="warehouse-units">UNITS · HALF-UNIT STEPS</label><input id="warehouse-units" type="number" min="0.5" step="0.5" value="${this.warehouseUnits}" /></div><div class="warehouse-actions"><button id="warehouse-store">STORE SELECTED</button><button id="warehouse-store-all">STORE ALL</button><button id="warehouse-withdraw">TAKE SELECTED</button><button id="warehouse-withdraw-all">TAKE ALL</button></div><div class="network-status"><b>VESPER RELAY · ${relay.completedStages}/${relay.totalStages} STAGES</b><span>${relayCopy}</span>${!relay.complete && relayStage?.mapId === this.mapId ? `<button id="fund-relay" ${canFundRelay ? '' : 'disabled'}>CONTRIBUTE ${relayStage.units} ${relayStage.ore.toUpperCase()}</button>` : ''}</div><div class="network-status"><b>CARGO TUG · ${tug.completedStages}/${tug.totalStages} STAGES</b><span>${tugCopy}</span>${!tug.complete && tugStage?.mapId === this.mapId ? `<button id="fund-tug" ${canFundTug ? '' : 'disabled'}>CONTRIBUTE ${tugStage.units} ${tugStage.ore.toUpperCase()}</button>` : ''}</div><p class="fine">${remoteWarehousesOnline ? `Remote access is online · ${warehouseMaps.length}/${Object.keys(MAPS).length} colony depots connected.` : `This inventory belongs to ${MAPS[this.mapId].name}.`} Use a Trading Post to sell ore.</p>`;
    } else if (name === 'service') {
      title = 'Ready for another run.';
      sub = this.actions.structures().some((entry) => entry.kind === 'service') ? 'FUEL & REPAIR / LOCAL PIT STOP' : 'FUEL & REPAIR / OUTPOST 07';
      content = `<p>Top up before you head back into the dark. Charges use the same standard prices as Hab 07.</p><button id="service-all" class="primary" ${p.serviceCost('fuel') + p.serviceCost('hull') === 0 || p.serviceCost('fuel') + p.serviceCost('hull') > p.money ? 'disabled' : ''}>REFUEL + REPAIR <span>$${p.serviceCost('fuel') + p.serviceCost('hull')}</span></button>${(['fuel', 'hull'] as const).map((k) => `<div class="service-row"><div><b>${k === 'fuel' ? 'REFUEL TANK' : 'REPAIR HULL'}</b><small>${Math.ceil(p[k])} / ${p.max(k)} ${k === 'fuel' ? 'L' : 'integrity'}</small></div><button id="service-${k}" ${p.serviceCost(k) === 0 || p.serviceCost(k) > p.money ? 'disabled' : ''}>${p.serviceCost(k) === 0 ? 'FULL' : `$${p.serviceCost(k)} →`}</button></div>`).join('')}${this.actions.surfaceAccess() ? '<p class="fine">Emergency recovery is available in the pause menu. It restores your pod, but forfeits unsold cargo.</p>' : '<p class="fine">A beacon is a pit stop, not a teleport. Keep enough fuel to fly back to the surface.</p>'}`;
    } else if (name === 'upgrades') {
      title = 'Make the next run count.';
      sub = 'POD WORKSHOP / OUTPOST 07';
      const specializationCards = SPECIALIZATION_KEYS.map((key) => {
        const path = SPECIALIZATIONS[key];
        const capacity = Math.round(p.max('cargo') * path.cargoMultiplier / SPECIALIZATIONS[p.specialization].cargoMultiplier * 2) / 2;
        const full = key === p.specialization;
        const blocked = p.count > capacity;
        const excess = Number((p.count - capacity).toFixed(1));
        return `<article class="specialization-card ${full ? 'active' : ''}"><b>${path.name.toUpperCase()}</b><p>${path.description}</p>${key === 'hauler' ? `<small>HOLD CAPACITY · ${capacity}</small>` : key === 'surveyor' ? `<small>SCANNER RADIUS · +${path.scanRadiusBonus} TILES</small>` : key === 'seamCutter' ? '<small>HARD ROCK CUTTING · +20%</small>' : '<small>STANDARD CAPACITY AND CUTTING</small>'}<button id="specialization-${key}" aria-pressed="${full}" ${full || blocked ? 'disabled' : ''}>${full ? 'ACTIVE PATH' : blocked ? `SELL ${excess} ${excess === 1 ? 'UNIT' : 'UNITS'} FIRST` : 'SELECT PATH'}</button></article>`;
      }).join('');
      content = `<div class="upgrade-list">${UPGRADE_KEYS.map((k) => {
        const u = UPGRADES[k],
          lv = p.levels[k];
          const current = upgradeValue(k, lv), next = upgradeValue(k, lv + 1), nextCost = p.cost(k), progressPips = k === 'grapple' && !p.grappleOwned ? 0 : (lv - 1) % 5 + 1,
          formatStat = (n: number) => Number(n.toFixed(2)).toLocaleString(), shortfall = Math.max(0, Math.ceil(nextCost - p.money));
        const grappleLocked = k === 'grapple' && !p.grappleOwned,
          gate = upgradeGateLabel(lv + 1), gateLocked = !p.canBuyUpgrade(k),
          levelLabel = grappleLocked ? 'NOT INSTALLED' : `LV ${lv} → ${lv + 1}`,
          benefit = grappleLocked ? `INSTALL · ${formatStat(next)}${u.unit} · catches only when a hard landing is imminent` : `${formatStat(current)} → ${formatStat(next)}${u.unit} · +${Math.round((next / current - 1) * 100)}%`;
        const drillReadout = k === 'drill'
          ? `<small class="upgrade-readout">${DRILL_TIERS[drillVisualTier(lv) - 1]!.name.toUpperCase()} · ${DRILL_TIERS[drillVisualTier(lv) - 1]!.module} · ${drillReachTiles(lv).toFixed(1)} TILE REACH · ${drillWidth(lv)}-WIDE CUT</small><small class="upgrade-next-readout">NEXT: ${DRILL_TIERS[drillVisualTier(lv + 1) - 1]!.name.toUpperCase()} · ${drillReachTiles(lv + 1).toFixed(1)} TILE REACH · ${drillWidth(lv + 1)}-WIDE CUT</small>`
          : '';
        return `<div class="upgrade-row"><span class="upgrade-icon">${u.icon}</span><div><b>${u.name.toUpperCase()} <small>${levelLabel}</small></b><p>${benefit}</p>${drillReadout}${gateLocked ? `<small class="upgrade-gate">LOCKED · ${gate} REQUIRED</small>` : ''}<div class="level-pips" aria-label="${progressPips} of 5 steps in this upgrade tier">${u.values.map((_, i) => `<i class="${i < progressPips ? 'filled' : ''}"></i>`).join('')}</div></div><div class="purchase"><button id="buy-${k}" ${p.money < nextCost || gateLocked ? 'disabled' : ''}>${grappleLocked ? 'INSTALL' : gateLocked ? 'LOCKED' : `$${nextCost} ↑`}</button>${gateLocked ? '' : p.money < nextCost ? `<small>Need $${shortfall} more</small>` : grappleLocked ? `<small>$${nextCost}</small>` : ''}</div></div>`;
      }).join('')}</div><div class="tool-purchase"><div><b>MINING CHARGES · ${p.charges} READY</b><small>Q drops a charge under gravity with a ${CHARGE.fuseSeconds.toFixed(1)}s fuse. Clears up to 13 tiles; ore drops persist until collected. The blast can open ground below you.</small></div><button id="buy-charges" ${p.money < CHARGE.packCost ? 'disabled' : ''}>${p.money < CHARGE.packCost ? `NEED $${CHARGE.packCost - p.money}` : `+${CHARGE.packSize} · $${CHARGE.packCost}`}</button></div><div class="tool-purchase"><div><b>SALVAGE MAGNET · ${p.salvageMagnet ? 'INSTALLED' : 'OPTIONAL ADD-ON'}</b><small>${p.salvageMagnet ? `Active · reels charge-freed ore from up to ${SALVAGE_MAGNET.radius} px through open tunnels. Cargo capacity still applies.` : `Automatically reels charge-freed ore from up to ${SALVAGE_MAGNET.radius} px through open tunnels. Cargo capacity still applies.`}</small></div><button id="buy-magnet" ${p.salvageMagnet || p.money < SALVAGE_MAGNET.cost ? 'disabled' : ''}>${p.salvageMagnet ? 'INSTALLED' : p.money < SALVAGE_MAGNET.cost ? `NEED $${SALVAGE_MAGNET.cost - p.money}` : `INSTALL · $${SALVAGE_MAGNET.cost}`}</button></div><section class="specialization-section" aria-label="Pilot specialization"><h3>CHOOSE YOUR PILOT PATH</h3><p>Set up for your next expedition. Paths are free to switch while docked.</p><div class="specialization-grid">${specializationCards}</div></section>`;
      const stasisCard = `<div class="tool-purchase"><div><b>STASIS MODULE · ${p.stasisModule ? 'INSTALLED' : 'OPTIONAL ADD-ON'}</b><small>${p.stasisModule ? `Hold X underground to cancel gravity while airborne. Uses ${STASIS_MODULE.fuelPerSecond} L/s; horizontal steering still works.` : `Freeze your fall underground by holding X. Uses ${STASIS_MODULE.fuelPerSecond} L/s; horizontal steering still works.`}</small></div><button id="buy-stasis" ${p.stasisModule || p.money < STASIS_MODULE.cost ? 'disabled' : ''}>${p.stasisModule ? 'INSTALLED' : p.money < STASIS_MODULE.cost ? `NEED $${STASIS_MODULE.cost - p.money}` : `INSTALL · $${STASIS_MODULE.cost}`}</button></div>`;
      const winchCard = `<div class="tool-purchase"><div><b>SURFACE WINCH · ${p.returnWinch ? 'INSTALLED' : 'OPTIONAL ADD-ON'}</b><small>${p.returnWinch ? `Hold R underground to reel upward ${RETURN_WINCH.pullMultiplier.toFixed(1)}× faster. Active pull uses ${RETURN_WINCH.fuelMultiplier.toFixed(1)}× thrust fuel and needs an open shaft.` : `A faster way home: hold R to reel upward ${RETURN_WINCH.pullMultiplier.toFixed(1)}× faster through open tunnels. Uses ${RETURN_WINCH.fuelMultiplier.toFixed(1)}× thrust fuel while pulling.`}</small></div><button id="buy-return-winch" ${p.returnWinch || p.money < RETURN_WINCH.cost ? 'disabled' : ''}>${p.returnWinch ? 'INSTALLED' : p.money < RETURN_WINCH.cost ? `NEED $${RETURN_WINCH.cost - p.money}` : `INSTALL · $${RETURN_WINCH.cost}`}</button></div>`;
      const escapeSuitCard = `<div class="tool-purchase"><div><b>EMERGENCY ESCAPE SUIT · ${p.escapeSuit ? 'PACKED' : 'ONE USE'}</b><small>${p.escapeSuit ? 'If the miner is destroyed, eject with an independent rocket pack. A / D steer, W boosts, and Q still drops charges. Reach the surface or a built service beacon; drilling is disabled.' : `One-use crash backup: hull failure ejects you in a protected suit with its own jetpack. Reach a surface dock or service beacon to survive. $${ESCAPE_SUIT.cost}.`}</small></div><button id="buy-escape-suit" ${p.escapeSuit || p.money < ESCAPE_SUIT.cost ? 'disabled' : ''}>${p.escapeSuit ? 'PACKED' : p.money < ESCAPE_SUIT.cost ? `NEED $${ESCAPE_SUIT.cost - p.money}` : `PACK · $${ESCAPE_SUIT.cost}`}</button></div>`;
      content = content.replace('<div class="tool-purchase"><div><b>MINING CHARGES', `${stasisCard}${winchCard}<div class="tool-purchase"><div><b>MINING CHARGES`);
      content = content.replace('<section class="specialization-section"', `${escapeSuitCard}<section class="specialization-section"`);
    } else if (name === 'archive') {
      title = 'Signals worth following.';
      sub = 'EXPEDITION ARCHIVE / OUTPOST 07';
      const deepSignalStatus = p.artifact
        ? 'RECOVERED · $500 BOUNTY CLAIMED'
        : p.maxDepth >= 1050
          ? 'DEPTH LEAD RECORDED · SIGNAL NOT RECOVERED'
          : 'UNRESOLVED · SURVEY BELOW 1,050 M';
      const deepSignalDetail = p.artifact
        ? 'The buried transmission is logged in the archive. Its one-time survey bounty has been paid.'
        : p.maxDepth >= 1050
          ? 'A deep scan reached the signal band, but the transmission has not been recovered yet.'
          : 'A transmission older than the outpost may be waiting beyond the known survey depth.';
      const hashCount = NAVIGATION_HASHES.filter((hash) => p.milestones.includes(hash.id)).length;
      const coreSurvey = coreSurveyProgress(p.milestones);
      const coreCount = coreSurvey.records.filter((entry) => entry.recovered).length;
      const mapRecords = campaignMapRecords(this.getMapDepths(), p.routeFragments, p.milestones);
      const crewConclusion = crewArchiveRestored(p.milestones)
        ? `<article class="archive-entry found" id="crew-archive-conclusion"><span>CREW ARCHIVE RESTORED · FINAL ENTRY</span><b>${CREW_ARCHIVE_CONCLUSION.title}</b><blockquote class="crew-log"><span>${CREW_ARCHIVE_CONCLUSION.author} · ${CREW_ARCHIVE_CONCLUSION.role}</span>${CREW_ARCHIVE_CONCLUSION.transcript}</blockquote></article>`
        : `<article class="archive-entry" id="crew-archive-conclusion"><span>CREW ARCHIVE INCOMPLETE · ${hashCount} / ${NAVIGATION_HASHES.length}</span><b>UNRESOLVED CREW ARCHIVE</b><p>Recover each regional navigation hash to reconstruct the flight crew's final message.</p></article>`;
      const coreConclusion = coreSurvey.conclusion
        ? `<article class="archive-entry found" id="core-survey-conclusion"><span>PLANETARY CORE LEDGER COMPLETE · ${CORE_RELICS.length} / ${CORE_RELICS.length}</span><b>${coreSurvey.conclusion.title}</b><blockquote class="crew-log">${coreSurvey.conclusion.transcript}</blockquote></article>`
        : `<article class="archive-entry" id="core-survey-conclusion"><span>PLANETARY CORE LEDGER · ${coreCount} / ${CORE_RELICS.length}</span><b>CORE SURVEY INCOMPLETE</b><p>Recover one unique core record from each destination. Every sample pays a one-time archive salvage claim.</p></article>`;
      const coreRecords = coreSurvey.records.map(({ relic, recovered }) =>
        `<article class="archive-entry ${recovered ? 'found' : ''}" id="${relic.id}"><span>${recovered ? `RECOVERED · $${relic.bounty} CLAIM PAID` : `${MAPS[relic.mapId].name.toUpperCase()} · CORE SEALED`}</span><b>${relic.name.toUpperCase()}</b><p>${recovered ? relic.record : 'A unique planetary record remains sealed at the core. Recover the sample to decode it.'}</p></article>`,
      ).join('');
      const regionRecords = `<section class="region-records" aria-label="Regional survey records"><h3>REGIONAL SURVEY RECORDS</h3><div class="region-record-grid">${mapRecords.map((record) => `<article class="archive-entry ${record.visited ? 'found' : ''}" data-map-record="${record.id}"><span>${record.visited ? 'SURVEY RECORDED' : 'NOT VISITED'}</span><b>${record.name.toUpperCase()}</b><p>${record.visited ? `Deepest scan: ${record.deepestMeters.toLocaleString()} m` : 'No depth record yet'}${record.routeTotal ? `<br>${record.routeRecovered} / ${record.routeTotal} route signals` : ''}<br>${record.hashesRecovered} / ${record.hashTotal} archive hash${record.hashTotal === 1 ? '' : 'es'}<br>CORE · ${record.coreRecovered ? 'RECOVERED' : 'SEALED'} · ${record.coreName}</p></article>`).join('')}</div></section>`;
      content = `<p>Recovered route data: <b>${p.routeFragments.length} / ${ROUTE_FRAGMENTS.length} fragments</b>. Optional navigation hashes: <b>${hashCount} / ${NAVIGATION_HASHES.length}</b> · no cash value. Planetary cores: <b>${coreCount} / ${CORE_RELICS.length}</b>. Deepest scan: <b>${Math.floor(p.maxDepth)} m</b>. Each route signal carries a one-time salvage claim for a long-range ship component.</p>${regionRecords}<div class="archive-list">${coreConclusion}${coreRecords}<article class="archive-entry ${p.artifact ? 'found' : ''}" id="deep-signal-record"><span>${deepSignalStatus}</span><b>UNKNOWN DEEP SIGNAL</b><p>${deepSignalDetail}</p></article>${ROUTE_FRAGMENTS.map((fragment) => {
        const found = p.routeFragments.includes(fragment.id);
        return `<article class="archive-entry ${found ? 'found' : ''}"><span>${found ? 'RECOVERED · CLAIM PAID' : `DEPTH ${fragment.row * 12} M · +$${ROUTE_SURVEY_REWARDS[fragment.id]} CLAIM`}</span><b>${fragment.landmark}</b><p>${fragment.title} — ${found ? fragment.detail : 'A luminous data seam is waiting in this chamber.'}</p></article>`;
      }).join('')}${NAVIGATION_HASHES.map((hash) => {
        const found = p.milestones.includes(hash.id);
        return `<article class="archive-entry ${found ? 'found' : ''}" id="${hash.id}"><span>${found ? 'RECOVERED · OFFLINE COLLECTIBLE' : `${MAPS[hash.mapId].name.toUpperCase()} · ${hash.row * 12} M · OPTIONAL`}</span><b>${hash.name} · ${found ? hash.hash : 'HASH UNRESOLVED'}</b>${found ? `<blockquote class="crew-log"><span>${hash.crew} · ${hash.role}</span>${hash.transcript}</blockquote>` : ''}<p>${found ? hash.detail : 'A fictional navigation checksum is encoded in a deep-rock signal seam.'} · No exchange value.</p></article>`;
      }).join('')}${crewConclusion}</div>`;
    } else if (name === 'shipyard') {
      title = p.shipComplete ? 'The long-range craft is ready.' : 'Build the launch craft.';
      sub = 'SHIPYARD / SURFACE HAB';
      content = `<p>Each route signal pays a one-time claim matching one ship system. Signal claims and ore-sale credits share one balance, which can also be spent on services and upgrades.</p><div class="ship-list">${Object.entries(SHIP_COMPONENTS).map(([key, item]) => {
        const built = p.shipComponents.includes(key);
        const signal = ROUTE_FRAGMENTS.find((fragment) => ROUTE_SHIP_COMPONENTS[fragment.id] === key)!;
        const recovered = p.routeFragments.includes(signal.id);
        return `<div class="service-row"><div><b>${item.name.toUpperCase()}</b><small>${built ? 'INSTALLED' : `${item.description}<br>${recovered ? `SIGNAL CLAIM RECEIVED · +$${ROUTE_SURVEY_REWARDS[signal.id]}` : `SIGNAL CLAIM · +$${ROUTE_SURVEY_REWARDS[signal.id]} AT ${signal.landmark.toUpperCase()} · ${signal.row * 12} M`}`}</small></div><button id="ship-${key}" ${built || p.money < item.cost ? 'disabled' : ''}>${built ? 'INSTALLED' : `$${item.cost} →`}</button></div>`;
      }).join('')}</div>${p.shipComplete ? '<div class="sale-total"><span>SHIP STATUS</span><b>CRAFT ASSEMBLED · REGIONS AVAILABLE</b></div>' : `<p class="fine">${p.shipComponents.length} / ${Object.keys(SHIP_COMPONENTS).length} components installed. A complete craft unlocks free travel to charted regions.</p>`}`;
    } else if (name === 'destinations') {
      title = 'Choose the next descent.';
      sub = 'DESTINATION BOARD / LONG-RANGE CRAFT';
      const postedMaps = this.actions.tradePostMaps(), routeEdges = tradeRouteEdges(postedMaps), positions = VESPER_SYSTEM_POSITIONS,
        relay = vesperRelayProgress(p.milestones), relayOnline = p.milestones.includes(VESPER_RELAY_PROJECT.completionMilestone),
        tug = cargoTugProgress(p.milestones), tugStage = tug.next;
      const routeSvg = `<svg class="trade-route-chart" viewBox="0 0 100 100" role="img" aria-label="${postedMaps.length} of ${Object.keys(MAPS).length} planetary Trading Posts connected${relayOnline ? ' through the restored Vesper Relay' : ''}"><g class="trade-route-lines">${routeEdges.map(({ from, to }) => `<line x1="${positions[from].x}" y1="${positions[from].y}" x2="${positions[to].x}" y2="${positions[to].y}" />`).join('')}${relayOnline ? postedMaps.map((id) => `<line class="relay-link" x1="50" y1="50" x2="${positions[id].x}" y2="${positions[id].y}" />`).join('') : ''}</g>${(Object.keys(MAPS) as MapId[]).map((id) => `<g class="trade-route-node ${postedMaps.includes(id) ? 'online' : ''}" transform="translate(${positions[id].x} ${positions[id].y})"><circle r="3.4"/><text y="8">${MAPS[id].shortName}</text></g>`).join('')}${relayOnline ? '<g class="trade-route-node relay" transform="translate(50 50)"><path d="M0 -4 L4 0 L0 4 L-4 0 Z"/><text y="9">RELAY</text></g>' : ''}</svg>`;
      const projectStatus = relayOnline ? 'VESPER RELAY RESTORED · +5% LINKED-POST SALE PREMIUM.' : `RESTORE VESPER RELAY · ${relay.completedStages}/${relay.totalStages} STAGES · FUND ORE FROM PLANET WAREHOUSES.`;
      const tugStatus = tug.complete ? 'CARGO TUG ONLINE · REMOTE WITHDRAWALS AVAILABLE AT COLONY WAREHOUSES.'
        : `CARGO TUG · ${tug.completedStages}/${tug.totalStages} STAGES · ${tugStage?.label} AT ${tugStage ? MAPS[tugStage.mapId].name.toUpperCase() : 'NEXT COLONY'} · UNLOCK REMOTE WAREHOUSE ACCESS.`;
      content = `<p>${p.shipComplete ? 'The ship can reach charted regions. Each map keeps its own tunnels and discoveries.' : 'Assemble the launch craft to travel beyond this shelf.'}</p><div class="trade-network-overview">${routeSvg}<div><b>VESPER EXCHANGE · ${postedMaps.length}/${Object.keys(MAPS).length} COLONIES LINKED</b><span>${postedMaps.length < 2 ? 'BUILD A POST ON ANOTHER WORLD TO OPEN A ROUTE' : `${routeEdges.length} ROUTE${routeEdges.length === 1 ? '' : 'S'} ACTIVE · EACH NODE CONNECTS TO ITS NEAREST PARTNER`}</span><span class="relay-status">${projectStatus}</span><span class="relay-status">${tugStatus}</span></div></div><div class="destination-list">${(Object.keys(MAPS) as MapId[]).map((id) => {
        const unlocked = id === this.mapId || id === 'cryo-shelf' || p.shipComplete && (id !== 'vesper-9' || vesperChapterUnlocked(p.milestones));
        const current = id === this.mapId;
        const description = id === 'mars-frontier' ? 'Legacy frontier · persistent original-world saves' : id === 'cryo-shelf' ? 'Branching ice caverns · stable starter ores' : id === 'hull-graveyard' ? 'Wide wreck chambers · structural salvage' : id === 'vesper-9' ? 'Hidden return world · lantern groves and living crystal' : 'Narrow crystal seams · valuable deep deposits';
        const core = CORE_RELICS.find((entry) => entry.mapId === id)!;
        const objective = p.milestones.includes(core.id) ? `CORE RECORD LOGGED · ${core.name}` : `CORE OBJECTIVE · RECOVER ${core.name} · $${core.bounty} CLAIM`;
        const lockLabel = id === 'vesper-9' && !unlocked ? '5 CORES REQUIRED' : 'SHIP REQUIRED';
        return `<div class="service-row"><div><b>${MAPS[id].name.toUpperCase()}</b><small>${description}<br>${objective}</small></div><button id="map-${id}" ${!unlocked || current ? 'disabled' : ''}>${current ? 'CURRENT' : unlocked ? 'TRAVEL →' : lockLabel}</button></div>`;
      }).join('')}${p.shipComplete ? '' : '<p class="fine">Current destination remains available while the ship is being built.</p>'}</div>`;
    } else if (name === 'paints') {
      title = this.styleSection === 'paint' ? 'Make the pod yours.' : 'Suit up for the long haul.';
      sub = 'HAB 07 / VISUAL CUSTOMIZATION';
      const switcher = `<nav class="style-tabs" aria-label="Appearance category"><button id="style-paint" aria-pressed="${this.styleSection === 'paint'}">FINISH</button><button id="style-suit" aria-pressed="${this.styleSection === 'suit'}">SUIT</button><button id="style-decal" aria-pressed="${this.styleSection === 'decal'}">DECALS</button><button id="style-profile" aria-pressed="${this.styleSection === 'profile'}">PROFILE</button></nav>`;
      if (this.styleSection === 'paint') {
        const selected = POD_PAINTS[p.selectedPaint];
        content = `${switcher}<div class="paint-preview"><div class="paint-pod" style="--paint-hull:#${selected.hull.toString(16).padStart(6, '0')};--paint-trim:#${selected.trim.toString(16).padStart(6, '0')};--paint-light:#${selected.light.toString(16).padStart(6, '0')}"><i></i><b></b><span></span></div><div><small>ACTIVE FINISH</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_PAINT_KEYS.map((key) => {
          const item = POD_PAINTS[key], owned = p.ownedPaints.includes(key), active = p.selectedPaint === key;
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch" style="--paint-hull:#${item.hull.toString(16).padStart(6, '0')};--paint-trim:#${item.trim.toString(16).padStart(6, '0')}"><i></i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="paint-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · $${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Pod paint changes hull, trim, and beacon light only.</p>`;
      } else if (this.styleSection === 'suit') {
        const selected = PILOT_SUITS[p.selectedSuit];
        content = `${switcher}<div class="paint-preview"><div class="suit-preview" style="--suit-body:#${selected.body.toString(16).padStart(6, '0')};--suit-trim:#${selected.trim.toString(16).padStart(6, '0')}"><i></i><b></b><span></span><small></small></div><div><small>ACTIVE PILOT KIT</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${PILOT_SUIT_KEYS.map((key) => {
          const item = PILOT_SUITS[key], owned = p.ownedSuits.includes(key), active = p.selectedSuit === key;
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch suit-swatch" style="--paint-hull:#${item.body.toString(16).padStart(6, '0')};--paint-trim:#${item.trim.toString(16).padStart(6, '0')}"><i></i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="suit-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · $${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Suit colors appear in the cockpit and change no stats or handling.</p>`;
      } else if (this.styleSection === 'decal') {
        const selected = POD_DECALS[p.selectedDecal];
        const mark = selected.style === 'arrow' ? '↘' : selected.style === 'crest' ? '✦' : selected.style === 'prism' ? '◇' : '—';
        content = `${switcher}<div class="paint-preview"><div class="decal-preview-mark" style="--decal-color:#${selected.color.toString(16).padStart(6, '0')}">${mark}</div><div><small>ACTIVE MARKING</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_DECAL_KEYS.map((key) => {
          const item = POD_DECALS[key], owned = p.ownedDecals.includes(key), active = p.selectedDecal === key;
          const icon = item.style === 'arrow' ? '↘' : item.style === 'crest' ? '✦' : item.style === 'prism' ? '◇' : '—';
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch decal-swatch" style="--paint-hull:#${item.color.toString(16).padStart(6, '0')}"><i>${icon}</i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="decal-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · $${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Decals are applied to the pod hull and are visual only.</p>`;
      } else {
        const selected = POD_PROFILES[p.selectedProfile];
        const icon = selected.style === 'antenna' ? '⌁' : selected.style === 'stabilizers' ? '⋈' : selected.style === 'armor' ? '⬟' : '◉';
        content = `${switcher}<div class="paint-preview"><div class="profile-preview profile-${selected.style}"><i>${icon}</i><span style="--cabin-color:#${selected.cabin.toString(16).padStart(6, '0')}"></span></div><div><small>ACTIVE POD PROFILE</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_PROFILE_KEYS.map((key) => {
          const item = POD_PROFILES[key], owned = p.ownedProfiles.includes(key), active = p.selectedProfile === key;
          const glyph = item.style === 'antenna' ? '⌁' : item.style === 'stabilizers' ? '⋈' : item.style === 'armor' ? '⬟' : '◉';
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="profile-swatch profile-${item.style}" style="--cabin-color:#${item.cabin.toString(16).padStart(6, '0')}"><i>${glyph}</i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="profile-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'FITTED' : owned ? 'FIT →' : `BUY · $${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Profiles change the pod's rendered silhouette only. Collision and drill clearance stay the same.</p>`;
      }
    } else if (name === 'pause') {
      const exportControl = this.exportUrl
        ? `<a id="download-save" class="pause-download" aria-label="DOWNLOAD SAVE FILE" href="${this.exportUrl}" download="${this.exportFilename}">Download save file <span aria-hidden="true">↓</span></a>`
        : '<button id="export-save" aria-label="EXPORT SAVE">Export save <span aria-hidden="true">↧</span></button>';
      content = pauseScreen(p, this.mapId, this.currentDepth, this.docked, exportControl, this.pauseSaveStatus());
    } else if (name === 'import-confirm') {
      const d = this.pendingImport;
      if (!d) { this.modal = 'pause'; this.renderModal(); return; }
      title = 'Replace this expedition?';
      sub = 'IMPORT EXPEDITION SAVE';
      content = `<p>This will replace the save currently in this browser. Review the expedition before continuing.</p><div class="sale-total"><span>DESTINATION</span><b>${MAPS[d.activeMap].name.toUpperCase()}</b></div><div class="service-row"><div><b>CAMPAIGN STATUS</b><small>${Math.floor(d.maxDepth)} m deepest · $${Math.floor(d.money)} credits · ${d.routeFragments.length} route fragments</small></div></div><button id="confirm-import" class="primary danger">IMPORT & REPLACE SAVE</button><button id="cancel-import">CANCEL</button>`;
    } else if (name === 'rescue') {
      title = 'Leave the haul behind?';
      sub = 'EMERGENCY RECOVERY';
      content =
        '<p>Return to the surface with full fuel and hull. All unsold cargo is lost. Your money, upgrades, and mine are kept.</p><button id="confirm-rescue" class="primary">RECOVER POD →</button>';
    } else if (name === 'new') {
      title = 'Start a new frontier?';
      sub = 'REPLACE SAVED EXPEDITION';
      content =
        '<p>This replaces your current mine, credits, and upgrades with a new world seed. This cannot be undone.</p><button id="confirm-new" class="primary danger">START NEW EXPEDITION →</button>';
    } else if (name === 'failure') {
      const reason = this.actions.failureReason();
      title = reason === 'fuel' ? 'The reserve ran dry.' : reason === 'hull' ? 'The hull gave way.' : 'The planet keeps its share.';
      sub = reason === 'fuel' ? 'STRANDED · RECOVERY IS YOUR CHOICE' : reason === 'hull' ? 'MINER DISABLED · RECOVERY IS YOUR CHOICE' : 'PILOT NEEDS RESCUE · RECOVERY IS YOUR CHOICE';
      content = `<p>${reason === 'fuel' ? 'Your miner ran dry at this location. The tunnel and loose ore are still here. If you built a service beacon nearby, refuel and continue; otherwise recover when you are ready to abandon the unsold haul.' : reason === 'hull' ? 'Impact damage disabled the miner at this location. Your tunnel, loose ore, credits, and upgrades are safe. Recover the pilot when you are ready to leave this haul.' : 'The pilot cannot reach a safe dock. Your tunnel, loose ore, credits, and upgrades remain saved. Recover to the surface when you are ready to leave this haul.'}</p>${reason === 'fuel' && this.actions.serviceAccess() ? '<button id="service-all" class="primary">REFUEL AT THIS BEACON</button>' : ''}<button id="recover-stranded" class="${reason === 'fuel' && this.actions.serviceAccess() ? '' : 'primary'}">RECOVER TO SURFACE · FORFEIT UNSOLD CARGO</button>`;
    }
    document.querySelector('#modal-layer')!.innerHTML = name === 'pause' ? content :
      `<section class="modal ${['upgrades', 'archive', 'shipyard', 'destinations', 'paints', 'construction'].includes(name) ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${sub}"><button class="close" id="close" aria-label="Close panel">×</button><header class="modal-head"><div class="eyebrow">${sub}</div><h2>${title}</h2></header><div class="modal-body">${['sell', 'service', 'upgrades'].includes(name) && this.nearSurface ? `<nav class="outpost-tabs" aria-label="Outpost services">${['sell', 'service', 'upgrades'].map((k) => `<button id="tab-${k}" aria-pressed="${name === k}">${k === 'sell' ? 'Sell ore' : k === 'service' ? 'Service' : 'Upgrades'}</button>`).join('')}</nav>` : ''}${content}</div><div class="modal-bank"><span>AVAILABLE CREDIT</span><b>$${p.money.toLocaleString()}</b></div></section>`;
    for (const k of ['sell', 'service', 'upgrades']) this.on(`tab-${k}`, () => this.open(k));
    this.on('style-paint', () => { this.styleSection = 'paint'; this.renderModal(); });
    this.on('style-suit', () => { this.styleSection = 'suit'; this.renderModal(); });
    this.on('style-decal', () => { this.styleSection = 'decal'; this.renderModal(); });
    this.on('style-profile', () => { this.styleSection = 'profile'; this.renderModal(); });
    for (const channel of ['music', 'effects'] as const) {
      const slider = document.querySelector<HTMLInputElement>(`#${channel}-volume`);
      slider?.addEventListener('input', () => {
        const value = Number(slider.value);
        document.querySelector(`#${channel}-value`)!.textContent = `${value}%`;
        this.actions.setAudioMix(channel, value);
      });
    }
    this.on('audio-mute', () => {
      this.updateMuteButton(this.actions.mute());
      this.renderModal();
    });
    this.on('atmosphere-toggle', () => {
      this.actions.setAtmosphereEnabled(!this.actions.atmosphereEnabled());
      this.renderModal();
      document.getElementById('atmosphere-toggle')?.focus();
    });
    this.on('service-all', () => {
      this.actions.serviceAll();
      this.renderModal();
    });
    for (const kind of ['platform', 'service'] as const) this.on(`build-${kind}`, () => {
      if (this.actions.buildStructure(kind)) this.toast(kind === 'service' ? 'Refuel beacon built. E opens the underground service stop.' : 'Anchor deck built. It catches the pod under local gravity.');
      else this.toast('Build site blocked. Clear a five-tile cavern and move away from other structures.');
      this.renderModal();
    });
    if (this.nearSurface) for (const structure of this.actions.structures().filter((entry) =>
      ['habitat', 'turret', 'wall', 'gate'].includes(entry.kind) && (entry.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity)) {
      this.on(`repair-${encodeURIComponent(structure.id)}`, () => {
        if (this.actions.repairStructure(structure.id)) this.toast('COLONY DEFENSE REPAIRED · FULL INTEGRITY RESTORED.');
        else this.toast(`REPAIR NEEDS $${SURFACE_RAID.repairCredits} AND A SURFACE BUILD YARD.`);
        this.renderModal();
      });
    }
    this.on('build-trade-post', () => {
      if (this.actions.buildStructure('trade-post')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('BUILD MODE · Move the pointer to a surface site. Click or press Enter to build; Escape cancels.');
          return;
        }
        this.toast('Trading post established. Build another on a different planet to link the exchange.');
      } else this.toast('Trading post needs the listed ore and credits, and can be built once per planet at the surface.');
      this.renderModal();
    });
    this.on('build-warehouse', () => {
      if (this.actions.buildStructure('warehouse')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('BUILD MODE · Move the pointer to a clear surface site. Click or press Enter to build; Escape cancels.');
          return;
        }
        this.toast('Ore warehouse online. Press E nearby to manage this planet’s stock.');
      } else this.toast('Warehouse needs the listed ore and credits, and can be built once per planet at a clear surface site.');
      this.renderModal();
    });
    for (const kind of ['wall', 'gate'] as const) this.on(`build-${kind}`, () => {
      if (this.actions.buildStructure(kind)) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('BUILD MODE · Place this perimeter piece along the crust. Click or press Enter to confirm; Escape cancels.');
          return;
        }
        this.toast(kind === 'wall' ? 'PERIMETER WALL BUILT · Raiders must breach it.' : 'SECURITY GATE BUILT · It opens for your miner.');
      } else this.toast('Surface defense needs the listed materials and a clear crust site.');
      this.renderModal();
    });
    this.on('build-habitat', () => {
      if (this.actions.buildStructure('habitat')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('BUILD MODE · Move the pointer to a surface site. Click or press Enter to build; Escape cancels.');
          return;
        }
        this.toast('Colony habitat online. Press E nearby to service the miner.');
      } else this.toast('Habitat needs the listed ore and credits, plus an open surface site.');
      this.renderModal();
    });
    this.on('build-turret', () => {
      if (this.actions.buildStructure('turret')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('BUILD MODE · Move the pointer to a surface site. Click or press Enter to build; Escape cancels.');
          return;
        }
        this.toast('Sentry online. It intercepts rock swimmers that enter range.');
      } else this.toast('Build site blocked. Clear the cavern and move away from other structures.');
      this.renderModal();
    });
    this.on('buy-stasis', () => {
      if (this.actions.buyStasis()) this.toast('Stasis module installed. Hold X underground to hover; fuel drains while active.');
      this.renderModal();
    });
    this.on('buy-return-winch', () => {
      if (this.actions.buyReturnWinch()) this.toast('Surface winch installed. Hold R in an open shaft to reel upward faster; fuel cost rises while active.');
      this.renderModal();
    });
    this.on('buy-escape-suit', () => {
      if (this.actions.buyEscapeSuit()) this.toast('Escape suit packed. If the miner is destroyed, pilot controls switch to jetpack flight.');
      this.renderModal();
    });
    this.on('close', () => this.close());
    this.on('resume', () => this.actions.resume());
    this.on('recover-stranded', () => { if (!this.actions.recoverStranded()) this.toast('The miner is no longer stranded.'); });
    this.on('save', () => this.actions.save());
    this.on('export-save', () => {
      const save = this.actions.exportSave();
      if (!save) { this.toast('Save could not be exported.'); return; }
      if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
      const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      this.exportUrl = URL.createObjectURL(blob);
      this.exportFilename = `cold-signal-${save.campaignSeed}.json`;
      this.renderModal();
      document.getElementById('download-save')?.focus();
      this.toast('Save prepared. Activate Download Save File to keep a copy.');
    });
    this.on('import-save', () => document.querySelector<HTMLInputElement>('#save-import-input')!.click());
    this.on('confirm-import', () => {
      if (this.pendingImport && this.actions.importSave(this.pendingImport)) {
        this.pendingImport = undefined;
      } else this.toast('Could not replace the saved expedition.');
    });
    this.on('cancel-import', () => { this.pendingImport = undefined; this.modal = 'pause'; this.renderModal(); });
    this.on('rescue', () => this.open('rescue'));
    this.on('new', () => this.open('new'));
    this.on('confirm-rescue', () => this.actions.rescue());
    this.on('confirm-new', () => this.actions.newGame());
    this.on('sell', () => {
      const receipt = this.actions.sell(this.selectedSaleBuyer), n = receipt?.total ?? 0;
      if (receipt) this.lastSale = receipt;
      this.renderModal();
      if (n) {
        document.querySelector('.sale-total span')!.textContent = 'CREDITS BANKED';
        const total = document.querySelector('.sale-total b')!;
        let start = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / 650);
          if (this.modal === 'sell') total.textContent = `+$${Math.round(n * (1 - (1 - t) ** 3))}`;
          if (t < 1) requestAnimationFrame(tick);
        };
        tick();
      }
    });
    this.on('warehouse-store', () => this.moveWarehouse('store'));
    this.on('warehouse-store-all', () => this.moveWarehouse('store', true));
    this.on('warehouse-withdraw', () => this.moveWarehouse('withdraw'));
    this.on('warehouse-withdraw-all', () => this.moveWarehouse('withdraw', true));
    this.on('fund-relay', () => {
      this.actions.contributeSystemProject();
      this.renderModal();
    });
    this.on('fund-tug', () => {
      this.actions.contributeCargoTug();
      this.renderModal();
    });
    for (const k of ['fuel', 'hull'] as const)
      this.on(`service-${k}`, () => {
        this.actions.service(k);
        this.renderModal();
      });
    for (const k of UPGRADE_KEYS)
      this.on(`buy-${k}`, () => {
        this.actions.buy(k);
        this.renderModal();
      });
    for (const key of SPECIALIZATION_KEYS)
      this.on(`specialization-${key}`, () => {
        this.actions.selectSpecialization(key);
        this.renderModal();
      });
    this.on('buy-charges', () => {
      if (this.actions.buyCharges()) this.toast(`${CHARGE.packSize} mining charges added to the pod.`);
      this.renderModal();
    });
    this.on('buy-magnet', () => {
      if (this.actions.buyMagnet()) this.toast('Salvage magnet installed. Loose charge ore will reel in through open tunnels.');
      this.renderModal();
    });
    for (const key of Object.keys(SHIP_COMPONENTS) as ShipComponent[])
      this.on(`ship-${key}`, () => {
        this.actions.buildShipComponent(key);
        this.renderModal();
      });
    for (const key of POD_PAINT_KEYS) this.on(`paint-${key}`, () => {
      if (this.p.ownedPaints.includes(key)) this.actions.selectPaint(key);
      else this.actions.buyPaint(key);
      this.renderModal();
    });
    for (const key of PILOT_SUIT_KEYS) this.on(`suit-${key}`, () => {
      if (this.p.ownedSuits.includes(key)) this.actions.selectSuit(key);
      else this.actions.buySuit(key);
      this.renderModal();
    });
    for (const key of POD_DECAL_KEYS) this.on(`decal-${key}`, () => {
      if (this.p.ownedDecals.includes(key)) this.actions.selectDecal(key);
      else this.actions.buyDecal(key);
      this.renderModal();
    });
    for (const key of POD_PROFILE_KEYS) this.on(`profile-${key}`, () => {
      if (this.p.ownedProfiles.includes(key)) this.actions.selectProfile(key);
      else this.actions.buyProfile(key);
      this.renderModal();
    });
    for (const id of Object.keys(MAPS) as MapId[])
      this.on(`map-${id}`, () => {
        if (this.actions.travelMap(id)) this.close();
      });
    document.querySelector<HTMLSelectElement>('#sale-buyer')?.addEventListener('change', (event) => {
      const buyer = (event.currentTarget as HTMLSelectElement).value as MapId;
      if (this.actions.tradePostMaps().includes(buyer)) this.selectedSaleBuyer = buyer;
      this.renderModal();
    });
    document.querySelector<HTMLSelectElement>('#warehouse-source')?.addEventListener('change', (event) => {
      const selected = (event.currentTarget as HTMLSelectElement).value as MapId;
      if (this.actions.warehouseMaps().includes(selected)) this.warehouseSourceMap = selected;
      this.renderModal();
    });
    const previousFocus = previousFocusId ? document.getElementById(previousFocusId) : null;
    (
      (previousFocus instanceof HTMLElement && !previousFocus.hasAttribute('disabled') ? previousFocus : null) ??
      (document.querySelector('.modal .primary:not(:disabled)') ??
        document.querySelector('.modal button:not(.close):not(:disabled)') ??
        document.querySelector('.close')) as HTMLElement
    )?.focus();
  }
  toast(text: string) {
    const el = document.querySelector('#toast')!;
    el.textContent = text;
    el.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('visible'), 3500);
  }
  saved(ok: boolean) {
    this.saveFailed = !ok;
    if (ok) this.savedAt = Date.now();
    document.querySelector('#save-status')!.textContent = ok
      ? 'LOCAL SAVE · JUST SAVED'
      : 'LOCAL SAVE · FAILED';
    const pauseStatus = document.getElementById('pause-save-state');
    if (pauseStatus) pauseStatus.textContent = this.pauseSaveStatus();
  }
  private pauseSaveStatus() {
    if (this.saveFailed) return 'Save failed. Export a copy before leaving.';
    if (!this.savedAt) return this.loaded ? 'Expedition loaded from this device.' : 'Your expedition is stored on this device.';
    const seconds = Math.max(0, Math.floor((Date.now() - this.savedAt) / 1000));
    return seconds < 5 ? 'Saved on this device · just now' : `Saved on this device · ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago`;
  }
  update(depth: number, surface: boolean, dt: number, docked = false, returnFuel = 0, descentSpeed = 0, farHemisphere = false, pilotEscaping = false, coreDepth = CORE.depthMeters,
    returnWinch = false, reeling = false, winchCableConnected = false, laserHeat = 0, laserVent = 0, laserTier = false, planetSurface = surface) {
    const p = this.p;
    this.nearSurface = surface;
    this.onCrust = planetSurface;
    this.currentDepth = depth;
    this.docked = docked;
    for (const k of ['fuel', 'hull'] as const) {
      const ratio = p[k] / p.max(k);
      document.querySelector(`#${k}-label`)!.textContent =
        k === 'fuel' ? `${Math.ceil(p.fuel)} / ${p.max('fuel')} L` : pilotEscaping ? 'EJECTED' : `${Math.ceil(ratio * 100)}%`;
      const bar = document.querySelector(`#${k}-bar`) as HTMLElement;
      bar.style.width = `${ratio * 100}%`;
      bar.classList.toggle('low', ratio < 0.25);
    }
    const estimate = document.querySelector<HTMLElement>('#return-estimate')!;
    const winchFuel = estimateWinchReturnFuel(returnFuel), requiredFuel = returnWinch ? winchFuel : returnFuel;
    estimate.textContent = planetSurface ? '' : returnWinch
      ? winchCableConnected ? `WINCH · ~${winchFuel} L · ${reeling ? 'REELING' : 'HOLD R'}` : 'WINCH BLOCKED · CLEAR SHAFT'
      : `RETURN EST. ~${returnFuel} L · ROUTE EXTRA`;
    estimate.title = planetSurface ? '' : returnWinch
      ? winchCableConnected ? `Estimated Surface Winch fuel: about ${winchFuel} L. Hold R to reel up the clear shaft.` : 'The Surface Winch needs a clear radial shaft to the surface.'
      : `Estimated thrust fuel to return: about ${returnFuel} L. Route detours require extra fuel.`;
    estimate.classList.toggle('tight', !planetSurface && p.fuel < requiredFuel * 1.4);
    document.querySelector('#cargo-label')!.textContent = `${p.count} / ${p.max('cargo')}`;
    document.querySelector('#cargo-blocks')!.innerHTML = Array.from(
      { length: 16 },
      (_, i) => `<i class="${i < Math.ceil((p.count / p.max('cargo')) * 16) ? 'filled' : ''}"></i>`,
    ).join('');
    document.querySelector('#cargo-worth')!.textContent = p.count
      ? `HAUL VALUE  $${p.cargoValue}`
      : 'CARGO BAY EMPTY';
    document.querySelector('#charge-count')!.textContent = String(p.charges);
    document.querySelector('#tool-stock')!.classList.toggle('hidden', p.charges <= 0);
    const laserMeter = document.querySelector<HTMLElement>('#laser-thermal')!;
    laserMeter.classList.toggle('hidden', !laserTier || (laserHeat <= 0 && laserVent <= 0));
    laserMeter.classList.toggle('venting', laserVent > 0);
    document.querySelector('#laser-thermal-label')!.textContent = laserVent > 0 ? 'EMITTER VENTING · DRILL PAUSED' : 'LASER HEAT · RELEASE TO COOL';
    document.querySelector('#laser-thermal-value')!.textContent = laserVent > 0 ? `${laserVent.toFixed(1)}s` : `${Math.round(laserHeat * 100)}%`;
    const laserBar = document.querySelector<HTMLElement>('#laser-thermal-bar')!;
    laserBar.style.width = `${laserVent > 0 ? laserVent / LASER_THERMAL.ventSeconds * 100 : laserHeat * 100}%`;
    laserBar.title = 'Continuous cutting builds heat. Release the drill to cool; a full emitter vents briefly.';
    document.querySelector('#depth')!.textContent = String(depth);
    document.querySelector('#record')!.textContent = `${Math.floor(p.maxDepth)}m`;
    document.querySelector('#zone')!.textContent = MAPS[this.mapId].shortName;
    const coreRecords = p.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id));
    const townTier = surfaceTownTier(p.shipComponents, coreRecords);
    document.querySelector('#town-status')!.textContent = [
      'PROSPECTOR CAMP · TIER 0', 'YARD EXPANSION · TIER 1', 'SKY DISTRICT · TIER 2',
      'CORE SKYWAY · TIER 3', 'BEACON TOWN · TIER 4',
    ][townTier]!;
    document.querySelector('#depth-note')!.textContent = planetSurface
      ? 'SURFACE OPERATIONS'
      : stratumAt(depth, this.mapId);
    const gravityNote = document.querySelector<HTMLElement>('#gravity-note')!;
    gravityNote.textContent = farHemisphere
      ? 'FAR HEMISPHERE · W CLIMBS OUTWARD'
      : depth >= coreDepth - 120
        ? 'CORE PASSAGE · COAST THROUGH THE TURN'
        : '';
    gravityNote.classList.toggle('active', !!gravityNote.textContent);
    this.displayedMoney += (p.money - this.displayedMoney) * Math.min(1, dt * 9);
    if (Math.abs(p.money - this.displayedMoney) < 1) this.displayedMoney = p.money;
    document.querySelector('#money')!.textContent =
      `$${Math.round(this.displayedMoney).toLocaleString()}`;
    document.querySelector('#station-dock')!.classList.toggle('hidden', !surface);
    this.updateMissionTip();
    if (this.savedAt && !this.saveFailed)
      document.querySelector('#save-status')!.textContent =
        `LOCAL SAVE · ${Math.floor((Date.now() - this.savedAt) / 1000)}s AGO`;
    document.querySelector('#low-warning')!.textContent = pilotEscaping ? 'ESCAPE SUIT ACTIVE · A / D STEER · W BOOSTS · REACH A SURFACE OR BEACON' : flightWarning({
      surface: planetSurface,
      fuelRatio: p.fuel / p.max('fuel'),
      hullRatio: p.hull / p.max('hull'),
      descentSpeed,
      cargoFull: p.count >= p.max('cargo'),
    });
  }
  private updateMissionTip() {
    const tip = document.querySelector<HTMLElement>('#tip')!;
    const visible = this.hasStarted && !this.paused && !this.modal;
    tip.classList.toggle('hidden', !visible);
    if (!visible) return;
    const objective = campaignObjective(this.p, this.mapId, this.actions.tradeNetworkCount(), this.actions.hasTradePost()),
      signature = `${objective.title}\n${objective.body}`;
    if (signature === this.missionTipSignature) return;
    this.missionTipSignature = signature;
    tip.querySelector('#mission-headline')!.textContent = objective.title;
    tip.querySelector('#mission-body')!.textContent = objective.body;
  }
  setOrbitalOverview(active: boolean) {
    document.querySelector('#viewport')?.classList.toggle('orbital-overview-active', active);
  }
}
