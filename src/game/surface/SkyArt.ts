import type Phaser from 'phaser';
import { MAPS, type MapId } from '../config';
import { random } from '../world/TileWorld';

/** Original celestial backdrop. Screen-space sky is intentionally infinitely distant. */
export function drawSkyArt(g: Phaser.GameObjects.Graphics, map: MapId,
  bounds: { x: number; y: number; width: number; height: number }) {
  const { x, y, width: w, height: h } = bounds, accent = MAPS[map].surface.edge;
  // A soft horizon and layered aurora give the ice worlds depth without
  // textures or randomness that flickers as the camera moves.
  for (let band = 0; band < 20; band++) {
    g.fillStyle(accent, 0.002 + band * 0.001);
    g.fillRect(x, y + h * (0.35 + band * 0.0325), w, h * 0.033);
  }
  if (map === 'cryo-shelf' || map === 'prism-fault') {
    for (let layer = 0; layer < 4; layer++) {
      const points = Array.from({ length: 25 }, (_, i) => ({
        x: x + w * i / 24,
        y: y + h * (0.24 + layer * 0.018 + Math.sin(i * 0.2 + layer * 0.3) * 0.12),
      }));
      g.lineStyle(12 - layer * 2, 0x8ce3dc, 0.018);
      g.strokePoints(points, false);
    }
  }
  for (let i = 0; i < 52; i++) {
    const sx = x + random(827, i, map.length, 1) * w,
      sy = y + random(827, i, map.length, 2) * h * 0.75,
      size = i % 9 === 0 ? 1.3 : 0.65;
    g.fillStyle(0xd3e6df, i % 9 === 0 ? 0.65 : 0.24);
    // Subpixel stars do not need the renderer's 100-segment arc tessellation.
    g.fillRect(sx - size, sy - size, size * 2, size * 2);
  }
  const cx = x + w * 0.73, cy = y + h * 0.24, radius = Math.min(w * 0.065, h * 0.13);
  for (let i = 5; i > 0; i--) {
    g.fillStyle(accent, 0.008);
    g.fillEllipse(cx, cy, (radius + i * 9) * 2, (radius + i * 9) * 2, 40);
  }
  if (map === 'cryo-shelf' || map === 'prism-fault') {
    g.lineStyle(5, accent, 0.13);
    g.strokeEllipse(cx, cy, radius * 3.6, radius * 0.65);
    g.lineStyle(1, 0xe6d5b9, 0.22);
    g.strokeEllipse(cx, cy, radius * 3.85, radius * 0.74);
  }
  g.fillStyle(0x142735, 0.96);
  g.fillEllipse(cx, cy, radius * 2, radius * 2, 48);
  g.fillStyle(accent, 0.32);
  g.fillEllipse(cx, cy, radius * 1.94, radius * 1.94, 48);
  // An offset dark disc gives the body a readable illuminated crescent.
  g.fillStyle(0x172b3a, 0.94);
  g.fillEllipse(cx - radius * 0.24, cy - radius * 0.1, radius * 1.46, radius * 1.46, 48);
  g.lineStyle(1, accent, 0.2);
  g.strokeCircle(cx, cy, radius);
}
