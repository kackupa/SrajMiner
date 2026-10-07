import { CORE, CORE_RELICS, coreSurveyComplete, ORES, ORE_KEYS, ORE_SILHOUETTES, UPGRADES, UPGRADE_KEYS, upgradeValue, SPECIALIZATIONS, SPECIALIZATION_KEYS, stratumAt, CAMPAIGN_MILESTONES, ROUTE_FRAGMENTS, ROUTE_SURVEY_REWARDS, NAVIGATION_HASHES, CREW_ARCHIVE_CONCLUSION, SHIP_COMPONENTS, MAPS, REGION_FINDS, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, DESCENT_WARNING_SPEED, POD_PAINTS, POD_PAINT_KEYS, PILOT_SUITS, PILOT_SUIT_KEYS, POD_DECALS, POD_DECAL_KEYS, POD_PROFILES, POD_PROFILE_KEYS, drillWidth, UNDERGROUND_BUILDING, type Upgrade, type ShipComponent, type MapId, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from '../config';
import { parseSaveFile, type SaveData } from '../save/SaveManager';
import { Progress, type Cargo } from '../economy/Progress';
import type { Tile } from '../world/TileWorld';
import type { TileWorld } from '../world/TileWorld';
import type { PlayerPod } from '../player/PlayerPod';
import type { AudioMix } from '../audio/AudioSystem';
import { campaignMapRecords, crewArchiveRestored } from '../campaign/Records';
import { surfaceTownTier } from '../surface/SurfaceStation';
import { canAffordStructure, type StructureKind, type UndergroundStructure } from '../building/UndergroundStructures';
import { ESCAPE_SUIT } from '../config';
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
  save: () => void;
  sell: () => number;
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
  buildShipComponent: (key: ShipComponent) => boolean;
  travelMap: (id: MapId) => boolean;
  buildStructure: (kind: StructureKind) => boolean;
  structures: () => readonly UndergroundStructure[];
  surfaceAccess: () => boolean;
  exportSave: () => SaveData | null;
  importSave: (save: SaveData) => boolean;
};
export class HUD {
  modal = 'intro';
  hasStarted = false;
  paused = true;
  nearSurface = true;
  toastTimer = 0;
  displayedMoney = 80;
  lastSale?: { cargo: Cargo; total: number };
  savedAt = 0;
  saveFailed = false;
  targetSignature = '';
  mapId: MapId = 'cryo-shelf';
  mapOpen = false;
  pendingImport?: SaveData;
  exportUrl?: string;
  exportFilename = '';
  styleSection: 'paint' | 'suit' | 'decal' | 'profile' = 'paint';
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
    const cellW = width / columns, cellH = height / 44;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#101a20'; ctx.fillRect(0, 0, width, height);
    for (let y = firstRow; y < lastRow; y++)
      for (let x = 0; x < columns; x++) {
        const key = `${x},${y}`;
        if (world.destroyed.has(key)) {
          ctx.fillStyle = '#94c7b5';
          ctx.fillRect(x * cellW, (y - firstRow) * cellH, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
        }
        // The scanner reveals only nearby geology. Keep markers within explored cells
        // so the map remains a survey aid rather than an ore detector for the whole world.
        if (world.discovered.has(key) && !world.destroyed.has(key)) {
          const tile = world.get(x, y);
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
    ctx.arc((pod.x / 40) * cellW, (row - firstRow + 0.5) * cellH, 4, 0, Math.PI * 2);
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
  target(tile: Tile | undefined, ratio: number, warning: number, overflow?: { active: boolean; units: number; space: number }) {
    let panel = document.getElementById('drill-target');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'drill-target';
      panel.className = 'drill-target hidden';
      document.getElementById('viewport')!.appendChild(panel);
    }
    const signature = tile
      ? `${tile.x},${tile.y},${tile.oreUnits ?? 0},${tile.geode ? 1 : 0},${tile.regionFind ?? ''},${tile.signalHashId ?? ''},${tile.coreRelicId ?? ''},${this.p.levels.drill},${overflow?.active ? `${overflow.units}:${overflow.space}` : ''},${Math.round(ratio * 100)},${Math.ceil(warning * 10)}`
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
    const overflowWarning = full
      ? cargoSpace === 0
        ? `CARGO FULL — EXCESS ORE DROPS HERE. CLEAR THE ROUTE; RETURN AFTER SELLING TO COLLECT IT.`
        : `CARGO SHORT — ${cargoSpace} OF ${overflowUnits} UNITS FIT. THE REST DROPS HERE FOR YOUR RETURN TRIP.`
      : '';
    panel.innerHTML = `<div><b>${coreRelic ? '◈ PLANET CORE · ' : tile.geode ? '✦ PRISM GEODE · ' : regionalFind ? `✦ ${regionalFind.name} · ` : signalHash ? '◈ ARCHIVE HASH · ' : ''}${name.toUpperCase()}${ore && units !== 1 ? ` · +${units} UNITS` : ''}</b><span>${coreRelic ? `$${coreRelic.bounty} ARCHIVE SALVAGE CLAIM` : signalHash ? 'OPTIONAL HASH HAS NO CASH VALUE' : ore ? `$${ore.value} / unit` : 'NO ORE'} · ${width} BLOCK${width === 1 ? '' : 'S'} WIDE · ${this.p.drillTime(tile.hardness).toFixed(2)}s CUT</span></div><div class="cut-meter"><i style="width:${ratio * 100}%"></i></div><small>${full ? overflowWarning : coreRelic ? `${coreRelic.detail} · CUT TO RECORD PLANET · ${Math.round(ratio * 100)}%` : signalHash ? `${signalHash.detail} · CUTTING ${Math.round(ratio * 100)}%` : tile.geode ? `RARE CRYSTAL POCKET · GUARANTEED 3 UNITS · CUTTING ${Math.round(ratio * 100)}%` : regionalFind ? `${regionalFind.detail} · CUTTING ${Math.round(ratio * 100)}%` : `CUTTING ${Math.round(ratio * 100)}%`}</small>`;
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
      <main id="viewport"><div id="game" aria-label="Mining campaign. Use WASD or arrow keys to fly and drill." role="application" tabindex="0"></div>
      <aside class="telemetry"><div class="eyebrow">POD TELEMETRY <span class="status-dot"></span></div><div class="meter-head"><span>FUEL</span><strong id="fuel-label"></strong></div><div class="meter"><i id="fuel-bar"></i></div><small id="return-estimate" class="return-estimate"></small><div class="meter-head"><span>HULL</span><strong id="hull-label"></strong></div><div class="meter hull"><i id="hull-bar"></i></div><div class="cargo-line"><span>▦ &nbsp;CARGO</span><strong id="cargo-label"></strong></div><div class="cargo-blocks" id="cargo-blocks"></div><div class="cargo-worth" id="cargo-worth"></div><div class="tool-stock hidden" id="tool-stock"><span>Q · MINING CHARGE</span><b id="charge-count">0</b></div></aside>
      <aside class="depth-panel"><div class="eyebrow">CURRENT DEPTH</div><div class="depth-value"><span id="depth">0</span><small>m</small></div><div class="record">DEEPEST <span id="record">0m</span></div><div class="depth-rule"></div><div id="depth-note">SURFACE OPERATIONS</div><div id="gravity-note" aria-live="polite"></div></aside>
      <div class="location-label"><span class="eyebrow">ICE MOON / CRYO SHELF</span><span>VESPER-9 · FARADAY HAB-07</span></div>
      <div id="tip" class="mission-tip"><span class="tip-icon">↧</span><div><b>A little deeper. A little richer.</b><span>Aim and hold left-click to drill, even while steering or using W thrust. Hold S to descend and cut below.</span></div></div>
      <div id="drill-target" class="drill-target hidden"></div><div id="route-map-panel" class="route-map-panel hidden"><div><b>EXPLORED TUNNELS</b><button id="map-close" aria-label="Close explored map">×</button></div><canvas id="route-map" width="240" height="220" aria-label="Map of explored tunnels and nearby surveyed ore"></canvas><div class="map-legend" aria-label="Ore map legend">${ORE_KEYS.map((key) => `<span><i class="ore-key ore-${ORE_SILHOUETTES[key]}" data-ore="${key}" role="img" aria-label="${ORES[key].name} marker" style="--ore-color:${ORES[key].hex}"></i>${ORES[key].name}</span>`).join('')}<span><i class="special"></i>Signature find</span><span><i class="hash"></i>Archive hash</span></div><small>Ore appears only after your scanner surveys nearby rock · M toggles map</small></div><div id="toast" role="status" aria-live="polite"></div><div id="low-warning" role="status"></div>
      <div class="station-dock" id="station-dock"><div class="dock-label"><i></i><div><b>HAB 07</b><span id="town-status">PROSPECTOR CAMP · TIER 0</span></div></div><button id="open-sell"><span>01</span> SELL ORE <b>↗</b></button><button id="open-service"><span>02</span> SERVICE <b>＋</b></button><button id="open-upgrades"><span>03</span> UPGRADES <b>↑</b></button><button id="open-archive"><span>04</span> ARCHIVE <b>▤</b></button><button id="open-shipyard"><span>05</span> SHIPYARD <b>↗</b></button><button id="open-destinations"><span>06</span> MAPS <b>⌖</b></button><button id="open-paints"><span>07</span> PAINT <b>✦</b></button></div>
      <input id="save-import-input" type="file" accept="application/json,.json" hidden /><div id="modal-layer" class="modal-layer"></div></main>
      <footer><div class="controls"><kbd>A</kbd><kbd>D</kbd> MOVE <span></span>MOUSE AIM + DRILL IN FLIGHT <span></span><kbd>S</kbd> DOWN / DROP <span></span><kbd>W</kbd> THRUST <span></span><kbd>E</kbd> SELL / SERVICE <span></span><kbd>B</kbd> BUILD <span></span><kbd>R</kbd> WINCH <span></span><kbd>Q</kbd> CHARGE <span></span><kbd>X</kbd> STASIS <span></span><kbd>M</kbd> MAP <span></span><kbd>ESC</kbd> PAUSE</div><div class="bank"><span>BANKED CREDITS</span><b id="money">$80</b></div><div class="save-status" id="save-status">LOCAL SAVE · READY</div></footer>`;
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
  private updateMuteButton(muted: boolean) {
    const button = document.querySelector<HTMLButtonElement>('#audio');
    if (!button) return;
    button.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    button.setAttribute('aria-pressed', String(muted));
  }
  open(name: string) {
    if (!this.nearSurface && ['sell', 'service', 'upgrades'].includes(name)) return;
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
          briefing: 'Recover ore and navigation fragments from Vesper-9. Bring each haul home to build the launch craft and chart new regions. Ship projects and planetary core records grow Hab 07 upward into a sky town. Your tunnels stay yours.',
        };
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal intro" role="dialog" aria-modal="true" aria-label="Expedition briefing"><div class="eyebrow">${intro.eyebrow}</div><div class="intro-symbol">✦</div><h1>${intro.headline}</h1><p>${intro.dek}</p><div class="intro-loop"><span>01 <b>${intro.loop[0]}</b></span><i>→</i><span>02 <b>${intro.loop[1]}</b></span><i>→</i><span>03 <b>${intro.loop[2]}</b></span></div><p class="briefing">${intro.briefing}</p><div class="intro-controls" aria-label="Game controls"><div><kbd>A</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>S</kbd><span>DESCEND / DRILL</span></div><div><kbd>W</kbd><span>THRUST UP</span></div><div><kbd>E</kbd><span>SELL / SERVICE</span></div><div><kbd>B</kbd><span>BUILD AT DEPTH</span></div><div><kbd>M</kbd><span>EXPLORED MAP</span></div><div><kbd>ESC</kbd><span>PAUSE</span></div></div><p class="intro-risk">ORE FILLS CARGO · WATCH THE RETURN-FUEL ESTIMATE AND KEEP A RESERVE.</p><button class="primary" id="launch">${this.loaded ? 'CONTINUE EXPEDITION' : 'BEGIN EXPEDITION'} <span>↗</span></button><small class="intro-note">ORIGINAL REACTIVE SYNTH MUSIC · Q USES A PURCHASED CHARGE · X USES AN INSTALLED STASIS MODULE · R USES THE OPTIONAL SURFACE WINCH</small></section>`;
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
      title = 'Make a foothold.';
      sub = 'UNDERGROUND FABRICATOR';
      const structures = this.actions.structures();
      const materials = (kind: StructureKind) => Object.entries(UNDERGROUND_BUILDING[kind].materials)
        .map(([ore, units]) => `${units} ${ore.toUpperCase()}`).join(' · ');
      const platformCount = structures.filter((entry) => entry.kind === 'platform').length;
      const hasService = structures.some((entry) => entry.kind === 'service');
      const turretCount = structures.filter((entry) => entry.kind === 'turret').length;
      const option = (kind: StructureKind, label: string, description: string, owned: boolean) => {
        const cost = UNDERGROUND_BUILDING[kind];
        const affordable = canAffordStructure(kind, p.cargo, p.money);
        const blocked = !affordable || owned || structures.length >= UNDERGROUND_BUILDING.maxStructuresPerMap;
        const buttonText = owned ? 'ALREADY BUILT' : !affordable ? 'NEED ORE / CREDITS' : `BUILD · $${cost.credits}`;
        return `<article class="service-row"><div><b>${label}</b><small>${description}<br>BUILD COST · ${materials(kind)} + $${cost.credits}</small></div><button id="build-${kind}" ${blocked ? 'disabled' : ''}>${buttonText}</button></article>`;
      };
      content = `<p>Build in a cleared cavern. Down drops through decks; local gravity decides which side catches you. Structures stay on this planet.</p><div class="upgrade-list">${option('platform', 'ANCHOR DECK', 'A five-tile landing and staging platform.', platformCount >= 12)}${option('service', 'REFUEL BEACON', 'One per planet. Press E nearby to refuel or repair at standard prices.', hasService)}${option('turret', 'SENTRY TURRET', `${turretCount}/3 built. Automatically intercepts rock swimmers in range.`, turretCount >= UNDERGROUND_BUILDING.turret.maxPerMap)}</div><p class="fine">Construction requires a 180 m+ site and open room around the build point.</p>`;
    } else if (name === 'audio') {
      const mix = this.actions.audioMix();
      title = 'Tune the sound.';
      sub = 'AUDIO / LOCAL SETTINGS';
      content = `<p>Set the soundtrack and game effects to suit your speakers. Your levels are saved on this device.</p><div class="audio-mix-controls"><label for="music-volume"><span><b>MUSIC</b><output id="music-value">${mix.music}%</output></span><input id="music-volume" type="range" min="0" max="100" step="5" value="${mix.music}" /></label><label for="effects-volume"><span><b>EFFECTS</b><output id="effects-value">${mix.effects}%</output></span><input id="effects-volume" type="range" min="0" max="100" step="5" value="${mix.effects}" /></label></div><button id="audio-mute" class="primary">${this.actions.isMuted() ? 'SOUND OFF · TURN ON' : 'SOUND ON · MUTE'} <span>♪</span></button>`;
    } else if (name === 'sell') {
      title = 'A good day’s haul.';
      sub = 'ORE EXCHANGE / OUTPOST 07';
      content = `<div class="ore-list">${ORE_KEYS.map((k) => `<div><span><i style="background:${ORES[k].hex}"></i>${ORES[k].name}</span><span>× ${saleCargo[k]}</span><b>$${saleCargo[k] * ORES[k].value}</b></div>`).join('')}</div><div class="sale-total"><span>${receipt ? 'CREDITS BANKED' : 'ESTIMATED PAYOUT'}</span><b>$${receipt?.total ?? p.cargoValue}</b></div><button id="sell" class="primary" ${p.count ? '' : 'disabled'}>SELL CARGO <span>↗</span></button>`;
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
        const current = upgradeValue(k, lv), next = upgradeValue(k, lv + 1), nextCost = p.cost(k), progressPips = (lv - 1) % 5 + 1,
          formatStat = (n: number) => Number(n.toFixed(2)).toLocaleString(), shortfall = Math.max(0, Math.ceil(nextCost - p.money));
        return `<div class="upgrade-row"><span class="upgrade-icon">${u.icon}</span><div><b>${u.name.toUpperCase()} <small>LV ${lv} → ${lv + 1}</small></b><p>${formatStat(current)} → ${formatStat(next)}${u.unit} · +${Math.round((next / current - 1) * 100)}%</p><div class="level-pips" aria-label="${progressPips} of 5 steps in this upgrade tier">${u.values.map((_, i) => `<i class="${i < progressPips ? 'filled' : ''}"></i>`).join('')}</div></div><div class="purchase"><button id="buy-${k}" ${p.money < nextCost ? 'disabled' : ''}>$${nextCost} ↑</button>${p.money < nextCost ? `<small>Need $${shortfall} more</small>` : ''}</div></div>`;
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
      const coreCount = CORE_RELICS.filter((relic) => p.milestones.includes(relic.id)).length;
      const mapRecords = campaignMapRecords(this.getMapDepths(), p.routeFragments, p.milestones);
      const crewConclusion = crewArchiveRestored(p.milestones)
        ? `<article class="archive-entry found" id="crew-archive-conclusion"><span>CREW ARCHIVE RESTORED · FINAL ENTRY</span><b>${CREW_ARCHIVE_CONCLUSION.title}</b><blockquote class="crew-log"><span>${CREW_ARCHIVE_CONCLUSION.author} · ${CREW_ARCHIVE_CONCLUSION.role}</span>${CREW_ARCHIVE_CONCLUSION.transcript}</blockquote></article>`
        : `<article class="archive-entry" id="crew-archive-conclusion"><span>CREW ARCHIVE INCOMPLETE · ${hashCount} / ${NAVIGATION_HASHES.length}</span><b>UNRESOLVED CREW ARCHIVE</b><p>Recover each regional navigation hash to reconstruct the flight crew's final message.</p></article>`;
      const coreConclusion = coreSurveyComplete(p.milestones)
        ? '<article class="archive-entry found" id="core-survey-conclusion"><span>PLANETARY CORE LEDGER COMPLETE · 4 / 4</span><b>FOUR WORLDS, ONE DEEP SIGNAL</b><p>Each planetary core has been sampled and its record is preserved in the archive.</p></article>'
        : `<article class="archive-entry" id="core-survey-conclusion"><span>PLANETARY CORE LEDGER · ${coreCount} / ${CORE_RELICS.length}</span><b>CORE SURVEY INCOMPLETE</b><p>Recover one unique core record from each destination. Every sample pays a one-time archive salvage claim.</p></article>`;
      const regionRecords = `<section class="region-records" aria-label="Regional survey records"><h3>REGIONAL SURVEY RECORDS</h3><div class="region-record-grid">${mapRecords.map((record) => `<article class="archive-entry ${record.visited ? 'found' : ''}" data-map-record="${record.id}"><span>${record.visited ? 'SURVEY RECORDED' : 'NOT VISITED'}</span><b>${record.name.toUpperCase()}</b><p>${record.visited ? `Deepest scan: ${record.deepestMeters.toLocaleString()} m` : 'No depth record yet'}${record.routeTotal ? `<br>${record.routeRecovered} / ${record.routeTotal} route signals` : ''}<br>${record.hashesRecovered} / ${record.hashTotal} archive hash${record.hashTotal === 1 ? '' : 'es'}<br>CORE · ${record.coreRecovered ? 'RECOVERED' : 'SEALED'} · ${record.coreName}</p></article>`).join('')}</div></section>`;
      content = `<p>Recovered route data: <b>${p.routeFragments.length} / ${ROUTE_FRAGMENTS.length} fragments</b>. Optional navigation hashes: <b>${hashCount} / ${NAVIGATION_HASHES.length}</b> · no cash value. Planetary cores: <b>${coreCount} / ${CORE_RELICS.length}</b>. Deepest scan: <b>${Math.floor(p.maxDepth)} m</b>. Each route signal carries a one-time salvage claim for a long-range ship component.</p>${regionRecords}<div class="archive-list">${coreConclusion}<article class="archive-entry ${p.artifact ? 'found' : ''}" id="deep-signal-record"><span>${deepSignalStatus}</span><b>UNKNOWN DEEP SIGNAL</b><p>${deepSignalDetail}</p></article>${ROUTE_FRAGMENTS.map((fragment) => {
        const found = p.routeFragments.includes(fragment.id);
        return `<article class="archive-entry ${found ? 'found' : ''}"><span>${found ? 'RECOVERED · CLAIM PAID' : `DEPTH ${fragment.row * 12} M · +$${ROUTE_SURVEY_REWARDS[fragment.id]} CLAIM`}</span><b>${fragment.landmark}</b><p>${fragment.title} — ${found ? fragment.detail : 'A luminous data seam is waiting in this chamber.'}</p></article>`;
      }).join('')}${NAVIGATION_HASHES.map((hash) => {
        const found = p.milestones.includes(hash.id);
        return `<article class="archive-entry ${found ? 'found' : ''}" id="${hash.id}"><span>${found ? 'RECOVERED · OFFLINE COLLECTIBLE' : `${MAPS[hash.mapId].name.toUpperCase()} · ${hash.row * 12} M · OPTIONAL`}</span><b>${hash.name} · ${found ? hash.hash : 'HASH UNRESOLVED'}</b>${found ? `<blockquote class="crew-log"><span>${hash.crew} · ${hash.role}</span>${hash.transcript}</blockquote>` : ''}<p>${found ? hash.detail : 'A fictional navigation checksum is encoded in a deep-rock signal seam.'} · No exchange value.</p></article>`;
      }).join('')}${crewConclusion}</div>`;
    } else if (name === 'shipyard') {
      title = p.shipComplete ? 'The long-range craft is ready.' : 'Build the launch craft.';
      sub = 'SHIPYARD / SURFACE HAB';
      content = `<p>Sell recovered ore to fund the frame, propulsion, navigation, and habitat systems. Every component is purchased with banked expedition credits.</p><div class="ship-list">${Object.entries(SHIP_COMPONENTS).map(([key, item]) => {
        const built = p.shipComponents.includes(key);
        return `<div class="service-row"><div><b>${item.name.toUpperCase()}</b><small>${built ? 'Installed' : item.description}</small></div><button id="ship-${key}" ${built || p.money < item.cost ? 'disabled' : ''}>${built ? 'INSTALLED' : `$${item.cost} →`}</button></div>`;
      }).join('')}</div>${p.shipComplete ? '<div class="sale-total"><span>SHIP STATUS</span><b>CRAFT ASSEMBLED · REGIONS AVAILABLE</b></div>' : `<p class="fine">${p.shipComponents.length} / ${Object.keys(SHIP_COMPONENTS).length} components installed. A complete craft unlocks free travel to charted regions.</p>`}`;
    } else if (name === 'destinations') {
      title = 'Choose the next descent.';
      sub = 'DESTINATION BOARD / LONG-RANGE CRAFT';
      content = `<p>${p.shipComplete ? 'The ship can reach every charted region. Each map keeps its own tunnels and discoveries.' : 'Assemble the launch craft to travel beyond this shelf.'}</p><div class="destination-list">${(Object.keys(MAPS) as MapId[]).map((id) => {
        const unlocked = id === this.mapId || id === 'cryo-shelf' || p.shipComplete;
        const current = id === this.mapId;
        const description = id === 'mars-frontier' ? 'Legacy frontier · persistent original-world saves' : id === 'cryo-shelf' ? 'Branching ice caverns · stable starter ores' : id === 'hull-graveyard' ? 'Wide wreck chambers · structural salvage' : 'Narrow crystal seams · valuable deep deposits';
        const core = CORE_RELICS.find((entry) => entry.mapId === id)!;
        const objective = p.milestones.includes(core.id) ? `CORE RECORD LOGGED · ${core.name}` : `CORE OBJECTIVE · RECOVER ${core.name} · $${core.bounty} CLAIM`;
        return `<div class="service-row"><div><b>${MAPS[id].name.toUpperCase()}</b><small>${description}<br>${objective}</small></div><button id="map-${id}" ${!unlocked || current ? 'disabled' : ''}>${current ? 'CURRENT' : unlocked ? 'TRAVEL →' : 'SHIP REQUIRED'}</button></div>`;
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
      title = 'Take a breath.';
      sub = 'EXPEDITION PAUSED';
      const exportControl = this.exportUrl
        ? `<a id="download-save" class="pause-download" href="${this.exportUrl}" download="${this.exportFilename}">DOWNLOAD SAVE FILE ↓</a>`
        : '<button id="export-save">EXPORT SAVE</button>';
      content = `<p>The mine will be here when you get back.</p><button id="resume" class="primary">RESUME EXPEDITION <span>→</span></button><div class="pause-actions"><button id="save">SAVE EXPEDITION</button>${exportControl}<button id="import-save">IMPORT SAVE</button><button id="rescue">EMERGENCY RECOVERY</button><button id="new">NEW EXPEDITION</button></div><p class="fine">Recovery loses your unsold ore. Banked credits, upgrades, and excavated tunnels are kept.</p>`;
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
      title = 'The planet keeps its share.';
      sub = 'POD RECOVERED / CARGO LOST';
      content =
        '<p>Your unsold ore was lost. Your banked credits, upgrades, and excavated tunnels are safe. A refueled, repaired pod is waiting at the outpost.</p><button id="resume" class="primary">BACK TO THE SURFACE <span>↑</span></button>';
    }
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal ${['upgrades', 'archive', 'shipyard', 'destinations', 'paints', 'construction'].includes(name) ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${sub}"><button class="close" id="close" aria-label="Close panel">×</button><div class="eyebrow">${sub}</div><h2>${title}</h2>${['sell', 'service', 'upgrades'].includes(name) && (name !== 'service' || this.actions.surfaceAccess()) ? `<nav class="outpost-tabs" aria-label="Outpost services">${['sell', 'service', 'upgrades'].map((k) => `<button id="tab-${k}" aria-pressed="${name === k}">${k === 'sell' ? 'Sell ore' : k === 'service' ? 'Service' : 'Upgrades'}</button>`).join('')}</nav>` : ''}${content}<div class="modal-bank">AVAILABLE CREDIT <b>$${p.money.toLocaleString()}</b></div></section>`;
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
    this.on('service-all', () => {
      this.actions.serviceAll();
      this.renderModal();
    });
    for (const kind of ['platform', 'service'] as const) this.on(`build-${kind}`, () => {
      if (this.actions.buildStructure(kind)) this.toast(kind === 'service' ? 'Refuel beacon built. E opens the underground service stop.' : 'Anchor deck built. It catches the pod under local gravity.');
      else this.toast('Build site blocked. Clear a five-tile cavern and move away from other structures.');
      this.renderModal();
    });
    this.on('build-turret', () => {
      if (this.actions.buildStructure('turret')) this.toast('Sentry online. It intercepts rock swimmers that enter range.');
      else this.toast('Build site blocked. Clear the cavern and move away from other structures.');
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
      const cargo = { ...p.cargo };
      const n = this.actions.sell();
      if (n) this.lastSale = { cargo, total: n };
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
  }
  update(depth: number, surface: boolean, dt: number, docked = false, returnFuel = 0, descentSpeed = 0, farHemisphere = false, pilotEscaping = false) {
    const p = this.p;
    this.nearSurface = surface;
    for (const k of ['fuel', 'hull'] as const) {
      const ratio = p[k] / p.max(k);
      document.querySelector(`#${k}-label`)!.textContent =
        k === 'fuel' ? `${Math.ceil(p.fuel)} / ${p.max('fuel')} L` : pilotEscaping ? 'EJECTED' : `${Math.ceil(ratio * 100)}%`;
      const bar = document.querySelector(`#${k}-bar`) as HTMLElement;
      bar.style.width = `${ratio * 100}%`;
      bar.classList.toggle('low', ratio < 0.25);
    }
    const estimate = document.querySelector<HTMLElement>('#return-estimate')!;
    estimate.textContent = surface ? '' : `RETURN EST. ~${returnFuel} L · ROUTE EXTRA`;
    estimate.classList.toggle('tight', !surface && p.fuel < returnFuel * 1.4);
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
    document.querySelector('#depth')!.textContent = String(depth);
    document.querySelector('#record')!.textContent = `${Math.floor(p.maxDepth)}m`;
    document.querySelector('#zone')!.textContent = MAPS[this.mapId].shortName;
    const coreRecords = p.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id));
    const townTier = surfaceTownTier(p.shipComponents, coreRecords);
    document.querySelector('#town-status')!.textContent = [
      'PROSPECTOR CAMP · TIER 0', 'YARD EXPANSION · TIER 1', 'SKY DISTRICT · TIER 2',
      'CORE SKYWAY · TIER 3', 'BEACON TOWN · TIER 4',
    ][townTier]!;
    document.querySelector('#depth-note')!.textContent = surface
      ? 'SURFACE OPERATIONS'
      : stratumAt(depth, this.mapId);
    const gravityNote = document.querySelector<HTMLElement>('#gravity-note')!;
    gravityNote.textContent = farHemisphere
      ? 'FAR HEMISPHERE · W CLIMBS OUTWARD'
      : depth >= CORE.depthMeters - 120
        ? 'CORE PASSAGE · GRAVITY FLIPS BEYOND'
        : '';
    gravityNote.classList.toggle('active', !!gravityNote.textContent);
    this.displayedMoney += (p.money - this.displayedMoney) * Math.min(1, dt * 9);
    if (Math.abs(p.money - this.displayedMoney) < 1) this.displayedMoney = p.money;
    document.querySelector('#money')!.textContent =
      `$${Math.round(this.displayedMoney).toLocaleString()}`;
    document.querySelector('#station-dock')!.classList.toggle('hidden', !surface);
    const tip = document.querySelector('#tip')!;
    tip.classList.toggle('hidden', !docked);
    tip.querySelector('b')!.textContent = 'Magnetic dock engaged.';
    tip.querySelector(':scope > div > span')!.textContent =
      'S to enter the mine · W to launch · A / D to move';
    if (this.savedAt && !this.saveFailed)
      document.querySelector('#save-status')!.textContent =
        `LOCAL SAVE · ${Math.floor((Date.now() - this.savedAt) / 1000)}s AGO`;
    document.querySelector('#low-warning')!.textContent = pilotEscaping ? 'ESCAPE SUIT ACTIVE · A / D STEER · W BOOSTS · REACH A SURFACE OR BEACON' : flightWarning({
      surface,
      fuelRatio: p.fuel / p.max('fuel'),
      hullRatio: p.hull / p.max('hull'),
      descentSpeed,
      cargoFull: p.count >= p.max('cargo'),
    });
  }
}
