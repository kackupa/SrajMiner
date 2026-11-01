import type { Point, UniformPlanet } from './UniformPlanet';

/** A glanceable overlay, independent of the gameplay camera and terrain renderer. */
export function studyMap(world: UniformPlanet, miner: Point, ship: Point, aboard: boolean) {
  const radius = Math.max(
    2100,
    Math.hypot(miner.x, miner.y) + 180,
    Math.hypot(ship.x, ship.y) + 180,
  );
  const at = (p: Point) => ({ x: 200 + (p.x * 165) / radius, y: 200 + (p.y * 165) / radius });
  const outline = world.outline
    .filter((_, i) => i % 8 === 0)
    .map((p) => {
      const q = at(p);
      return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    })
    .join(' ');
  const m = at(miner),
    s = at(ship);
  return `<svg viewBox="0 0 400 400" role="img" aria-label="Planet with your position and the mothership"><circle cx="200" cy="200" r="180" fill="none" stroke="#5d808d" stroke-opacity=".2"/><path d="M200 12v376M12 200h376" stroke="#5d808d" stroke-opacity=".15"/><polygon points="${outline}" fill="#1d3946" stroke="#7ba9b7" stroke-width="1.5"/><circle cx="200" cy="200" r="8" fill="#d8b77d" opacity=".5"/><rect x="${s.x - 6}" y="${s.y - 5}" width="12" height="10" rx="2" fill="#f3be72"/><circle cx="${m.x}" cy="${m.y}" r="${aboard ? 11 : 7}" fill="none" stroke="#86eee0" stroke-width="2"/>${aboard ? '' : `<circle cx="${m.x}" cy="${m.y}" r="2" fill="#86eee0"/>`}</svg>`;
}
