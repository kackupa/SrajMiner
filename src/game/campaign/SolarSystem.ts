import { MAPS, SOLAR_SYSTEM, vesperChapterUnlocked, type MapId } from '../config';
export type SolarPosition = { x: number; y: number };
export const planetPosition = (id: MapId): SolarPosition => SOLAR_SYSTEM.planets[id];
export function reachablePlanet(p: SolarPosition, milestones: string[]) {
  return (Object.keys(MAPS) as MapId[])
    .filter((id) => id !== 'vesper-9' || vesperChapterUnlocked(milestones))
    .sort((a, b) => distance(p, planetPosition(a)) - distance(p, planetPosition(b)))[0];
}
export const distance = (a: SolarPosition, b: SolarPosition) => Math.hypot(a.x - b.x, a.y - b.y);
export function flySolar(
  p: SolarPosition,
  dx: number,
  dy: number,
  dt: number,
  fuel: number,
  milestones: string[],
) {
  const norm = Math.hypot(dx, dy);
  if (!norm) return { position: p, fuel, limited: false };
  const step = Math.min(SOLAR_SYSTEM.speed * dt, fuel * SOLAR_SYSTEM.distancePerFuel);
  const next = { x: p.x + (dx / norm) * step, y: p.y + (dy / norm) * step };
  const remaining = Math.max(0, fuel - step / SOLAR_SYSTEM.distancePerFuel);
  const reserve =
    Math.max(
      0,
      distance(next, planetPosition(reachablePlanet(next, milestones))) -
        SOLAR_SYSTEM.landingRadius,
    ) / SOLAR_SYSTEM.distancePerFuel;
  if (reserve > remaining + 1e-8) return { position: p, fuel, limited: true };
  return { position: next, fuel: remaining, limited: false };
}
export class SolarView {
  root = document.createElement('section');
  canvas = document.createElement('canvas');
  status = document.createElement('p');
  button = document.createElement('button');
  constructor(land: () => void) {
    this.root.className = 'solar-flight';
    this.root.innerHTML =
      '<header><small>MOTHERSHIP FLIGHT DECK</small><h1>VESPER SYSTEM</h1><p>WASD / arrows to fly · release to brake · approach a planet to land</p></header>';
    this.root.append(this.canvas, this.status, this.button);
    this.button.onclick = land;
    document.body.append(this.root);
  }
  destroy() {
    this.root.remove();
  }
  draw(p: SolarPosition, fuel: number, milestones: string[], limited: boolean) {
    const w = (this.canvas.width = Math.max(320, window.innerWidth)),
      h = (this.canvas.height = Math.max(200, window.innerHeight - 230));
    const c = this.canvas.getContext('2d')!,
      scale = Math.min(
        w / (Math.max(600, Math.abs(p.x) + 90) * 2),
        h / (Math.max(350, Math.abs(p.y) + 90) * 2),
      ),
      ox = w / 2,
      oy = h / 2;
    c.fillStyle = '#070e1c';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = i % 3 ? '#52627c' : '#c7e4ec';
      c.fillRect((i * 173.3) % w, (i * 91.7) % h, 1.5, 1.5);
    }
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    c.strokeStyle = '#243448';
    c.lineWidth = 1 / scale;
    for (const r of [160, 280, 400, 530]) {
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#ffc878';
    c.shadowColor = '#ffac50';
    c.shadowBlur = 30;
    c.beginPath();
    c.arc(0, 0, 32, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#64dcb64d';
    c.beginPath();
    c.arc(p.x, p.y, fuel * SOLAR_SYSTEM.distancePerFuel, 0, Math.PI * 2);
    c.stroke();
    for (const id of Object.keys(MAPS) as MapId[]) {
      const q = planetPosition(id),
        locked = id === 'vesper-9' && !vesperChapterUnlocked(milestones);
      c.fillStyle = locked ? '#394258' : '#' + MAPS[id].surface.edge.toString(16).padStart(6, '0');
      c.beginPath();
      c.arc(q.x, q.y, 22, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#66839a';
      c.beginPath();
      c.arc(q.x, q.y, SOLAR_SYSTEM.landingRadius, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#e0edf4';
      c.font = '16px monospace';
      c.textAlign = 'center';
      c.fillText(locked ? 'UNCHARTED · FIVE CORES' : MAPS[id].name, q.x, q.y + 57);
      c.fillStyle = '#90a9ba';
      c.font = '12px monospace';
      c.fillText(
        `${(Math.max(0, distance(p, q) - SOLAR_SYSTEM.landingRadius) / SOLAR_SYSTEM.distancePerFuel).toFixed(2)} FUEL`,
        q.x,
        q.y + 74,
      );
    }
    c.translate(p.x, p.y);
    c.fillStyle = '#8aa9af';
    c.fillRect(-19, -4, 38, 18);
    c.fillStyle = '#e2fff5';
    c.fillRect(-9, -20, 18, 35);
    c.fillStyle = '#76e6d2';
    c.fillRect(-6, -16, 12, 9);
    c.fillStyle = '#ffbf77';
    c.fillRect(-17, 14, 8, 6);
    c.fillRect(9, 14, 8, 6);
    c.restore();
    const id = reachablePlanet(p, milestones),
      near = distance(p, planetPosition(id)) <= SOLAR_SYSTEM.landingRadius;
    this.status.textContent = `CORE FUEL ${fuel.toFixed(2)} · RANGE ${Math.floor(fuel * SOLAR_SYSTEM.distancePerFuel)} km${limited ? ' · RETURN RESERVE: steer toward the nearest planet' : ''}`;
    this.button.disabled = !near;
    this.button.textContent = near
      ? `LAND ON ${MAPS[id].name.toUpperCase()}`
      : `APPROACH ${MAPS[id].name.toUpperCase()}`;
  }
}
