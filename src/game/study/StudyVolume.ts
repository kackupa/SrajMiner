import type Phaser from 'phaser';

type Point = { x: number; y: number };
export type VolumeProject = (x: number, y: number, z: number) => Point;

export function shadeMetal(color: number, light: number) {
  const channel = (shift: number) => Math.min(255, Math.max(0, Math.round(((color >> shift) & 255) * light)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Extrude the silhouette behind its original face. All vertices share the
 * caller's local projection, including a rotating chassis or planet horizon. */
export function volumeFaces(points: number[][], depth: number, project: VolumeProject, color: number) {
  const front = points.map(([x, y]) => project(x, y, 0));
  const back = points.map(([x, y]) => project(x, y, -depth));
  const sides = points.map((_, i) => {
    const j = (i + 1) % points.length;
    const dx = front[j].x - front[i].x, dy = front[j].y - front[i].y;
    // Upper bevels catch light; vertical armour receives a cooler dark face.
    const light = Math.abs(dx) / (Math.hypot(dx, dy) || 1);
    return { points: [back[i], back[j], front[j], front[i]], color: shadeMetal(color, .48 + light * .65) };
  });
  return [{ points: back, color: shadeMetal(color, .45) }, ...sides];
}

export function drawVolume(g: Phaser.GameObjects.Graphics, points: number[][], depth: number, project: VolumeProject, color: number, alpha = 1) {
  for (const face of volumeFaces(points, depth, project, color)) {
    g.fillStyle(face.color, alpha);
    g.fillPoints(face.points, true);
  }
}
