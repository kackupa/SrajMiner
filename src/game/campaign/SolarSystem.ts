import { MAPS, ORES, SOLAR_SYSTEM, vesperChapterUnlocked, type MapId, type Ore } from '../config';
export type SolarPlanetIntel = {
  visited: boolean;
  tradingPost: boolean;
  warehouse: Record<Ore, number> | null;
  facilities: number;
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
/** Accessible, keyboard-friendly mothership route selector. */
export class SolarView {
  root = document.createElement('section');
  canvas = document.createElement('canvas');
  status = document.createElement('p');
  list = document.createElement('div');
  detail = document.createElement('aside');
  button = document.createElement('button');
  selected: MapId = 'mars-frontier';
  private initializedSelection = false;
  private lastInfoSignature = '';
  private lastDraw?: { p: SolarPosition; fuel: number; milestones: string[]; currentMap: MapId; shipComplete: boolean; intel: Record<MapId, SolarPlanetIntel>; commander: SolarCommanderIntel };
  private readonly resize = () => {
    if (this.lastDraw) this.draw(this.lastDraw.p, this.lastDraw.fuel, this.lastDraw.milestones,
      this.lastDraw.currentMap, this.lastDraw.shipComplete, this.lastDraw.intel, this.lastDraw.commander);
  };
  private entries = new Map<MapId, HTMLButtonElement>();
  constructor(land: (id: MapId) => void) {
    this.root.className = 'solar-flight';
    this.root.innerHTML = '<header><small>MOTHERSHIP FLIGHT DECK</small><h1>CHOOSE A WORLD</h1><p>Select a destination to review its route, local terrain, and fuel cost.</p></header>';
    this.canvas.setAttribute('aria-label', 'Star map. Select a planet or use the destination buttons below.');
    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect(), w = this.canvas.width, h = this.canvas.height;
      const scale = Math.min(w / 1120, h / 620), x = ((event.clientX - rect.left) / rect.width * w - w / 2) / scale,
        y = ((event.clientY - rect.top) / rect.height * h - h / 2) / scale;
      const id = (Object.keys(MAPS) as MapId[]).find((candidate) => distance({ x, y }, planetPosition(candidate)) < 48);
      if (id && !this.entries.get(id)?.disabled) this.entries.get(id)?.click();
    });
    this.list.className = 'solar-planet-list';
    this.list.setAttribute('aria-label', 'Planet destinations');
    for (const id of Object.keys(MAPS) as MapId[]) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'solar-planet-choice';
      entry.onclick = () => {
        this.selected = id;
        this.lastInfoSignature = '';
        this.refreshSelection();
        if (this.lastDraw) this.draw(this.lastDraw.p, this.lastDraw.fuel, this.lastDraw.milestones,
          this.lastDraw.currentMap, this.lastDraw.shipComplete, this.lastDraw.intel, this.lastDraw.commander);
      };
      this.entries.set(id, entry);
      this.list.append(entry);
    }
    this.detail.className = 'solar-destination-detail';
    this.status.className = 'solar-status';
    this.button.className = 'solar-travel-button';
    this.button.onclick = () => land(this.selected);
    this.root.append(this.canvas, this.list, this.detail, this.status, this.button);
    document.body.append(this.root);
    window.addEventListener('resize', this.resize);
  }
  destroy() { window.removeEventListener('resize', this.resize); this.root.remove(); }
  private refreshSelection() {
    for (const [id, entry] of this.entries) {
      entry.setAttribute('aria-pressed', String(id === this.selected));
      entry.classList.toggle('selected', id === this.selected);
    }
  }
  draw(p: SolarPosition, fuel: number, milestones: string[], currentMap: MapId, shipComplete: boolean,
    planetIntel: Record<MapId, SolarPlanetIntel>, commander: SolarCommanderIntel) {
    this.lastDraw = { p, fuel, milestones, currentMap, shipComplete, intel: planetIntel, commander };
    const w = (this.canvas.width = Math.max(320, Math.floor(this.root.clientWidth))),
      h = (this.canvas.height = Math.max(170, Math.min(250, Math.floor(window.innerHeight * .31))));
    const c = this.canvas.getContext('2d')!, scale = Math.min(w / 1120, h / 620), ox = w / 2, oy = h / 2;
    c.fillStyle = '#070e1c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 100; i++) { c.fillStyle = i % 3 ? '#52627c' : '#c7e4ec'; c.fillRect((i * 173.3) % w, (i * 91.7) % h, 1.5, 1.5); }
    c.save(); c.translate(ox, oy); c.scale(scale, scale);
    c.strokeStyle = '#243448'; c.lineWidth = 1 / scale;
    for (const r of [160, 280, 400, 530]) { c.beginPath(); c.ellipse(0, 0, r, r * .55, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#ffc878'; c.shadowColor = '#ffac50'; c.shadowBlur = 30; c.beginPath(); c.arc(0, 0, 32, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    for (const id of Object.keys(MAPS) as MapId[]) {
      const q = planetPosition(id), unlocked = solarDestinationUnlocked(id, currentMap, shipComplete, milestones), color = MAPS[id].surface.edge;
      c.fillStyle = unlocked ? `#${color.toString(16).padStart(6, '0')}` : '#394258';
      c.beginPath(); c.arc(q.x, q.y, id === this.selected ? 29 : 22, 0, Math.PI * 2); c.fill();
      c.strokeStyle = id === this.selected ? '#efffc0' : '#66839a'; c.beginPath(); c.arc(q.x, q.y, 35, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#e0edf4'; c.font = '15px monospace'; c.textAlign = 'center'; c.fillText(MAPS[id].name, q.x, q.y + 58);
    }
    c.translate(p.x, p.y); c.fillStyle = '#8aa9af'; c.fillRect(-19, -4, 38, 18); c.fillStyle = '#e2fff5'; c.fillRect(-9, -20, 18, 35); c.fillStyle = '#76e6d2'; c.fillRect(-6, -16, 12, 9); c.restore();
    const ids = Object.keys(MAPS) as MapId[];
    if (!this.initializedSelection) { this.selected = currentMap; this.initializedSelection = true; }
    const selectedUnlocked = solarDestinationUnlocked(this.selected, currentMap, shipComplete, milestones), cost = solarRouteFuel(p, planetPosition(this.selected));
    const infoSignature = JSON.stringify({ p, fuel: fuel.toFixed(2), currentMap, shipComplete, milestones, selected: this.selected, planetIntel, commander });
    if (infoSignature !== this.lastInfoSignature) {
      this.lastInfoSignature = infoSignature;
      for (const id of ids) {
        const entry = this.entries.get(id)!, unlocked = solarDestinationUnlocked(id, currentMap, shipComplete, milestones), intel = planetIntel[id];
        const routeCost = solarRouteFuel(p, planetPosition(id));
        const lockCopy = id === 'vesper-9' && !vesperChapterUnlocked(milestones)
          ? 'LOCKED · RECOVER FIVE CORE RECORDS' : 'LOCKED · COMPLETE THE SHIP';
        entry.innerHTML = `<span class="planet-dot" style="--planet-color:#${MAPS[id].surface.edge.toString(16).padStart(6, '0')}"></span><span><strong>${MAPS[id].name}</strong><small>${unlocked ? `${MAPS[id].shortName}${intel.visited ? ' · VISITED' : ''}` : lockCopy}</small></span><b>${unlocked ? `${routeCost.toFixed(2)} F` : 'LOCKED'}</b>`;
        entry.disabled = !unlocked;
      }
      this.refreshSelection();
      const info = planetIntel[this.selected];
      const richer = Object.entries(MAPS[this.selected].oreFactors).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([ore, factor]) => `${ORES[ore as Ore].name} ×${factor.toFixed(2)} · $${ORES[ore as Ore].value}/unit`).join(' · ');
      const stored = info.warehouse
        ? Object.entries(info.warehouse).filter(([, amount]) => amount > 0).map(([ore, amount]) => `${amount} ${ORES[ore as Ore].name}`).join(' · ') || 'Empty'
        : 'No warehouse built';
      this.detail.innerHTML = `<small>DESTINATION INTEL · ${selectedUnlocked ? 'OPEN ROUTE' : 'LOCKED · COMPLETE MOTHERSHIP'}</small><h2>${MAPS[this.selected].name}${this.selected === currentMap ? ' · CURRENT' : ''}</h2><p>${MAPS[this.selected].strata[0]} · ${MAPS[this.selected].strata[1]} · ${info.visited ? 'Charted' : 'Unvisited'}</p><div class="solar-intel-grid"><p><b>RESOURCE PROFILE</b><br>${richer}</p><p><b>LOCAL TRADE</b><br>${info.tradingPost ? 'Trading Post online' : 'Surface buyer · no local Trading Post'}</p><p><b>WAREHOUSE STOCK</b><br>${stored}</p><p><b>INDUSTRY</b><br>${info.facilities ? `${info.facilities} automated rig(s)` : 'No automated rigs'}</p><p><b>COMMANDER</b><br>$${commander.credits} credits · cargo ${commander.cargo.toFixed(1)}/${commander.cargoCapacity}</p></div>`;
      this.status.textContent = `CORE FUEL ${fuel.toFixed(2)}  ·  ROUTE ${cost.toFixed(2)}  ·  REMAINING ${(fuel - cost).toFixed(2)}`;
      this.button.disabled = !selectedUnlocked || cost > fuel + 1e-8;
      this.button.textContent = !selectedUnlocked ? 'SHIP RECONSTRUCTION REQUIRED' : cost > fuel + 1e-8 ? 'INSUFFICIENT CORE FUEL' : this.selected === currentMap ? `RETURN TO ${MAPS[this.selected].name.toUpperCase()}` : `TRAVEL TO ${MAPS[this.selected].name.toUpperCase()}`;
    }
  }
}
