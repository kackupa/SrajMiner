import { buildingArt } from './BuildingArt';
import { showTransit, arrivalMarkup } from './TravelPresentation';
import { freightView, bindFreight, initialFreight, bestOreOffer } from './FreightView';
import { cargoTotal, type InventorySource } from '../economy/Freight';
import { colonyOverview, buildingName } from './ColonyOverview';
import { colonyOrdersPanel } from './ColonyOrders';
import { colonyOrders } from '../economy/ColonyOrders';
import type { extractorStatus } from '../economy/ExtractionSeams';
import { rigWorkshop, type RigDepartment } from './RigWorkshop';
import { FRONTIER, PREBUILD } from '../config';
import { buildingCatalogue, BUILD_GROUPS, type BuildGroup } from './BuildingCatalogue';
import { planetaryMaterials } from '../building/PlanetaryMaterials';
import { starMapMarkup, bindStarMap } from './StarMap';
import { mobileTrade } from './MobileTrade';
import { mobileStorage } from './MobileStorage';
import { panelPages } from './PanelPages';
import { codexPanel } from './Codex';
import { atlasMarkup } from './PlanetArt';
import { tradeTerminal, type PlannedBuilding } from './TradeTerminal';
import { CIVILISATION_KEYS, CIVILISATIONS, type CivilisationId } from '../config';
import { podPortrait } from './PodPortrait';
import { CORE, CORE_RELICS, CORE_FUEL, EXTRACTOR_TIERS, vesperChapterUnlocked, ORES, ORE_KEYS, ORE_SILHOUETTES, UPGRADES, UPGRADE_KEYS, upgradeValue, upgradeGateLabel, SPECIALIZATIONS, SPECIALIZATION_KEYS, stratumAt, CAMPAIGN_MILESTONES, ROUTE_FRAGMENTS, ROUTE_SHIP_COMPONENTS, ROUTE_PART_RECOVERY_BONUS, NAVIGATION_HASHES, CREW_ARCHIVE_CONCLUSION, SHIP_COMPONENTS, MAPS, REGION_FINDS, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, DESCENT_WARNING_SPEED, LASER_THERMAL, SURFACE_RAID, TURRET_TIERS, estimateWinchReturnFuel, POD_PAINTS, POD_PAINT_KEYS, PILOT_SUITS, PILOT_SUIT_KEYS, POD_DECALS, POD_DECAL_KEYS, POD_PROFILES, POD_PROFILE_KEYS, drillWidth, drillReachTiles, drillVisualTier, DRILL_TIERS, UNDERGROUND_BUILDING, type Upgrade, type MapId, type Ore, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from '../config';
import { extractorOreEligibility } from '../building/UndergroundStructures';
import { parseSaveFile, type SaveData } from '../save/SaveManager';
import { Progress, emptyCargo, type Cargo } from '../economy/Progress';
import { quoteCivilianShipment } from '../economy/Civilisations';
import type { SaleReceipt } from '../economy/Sale';
import type { Tile } from '../world/TileWorld';
import type { TileWorld } from '../world/TileWorld';
import type { PlayerPod } from '../player/PlayerPod';
import type { AudioMix } from '../audio/AudioSystem';
import { campaignMapRecords, coreSurveyProgress, crewArchiveRestored } from '../campaign/Records';
import { surfaceTownTier } from '../surface/SurfaceStation';
import { structureIntegrity, turretStats, canAffordStructure, type StructureKind, type UndergroundStructure } from '../building/UndergroundStructures';
import { ESCAPE_SUIT } from '../config';
import { wrapPlanetTile } from '../world/PlanetChart';
import { tradeNetworkPremium } from '../config';
import { tradeRouteEdges, VESPER_SYSTEM_POSITIONS } from '../economy/TradeNetwork';
import { contractReady, marketContract, marketDemand, marketDemandBonus } from '../economy/MarketContracts';
import type { WarehouseDirection } from '../economy/Warehouse';
import { CARGO_TUG_PROJECT, SURVEY_ARRAY_PROJECT, VESPER_RELAY_PROJECT, cargoTugProgress, surveyArrayProgress, vesperRelayProgress } from '../economy/SystemProjects';
import { pauseScreen } from './PauseScreen';
import { AccountPanel } from './AccountPanel';
import { onlineSignInErrorMessage } from '../online/AuthClient';
import { campDock, campShell, equipmentArt, servicePanel, workshopPanel, CAMP_MENUS, credits, type WorkshopSection } from './CampUI';
export const flightWarning = (input: {
  surface: boolean;
  inOrbit?: boolean;
  fuelRatio: number;
  hullRatio: number;
  descentSpeed: number;
  cargoFull: boolean;
}) => {
  if (input.surface) return '';
  if (input.inOrbit) return '';
  if (input.fuelRatio < 0.23) return 'LOW BATTERY: RETURN TO MOTHERSHIP';
  if (input.hullRatio < 0.25) return 'LOW HULL: THRUST TO BRAKE. RETURN FOR REPAIRS';
  if (input.descentSpeed >= DESCENT_WARNING_SPEED)
    return 'FAST DESCENT: HOLD W TO BRAKE BEFORE IMPACT';
  if (input.cargoFull) return 'CARGO FULL: RETURN TO UNLOAD';
  return '';
};
export function campaignObjective(p: Progress, mapId: MapId, tradePostCount = 0, hasLocalTradePost = false, inOrbit = false, mothershipBoarded = false) {
  if (p.pilotEscaping) return { title: 'RETURN TO SAFETY', body: 'Reach the surface or a repair station to recover your rig.' };
  if (!PREBUILD.travelEnabled) return { title: 'BUILD YOUR MINING OPERATION', body: 'Upgrade with common ores. Recover the core, load the ship and establish your Mars colony.' };
  if (inOrbit) return { title: 'CHOOSE YOUR NEXT PLANET', body: 'Select a world and check the core-fuel cost before travelling.' };
  const core = CORE_RELICS.find(r => r.mapId === mapId)!;
  if (!p.milestones.includes(core.id)) return { title: 'MINE THE PLANETARY CORE', body: 'Your mothership needs core fuel to leave. Drill toward the center. Return to the ship whenever your rig needs recharging.' };
  return { title: 'EXPLORE ANOTHER WORLD', body: `Core fuel ready: ${p.coreFuel.toFixed(2)}. Board with E, choose Pilot mothership, then hold W to take off. Build an uplink on each planet to sell its ore.` };
}

export function drawOreSymbol(ctx: CanvasRenderingContext2D, ore: keyof typeof ORES, x: number, y: number, size: number) {
  const half = size / 2;
  ctx.beginPath();
  switch (ORE_SILHOUETTES[ore]) {
    case 'hexagons':
    case 'snowflakes': {
      const star=ore==='cryocrystal', count=star?12:6;
      for(let i=0;i<count;i++) { const angle=i*Math.PI*2/count, r=star&&i%2?half*.35:half;
        const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();ctx.fill();break;
    }
    case 'needles':
      ctx.fillRect(x-half,y-half,size*.25,size);
      ctx.fillRect(x+size*.15,y-size*.25,size*.2,size*.65);break;
    case 'crosses':
      ctx.fillRect(x-half,y-size*.15,size,size*.3);
      ctx.fillRect(x-size*.15,y-half,size*.3,size);break;
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
  locateBuilding: (id: string) => boolean;
  deliverColonyOrder: (id: string) => boolean;
  extractorStatus: (structure: UndergroundStructure) => ReturnType<typeof extractorStatus>;
  moveBuilding: (id: string) => boolean;
  dismantleBuilding: (id: string) => boolean;
  leaveShip: () => boolean;
  openShip: () => void;
  modeChanged: (paused: boolean) => void;
  serviceAll: () => boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  recoverStranded: () => boolean;
  save: () => void;
  shipCivilian: (buyer: CivilisationId, requested: Cargo, source?: InventorySource) => number;
  sell: (buyerMapId?: MapId) => SaleReceipt | undefined;
  service: (key: 'fuel' | 'hull') => boolean;
  buy: (key: Upgrade) => boolean;
  selectCharge: (id: string) => boolean;
  fitEquipment: (id: string) => string;
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
  travelMap: (id: MapId, recovery?: 'relocate' | 'tow') => boolean;
  installSpecialist: (module: import('../config').SpecialistModule) => boolean;
  arrivalSummary: () => string;
  travelReady: () => boolean;
  mapIntel: () => Record<MapId, import('../campaign/SolarSystem').SolarPlanetIntel>;
  buildStructure: (kind: StructureKind) => boolean;
  undergroundBuildReason?: (kind: StructureKind) => string;
  upgradeTurret: (id: string) => boolean;
  buildExtractor: () => boolean;
  upgradeExtractor: (id: string) => boolean;
  upgradeWarehouse: (id?: string) => boolean;
  warehouseStock: (mapId?: MapId) => Cargo;
  warehouseCapacity: (mapId?: MapId) => number;
  transferFreight: (source: InventorySource, target: InventorySource, ore: Ore, units: number) => number;
  warehouseMaps: () => MapId[];
  discardOre: (ore: Ore, units: number) => number;
  transferWarehouse: (ore: Ore, direction: WarehouseDirection, units: number, mapId?: MapId) => number;
  contributeSystemProject: () => boolean;
  contributeCargoTug: () => boolean;
  contributeSurveyArray: () => boolean;
  atWarehouse: () => boolean;
  placementActive: () => boolean;
  structures: () => readonly UndergroundStructure[];
  surfaceAccess: () => boolean;
  planetSurfaceAccess: () => boolean;
  sellAccess: () => boolean;
  serviceAccess: () => boolean;
  rechargeAccess: () => boolean;
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
  freightSelection = initialFreight();
  starMapReturn = '';
  codexEntry = 'drill';
  codexQuery = '';
  codexReturn = 'pause';
  civilianBuyer: CivilisationId = 'helion';
  shipment: Cargo = emptyCargo();
  plannedBuilding: PlannedBuilding = 'habitat';
  private clearPages = () => {};
  modal = 'intro';
  hasStarted = false;
  paused = true;
  sheltered = false;
  nearSurface = true;
  onCrust = true;
  currentDepth = 0;
  docked = false;
  inOrbit = false;
  mothershipBoarded = false;
  toastTimer = 0;
  displayedMoney = 80;
  lastSale?: SaleReceipt;
  buildGroup: BuildGroup = 'Services';
  buildChoice: StructureKind = 'habitat';
  managedBuilding = 0;
  colonySelection = 0;
  colonyPage = 0;
  colonyConfirm = false;
  trackedOrder = '';
  orderSelection = 0;
  codexListing = true;
  codexPage = 0;
  codexSection = 0;
  workshopSection: WorkshopSection = 'miner';
  rigDepartment: RigDepartment = 'rig';
  rigItem = 0;
  selectedUpgrade: Upgrade = 'drill';
  campNotice = '';
  selectedSaleBuyer: MapId = 'cryo-shelf';
  savedAt = 0;
  saveFailed = false;
  targetSignature = '';
  missionTipSignature = '';
  private missionTipShownAt?: number;
  mapId: MapId = 'cryo-shelf';
  mapOpen = false;
  pendingImport?: SaveData;
  exportUrl?: string;
  exportFilename = '';
  styleSection: 'paint' | 'suit' | 'decal' | 'profile' = 'paint';
  mobileStorageOre: Ore | undefined;
  warehouseAmounts: Partial<Record<Ore, number>> = {};
  pendingWarehouseDiscard?: { ore: Ore; units: number };
  warehouseSourceMap: MapId = 'cryo-shelf';
  returnFocus: HTMLElement | null = null;
  introStep: 'title' | 'atlas' | 'controls' = 'title';
  private accountPanel?: AccountPanel;
  private accountReturn: 'intro' | 'pause' = 'intro';
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
      : `${id === 'cryo-shelf' ? 'VESPER-9' : 'Mothership ROUTE'} · ${MAPS[id].name.toUpperCase()}`;
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
      ? `${tile.x},${tile.y},${tile.oreUnits ?? 0},${tile.geode ? 1 : 0},${tile.regionFind ?? ''},${tile.signalHashId ?? ''},${tile.coreRelicId ?? ''},${tile.fragmentId ?? ''},${this.p.levels.drill},${overflow?.active ? `${overflow.units}:${overflow.space}` : ''},${Math.round(ratio * 100)},${Math.ceil(warning * 10)},${laserVenting ? 1 : 0}`
      : '';
    if (signature === this.targetSignature) return;
    this.targetSignature = signature;
    panel.classList.toggle('hidden', !tile);
    if (!tile) return;
    const ore = tile.ore ? ORES[tile.ore] : undefined;
    const regionalFind = tile.regionFind ? REGION_FINDS[tile.regionFind] : undefined;
    const signalHash = tile.signalHashId ? NAVIGATION_HASHES.find((entry) => entry.id === tile.signalHashId) : undefined;
    const coreRelic = tile.coreRelicId ? CORE_RELICS.find((entry) => entry.id === tile.coreRelicId) : undefined;
    const shipPart = tile.fragmentId ? ROUTE_FRAGMENTS.find((entry) => entry.id === tile.fragmentId) : undefined;
    const name =
      (coreRelic ? coreRelic.name : undefined) ?? shipPart?.title ?? (signalHash ? `Navigation hash · ${signalHash.name}` : undefined) ?? ore?.name ??
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
        ? `CARGO FULL: EXCESS ORE DROPS HERE. CLEAR THE ROUTE; RETURN AFTER SELLING TO COLLECT IT.`
        : `CARGO SHORT: ${cargoSpace} OF ${overflowUnits} UNITS FIT. THE REST DROPS HERE FOR YOUR RETURN TRIP.`
      : '';
    panel.innerHTML = `<div><b>${shipPart ? '✦ LEGACY SURVEY SAMPLE · ' : coreRelic ? '◈ PLANET CORE · ' : tile.geode ? '✦ PRISM GEODE · ' : regionalFind ? `✦ ${regionalFind.name} · ` : signalHash ? '◈ ARCHIVE HASH · ' : ''}${name.toUpperCase()}${ore && units !== 1 ? ` · +${units} UNITS` : ''}</b><span>${shipPart ? `SURVEY GRANT · +K ${ROUTE_PART_RECOVERY_BONUS} KREDITS` : coreRelic ? `+${CORE_FUEL.unitsPerCore} CORE FUEL` : signalHash ? 'OPTIONAL HASH HAS NO CASH VALUE' : ore ? `K ${ore.value} / unit` : 'NO ORE'} · ${width} BLOCK${width === 1 ? '' : 'S'} WIDE · ${this.p.drillTime(tile.hardness).toFixed(2)}s CUT</span></div><div class="cut-meter"><i style="width:${ratio * 100}%"></i></div><small>${full ? overflowWarning : laserVenting ? 'EMITTER VENTING · CUT PAUSED · RELEASE TO COOL FASTER' : shipPart ? `LEGACY SURVEY SAMPLE · CUTTING ${Math.round(ratio * 100)}%` : coreRelic ? `${coreRelic.detail} · CUT TO RECORD PLANET AND REFILL JUMPS · ${Math.round(ratio * 100)}%` : signalHash ? `${signalHash.detail} · CUTTING ${Math.round(ratio * 100)}%` : tile.geode ? `RARE CRYSTAL POCKET · GUARANTEED 3 UNITS · CUTTING ${Math.round(ratio * 100)}%` : regionalFind ? `${regionalFind.detail} · CUTTING ${Math.round(ratio * 100)}%` : `CUTTING ${Math.round(ratio * 100)}%`}</small>`;
  }
  constructor(
    public p: Progress,
    public actions: UIActions,
    public loaded: boolean,
    mapId: MapId = 'cryo-shelf',
    public getMapDepths: () => Partial<Record<MapId, number>> = () => ({}),
    public migrationNotice = false,
  ) {
    this.mapId = mapId;
    this.displayedMoney = p.money;
    matchMedia('(max-width:700px), (max-height:500px)').addEventListener('change', () => { if (['cargo','warehouse','sell'].includes(this.modal)) this.renderModal(); });
    matchMedia('(max-height:650px)').addEventListener('change', () => { if (['cargo','warehouse','sell'].includes(this.modal)) this.renderModal(); });
    document.querySelector('#app')!.innerHTML = `
      <header class="topbar"><a class="brand" href="#" aria-label="Ore Frontier"><span class="brand-mark">O<span>F</span></span><span>ORE<span class="brand-light"> FRONTIER</span><small>MINE · BUILD · TRADE · EXPLORE</small></span></a><div class="expedition"><i></i> MINING RIG ONLINE <span>/</span> <b id="zone">ICE MOON / CRYO SHELF</b></div><div class="top-actions"><button id="open-colony" aria-label="Open colony">Colony</button><button id="market" title="Browse the Star map">WORLDS</button><button id="map-toggle" aria-label="Toggle explored map" title="Toggle explored map" aria-pressed="false">MAP</button><button id="audio" aria-label="Toggle sound" title="Toggle sound">SOUND ON</button><button id="audio-mix" aria-label="Open audio mixer" title="Open audio mixer">MIX</button><button id="pause" aria-label="Pause game">Ⅱ</button></div></header>
      <main id="viewport"><div id="game" aria-label="Mining campaign. Use WASD or arrow keys to move. Hold left mouse button to aim and drill." role="application" tabindex="0"></div>
      <aside class="telemetry"><div class="eyebrow">RIG STATUS <span class="status-dot"></span></div><div class="meter-head"><span>BATTERY</span><strong id="fuel-label"></strong></div><div class="meter"><i id="fuel-bar"></i></div><small id="return-estimate" class="return-estimate"></small><div class="meter-head"><span>HULL</span><strong id="hull-label"></strong></div><div class="meter hull"><i id="hull-bar"></i></div><div class="cargo-manifest"><button id="open-cargo" class="cargo-line" aria-label="Open cargo inventory" aria-describedby="cargo-manifest-list"><span>CARGO</span><strong id="cargo-label"></strong></button><div id="cargo-manifest-list" role="tooltip" hidden></div></div><div class="cargo-blocks" id="cargo-blocks"></div><div class="cargo-worth" id="cargo-worth"></div><div class="laser-thermal hidden" id="laser-thermal" role="status" aria-live="polite"><div><span id="laser-thermal-label">LASER HEAT</span><b id="laser-thermal-value">0%</b></div><div class="meter"><i id="laser-thermal-bar"></i></div></div><div class="tool-stock hidden" id="tool-stock"><span>Q · MINING CHARGE</span><b id="charge-count">0</b></div><div class="core-fuel-readout" aria-label="Ore Frontier core fuel"><span>CORE FUEL · SPACE</span><b id="core-fuel-label">0</b></div><div id="colony-alert" aria-label="Colony raid status"></div></aside>
      <aside class="depth-panel"><div class="eyebrow">CURRENT DEPTH</div><div class="depth-value"><span id="depth">0</span><small>m</small></div><div class="record">DEEPEST <span id="record">0m</span></div><div class="depth-rule"></div><div id="depth-note">SURFACE OPERATIONS</div><div id="gravity-note" aria-live="polite"></div></aside>
      <div class="location-label"><span class="eyebrow">ICE MOON / CRYO SHELF</span><span>VESPER-9 · Mothership HAB-07</span></div>
      <div id="tip" class="mission-tip hidden" aria-live="polite"><span class="tip-icon">✦</span><div><b id="mission-headline"></b><span id="mission-body"></span></div></div>
      <div id="drill-target" class="drill-target hidden"></div><div id="route-map-panel" class="route-map-panel hidden"><div><b>EXPLORED TUNNELS</b><button id="map-close" aria-label="Close explored map">×</button></div><canvas id="route-map" width="240" height="220" aria-label="Map of explored tunnels and nearby surveyed ore"></canvas><div class="map-legend" aria-label="Ore map legend">${ORE_KEYS.map((key) => `<span><i class="ore-key ore-${ORE_SILHOUETTES[key]}" data-ore="${key}" role="img" aria-label="${ORES[key].name} marker" style="--ore-color:${ORES[key].hex}"></i>${ORES[key].name}</span>`).join('')}<span><i class="special"></i>Mineral find</span></div><small>Ore appears only after your scanner surveys nearby rock · M toggles map</small></div><div id="toast" role="status" aria-live="polite"></div><div id="low-warning" role="status"></div>
      <button id="orbit-worlds" class="orbit-worlds-button hidden" title="Choose a planet from orbit"><span aria-hidden="true">⌖</span> Mothership · WORLDS</button>
      ${campDock()}
      <input id="save-import-input" type="file" accept="application/json,.json" hidden /><div id="modal-layer" class="modal-layer"></div></main>
      <footer><div class="field-controls"><span><kbd>A D</kbd> Move</span><span><kbd>S</kbd> Drill</span><span><kbd>W</kbd> Fly up</span><span><kbd>E</kbd> Ship</span><span><kbd>B</kbd> Build</span><span><kbd>F</kbd> Unload</span><span><kbd>G</kbd> Repair</span></div><div class="controls"><kbd>A</kbd><kbd>D</kbd> MOVE <span></span>HOLD LEFT CLICK · AIM + DRILL <span></span>WHEEL ZOOM <span></span><kbd>S</kbd> <span id="control-s">DOWN / DROP</span> <span></span><kbd>W</kbd> <span id="control-w">THRUST</span> <span></span><kbd>E</kbd> <span id="control-e">INTERACT</span> <span></span><kbd>B</kbd> BUILD <span></span><kbd id="grapple-key" class="hidden">H</kbd> <span id="grapple-control" class="hidden">TOGGLE GRAPPLE</span> <span></span><kbd>R</kbd> WINCH <span></span><kbd>Q</kbd> CHARGE <span></span><kbd>X</kbd> STASIS <span></span><kbd>M</kbd> MAP <span></span><kbd>ESC</kbd> PAUSE</div><div class="bank"><span>BANKED KREDITS</span><b id="money">${credits(p.money)}</b></div><div class="save-status" id="save-status">LOCAL SAVE · READY</div></footer>`;
    const tracker = document.createElement('div'); tracker.id = 'tracked-order'; tracker.className = 'tracked-order'; tracker.hidden = true;
    document.querySelector('#viewport')!.append(tracker);
    this.on('pause', () => actions.pause());
    const cargoButton = document.getElementById('open-cargo')!;
    const cargoTooltip = document.getElementById('cargo-manifest-list')!;
    const hideCargo = () => { cargoTooltip.hidden = true; };
    const showCargo = () => {
      if (this.modal) return;
      cargoTooltip.hidden = false;
      const rect = cargoButton.getBoundingClientRect();
      cargoTooltip.style.left = `${Math.max(8, Math.min(rect.right + 12, innerWidth - cargoTooltip.offsetWidth - 8))}px`;
      cargoTooltip.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - cargoTooltip.offsetHeight - 8))}px`;
    };
    cargoButton.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') showCargo(); });
    cargoButton.addEventListener('pointerleave', hideCargo);
    cargoButton.addEventListener('focus', () => { if (cargoButton.matches(':focus-visible')) showCargo(); });
    cargoButton.addEventListener('blur', hideCargo);
    cargoButton.addEventListener('keydown', event => { if (event.key === 'Escape') hideCargo(); });
    window.addEventListener('resize', hideCargo);
    this.on('open-cargo', () => { hideCargo(); this.open('cargo'); });
    this.on('open-colony', () => this.open('colony'));
    this.on('market', () => this.open('destinations'));
    this.on('audio', () => this.updateMuteButton(actions.mute()));
    this.updateMuteButton(actions.isMuted());
    this.on('open-sell', () => this.open('sell'));
    this.on('open-service', () => this.open('service'));
    this.on('open-upgrades', () => this.open('upgrades'));
    this.on('open-full-services', () => this.actions.openShip());
    this.on('open-archive', () => this.open('archive'));
    this.on('open-shipyard', () => this.open('shipyard'));
    this.on('open-destinations', () => this.open('destinations'));
    this.on('orbit-worlds', () => this.open('destinations'));
    this.on('open-paints', () => this.open('paints'));
    this.on('open-construction', () => this.open('construction'));
    this.on('open-warehouse', () => this.open('warehouse'));
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
    const url = new URL(location.href);
    if (url.searchParams.get('account') === '1' || onlineSignInErrorMessage(url.hash)) {
      url.searchParams.delete('account');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
      this.openAccount('intro');
    }
  }
  on(id: string, fn: () => void) {
    document.getElementById(id)?.addEventListener('click', fn);
  }
  private moveWarehouse(ore: Ore, direction: WarehouseDirection, all = false) {
    const input = document.querySelector<HTMLInputElement>('#warehouse-units-' + ore);
    if (!all && input && !input.reportValidity()) return;
    const units = Number(input?.value || 1);
    const panel = document.querySelector<HTMLElement>('.camp-main');
    const scrollTop = panel?.scrollTop ?? 0;
    const sourceMap = direction === 'withdraw' ? this.warehouseSourceMap : undefined;
    const moved = this.actions.transferWarehouse(ore, direction, all ? Number.MAX_SAFE_INTEGER : units, sourceMap);
    // The transaction reports success or a save failure; preserve that specific feedback.
    if (moved) this.toast(direction === 'store'
      ? `${moved} ${ORES[ore].name} deposited in local Planet storage.`
      : `${moved} ${ORES[ore].name} moved back into your miner.`);
    else if (!this.saveFailed) this.toast(direction === 'store'
      ? 'Nothing moved: Planet storage has no room or your miner has none of this ore.'
      : 'Nothing moved: your miner is full or no ore is stored here.');
    this.renderModal();
    const nextPanel = document.querySelector<HTMLElement>('.camp-main');
    if (nextPanel) nextPanel.scrollTop = scrollTop;
  }
  private updateMuteButton(muted: boolean) {
    const button = document.querySelector<HTMLButtonElement>('#audio');
    if (!button) return;
    button.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    button.setAttribute('aria-pressed', String(muted));
  }
  openCodex(entry: string) {
    if (this.modal !== 'codex') this.codexReturn = this.modal || 'pause';
    this.codexEntry = entry; this.codexQuery = ''; this.codexListing = false; this.codexPage = 0; this.codexSection = 0; this.open('codex');
  }
  inspectBuilding(id: string) {
    const index = this.actions.structures().findIndex(s => s.id === id);
    if (index < 0 || !this.actions.locateBuilding(id)) return;
    this.colonySelection = index; this.open('building');
  }
  open(name: string) {
    this.accountPanel?.close();
    if(name === 'destinations') this.starMapReturn = this.modal;
    if (name === 'service' && !this.actions.serviceAccess()) { this.toast('Visit the mothership, a mining camp or an underground shelter for repairs.'); return; }
    if (['cargo', 'warehouse', 'sell'].includes(name)) {
      this.freightSelection.selling = name === 'sell'; this.freightSelection.notice = ''; this.freightSelection.page = 0;
      // The HUD cargo button always inspects the miner. Storage and selling open on usable stock.
      const stores = { miner: this.p.cargo, ship: this.p.shipCargo, planet: this.actions.warehouseStock() };
      this.freightSelection.source = name === 'cargo' ? 'miner' : (['miner', 'ship', 'planet'] as const).find(key => cargoTotal(stores[key]) > 0 && (key === 'miner' || key === 'ship' && this.actions.rechargeAccess() || key === 'planet' && this.actions.atWarehouse())) ?? 'miner';
      this.freightSelection.target = this.freightSelection.source === 'miner' ? 'ship' : 'miner';
    }
    if (name === 'sell') this.selectedSaleBuyer = this.mapId;
    // Inventory is always inspectable; freight actions enforce proximity individually.
    if (name === 'warehouse') this.warehouseSourceMap = this.mapId;
    if (name === 'upgrades' && !this.actions.serviceAccess()) { this.toast('Visit the mothership, a mining camp or your shelter to change equipment.'); return; }
    if (!this.modal) {
      const active = document.activeElement;
      this.returnFocus = active instanceof HTMLElement && active.getClientRects().length ? active : null;
    }
    this.campNotice = '';
    this.modal = name;
    this.setMode(true);
    this.renderModal();
  }
  close(deploy = true) {
    if (this.modal === 'transit') return;
    // Every return to gameplay releases a landed miner, including nested
    // cargo, discard and pause panels that are not in the camp navigation.
    // Only explicit ship piloting keeps the boarding state.
    if (deploy && !this.actions.leaveShip()) return;
    this.clearPages();
    this.modal = '';
    this.lastSale = undefined;
    if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
    this.exportUrl = undefined;
    this.exportFilename = '';
    this.setMode(false);
    document.querySelector('#modal-layer')!.innerHTML = '';
    this.returnFocus = null;
    // Space is thrust in play: never restore focus to a service button that
    // would activate again when the player tries to fly.
    (document.querySelector('#game') as HTMLElement).focus();
  }
  showIntro() {
    this.accountPanel?.close();
    this.clearPages();
    this.modal = 'intro';
    this.paused = true;
    const step = this.introStep;
    const legacyMars = !FRONTIER.worlds.includes(this.mapId);
    const intro = legacyMars
      ? {
          eyebrow: 'INDEPENDENT PROSPECTOR PROGRAM / LEGACY SAVE',
          headline: 'FORTUNE FAVORS<br>THE <em>DEEP.</em>',
          dek: 'A small pod. A red planet. A whole lot beneath it.',
          loop: ['DIG', 'HAUL', 'UPGRADE'],
          briefing: 'Drill for ore. Watch your battery. Fly home to sell your haul and build a better machine. Your tunnels stay yours.',
        }
      : {
          eyebrow: this.loaded ? 'ORE FRONTIER / YOUR EXPEDITION' : 'ORE FRONTIER / FIRST DEPLOYMENT',
          headline: 'A SMALL RIG.<br>A <em>BIG FRONTIER.</em>',
          dek: 'Choose your equipment. Mine valuable ore. Build shelters and grow your operation.',
          loop: ['DRILL', 'RECOVER', 'DEPART'],
          briefing: 'Start with a mothership, a mining rig and no Kredits. Use common ores to build in any order and upgrade your rig. Construction and upgrades use Miner, Ship, then Planet materials. A Market uplink lets you sell ore for optional equipment. Recharge free at the mothership. Recover the core for four travel fuel units. Depart for Mars through the Star map.',
        };
    const touch = matchMedia('(any-pointer: coarse)').matches;
    const atlas = legacyMars ? '' : atlasMarkup(this.mapId);
    const launchButton = `<button class="primary" id="launch">${this.loaded ? 'CONTINUE EXPEDITION' : 'BEGIN EXPEDITION'} <span>↗</span></button>`;
    const titleScreen = `<div class="intro-screen intro-title-screen"><div class="eyebrow">${intro.eyebrow}</div><h1>${this.loaded ? 'MOTHERSHIP<br><em>STANDING BY.</em>' : intro.headline}</h1><p>${this.migrationNotice ? 'Old stock stays on each planet. Your new empty 50-unit ship hold travels with you.' : this.loaded ? 'Your rig, buildings and tunnels are saved. Continue your mining operation.' : intro.dek}</p><div class="learn-loop"><div><kbd>${'A D'}</kbd><b>Move</b><small>Steer across the surface</small></div><div><kbd>${touch ? 'S' : 'S / Mouse'}</kbd><b>Mine</b><small>Hold to drill into rock</small></div><div><kbd>${touch ? 'W' : 'W / ↑'}</kbd><b>Fly / brake</b><small>Fly up or slow your fall</small></div><div><kbd>${touch ? 'FIRE' : 'Shift + click'}</kbd><b>Shoot</b><small>Fit a weapon first</small></div><div><kbd>${touch ? 'Unload / Repair' : 'F / G'}</kbd><b>Unload / repair</b><small>F: ship / warehouse · G: ship repair</small></div><div><kbd>${touch ? 'Tools → Build' : 'B'}</kbd><b>Build</b><small>Place colony structures</small></div></div>${launchButton}<nav class="intro-secondary" aria-label="Expedition information">${atlas ? '<button type="button" id="intro-atlas">View worlds</button>' : ''}<button type="button" id="intro-controls">How to play</button><button type="button" id="intro-account">Account</button></nav></div>`;
    const atlasScreen = `<div class="intro-screen intro-detail-screen"><div class="intro-detail-heading"><button type="button" class="intro-back" id="intro-back">← Back</button><span class="eyebrow">EXPEDITION ROUTE</span></div><h2>Worlds in the Vesper system</h2><p>Start on the Cryo Shelf. Other worlds open as your expedition ship comes online.</p>${atlas}<div class="intro-detail-actions">${launchButton}</div></div>`;
    const controlsScreen = `<div class="intro-screen intro-detail-screen"><div class="intro-detail-heading"><button type="button" class="intro-back" id="intro-back">← Back</button><span class="eyebrow">FIELD GUIDE</span></div><h2>How to play</h2><p>${intro.briefing}</p><div class="intro-controls" aria-label="Game controls"><div><kbd>A</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>S</kbd><span>DESCEND / DRILL</span></div><div><kbd>W</kbd><span>THRUST UP · BRAKE DESCENT</span></div><div><kbd>LMB</kbd><span>AIM · HOLD TO DRILL</span></div><div><kbd>SHIFT + LMB</kbd><span>FIRE FITTED WEAPON · AIM WITH MOUSE</span></div><div><kbd>G</kbd><span>FULL REPAIR + RECHARGE · NEAR SHIP · WORKS IN FLIGHT</span></div><div><kbd>F</kbd><span>FAST UNLOAD · SHIP OR WAREHOUSE · AVAILABLE STORAGE</span></div><div><kbd>E</kbd><span>OPEN SHIP / ENTER SHELTER</span></div><div><kbd>B</kbd><span>BUILD</span></div><div><kbd>H</kbd><span>TOGGLE AUTO GRAPPLE · RELEASE TETHER</span></div><div><kbd>M</kbd><span>EXPLORED MAP</span></div><div><kbd>ESC</kbd><span>PAUSE</span></div></div><p class="intro-risk">ORE FILLS CARGO · WATCH YOUR BATTERY.</p><small class="intro-note">T SELL · J REPAIR BUILDING · Q CHARGE · X STASIS · R WINCH</small><div class="intro-detail-actions">${launchButton}</div></div>`;
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal intro ${atlas ? 'intro-with-atlas' : ''} intro-step-${step}" role="dialog" aria-modal="true" aria-label="Expedition start">${step === 'atlas' ? atlasScreen : step === 'controls' ? matchMedia('(any-pointer: coarse)').matches ? `<div class="intro-screen intro-detail-screen"><div class="intro-detail-heading"><button type="button" class="intro-back" id="intro-back">← Back</button><span class="eyebrow">TOUCH FIELD GUIDE</span></div><h2>Two thumbs. One expedition.</h2><p>Use the left WASD pad: W thrusts upward or brakes a fall, A and D steer and drill sideways, and S drills down. Actions and Tools are on the right.</p><p>You can thrust and drill together. Release a button to stop its action. Hold FIRE to shoot a fitted weapon. Tap Unload near a warehouse or mothership to transfer cargo into its available storage without opening a menu. Tap Repair near the mothership, including while flying, for a full rig exchange at the displayed cost. Tap Open ship for storage, recharge and repairs. Tools holds Build, Map and installed equipment. Beside a Market uplink, tap Sell to sell your miner cargo for the displayed Kredits.</p><p>Landscape gives you the widest view. The top-right pause button stops the expedition. Rotate or switch apps safely: held controls clear automatically.</p><p class="intro-risk">WATCH YOUR BATTERY · LEAVE ENOUGH FOR THE RETURN.</p><div class="intro-detail-actions">${launchButton}</div></div>` : controlsScreen : titleScreen}</section>`;
    document.querySelectorAll<HTMLButtonElement>('.atlas-world').forEach((node) => node.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.atlas-world').forEach((other) => {
        const selected = other === node;
        other.classList.toggle('selected', selected);
        other.setAttribute('aria-pressed', String(selected));
      });
      document.querySelector('#atlas-title')!.textContent = node.dataset.title ?? '';
      document.querySelector('#atlas-copy')!.textContent = node.dataset.copy ?? '';
    }));
    this.on('intro-atlas', () => this.open('destinations'));
    this.on('intro-account', () => this.openAccount('intro'));
    this.on('intro-controls', () => { this.introStep = 'controls'; this.showIntro(); });
    this.on('intro-back', () => { this.introStep = 'title'; this.showIntro(); });
    this.on('launch', () => {
      const begin = () => {
        this.hasStarted = true;
        this.close();
        this.actions.start();
      };
      begin();
    });
    this.clearPages = panelPages(document.querySelector<HTMLElement>('#modal-layer')!);
    document.getElementById(step === 'title' ? 'launch' : 'intro-back')?.focus();
  }
  private lastRenderedModal = "";
  private openAccount(origin: 'intro' | 'pause') {
    this.clearPages();
    this.accountReturn = origin;
    this.modal = 'account';
    this.setMode(true);
    const host = document.querySelector<HTMLElement>('#modal-layer')!;
    this.accountPanel = new AccountPanel(host, () => {
      this.accountPanel?.close();
      if (this.accountReturn === 'intro') this.showIntro();
      else this.open('pause');
    }, () => {
      this.saveFailed = false;
      this.actions.save();
      return !this.saveFailed;
    });
    void this.accountPanel.open();
  }
  renderModal() {
    this.clearPages();
    const name = this.modal,
      p = this.p;
    const samePanel = this.lastRenderedModal === name;
    this.lastRenderedModal = name;
    const scrollTop = samePanel ? document.querySelector('.camp-main')?.scrollTop ?? 0 : 0;
    const active = document.activeElement;
    const previousFocusId = samePanel && active instanceof HTMLElement && document.querySelector('.modal')?.contains(active) ? active.id : '';
    const receipt = name === 'sell' && !p.count ? this.lastSale : undefined;
    const saleCargo = receipt?.cargo ?? p.cargo;
    let title = '',
      sub = '',
      content = '';
    if (name === 'hub') {
      title = 'Your mining operation.';
      sub = 'Build, manage your ore or prepare your miner.';
      content = `<div class="hub-status"><span>Battery <b>${Math.ceil(p.fuel / p.max('fuel') * 100)}%</b></span><span>Hull <b>${Math.ceil(p.hull / p.max('hull') * 100)}%</b></span><span>Miner cargo <b>${p.count} / ${p.max('cargo')}</b></span></div><div class="hub-grid operations-grid">${[
        ['construction', 'BUILD', 'Build', 'Choose a building and place it on the planet.'],
        ['colony', 'MANAGE', 'Your colony', 'Check production, storage and your existing buildings.'],
        ['warehouse', 'ORE', 'My ore', this.actions.hasTradePost() ? 'Uplink online. Store, transfer or sell your ore.' : 'Store and transfer ore. Build a Market uplink to sell.'],
        ['upgrades', 'EQUIP', 'My miner', 'Buy parts and change your fitted equipment.'],
        ['service', 'RECOVER', 'Recharge & repair', 'Charge your battery free. Repair hull damage.'],
        ['destinations', 'EXPLORE', 'Planets', 'View worlds and plan your next destination.'],
      ].map(([page, category, heading, copy]) => `<button data-hub="${page}"><span class="hub-picture" aria-hidden="true">${page==='construction'?buildingArt('habitat'):page==='colony'?buildingArt('extractor'):page==='warehouse'?buildingArt('warehouse'):page==='upgrades'?podPortrait(p):equipmentArt(page==='service'?'hull':'scanner')}</span><b>${heading} <i aria-hidden="true">↗</i></b><small>${copy}</small></button>`).join('')}</div><div class="hub-secondary"><button data-hub="more">Paint, mining log & help →</button>${this.mothershipBoarded && PREBUILD.travelEnabled ? `<button id="pilot-ship" ${p.coreFuel <= 0 ? 'disabled' : ''}>Pilot mothership · ${p.coreFuel > 0 ? 'W to take off' : 'Core fuel required'}</button>` : ''}</div>`;
    } else if (name === 'more') {
      title = 'Explore your expedition'; sub = 'Optional tools, records and destinations.';
      content = `<div class="hub-grid">${[['paints', 'Paint shop'], ['archive', 'Mining log'], ['shipyard', 'Core drive'], ['codex', 'How things work']].map(([page,label]) => `<button data-hub="${page}"><b>${label} <i>↗</i></b></button>`).join('')}</div>`;
    } else if (name === 'codex') {
      title = 'The Expedition Codex'; sub = 'ENGINEERING · WORLDS · FRONTIER HISTORY';
      content = codexPanel(p,this.codexEntry,this.codexQuery,this.codexListing,this.codexPage,this.codexSection);
    } else if (name === 'cargo') {
      content = freightView(p, this.actions.warehouseStock(), this.actions.warehouseCapacity(), this.mapId, this.freightSelection, this.actions.atWarehouse(), this.actions.rechargeAccess(), this.actions.sellAccess(), this.actions.hasTradePost());
    } else if (name === 'building') {
      const selected = this.actions.structures()[this.colonySelection];
      if (!selected) { this.open('colony'); return; }
      const status = selected.kind === 'extractor' ? this.actions.extractorStatus(selected) : undefined;
      content = `<section class="modal building-inspector" role="dialog" aria-modal="true" aria-label="Building controls"><small>COLONY INSPECTION · MINING PAUSED</small><h2>${buildingName(selected)}</h2><p>${status ? `${status.state} · ${ORES[status.ore].name} · ${status.remaining} ore remaining` : 'Your planetary operation'}</p><div><button id="building-manage">Manage</button><button id="colony-move">Move</button><button id="colony-dismantle">Dismantle</button><button id="close">Return to rig</button></div></section>`;
    } else if (name === 'orders') {
      content = colonyOrdersPanel(p, this.actions.warehouseStock(), this.mapId, this.trackedOrder, this.campNotice, this.orderSelection);
    } else if (name === 'colony') {
      content = colonyOverview(this.actions.structures(), this.actions.warehouseStock(), this.actions.warehouseCapacity(), this.mapId, this.colonySelection, this.colonyPage, this.colonyConfirm, this.actions.extractorStatus, p);
    } else if (name === 'construction') {
      const planetSurface = this.actions.planetSurfaceAccess();
      title = planetSurface ? 'Build your mining camp.' : 'Make a foothold.';
      sub = planetSurface ? 'PLANETARY BUILD YARD' : 'UNDERGROUND FABRICATOR';
      const structures = this.actions.structures();
      content = buildingCatalogue(planetSurface ? this.buildGroup : 'Underground', this.buildChoice, p.cargo, this.actions.warehouseStock(), p.money, structures, this.mapId, this.managedBuilding, p.shipCargo, planetSurface ? '' : this.actions.undergroundBuildReason?.((BUILD_GROUPS.Underground as readonly StructureKind[]).includes(this.buildChoice) ? this.buildChoice : 'service') ?? '');
    } else if (name === 'audio') {
      const mix = this.actions.audioMix();
      title = 'Tune the sound.';
      sub = 'AUDIO / LOCAL SETTINGS';
      content = `<p>Set the soundtrack and game effects to suit your speakers. Your levels are saved on this device.</p><div class="audio-mix-controls"><label for="music-volume"><span><b>MUSIC</b><output id="music-value">${mix.music}%</output></span><input id="music-volume" type="range" min="0" max="100" step="5" value="${mix.music}" /></label><label for="effects-volume"><span><b>EFFECTS</b><output id="effects-value">${mix.effects}%</output></span><input id="effects-volume" type="range" min="0" max="100" step="5" value="${mix.effects}" /></label></div><button id="audio-mute" class="primary">${this.actions.isMuted() ? 'SOUND OFF · TURN ON' : 'SOUND ON · MUTE'} <span>♪</span></button>`;
      content += `<div class="service-row"><div><b>CAVE ATMOSPHERE</b><small>Drifting dust and thruster wakes. Hidden with reduced motion.</small></div><button id="atmosphere-toggle" aria-label="Cave atmosphere" aria-pressed="${this.actions.atmosphereEnabled()}">${this.actions.atmosphereEnabled() ? 'ON' : 'OFF'}</button></div>`;
    } else if (name === 'sell') {
      title = 'Ore for living worlds.'; sub = 'TELETRADE / CIVILIAN EXCHANGE';
      content = freightView(p, this.actions.warehouseStock(), this.actions.warehouseCapacity(), this.mapId, this.freightSelection, this.actions.atWarehouse(), this.actions.rechargeAccess(), this.actions.sellAccess(), this.actions.hasTradePost());
    } else if (name === 'warehouse') {
      content = freightView(p, this.actions.warehouseStock(), this.actions.warehouseCapacity(), this.mapId, this.freightSelection, this.actions.atWarehouse(), this.actions.rechargeAccess(), this.actions.sellAccess(), this.actions.hasTradePost());
    } else if (name === 'discard') {
      const pending=this.pendingWarehouseDiscard ?? {ore:'copper' as Ore, units:1};
      this.pendingWarehouseDiscard=pending;
      content=`<section class="modal discard-screen" role="dialog" aria-modal="true" aria-label="Confirm miner discard"><div class="warehouse-discard-confirm"><small>MINER CARGO ONLY</small><nav class="freight-ore"><button id="discard-prev" aria-label="Previous ore">←</button><h2>${ORES[pending.ore].name}</h2><button id="discard-next" aria-label="Next ore">→</button></nav><p>Held: ${p.cargo[pending.ore]} units</p><div class="freight-amounts">${[.5,1,5].map(n=>`<button data-discard-amount="${n}">${n}</button>`).join('')}<button data-discard-amount="max">Max</button></div><h3>Discard ${pending.units} ${ORES[pending.ore].name} from Miner?</h3><p>This permanently removes the named quantity. Ship and Planet stock stay safe.</p><div><button id="cancel-warehouse-discard">Keep ore</button><button id="confirm-warehouse-discard" class="primary danger" ${pending.units<=0||pending.units>p.cargo[pending.ore]?'disabled':''}>Confirm discard</button></div></div></section>`;
    } else if (name === 'arrival') {
      content = arrivalMarkup(this.mapId, this.actions.arrivalSummary());
    } else if (name === 'service') {
      title = 'Recharge & repair.';
      sub = 'Recharge at the mothership for free. Repairs cost Kredits.';
      content = servicePanel(p, this.actions.rechargeAccess());
    } else if (name === 'upgrades') {
      title = 'Build a better miner.';
      sub = 'Compare components and buy upgrades with your ore earnings.';
      content = rigWorkshop(p, this.actions.warehouseStock(), this.selectedUpgrade, this.rigDepartment, this.rigItem, this.campNotice);
    } else if (name === 'archive') {
      title = 'Your mining log.';
      sub = 'PLANETS · DEPTH · CORE FUEL';
      const records = campaignMapRecords(this.getMapDepths(), p.routeFragments, p.milestones);
      content = `<p>Core fuel aboard: <b>${p.coreFuel.toFixed(2)}</b>. Deepest excavation: <b>${Math.floor(p.maxDepth)} m</b>.</p><div class="region-record-grid">${records.map(record => `<article class="archive-entry ${record.visited ? 'found' : ''}"><span>${record.visited ? 'VISITED' : 'NOT VISITED'}</span><b>${record.name}</b><p>${record.visited ? `Deepest excavation: ${record.deepestMeters} m` : 'No mining activity yet.'}<br>${record.coreRecovered ? 'Core extracted · fuel collected' : 'Planetary core available'}</p></article>`).join('')}</div>`;
    } else if (name === 'shipyard') {
      title = 'Core drive ready.'; sub = 'TWO WORLD EXPEDITION';
      content = '<p>Recover a core for four fuel units. Use the Star map aboard the docked mothership. A journey costs one fuel; an unrecovered destination also requires one return reserve. Re-mine exposed cores for ten seconds per unit, up to four fuel.</p><button data-hub="destinations">Explore star map →</button>';
    } else if (name === 'destinations') {
      title = 'Star map';
    } else if (name === 'paints') {
      title = this.styleSection === 'paint' ? 'Make the pod yours.' : 'Suit up for the long haul.';
      sub = 'RIG CUSTOMIZATION';
      const switcher = `<nav class="style-tabs" aria-label="Appearance category"><button id="style-paint" aria-pressed="${this.styleSection === 'paint'}">FINISH</button><button id="style-suit" aria-pressed="${this.styleSection === 'suit'}">SUIT</button><button id="style-decal" aria-pressed="${this.styleSection === 'decal'}">DECALS</button><button id="style-profile" aria-pressed="${this.styleSection === 'profile'}">PROFILE</button></nav>`;
      if (this.styleSection === 'paint') {
        const selected = POD_PAINTS[p.selectedPaint];
        content = `${switcher}<div class="paint-preview"><div class="paint-pod" style="--paint-hull:#${selected.hull.toString(16).padStart(6, '0')};--paint-trim:#${selected.trim.toString(16).padStart(6, '0')};--paint-light:#${selected.light.toString(16).padStart(6, '0')}"><i></i><b></b><span></span></div><div><small>ACTIVE FINISH</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_PAINT_KEYS.map((key) => {
          const item = POD_PAINTS[key], owned = p.ownedPaints.includes(key), active = p.selectedPaint === key;
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch" style="--paint-hull:#${item.hull.toString(16).padStart(6, '0')};--paint-trim:#${item.trim.toString(16).padStart(6, '0')}"><i></i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="paint-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · K ${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Pod paint changes hull, trim, and beacon light only.</p>`;
      } else if (this.styleSection === 'suit') {
        const selected = PILOT_SUITS[p.selectedSuit];
        content = `${switcher}<div class="paint-preview"><div class="suit-preview" style="--suit-body:#${selected.body.toString(16).padStart(6, '0')};--suit-trim:#${selected.trim.toString(16).padStart(6, '0')}"><i></i><b></b><span></span><small></small></div><div><small>ACTIVE PILOT KIT</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${PILOT_SUIT_KEYS.map((key) => {
          const item = PILOT_SUITS[key], owned = p.ownedSuits.includes(key), active = p.selectedSuit === key;
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch suit-swatch" style="--paint-hull:#${item.body.toString(16).padStart(6, '0')};--paint-trim:#${item.trim.toString(16).padStart(6, '0')}"><i></i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="suit-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · K ${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Suit colors appear in the cockpit and change no stats or handling.</p>`;
      } else if (this.styleSection === 'decal') {
        const selected = POD_DECALS[p.selectedDecal];
        const mark = selected.style === 'arrow' ? '↘' : selected.style === 'crest' ? '✦' : selected.style === 'prism' ? '◇' : '·';
        content = `${switcher}<div class="paint-preview"><div class="decal-preview-mark" style="--decal-color:#${selected.color.toString(16).padStart(6, '0')}">${mark}</div><div><small>ACTIVE MARKING</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_DECAL_KEYS.map((key) => {
          const item = POD_DECALS[key], owned = p.ownedDecals.includes(key), active = p.selectedDecal === key;
          const icon = item.style === 'arrow' ? '↘' : item.style === 'crest' ? '✦' : item.style === 'prism' ? '◇' : '·';
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="paint-swatch decal-swatch" style="--paint-hull:#${item.color.toString(16).padStart(6, '0')}"><i>${icon}</i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="decal-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'EQUIPPED' : owned ? 'EQUIP →' : `BUY · K ${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Decals are applied to the pod hull and are visual only.</p>`;
      } else {
        const selected = POD_PROFILES[p.selectedProfile];
        const icon = selected.style === 'antenna' ? '⌁' : selected.style === 'stabilizers' ? '⋈' : selected.style === 'armor' ? '⬟' : '◉';
        content = `${switcher}<div class="paint-preview"><div class="profile-preview profile-${selected.style}"><i>${icon}</i><span style="--cabin-color:#${selected.cabin.toString(16).padStart(6, '0')}"></span></div><div><small>ACTIVE POD PROFILE</small><b>${selected.name.toUpperCase()}</b><p>${selected.description}</p></div></div><div class="paint-grid">${POD_PROFILE_KEYS.map((key) => {
          const item = POD_PROFILES[key], owned = p.ownedProfiles.includes(key), active = p.selectedProfile === key;
          const glyph = item.style === 'antenna' ? '⌁' : item.style === 'stabilizers' ? '⋈' : item.style === 'armor' ? '⬟' : '◉';
          return `<article class="paint-card ${active ? 'active' : ''}"><div class="profile-swatch profile-${item.style}" style="--cabin-color:#${item.cabin.toString(16).padStart(6, '0')}"><i>${glyph}</i></div><b>${item.name.toUpperCase()}</b><small>${item.description}</small><button id="profile-${key}" ${active || (!owned && p.money < item.cost) ? 'disabled' : ''}>${active ? 'FITTED' : owned ? 'FIT →' : `BUY · K ${item.cost}`}</button></article>`;
        }).join('')}</div><p class="fine">Profiles change the pod's rendered silhouette only. Collision and drill clearance stay the same.</p>`;
      }
    } else if (name === 'pause') {
      const exportControl = this.exportUrl
        ? `<a id="download-save" class="pause-download" aria-label="DOWNLOAD SAVE FILE" href="${this.exportUrl}" download="${this.exportFilename}">Download save file <span aria-hidden="true">↓</span></a>`
        : '<button id="export-save" aria-label="EXPORT SAVE">Export save <span aria-hidden="true">↧</span></button>';
      content = pauseScreen(p, this.mapId, this.currentDepth, this.docked, exportControl, this.pauseSaveStatus(), this.actions.structures().some(s => s.kind === 'habitat'), this.actions.hasTradePost());
    } else if (name === 'import-confirm') {
      const d = this.pendingImport;
      if (!d) { this.modal = 'pause'; this.renderModal(); return; }
      title = 'Replace this expedition?';
      sub = 'IMPORT EXPEDITION SAVE';
      content = `<p>This will replace the save currently in this browser. Review the expedition before continuing.</p><div class="sale-total"><span>DESTINATION</span><b>${MAPS[d.activeMap].name.toUpperCase()}</b></div><div class="service-row"><div><b>CAMPAIGN STATUS</b><small>${Math.floor(d.maxDepth)} m deepest · K ${Math.floor(d.money)} Kredits · ${d.routeFragments.length} route fragments</small></div></div><button id="confirm-import" class="primary danger">IMPORT & REPLACE SAVE</button><button id="cancel-import">CANCEL</button>`;
    } else if (name === 'rescue') {
      title = 'Leave the haul behind?';
      sub = 'EMERGENCY RECOVERY';
      content =
        '<p>Land on the nearest surface at your current longitude and planet side with a full battery and hull. Unsold cargo is lost; your money, upgrades, and tunnels are kept.</p><button id="confirm-rescue" class="primary">RECOVER HERE →</button>';
    } else if (name === 'new') {
      title = 'Start a new frontier?';
      sub = 'REPLACE SAVED EXPEDITION';
      content =
        '<p>This replaces your current mine, Kredits, and upgrades with a new world seed. This cannot be undone.</p><button id="confirm-new" class="primary danger">START NEW EXPEDITION →</button>';
    } else if (name === 'defeat') {
      title='Mothership lost.';sub='EXPEDITION ENDED';content='<p>Your mothership was destroyed. This expedition is over.</p><button id=defeat-new class=primary>Start a new expedition</button>';
    } else if (name === 'failure') {
      const reason = this.actions.failureReason();
      title = reason === 'fuel' ? 'The reserve ran dry.' : reason === 'hull' ? 'The hull gave way.' : 'The planet keeps its share.';
      sub = reason === 'fuel' ? 'STRANDED · RECOVERY IS YOUR CHOICE' : reason === 'hull' ? 'MINER DISABLED · RECOVERY IS YOUR CHOICE' : 'PILOT NEEDS RESCUE · RECOVERY IS YOUR CHOICE';
      content = `<p>${reason === 'fuel' ? 'Your rig’s battery is empty. Your tunnels and loose ore are still here. Recharge if you can reach the mothership; otherwise recover and leave the carried ore behind.' : reason === 'hull' ? 'Your miner was destroyed here. Your tunnel, loose ore, Kredits, and upgrades are safe. Recover the pilot when you are ready to return for this haul later.' : 'The pilot cannot reach a safe dock. Your tunnel, loose ore, Kredits, and upgrades remain saved. Recover to the surface when you are ready to return for this haul later.'}</p><p>Recovery lands at your current longitude and keeps you on this crust. Carried ore stays at the wreck for you to recover.</p>${reason === 'fuel' && this.actions.rechargeAccess() ? '<button id="service-all" class="primary">RECHARGE AT MOTHERSHIP</button>' : ''}<button id="recover-stranded" class="${reason === 'fuel' && this.actions.rechargeAccess() ? '' : 'primary'}">RECOVER PILOT · ORE STAYS AT WRECK</button>`;
    }
    document.querySelector('#modal-layer')!.classList.remove('has-operation-tabs');
    const campMenu = CAMP_MENUS.includes(name);
    const campLinks = [
      ...(this.nearSurface ? ['hub'] : []),
      
      ...(this.actions.serviceAccess() ? ['service'] : []),
      ...(this.nearSurface ? ['upgrades', 'construction', 'colony', 'more'] : []),
      ...(this.actions.atWarehouse() ? ['warehouse'] : []),
      ...(this.nearSurface ? ['destinations'] : []),
    ];
    document.querySelector('#modal-layer')!.innerHTML = name === 'sell' || name === 'discard' || name === 'arrival' || name === 'warehouse' || name === 'codex' || name === 'cargo' || name === 'building' || name === 'orders' || name === 'colony' || name === 'upgrades' ? content : name === 'construction' ? content : name === 'destinations' ? starMapMarkup(this.mapId) : name === 'pause' ? content : campMenu
      ? campShell(name, title, sub, content, p, this.mapId, campLinks, this.campNotice) :
      `<section class="modal ${['upgrades', 'archive', 'shipyard', 'destinations', 'paints', 'construction'].includes(name) ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${sub}"><button class="close" id="close" aria-label="Close panel">×</button><header class="modal-head"><div class="eyebrow">${sub}</div><h2>${title}</h2></header><div class="modal-body">${content}</div><div class="modal-bank"><span>AVAILABLE KREDITS</span><b>K ${p.money.toLocaleString()}</b></div></section>`;
    if(name==='defeat')document.querySelector('#modal-layer #close')?.remove();
    if (['hub','service','construction','colony','upgrades','warehouse','sell','more','destinations','paints','archive','shipyard'].includes(name)) {
      const root=document.querySelector('#modal-layer')!;
      root.querySelector('.modal')?.classList.add('operations-panel');
      const groups: [string,string,string[]][] = [
        ['hub','Overview',['hub']],
        ['warehouse','My ore',['warehouse','sell']],
        ['construction','Buildings',['construction','colony']],
        ['upgrades','My miner',['upgrades','service','paints']],
        ['destinations','Planets',['destinations']],
        ['more','Extras',['more','archive','shipyard']],
      ];
      const tabs = ['construction','colony'].includes(name) ? [['construction','Build new'],['colony','Your buildings']]
        : ['upgrades','service','paints'].includes(name) ? [['upgrades','Equipment'],['service','Repair & recharge'],['paints','Paint']]
        : [];
      root.classList.toggle('has-operation-tabs',tabs.length>0);
      root.insertAdjacentHTML('afterbegin',`<nav class="operations-nav" aria-label="Mothership operations">${groups.map(([key,label,pages])=>`<button data-hub="${key}" aria-current="${pages.includes(name)?'page':'false'}">${label}</button>`).join('')}</nav>${tabs.length?`<nav class="operations-tabs" aria-label="${name==='construction'||name==='colony'?'Buildings':'Miner'} options">${tabs.map(([key,label])=>`<button data-hub="${key}" aria-current="${name===key?'page':'false'}">${label}</button>`).join('')}</nav>`:''}`);

    }
    const exitButton=document.querySelector<HTMLButtonElement>('#modal-layer #close');
    if(exitButton && name!=='defeat') { exitButton.textContent='Back to game'; exitButton.setAttribute('aria-label','Back to game'); }
    if (['cargo','warehouse','sell'].includes(name)) {
      const state=this.freightSelection, inventories={miner:p.cargo,ship:p.shipCargo,planet:this.actions.warehouseStock()}, capacities={miner:p.max('cargo'),ship:FRONTIER.shipCapacity,planet:this.actions.warehouseCapacity()};
      bindFreight(document.querySelector('#modal-layer')!,state,()=>this.renderModal(),()=>{
        if (!state.selling) return this.actions.transferFreight(state.source,state.target,state.ore,state.amount);
        const offer=bestOreOffer(p,inventories[state.source],state);
        return this.actions.shipCivilian(offer.buyer,offer.shipment,state.source);
      },()=>state.selling?inventories[state.source][state.ore]:Math.max(0, Math.min(inventories[state.source][state.ore],capacities[state.target]-ORE_KEYS.reduce((n,o)=>n+inventories[state.target][o],0))));
      this.on('freight-back',()=>this.open('hub'));
    }
    if (name === 'destinations') bindStarMap(document.querySelector('#modal-layer')!, this.mapId, {
      fuel:p.coreFuel, milestones:p.milestones, docked:this.actions.travelReady(), intel:this.actions.mapIntel(),
      depart:(id,recovery)=>{
        if(!this.actions.travelMap(id,recovery)){this.toast('Departure could not be saved. Fuel and colonies retained.');return false;}
        this.modal='transit';
        showTransit(document.querySelector<HTMLElement>('#modal-layer')!,id,()=>this.open('arrival'));
        return true;
      },
    });
    this.on('arrival-deploy',()=>this.close());
    this.on('star-map-back', () => {
      const previous=this.starMapReturn;
      if(previous==='intro'){this.showIntro();document.getElementById('intro-atlas')?.focus();}
      else if(previous&&previous!=='destinations'){this.open(previous);document.querySelector<HTMLButtonElement>('[data-hub="destinations"]')?.focus();}
      else this.close();
    });
    const search = document.querySelector<HTMLInputElement>('#codex-search');
    if (search) { search.value = this.codexQuery; search.oninput = () => { const cursor=search.selectionStart; this.codexQuery=search.value; this.codexPage=0; this.renderModal(); const next=document.querySelector<HTMLInputElement>('#codex-search'); next?.focus(); if(cursor!==null) next?.setSelectionRange(cursor,cursor); }; }
    this.on('open-codex', () => this.openCodex('drill'));
    this.on('codex-index', () => { this.codexListing = true; this.codexPage = 0; this.renderModal(); });
    this.on('codex-prev', () => { this.codexPage = Math.max(0,this.codexPage-1); this.renderModal(); });
    this.on('codex-next', () => { this.codexPage++; this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-codex-section]').forEach(b => b.onclick = () => { this.codexSection=Number(b.dataset.codexSection); this.codexPage=0; this.renderModal(); });
    this.on('codex-back', () => this.open(this.codexReturn));
    if (name === 'pause') this.on('account', () => this.openAccount('pause'));
    document.querySelectorAll<HTMLButtonElement>('[data-codex]').forEach(node => node.onclick = () => this.openCodex(node.dataset.codex!));
    for (const key of campLinks) this.on(`camp-nav-${key}`, () => this.open(key));
    document.querySelectorAll<HTMLButtonElement>('[data-hub]').forEach(node => node.onclick = () => this.open(node.dataset.hub!));
    this.on('workshop-build', () => this.open('construction'));
    document.querySelectorAll<HTMLButtonElement>('[data-buyer]').forEach(node => node.onclick = () => { this.civilianBuyer = node.dataset.buyer as CivilisationId; this.renderModal(); });
    document.querySelectorAll<HTMLInputElement>('[data-shipment]').forEach(node => {
      const update = () => {
        const ore = node.dataset.shipment as Ore;
        this.shipment[ore] = Math.max(0, Math.floor(Math.min(this.p.cargo[ore], Number(node.value) || 0) * 2) / 2);
        const quote = quoteCivilianShipment(this.p.cargo, this.shipment, this.civilianBuyer, this.p.deliveries);
        // Keep the active input and the next click target alive while editing.
        // Rebuilding the modal on blur used to discard the next field's edit.
        document.querySelector('.shipment-checkout strong')!.textContent = `K ${quote.total.toLocaleString()}`;
        document.querySelector('.shipment-checkout div > span')!.textContent = `K ${quote.gross} ore + K ${quote.bonus} project premium`;
        document.querySelector<HTMLButtonElement>('#ship-selected')!.disabled = quote.total <= 0;
      };
      node.oninput = update;
      node.onchange = () => { update(); node.value = String(this.shipment[node.dataset.shipment as Ore]); };
    });
    document.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(node => node.onclick = () => { this.plannedBuilding = node.dataset.plan as PlannedBuilding; this.renderModal(); });
    this.on('trade-surplus', () => {
      const stock = this.actions.warehouseStock(), materials = UNDERGROUND_BUILDING[this.plannedBuilding].materials as Partial<Cargo>;
      for (const ore of ORE_KEYS) this.shipment[ore] = Math.max(0, this.p.cargo[ore] - Math.max(0, (materials[ore] ?? 0) - stock[ore] - p.shipCargo[ore]));
      this.renderModal();
    });
    for (const [attribute, direction] of [['store', 'store'], ['take', 'withdraw']] as const) document.querySelectorAll<HTMLButtonElement>('[data-'+attribute+']').forEach(node => node.onclick = () => { this.actions.transferWarehouse(node.dataset[attribute] as Ore, direction, 1); this.renderModal(); });
    this.on('ship-selected', () => { const amount = this.actions.shipCivilian(this.civilianBuyer, this.shipment); if (amount) { this.shipment = emptyCargo(); this.campNotice = amount.toLocaleString()+' Kredits received from '+CIVILISATIONS[this.civilianBuyer].buyer+'. Shipment saved. Stored ore untouched.'; } this.renderModal(); });
    this.on('sale-next-service', () => this.open('service'));
    for (const section of ['miner', 'equipment', 'pilot'] as const) this.on(`workshop-${section}`, () => {
      this.workshopSection = section;
      this.campNotice = '';
      this.renderModal();
    });
    for (const key of UPGRADE_KEYS) this.on(`choose-${key}`, () => {
      this.selectedUpgrade = key;
      this.rigItem = 0;
      this.campNotice = '';
      this.renderModal();
    });
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
      this.campNotice = this.actions.serviceAll() ? 'Battery charged. Hull repaired. Your rig is ready.' : 'Service could not be completed. Check your Kredits and save storage.';
      this.renderModal();
    });
    for (const kind of ['platform', 'service'] as const) this.on(`build-${kind}`, () => {
      if (this.actions.buildStructure(kind)) { this.close(); this.toast(kind === 'service' ? 'Shelter deploying. Stay nearby for four seconds.' : 'Anchor deck built.'); return; }
      else this.toast('Build site blocked. Clear a five-tile cavern and move away from other structures.');
      this.renderModal();
    });
    if (this.nearSurface) for (const structure of this.actions.structures().filter((entry) =>
      ['habitat', 'turret', 'wall', 'gate', 'fort'].includes(entry.kind) && (entry.integrity ?? structureIntegrity(entry.kind)) < structureIntegrity(entry.kind))) {
      this.on(`repair-${encodeURIComponent(structure.id)}`, () => {
        if (this.actions.repairStructure(structure.id)) this.toast('COLONY DEFENSE REPAIRED · FULL INTEGRITY RESTORED.');
        else this.toast(`REPAIR NEEDS K ${SURFACE_RAID.repairCredits} AND A SURFACE BUILD YARD.`);
        this.renderModal();
      });
    }
    this.on('build-fort', () => {
      if (this.actions.buildStructure('fort')) {
        this.close();
        this.toast('FORT PLACEMENT · Choose a clear surface site. Enter builds; Escape cancels.');
      } else this.toast('Fort requires a clear planetary surface site and the listed materials.');
    });
    if (this.nearSurface) for (const turret of this.actions.structures().filter(entry => entry.kind === 'turret')) {
      this.on(`upgrade-turret-${encodeURIComponent(turret.id)}`, () => {
        this.toast(this.actions.upgradeTurret(turret.id) ? 'PYLON UPGRADED · RANGE AND RELOAD IMPROVED.' : 'UPGRADE FAILED · CHECK KREDITS AND SAVE STORAGE.');
        this.renderModal();
      });
    }
    this.on('build-trade-post', () => {
      if (this.actions.buildStructure('trade-post')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('Pick a spot. Build here. Repeat, or press Done.');
          return;
        }
        this.toast('Trading post established. Build another on a different planet to link the exchange.');
      } else this.toast('Trading post needs the listed ore and Kredits, and can be built once per planet at the surface.');
      this.renderModal();
    });
    this.on('build-warehouse', () => {
      if (this.actions.buildStructure('warehouse')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('Pick a spot. Build here. Repeat, or press Done.');
          return;
        }
        this.toast('Ore warehouse online. Press E nearby to manage this planet’s stock.');
      } else this.toast('Warehouse needs the listed ore and Kredits, and can be built once per planet at a clear surface site.');
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
          this.toast('Pick a spot. Build here. Repeat, or press Done.');
          return;
        }
        this.toast('Colony habitat online. Press E nearby to service the miner.');
      } else this.toast('Habitat needs the listed ore and Kredits, plus an open surface site.');
      this.renderModal();
    });
    this.on('build-turret', () => {
      if (this.actions.buildStructure('turret')) {
        if (this.actions.placementActive()) {
          this.close();
          this.toast('Pick a spot. Build here. Repeat, or press Done.');
          return;
        }
        this.toast('Sentry online. It intercepts rock swimmers that enter range.');
      } else this.toast('Build site blocked. Clear the cavern and move away from other structures.');
      this.renderModal();
    });
    this.on('buy-stasis', () => {
      if (this.actions.buyStasis()) this.toast('Stasis module installed. Hold X underground to hover; battery charge drains while active.');
      this.renderModal();
    });
    this.on('buy-return-winch', () => {
      if (this.actions.buyReturnWinch()) this.toast('Surface winch installed. Hold R on a clear tunnel route to reel back to the surface yard; battery use rises while active.');
      this.renderModal();
    });
    this.on('buy-escape-suit', () => {
      if (this.actions.buyEscapeSuit()) this.toast('Escape suit packed. If the miner is destroyed, pilot controls switch to jetpack flight.');
      this.renderModal();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-charge-mode]').forEach(button => button.onclick = () => { this.campNotice = this.actions.selectCharge(button.dataset.chargeMode!) ? 'Charge mode saved.' : 'Save failed.'; this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-fit-item]').forEach(button => button.onclick = () => { this.campNotice = this.actions.fitEquipment(button.dataset.fitItem!); this.renderModal(); });
    this.on('rig-back', () => this.open('hub'));
    document.querySelectorAll<HTMLButtonElement>('[data-rig-department]').forEach(button => button.onclick = () => { this.rigDepartment = button.dataset.rigDepartment as RigDepartment; this.rigItem = 0; this.campNotice = ''; this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-rig-item]').forEach(button => button.onclick = () => { this.rigItem = Number(button.dataset.rigItem); this.campNotice = ''; this.renderModal(); });
    this.on('catalogue-back', () => this.open('hub'));
    this.on('catalogue-colony', () => this.open('colony'));
    this.on('colony-build', () => this.open('construction'));
    this.on('colony-orders', () => this.open('orders'));
    this.on('orders-back', () => this.open('colony'));
    document.querySelectorAll<HTMLButtonElement>('[data-order-page]').forEach(button => button.onclick = () => { this.orderSelection = Number(button.dataset.orderPage); this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-order-track]').forEach(button => button.onclick = () => {
      this.trackedOrder = this.trackedOrder === button.dataset.orderTrack ? '' : button.dataset.orderTrack!; this.renderModal();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-order-deliver]').forEach(button => button.onclick = () => {
      const id = button.dataset.orderDeliver!;
      const ok = this.actions.deliverColonyOrder(id);
      this.campNotice = ok ? 'Delivered. Kredits received and progress saved.' : 'Delivery not saved. Check materials and try again.';
      if (ok && this.trackedOrder === id) this.trackedOrder = '';
      this.renderModal();
    });
    this.on('cargo-storage', () => this.open('warehouse'));
    this.on('colony-storage', () => this.open('warehouse'));
    this.on('colony-prev', () => { this.colonyPage = Math.max(0, this.colonyPage - 1); this.renderModal(); });
    this.on('colony-next', () => { this.colonyPage++; this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-colony-select]').forEach(button => button.onclick = () => {
      this.colonySelection = Number(button.dataset.colonySelect); this.colonyConfirm = false; this.renderModal();
    });
    this.on('colony-move', () => {
      const selected = this.actions.structures()[this.colonySelection];
      if (selected && this.actions.moveBuilding(selected.id)) this.close();
    });
    this.on('colony-locate', () => { const s = this.actions.structures()[this.colonySelection]; if (s) this.inspectBuilding(s.id); });
    this.on('building-manage', () => this.open('colony'));
    this.on('colony-dismantle', () => { this.colonyConfirm = true; this.modal = 'colony'; this.renderModal(); });
    this.on('colony-cancel', () => { this.colonyConfirm = false; this.renderModal(); });
    this.on('colony-confirm', () => {
      const selected = this.actions.structures()[this.colonySelection];
      if (selected && this.actions.dismantleBuilding(selected.id)) { this.colonySelection = 0; this.colonyPage = 0; }
      this.colonyConfirm = false; this.renderModal();
    });
    this.on('catalogue-storage', () => this.open('warehouse'));
    this.on('manage-next', () => { this.managedBuilding++; this.renderModal(); });
    document.querySelectorAll<HTMLButtonElement>('[data-build-group]').forEach(button => button.onclick = () => {
      this.buildGroup = button.dataset.buildGroup as BuildGroup; this.buildChoice = BUILD_GROUPS[this.buildGroup][0]; this.managedBuilding = 0; this.renderModal();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-build-choice]').forEach(button => button.onclick = () => {
      this.buildChoice = button.dataset.buildChoice as StructureKind; this.managedBuilding = 0; this.renderModal();
    });
    this.on('pilot-ship', () => this.close(false));
    this.on('close', () => {if(!this.hasStarted&&this.modal==='destinations')this.showIntro();else this.close();});
    this.on('resume', () => this.actions.resume());
    this.on('recover-stranded', () => { if (!this.actions.recoverStranded()) this.toast('The miner is no longer stranded.'); });
    this.on('save', () => this.actions.save());
    this.on('export-save', () => {
      const save = this.actions.exportSave();
      if (!save) { this.toast('Save could not be exported.'); return; }
      if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
      const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      this.exportUrl = URL.createObjectURL(blob);
      this.exportFilename = `ore-frontier-miner-${save.campaignSeed}.json`;
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
    this.on('defeat-new',()=>this.open('new'));
    this.on('confirm-new', () => this.actions.newGame());
    this.on('sell', () => {
      const receipt = this.actions.sell(this.selectedSaleBuyer), n = receipt?.total ?? 0;
      if (receipt) this.lastSale = receipt;
      this.renderModal();
      if (n) {
        document.querySelector('.sale-total span')!.textContent = 'KREDITS BANKED';
        const total = document.querySelector('.sale-total b')!;
        let start = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / 650);
          if (this.modal === 'sell') total.textContent = `+K ${Math.round(n * (1 - (1 - t) ** 3))}`;
          if (t < 1) requestAnimationFrame(tick);
        };
        tick();
      }
    });
    for (const ore of ORE_KEYS) {
      document.getElementById('warehouse-units-' + ore)?.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;
        if (input.validity.valid) this.warehouseAmounts[ore] = Number(input.value);
      });
      this.on('warehouse-discard-' + ore, () => {
        const input = document.querySelector<HTMLInputElement>('#warehouse-units-' + ore);
        if (!input || !input.reportValidity()) return;
        const units = Math.min(Number(input.value), this.p.cargo[ore]);
        if (units <= 0) return;
        this.warehouseAmounts[ore] = units;
        this.pendingWarehouseDiscard = { ore, units };
        this.renderModal();
      });
      this.on('warehouse-discard-all-' + ore, () => {
        const units = this.p.cargo[ore];
        if (units <= 0) return;
        this.pendingWarehouseDiscard = { ore, units };
        this.renderModal();
      });
      this.on('warehouse-store-' + ore, () => this.moveWarehouse(ore, 'store'));
      this.on('warehouse-store-all-' + ore, () => this.moveWarehouse(ore, 'store', true));
      this.on('warehouse-withdraw-' + ore, () => this.moveWarehouse(ore, 'withdraw'));
      this.on('warehouse-withdraw-all-' + ore, () => this.moveWarehouse(ore, 'withdraw', true));
    }
    this.on('cargo-discard',()=>{this.pendingWarehouseDiscard={ore:'copper',units:Math.min(1,p.cargo.copper)};this.open('discard');});
    for(const direction of [-1,1]) this.on(direction<0?'discard-prev':'discard-next',()=>{const pending=this.pendingWarehouseDiscard!;pending.ore=ORE_KEYS[(ORE_KEYS.indexOf(pending.ore)+direction+ORE_KEYS.length)%ORE_KEYS.length];pending.units=Math.min(1,p.cargo[pending.ore]);this.renderModal();});
    document.querySelectorAll<HTMLButtonElement>('[data-discard-amount]').forEach(b=>b.onclick=()=>{const pending=this.pendingWarehouseDiscard!;pending.units=Math.min(p.cargo[pending.ore],b.dataset.discardAmount==='max'?Number.MAX_SAFE_INTEGER:Number(b.dataset.discardAmount));this.renderModal();});
    this.on('cancel-warehouse-discard',()=>{this.pendingWarehouseDiscard=undefined;this.open('cargo');});
    this.on('confirm-warehouse-discard',()=>{const pending=this.pendingWarehouseDiscard;if(!pending)return;const removed=this.actions.discardOre(pending.ore,pending.units);this.pendingWarehouseDiscard=undefined;this.open('cargo');this.toast(removed?'Discard saved.':'Discard failed. Miner cargo retained.');});
    this.on('upgrade-warehouse', () => { this.toast(this.actions.upgradeWarehouse(this.modal === 'colony' ? this.actions.structures()[this.colonySelection]?.id : undefined) ? 'WAREHOUSE CAPACITY UPGRADED.' : 'UPGRADE FAILED · CHECK KREDITS AND SAVE STORAGE.'); this.renderModal(); });
    for (const extractor of this.actions.structures().filter((entry) => entry.kind === 'extractor')) this.on(`upgrade-extractor-${encodeURIComponent(extractor.id)}`, () => {
      this.toast(this.actions.upgradeExtractor(extractor.id) ? 'EXTRACTOR UPGRADED · NEW ORES AND RATE ONLINE.' : 'UPGRADE FAILED · CHECK KREDITS, ORE AND SAVE STORAGE.'); this.renderModal();
    });
    const buildExtractor = () => { if (this.actions.buildExtractor()) { this.close(); this.toast('CHOOSE EXTRACTOR SITE · PLACE / CANCEL'); } else { this.toast('BUILD FAILED · RETURN TO THE SURFACE.'); this.renderModal(); } };
    this.on('build-extractor', buildExtractor);
    this.on('warehouse-build-extractor', buildExtractor);
    this.on('fund-relay', () => {
      this.actions.contributeSystemProject();
      this.renderModal();
    });
    this.on('fund-tug', () => {
      this.actions.contributeCargoTug();
      this.renderModal();
    });
    this.on('fund-survey', () => {
      this.actions.contributeSurveyArray();
      this.renderModal();
    });
    for (const k of ['fuel', 'hull'] as const)
      this.on(`service-${k}`, () => {
        this.campNotice = this.actions.service(k) ? (k === 'fuel' ? 'Battery fully charged.' : 'Hull repaired to full strength.') : 'Service could not be completed. Check your Kredits.';
        this.renderModal();
      });
    for (const k of UPGRADE_KEYS)
      this.on(`buy-${k}`, () => {
        const before = p.max(k), installed = this.actions.buy(k);
        this.campNotice = installed ? `${UPGRADES[k].name} installed: ${Number(before.toFixed(2))} → ${Number(p.max(k).toFixed(2))} ${UPGRADES[k].unit}.` : 'Purchase could not be completed. Check the requirements and save storage.';
        this.renderModal();
        if (installed) document.querySelector('.rig-detail')?.classList.add('rig-installed');
      });
    for (const key of SPECIALIZATION_KEYS)
      this.on(`specialization-${key}`, () => {
        this.actions.selectSpecialization(key);
        this.renderModal();
      });
    for (const key of ['reinforcedHull','efficientCooling'] as const) this.on('install-specialist-' + key, () => {
      this.campNotice = this.actions.installSpecialist(key) ? 'Installation saved. Module active.' : 'Installation failed. Materials retained.';
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
    document.querySelectorAll<HTMLButtonElement>('[data-warehouse-source]').forEach(node => node.onclick = () => {
      const selected = node.dataset.warehouseSource as MapId;
      if (this.actions.warehouseMaps().includes(selected)) this.warehouseSourceMap = selected;
      this.renderModal();
    });
    mobileTrade();
    mobileStorage(this.mobileStorageOre, ore => { this.mobileStorageOre = ore; });
    this.clearPages = panelPages(document.querySelector<HTMLElement>('#modal-layer')!);
    const campMain = document.querySelector('.camp-main');
    if (campMain && previousFocusId) campMain.scrollTop = scrollTop;
    const previousFocus = previousFocusId ? document.getElementById(previousFocusId) : null;
    (
      (this.pendingWarehouseDiscard ? document.getElementById('cancel-warehouse-discard') : null) ??
      (previousFocus instanceof HTMLElement && !previousFocus.hasAttribute('disabled') ? previousFocus : null) ??
      (document.querySelector('.modal .primary:not(:disabled)') ??
        document.querySelector('.modal button:not(.close):not(:disabled)') ??
        document.querySelector('.close')) as HTMLElement
    )?.focus({ preventScroll: true });
  }
  setColonyAlert(text: string) {
    const alert = document.getElementById('colony-alert');
    if (alert && alert.textContent !== text) alert.textContent = text;
  }
  toast(text: string) {
    if (CAMP_MENUS.includes(this.modal)) {
      this.campNotice = text;
      const notice = document.getElementById('camp-notice');
      if (notice) { notice.textContent = text; notice.classList.remove('is-empty'); }
    }
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
    returnWinch = false, reeling = false, winchCableConnected = false, laserHeat = 0, laserVent = 0, laserTier = false, planetSurface = surface, coreDrillMode = false,
    mothershipNearby = false, mothershipBoarded = this.mothershipBoarded, shipComplete = this.p.shipComplete, inOrbit = this.inOrbit) {
    const p = this.p;
    document.getElementById('open-colony')?.classList.toggle('needs-attention', this.actions.structures().some(s => s.kind === 'extractor' && this.actions.extractorStatus(s).state !== 'Mining'));
    this.nearSurface = surface;
    const tracked = colonyOrders(this.mapId).find(o => o.id === this.trackedOrder && !p.milestones.includes(o.id)), tracker = document.getElementById('tracked-order');
    if (tracker) {
      tracker.hidden = !tracked || !!this.modal || this.paused;
      if (tracked) tracker.textContent = `${tracked.name}: ${Math.min(tracked.units, p.cargo[tracked.ore] + p.shipCargo[tracked.ore] + this.actions.warehouseStock()[tracked.ore])}/${tracked.units} ${ORES[tracked.ore].name}`;
    }
    this.onCrust = planetSurface;
    this.currentDepth = depth;
    this.docked = docked;
    for (const k of ['fuel', 'hull'] as const) {
      const ratio = p[k] / p.max(k);
      document.querySelector(`#${k}-label`)!.textContent =
        k === 'fuel' ? `${Math.ceil(p.fuel / p.max('fuel') * 100)}%` : pilotEscaping ? 'EJECTED' : `${Math.ceil(ratio * 100)}%`;
      const bar = document.querySelector(`#${k}-bar`) as HTMLElement;
      bar.style.width = `${ratio * 100}%`;
      bar.classList.toggle('low', ratio < 0.25);
    }
    const estimate = document.querySelector<HTMLElement>('#return-estimate')!;
    const winchFuel = estimateWinchReturnFuel(returnFuel), requiredFuel = returnWinch ? winchFuel : returnFuel;
    estimate.textContent = inOrbit || planetSurface ? '' : returnWinch
      ? winchCableConnected ? `WINCH · ~${winchFuel} charge · ${reeling ? 'REELING' : 'HOLD R'}` : 'WINCH BLOCKED · CLEAR TUNNEL ROUTE'
      : `RETURN EST. ~${returnFuel} charge · ROUTE EXTRA`;
    estimate.title = inOrbit || planetSurface ? '' : returnWinch
      ? winchCableConnected ? `Estimated Surface Winch charge: about ${winchFuel} charge. Hold R to reel along the clear route to the mothership.` : 'The Surface Winch needs a connected, mined tunnel route to the the mothership yard.'
      : `Estimated thrust charge to return: about ${returnFuel} charge. Route detours require extra charge.`;
    estimate.classList.toggle('tight', !inOrbit && !planetSurface && p.fuel < requiredFuel * 1.4);
    document.querySelector('#cargo-label')!.textContent = `${p.count} / ${p.max('cargo')}`;
    const carriedOres = ORE_KEYS.filter(ore => p.cargo[ore] > 0);
    const manifest = carriedOres.length
      ? carriedOres.map(ore => `<span class="cargo-manifest-ore"><i style="--ore:${ORES[ore].hex}"></i>${ORES[ore].name}<b>× ${p.cargo[ore]}</b></span>`).join('')
      : '<span class="cargo-manifest-empty">No ore aboard</span>';
    const manifestList = document.querySelector('#cargo-manifest-list')!;
    if (manifestList.innerHTML !== manifest) manifestList.innerHTML = manifest;
    document.querySelector('#core-fuel-label')!.textContent = p.coreFuel.toFixed(2);
    document.querySelector('#cargo-blocks')!.innerHTML = Array.from(
      { length: 16 },
      (_, i) => `<i class="${i < Math.ceil((p.count / p.max('cargo')) * 16) ? 'filled' : ''}"></i>`,
    ).join('');
    document.querySelector('#cargo-worth')!.textContent = p.count
      ? `HAUL VALUE  K ${p.cargoValue}`
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
    const depthPanel = document.querySelector<HTMLElement>('.depth-panel')!;
    depthPanel.classList.toggle('in-orbit', inOrbit);
    depthPanel.querySelector('.eyebrow')!.textContent = inOrbit ? 'MOTHERSHIP STATUS' : 'CURRENT DEPTH';
    document.querySelector('#depth')!.textContent = inOrbit ? 'ORBIT' : String(depth);
    depthPanel.querySelector('.depth-value small')!.classList.toggle('hidden', inOrbit);
    depthPanel.querySelector('.record')!.classList.toggle('hidden', inOrbit);
    depthPanel.querySelector('.depth-rule')!.classList.toggle('hidden', inOrbit);
    document.querySelector('#record')!.textContent = `${Math.floor(p.maxDepth)}m`;
    document.querySelector('#zone')!.textContent = MAPS[this.mapId].shortName;
    const coreRecords = p.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id));
    const townTier = surfaceTownTier(p.shipComponents, coreRecords);
    document.querySelector('#town-status')!.textContent = p.milestones.includes('mothership-origin') ? `MOTHERSHIP · ${this.actions.structures().filter(s => ['warehouse', 'habitat', 'trade-post'].includes(s.kind)).length} CAMP BUILDINGS` : [
      'PROSPECTOR CAMP · TIER 0', 'YARD EXPANSION · TIER 1', 'SKY DISTRICT · TIER 2',
      'CORE SKYWAY · TIER 3', 'BEACON TOWN · TIER 4',
    ][townTier]!;
    document.querySelector('#depth-note')!.textContent = inOrbit
      ? 'STABLE PARKING · OPEN WORLDS'
      : coreDrillMode
        ? 'CORE HALO · AIM 360° · HOLD CLICK TO MINE'
        : planetSurface
          ? docked ? 'SURFACE · HOLD S TO DRILL' : 'SURFACE ZONE · ABOVE CRUST'
          : `UNDERGROUND · ${stratumAt(depth, this.mapId)}`;
    document.querySelector('#control-e')!.textContent = mothershipBoarded
      ? inOrbit ? '' : 'DISEMBARK'
      : mothershipNearby ? 'BOARD MOTHERSHIP'
        : 'INTERACT';
    document.querySelector('#control-w')!.textContent = mothershipBoarded && !PREBUILD.travelEnabled ? 'TRAVEL COMING SOON' : mothershipBoarded && !inOrbit ? p.coreFuel > 0 ? 'TAKE OFF' : 'NEED CORE FUEL' : 'THRUST';
    document.querySelector('#control-s')!.textContent = mothershipBoarded
      ? inOrbit ? 'LAND' : ''
      : 'DOWN / DROP';
    document.querySelector('#grapple-key')!.classList.toggle('hidden', !p.grappleOwned);
    document.querySelector('#grapple-control')!.classList.toggle('hidden', !p.grappleOwned);
    const gravityNote = document.querySelector<HTMLElement>('#gravity-note')!;
    gravityNote.textContent = inOrbit ? '' : farHemisphere
      ? 'FAR HEMISPHERE · W CLIMBS OUTWARD'
      : depth >= coreDepth - 120
        ? coreDrillMode ? 'CORE CROSSING · STEER + DRILL 360°' : 'CORE PASSAGE · COAST THROUGH THE TURN'
        : '';
    gravityNote.classList.toggle('active', !!gravityNote.textContent);
    this.displayedMoney += (p.money - this.displayedMoney) * Math.min(1, dt * 9);
    if (Math.abs(p.money - this.displayedMoney) < 1) this.displayedMoney = p.money;
    document.querySelector('#money')!.textContent =
      `K ${Math.round(this.displayedMoney).toLocaleString()}`;
    document.querySelector<HTMLElement>('#station-dock')!.classList.toggle('hidden', !surface && !this.actions.atWarehouse() && !this.actions.sellAccess());
    document.querySelector<HTMLElement>('#station-dock')!.classList.toggle('warehouse-only', !surface);
    document.querySelector<HTMLElement>('#orbit-worlds')!.classList.toggle('hidden', !this.inOrbit);
    document.getElementById('camp-sell-hint')!.textContent = !this.actions.hasTradePost() ? 'Build a Market uplink to unlock sales' : p.count ? `${p.count} ore on board · base value ${credits(p.cargoValue)}` : 'Sell ore from Miner, Mothership or Planet warehouse';
    const serviceTotal = p.serviceCost('fuel') + p.serviceCost('hull');
    document.getElementById('camp-service-hint')!.textContent = serviceTotal || p.fuel < p.max('fuel') ? `Recharge free · repairs ${credits(serviceTotal)}` : 'Battery and hull ready.';
    this.updateMissionTip();
    if (this.savedAt && !this.saveFailed)
      document.querySelector('#save-status')!.textContent =
        `LOCAL SAVE · ${Math.floor((Date.now() - this.savedAt) / 1000)}s AGO`;
    document.querySelector('#low-warning')!.textContent = pilotEscaping ? 'ESCAPE SUIT ACTIVE · A / D STEER · W BOOSTS · REACH A SURFACE OR BEACON' : flightWarning({
      surface: planetSurface,
      fuelRatio: p.fuel / p.max('fuel'),
      hullRatio: p.hull / p.max('hull'),
      descentSpeed,
      inOrbit: this.inOrbit,
      cargoFull: p.count >= p.max('cargo'),
    });
    if (matchMedia('(any-pointer: coarse)').matches) {
      const warning = document.querySelector('#low-warning')!;
      warning.textContent = warning.textContent?.replaceAll('HOLD W', 'HOLD ↑').replaceAll('W BOOSTS', '↑ BOOSTS').replaceAll('A / D STEER', 'LEFT PAD STEERS') ?? '';
    }
  }
  private updateMissionTip() {
    const tip = document.querySelector<HTMLElement>('#tip');
    if (!tip) return;
    if (this.missionTipShownAt !== undefined && performance.now() - this.missionTipShownAt >= 5000) { tip.remove(); return; }
    const visible = this.hasStarted && !this.paused && !this.modal && !this.sheltered;
    tip.classList.toggle('hidden', !visible);
    if (!visible) return;
    this.missionTipShownAt ??= performance.now();
    const touch = matchMedia('(any-pointer: coarse)').matches;
    let objective = !this.actions.hasTradePost()
      ? { title: 'EQUIP · EXPLORE · ESTABLISH', body: touch ? 'Buy parts at the workshop. Hold FIRE to shoot your fitted weapon. Tools → BUILD places shelters; Enter shelter starts recovery.' : 'Buy parts at the workshop. Shift + click fires your weapon. Build underground shelters with B; enter with E to recover safely.' }
      : campaignObjective(this.p, this.mapId, this.actions.tradeNetworkCount(), this.actions.hasTradePost(), this.inOrbit, this.mothershipBoarded);
    if (touch && !this.inOrbit && !this.p.pilotEscaping) {
      if (!this.onCrust && (this.p.count >= this.p.max('cargo') || this.p.fuel < this.p.max('fuel') * 0.3)) {
        objective = { title: this.p.count >= this.p.max('cargo') ? 'CARGO FULL · RETURN HOME' : 'LOW BATTERY · RETURN HOME', body: 'Hold W on the left pad. Follow the tunnel you mined back to the ship.' };
      } else if (this.onCrust && this.p.count >= this.p.max('cargo')) {
        objective = { title: 'MAKE ROOM FOR BUILDING ORE', body: 'Open ship → Warehouse. Store spare ore, then take the materials you need. If both holds are full, discard a small amount from the miner.' };
      } else if (this.onCrust && this.p.fuel < this.p.max('fuel') * 0.7) {
        objective = { title: 'RECHARGE BEFORE YOUR NEXT RUN', body: 'Open ship → Recharge. Battery charging is free. Your ore stays aboard the miner.' };
      }
    }
    const signature = `${objective.title}\n${objective.body}`;
    if (signature === this.missionTipSignature) return;
    this.missionTipSignature = signature;
    tip.querySelector('#mission-headline')!.textContent = objective.title;
    tip.querySelector('#mission-body')!.textContent = objective.body;
  }
  setOrbitalOverview(active: boolean) {
    document.querySelector('#viewport')?.classList.toggle('orbital-overview-active', active);
  }
  setInOrbit(active: boolean) {
    this.inOrbit = active;
    if (active) this.setColonyAlert('');
  }
  setGrappleEnabled(enabled: boolean) {
    const control = document.querySelector<HTMLElement>('#grapple-control');
    if (!control) return;
    control.textContent = `AUTO HOOK ${enabled ? 'ON' : 'OFF'}`;
    control.setAttribute('aria-label', `Auto grapple ${enabled ? 'on' : 'off'}. Press H to toggle.`);
  }
  setMothershipBoarded(active: boolean) {
    this.mothershipBoarded = active;
  }
}
