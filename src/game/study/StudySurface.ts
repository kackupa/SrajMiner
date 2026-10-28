import type Phaser from 'phaser';
import { MOTHERSHIP, WORLD } from '../config';
import { random, type TileWorld } from '../world/TileWorld';
import { STUDY_ROCK } from './StudyDrillEffects';

type Point = { x: number; y: number };
type Project = (x: number, y: number) => Point;

/** A thin weathered skin, never a new collision surface. Endpoints meet exactly. */
export function studySurfaceSkin(seed: number, cell: number, y: number, sign: number) {
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12,
      x = (cell + t) * WORLD.tile;
    const erosion = Math.sin(t * Math.PI) * (0.8 + Math.sin(x * 0.16 + seed) * 0.7);
    return {
      x,
      y: y - erosion * sign,
      depth: 5 + 2 * Math.sin(x * 0.08) + random(seed, cell, i, 902) * 3,
    };
  });
}

/** Wind-worn ridges share the foreground's strata and stay attached to the globe. */
export function drawStudyLandscape(
  g: Phaser.GameObjects.Graphics,
  project: Project,
  columns: number,
  visible: (x: number, y: number, pad: number) => boolean,
) {
  const circumference = columns * WORLD.tile * 2,
    count = 360;
  for (const [layer, color] of [0x345363, 0x294653, 0x1b323e].entries()) {
    const base = 18 - layer * 5,
      height = [190, 105, 48][layer];
    const ridge = (i: number) => {
      const angle = (i / count) * Math.PI * 2;
      const broad = Math.sin(angle * 13 + layer * 1.8) * 0.5 + 0.5;
      const broken = Math.sin(angle * 31 + layer) * 0.09 + Math.sin(angle * 63) * 0.025;
      return base - height * (0.15 + broad * broad * 0.85 + broken);
    };
    // Small visible strips avoid triangulating a whole high-resolution globe
    // every frame. The planet's existing backing covers their inner boundary.
    for (let i = 0; i < count; i++) {
      const x = (i / count) * circumference,
        next = ((i + 1) / count) * circumference;
      if (!visible((x + next) / 2, 0, 320)) continue;
      g.fillStyle(color);
      g.fillPoints(
        [project(x, ridge(i)), project(next, ridge(i + 1)), project(next, 240), project(x, 240)],
        true,
      );
    }
    // Broad eroded beds follow the ridge, without triangular facet fans.
    for (const depth of [0.12, 0.38, 0.7]) {
      for (let i = 0; i < count; i += 5) {
        if (!visible(((i + 2.5) / count) * circumference, 0, 450)) continue;
        if (random(317, i, layer) < 0.26) continue;
        const band = Array.from({ length: 6 }, (_, j) => {
          const x = ((i + j) / count) * circumference;
          return project(x, ridge(i + j) * (1 - depth) + base * depth);
        });
        g.lineStyle(layer === 0 ? 2 : 1.4, 0x8ca5aa, 0.1 - layer * 0.02);
        g.strokePoints(band, false);
      }
    }
  }
}

/** Low, non-colliding rubble anchored only to supported surface. No save mutations. */
export function drawStudySurface(
  g: Phaser.GameObjects.Graphics,
  world: TileWorld,
  project: Project,
  visible: (x: number, y: number, pad: number) => boolean,
  structures: readonly Point[],
  time: number,
  reduced: boolean,
) {
  const poly = (points: Point[], color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      points.map((p) => project(p.x, p.y)),
      true,
    );
  };
  const line = (points: Point[], color: number, width: number, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    g.strokePoints(
      points.map((p) => project(p.x, p.y)),
      false,
    );
  };
  for (const far of [false, true]) {
    const sign = far ? -1 : 1,
      hemisphereY = far ? world.farSurfaceY : 0;
    for (let cell = 0; cell < world.widthTiles; cell++) {
      const cx = (cell + 0.5) * WORLD.tile,
        y = world.surfaceHeight(cx, hemisphereY);
      if (!visible(cx, y, 70)) continue;
      const support = (x: number) =>
        Math.abs(world.surfaceHeight(x, hemisphereY) - y) < 1 &&
        world.solid(Math.floor(x / WORLD.tile), Math.floor((y + sign * 2) / WORLD.tile));
      if (!support(cx)) continue;
      const seed = world.seed + (far ? 417 : 0),
        skin = studySurfaceSkin(seed, cell, y, sign);
      poly(
        [
          ...skin,
          ...skin
            .slice()
            .reverse()
            .map((p) => ({ x: p.x, y: p.y + p.depth * sign })),
        ],
        0x4c6269,
        0.75,
      );
      line(skin, 0x9dafaa, 0.9, 0.48);
      line(
        skin.map((p) => ({ x: p.x, y: p.y + p.depth * sign })),
        0x132b36,
        1.2,
        0.6,
      );
      const built =
        (!far && Math.abs(cx - MOTHERSHIP.x) < 235) ||
        structures.some((s) => Math.abs(s.y - y) < 90 && Math.abs(s.x - cx) < 100);
      const cluster = random(seed, cell, 0, 903);
      // Sparse, differently sized groups rather than one repeated object per tile.
      for (let i = 0; i < (cluster > 0.56 ? 4 : 1); i++) {
        const x = (cell + 0.12 + random(seed, cell, i, 904) * 0.76) * WORLD.tile;
        const prominent = !built && cluster > 0.72 && i === 0;
        const width = prominent ? 10 + cluster * 12 : 2 + random(seed, cell, i, 905) * 5;
        const height = prominent
          ? 6 + random(seed, cell, i, 906) * 9
          : 1.3 + random(seed, cell, i, 907) * 3;
        if (!support(x - width) || !support(x + width)) continue;
        const points = Array.from({ length: 11 }, (_, n) => {
          const t = n / 10,
            a = t * Math.PI;
          const uneven = 0.83 + random(seed, cell * 13 + i, n, 908) * 0.17;
          return { x: x - width * Math.cos(a), y: y - Math.sin(a) * height * uneven * sign };
        });
        poly(
          points.map((p) => ({ x: p.x + 2, y: p.y + sign * 2 })),
          0x0b202b,
          0.6,
        );
        poly(points, STUDY_ROCK.body);
        poly(
          [...points.slice(0, 8), { x: x + width * 0.25, y: y - height * 0.34 * sign }],
          STUDY_ROCK.facet,
          0.65,
        );
        line(points.slice(1, 9), 0x94aaa9, 0.65, 0.55);
        if (prominent) {
          line(
            [
              { x: x - width * 0.6, y: y - height * 0.38 * sign },
              { x: x - width * 0.1, y: y - height * 0.46 * sign },
              { x: x + width * 0.6, y: y - height * 0.2 * sign },
            ],
            0x132b36,
            1,
            0.8,
          );
        }
      }
      // A low wisp of wind-blown grit; never covers the walking line or cave mouth.
      if (!reduced && cluster > 0.8) {
        const t = (time * 0.2 + cluster) % 1,
          p = project(cx + (t - 0.5) * 26, y - sign * (3 + Math.sin(t * Math.PI) * 4));
        g.fillStyle(0x9eafb0, Math.sin(t * Math.PI) * 0.06);
        g.fillEllipse(p.x, p.y, 12, 2);
      }
    }
  }
}
