import type Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import { conceptMiner } from '../player/ConceptMiner';
import { restingVehiclePose } from '../player/VehiclePose';
export const RIG_SWAP_SECONDS = 3.2;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

/** Hangar-serviced parts retain the equipped rig's actual silhouette and colours. */
export function drawRigSwap(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, p: Progress, age: number, ship: { x: number; y: number }, reduced: boolean) {
 const phase = clamp(age / RIG_SWAP_SECONDS);
 const rig = conceptMiner(p, restingVehiclePose(), undefined, undefined, !reduced && phase < .82);
 const point = (u: number, v: number) => ({ x: x + u * scale, y: y + v * scale });
 const line = (a: number, b: number, c: number, d: number, color: number, alpha: number, width = 1) => {
  const start = point(a, b), end = point(c, d);
  g.lineStyle(width * scale, color, alpha); g.lineBetween(start.x, start.y, end.x, end.y);
 };
 const circle = (u: number, v: number, r: number, color: number, alpha = 1) => {
  const pt = point(u, v); g.fillStyle(color, alpha); g.fillCircle(pt.x, pt.y, r * scale);
 };
 const drawParts = (old: boolean) => {
  for (const mark of rig) {
   const cx = mark.kind === 'circle' ? mark.x : mark.points.reduce((n, v) => n + v[0], 0) / mark.points.length;
   const cy = mark.kind === 'circle' ? mark.y : mark.points.reduce((n, v) => n + v[1], 0) / mark.points.length;
   // Feet first, then the body, tools and finally the upper equipment.
   const group = cy > 15 ? 0 : cx < -14 ? 2 : cx > 14 ? 3 : cy < -18 ? 4 : 1;
   const q = reduced ? 1 : smooth((phase - .29 - group * .045) / .31);
   const away = reduced ? 0 : smooth((phase - .06) / .24);
   if ((!old && q <= 0) || (old && away >= 1)) continue;
   const t = old ? away : 1 - q;
   const side = group % 2 ? 1 : -1;
   const ox = (ship.x - x) / scale * t + side * Math.sin(t * Math.PI) * (48 + group * 8);
   const oy = (ship.y - y) / scale * t - Math.sin(t * Math.PI) * (65 + group * 14);
   const angle = reduced ? 0 : side * Math.sin(t * Math.PI) * .6;
   const at = (u: number, v: number) => point(cx + (u - cx) * Math.cos(angle) - (v - cy) * Math.sin(angle) + ox, cy + (u - cx) * Math.sin(angle) + (v - cy) * Math.cos(angle) + oy);
   const alpha = old ? 1 - away * .7 : 1;
   if (mark.kind === 'circle') { const pt = at(mark.x, mark.y); g.fillStyle(mark.color, mark.alpha * alpha); g.fillCircle(pt.x, pt.y, mark.r * scale); }
   else if (mark.kind === 'line') { g.lineStyle(mark.width * scale, mark.color, mark.alpha * alpha); g.strokePoints(mark.points.map(([u, v]) => at(u, v)), false); }
   else { g.fillStyle(mark.color, mark.alpha * alpha); g.fillPoints(mark.points.map(([u, v]) => at(u, v)), true); }
  }
 };
 if (reduced) { drawParts(false); g.lineStyle(scale, 0x8be7dc, .6); g.strokeCircle(x, y, 36 * scale); return; }
 const activity = smooth(phase / .1) * (1 - smooth((phase - .86) / .14));
 // Soft magnetic cradle and segmented service halo behind the machinery.
 for (let i = 3; i > 0; i--) circle(0, -8, 30 + i * 13, 0x67dcd7, .018 * activity);
 for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4 + age * .6, r = 45 + 4 * Math.sin(age * 3);
  line(Math.cos(a) * r, -8 + Math.sin(a) * r, Math.cos(a + .18) * r, -8 + Math.sin(a + .18) * r, 0x8be7dc, .45 * activity, 2);
 }
 drawParts(true);
 drawParts(false);
 const lift = smooth(phase / .2) * (1 - smooth((phase - .52) / .27));
 const py = -8 - lift * 48;
 // Two articulated recovery drones carry the pilot, then peel away after sealing.
 for (const side of [-1, 1]) {
  const retreat = smooth((phase - .78) / .22);
  const dx = side * (29 + retreat * 85), dy = py - 16 - retreat * 45;
  const alpha = 1 - retreat;
  line(dx, dy + 3, side * 5, py + 3, 0x9cefe0, .65 * alpha);
  line(dx, dy, dx - side * 8, dy + 7, 0x718c91, alpha, 3);
  circle(dx, dy, 9, 0x78e7db, .09 * alpha);
  const pt = point(dx - 7, dy - 4);
  g.fillStyle(0x203744, alpha); g.fillRoundedRect(pt.x, pt.y, 14 * scale, 8 * scale, 2 * scale);
  line(dx - 6, dy - 3, dx + 6, dy - 3, 0xe9b75d, alpha, 2);
  circle(dx + side * 3, dy, 2, 0xd8fff0, alpha);
  const flame = 7 + Math.sin(age * 37 + side) * 2;
  const a = point(dx - 3, dy + 4), b = point(dx + 3, dy + 4), c = point(dx, dy + 4 + flame);
  g.fillStyle(0x7ee7df, .8 * alpha); g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
 }
 // Pilot remains visible until the cockpit seals around them.
 if (phase < .82) {
  line(-2, py + 4, -4, py + 10, 0x293f4a, 1, 2);
  line(2, py + 4, 4, py + 10, 0x293f4a, 1, 2);
  const pt = point(-3, py - 2); g.fillStyle(0xe2b665); g.fillRoundedRect(pt.x, pt.y, 6 * scale, 9 * scale, scale);
  circle(0, py - 5, 4, 0xe9d6a2); line(-2, py - 5, 2, py - 5, 0x163748, 1, 2);
 }
 // Individual locks throw short welding sparks as each module seats.
 for (let group = 0; group < 5; group++) {
  const burst = (phase - (.60 + group * .045)) / .12;
  if (burst <= 0 || burst >= 1) continue;
  const bx = group % 2 ? 17 : -17, by = group === 0 ? 21 : -12;
  circle(bx, by, 7 * (1 - burst), 0xffd690, .5 * (1 - burst));
  for (let j = 0; j < 7; j++) {
   const a = j * 2.399 + group, r = 4 + burst * 23;
   line(bx + Math.cos(a) * r, by + Math.sin(a) * r + burst * burst * 9, bx + Math.cos(a) * (r + 4), by + Math.sin(a) * (r + 4) + burst * burst * 9, j % 2 ? 0xffc477 : 0xd5fff0, 1 - burst, 1.3);
  }
 }
 if (phase > .82) {
  const ignition = clamp((phase - .82) / .18), strength = Math.sin(ignition * Math.PI);
  for (const side of [-1, 1]) {
   const a = point(side * 18 - 4, 24), b = point(side * 18 + 4, 24), c = point(side * 18, 26 + strength * 25);
   g.fillStyle(0x75e5dc, .75 * strength); g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
   circle(side * 18, 26, 8, 0xb9fff1, .16 * strength);
  }
  g.lineStyle(1.5 * scale, 0xa6f5df, (1 - ignition) * .7); g.strokeEllipse(x, y + 27 * scale, (40 + ignition * 75) * scale, (10 + ignition * 18) * scale);
 }
}
