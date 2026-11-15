import type Phaser from 'phaser';
import { MOTHERSHIP, WORLD } from '../config';
import { planetChartToCartesian } from '../world/PlanetChart';
import { random, type TileWorld } from '../world/TileWorld';
type Point = { x: number; y: number };
export type SurveyLabel = (
  text: string,
  x: number,
  y: number,
  color: string,
  size?: number,
) => void;
export function surveyProjection(world: TileWorld, w: number, h: number) {
  const chart = world.planetChart!;
  const compact=h<500;
  const radius = Math.max(50, Math.min(w * 0.36, compact?(h-170)*.5:(h - 205) * 0.46)),
    center = compact?{x:w*.6,y:h*.5}:{ x: w * 0.5, y: 148 + (h - 205) * 0.5 };
  const scale = radius / (chart.radiusRows * WORLD.tile);
  const point = (x: number, y: number) => {
    const p = planetChartToCartesian(
      { u: x / WORLD.tile, v: y / WORLD.tile },
      chart.columns,
      chart.radiusRows,
      WORLD.tile,
    );
    return { x: center.x + p.x * scale, y: center.y + p.y * scale };
  };
  return { radius, center, point, scale };
}
export function drawStudySurvey(
  g: Phaser.GameObjects.Graphics,
  world: TileWorld,
  w: number,
  h: number,
  pod: Point,
  structures: Point[],
  label: SurveyLabel,
  name: string,
) {
  const { radius: r, center: c, point, scale } = surveyProjection(world, w, h);
  g.fillStyle(0x06121c);
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 130; i++) {
    g.fillStyle(0xadcbd1, 0.15 + random(world.seed, i, 92) * 0.3);
    g.fillCircle(
      random(world.seed, i, 90) * w,
      random(world.seed, i, 91) * h,
      0.6 + random(world.seed, i, 93),
    );
  }
  for (let i = 7; i >= 1; i--) {
    g.lineStyle(i * 3, 0x6fa3ac, 0.008);
    g.strokeCircle(c.x, c.y, r + 5);
  }
  const layer = (fraction: number, color: number, rough: number) => {
    const p = Array.from({ length: 144 }, (_, i) => {
      const a = (i / 144) * Math.PI * 2,
        n = Math.sin(a * 5 + 0.7) * 0.4 + Math.cos(a * 11) * 0.25 + Math.sin(a * 19) * 0.15;
      const q = r * (fraction + n * rough);
      return { x: c.x + Math.cos(a) * q, y: c.y + Math.sin(a) * q };
    });
    g.fillStyle(color);
    g.fillPoints(p, true);
    return p;
  };
  layer(1, 0x7b9695, 0.006);
  layer(0.984, 0x314c59, 0.006);
  layer(0.87, 0x2d4651, 0.045);
  layer(0.65, 0x283d49, 0.06);
  layer(0.39, 0x343a40, 0.045);
  layer(0.17, 0x835b43, 0.018);
  for (let i = 0; i < 230; i++) {
    const a = random(world.seed, i, 163) * Math.PI * 2,
      q = 0.18 + random(world.seed, i, 164) * 0.76,
      span = 0.015 + random(world.seed, i, 165) * 0.15;
    const pts = [
      [a, q],
      [a + span, q + 0.012],
      [a + span * 0.7, q + 0.038],
      [a - 0.02, q + 0.021],
    ].map(([v, z]) => ({ x: c.x + Math.cos(v) * r * z, y: c.y + Math.sin(v) * r * z }));
    g.fillStyle(i % 3 ? 0x97b8bc : 0x091923, 0.025 + random(world.seed, i, 166) * 0.085);
    g.fillPoints(pts, true);
  }
  for (let i = 16; i >= 1; i--) {
    g.fillStyle(0xffbd73, 0.018);
    g.fillCircle(c.x, c.y, r * (0.09 + i * 0.005));
  }
  layer(0.075, 0xffd597, 0.004);
  // The actual frozen surface profile wraps the cutaway, including the far side.
  const chart = world.planetChart!,
    rim = [];
  for (let i = 0; i <= 240; i++) {
    const far = i > 120,
      u = ((far ? i - 120 : i) / 120) * chart.columns,
      x = u * WORLD.tile,
      y = world.surfaceHeight(x, far ? world.farSurfaceY : 0);
    rim.push(point(x, y));
  }
  g.lineStyle(1.5, 0xb8d4ca, 0.7);
  g.strokePoints(rim, true);
  // Discontinuous geological seams and faults, with one consistent light direction.
  for (let i = 0; i < 75; i++) {
    const a = random(world.seed, i, 151) * Math.PI * 2,
      q = 0.24 + random(world.seed, i, 152) * 0.67,
      len = 0.03 + random(world.seed, i, 153) * 0.14;
    const pts = Array.from({ length: 9 }, (_, j) => {
      const t = a + (j / 8) * len;
      const z = r * (q + Math.sin(t * 13) * 0.014);
      return { x: c.x + Math.cos(t) * z, y: c.y + Math.sin(t) * z };
    });
    g.lineStyle(1, i % 5 ? 0x739099 : 0xe2ab72, i % 5 ? 0.14 : 0.27);
    g.strokePoints(pts, false);
  }
  // Real surveyed terrain only. Authored but undiscovered caves stay hidden.
  let i = 0;
  const stride = Math.max(1, Math.ceil(world.discovered.size / 4000));
  for (const key of world.discovered) {
    if (i++ % stride) continue;
    const [x, y] = key.split(',').map(Number);
    if (!world.destroyed.has(key) && world.get(x, y).type !== 'empty') continue;
    const corners = [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ].map(([a, b]) => point(a * WORLD.tile, b * WORLD.tile));
    g.fillStyle(0x8dc7c4, 0.55);
    g.fillPoints(corners, true);
  }
  const mark = (p: Point, color: number, size: number) => {
    g.fillStyle(color);
    g.fillCircle(p.x, p.y, size);
    g.lineStyle(1, color, 0.5);
    g.strokeCircle(p.x, p.y, size + 3);
  };
  for (const b of structures) mark(point(b.x, b.y), 0x8ed1b8, 2);
  const home = point(MOTHERSHIP.x, 0),
    you = point(pod.x, pod.y);
  mark(home, 0x93d9d2, 4);
  mark(you, 0xffc27c, 4);
  // Labels occupy opposite margins so the two near-home markers never overlap.
  const left = w < 600 ? 18 : Math.max(24, c.x - r - 135),
    right = w < 600 ? w - 88 : Math.min(w - 100, c.x + r + 25);
  g.lineStyle(1, 0x93d9d2, 0.55);
  g.strokePoints(
    [home, { x: left + 8, y: c.y - r * 0.7 }, { x: left + 70, y: c.y - r * 0.7 }],
    false,
  );
  label('MOTHERSHIP', left, c.y - r * 0.7 - 16, '#a3dbd8', 10);
  g.lineStyle(1, 0xffc27c, 0.65);
  g.strokePoints(
    [you, { x: right, y: c.y + r * 0.65 }, { x: right + 50, y: c.y + r * 0.65 }],
    false,
  );
  label('YOUR RIG', right, c.y + r * 0.65 + 6, '#ffca8d', 10);
  label(
    name.toUpperCase(),
    Math.max(18, w * 0.08),
    h < 500 ? 111 : 120,
    '#eee4cc',
    w < 600 ? 16 : 21,
  );
  label('PLANET SURVEY', Math.max(18, w * 0.08), h < 500 ? 94 : 99, '#92b9c6', 9);
  label(
    'Cyan: explored tunnels     Green: buildings',
    Math.max(18, w * 0.08),
    h - 75,
    '#a4bcc5',
    w < 600 ? 9 : 11,
  );
}
