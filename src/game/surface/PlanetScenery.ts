import type Phaser from 'phaser';
import { MAPS, WORLD, type MapId } from '../config';
import { surfaceArcPoint } from '../building/UndergroundStructures';
import type { TileWorld } from '../world/TileWorld';
import { random } from '../world/TileWorld';

export type SurfaceLandmarkKind = 'mesa' | 'ice-ridge' | 'wreck-arc' | 'crystal-spires' | 'caldera' | 'lantern-grove';
export type SurfaceLandmark = { x: number; y: number; kind: SurfaceLandmarkKind; scale: number; variation: number };

/** Original, deterministic silhouette families for the six distinct worlds. */
export const PLANET_SURFACE_LANDMARKS: Readonly<Record<MapId, readonly SurfaceLandmarkKind[]>> = {
  'mars-frontier': ['mesa', 'mesa', 'caldera', 'mesa', 'ice-ridge'],
  'cryo-shelf': ['ice-ridge', 'ice-ridge', 'mesa', 'ice-ridge', 'wreck-arc'],
  'hull-graveyard': ['wreck-arc', 'wreck-arc', 'mesa', 'wreck-arc', 'crystal-spires'],
  'prism-fault': ['crystal-spires', 'mesa', 'crystal-spires', 'ice-ridge', 'crystal-spires'],
  'cinder-vale': ['caldera', 'caldera', 'mesa', 'caldera', 'crystal-spires'],
  'vesper-9': ['lantern-grove', 'lantern-grove', 'ice-ridge', 'lantern-grove', 'crystal-spires'],
};
export function surfaceLandmarkColor(mapId: MapId, kind: SurfaceLandmarkKind) {
  const palette = MAPS[mapId].surface;
  return kind === 'ice-ridge' || kind === 'crystal-spires' || kind === 'lantern-grove'
    ? palette.edge
    : palette.mountains[1];
}

/** Fixed by world seed and longitude so scenery remains still through travel and reload. */
export function surfaceLandmarks(world: TileWorld, mapId: MapId): SurfaceLandmark[] {
  const fullArc = world.widthTiles * WORLD.tile * 2, count = 12, families = PLANET_SURFACE_LANDMARKS[mapId];
  return Array.from({ length: count }, (_, index) => {
    const arc = fullArc * (index + 0.5 + (random(world.seed, index, mapId.length, 9501) - 0.5) * 0.24) / count,
      point = surfaceArcPoint(world, arc), familyIndex = Math.floor(random(world.seed, index, mapId.length, 9502) * families.length);
    return {
      ...point,
      kind: families[familyIndex]!,
      scale: 0.82 + random(world.seed, index, mapId.length, 9503) * 0.42,
      variation: random(world.seed, index, mapId.length, 9504),
    };
  });
}

type Point = { x: number; y: number };
type LocalProject = (x: number, y: number, tangent: number, outward: number) => Point;

/** Draw the shared art language from globe-anchored coordinates, behind playable terrain. */
export function drawSurfaceLandmarks(
  g: Phaser.GameObjects.Graphics,
  landmarks: readonly SurfaceLandmark[],
  mapId: MapId,
  project: LocalProject,
  visible: (x: number, y: number) => boolean,
) {
  const palette = MAPS[mapId].surface, highlight = palette.edge;
  for (const landmark of landmarks) {
    if (!visible(landmark.x, landmark.y)) continue;
    const { x, y, scale, variation, kind } = landmark,
      at = (tangent: number, outward: number) => project(x, y, tangent * scale, outward * scale),
      points = (coords: readonly [number, number][]) => coords.map(([t, o]) => at(t, o));
    const mountain = palette.mountains[Math.floor(variation * palette.mountains.length)]!;
    g.fillStyle(mountain, 0.88);
    if (kind === 'mesa') {
      g.fillPoints(points([[-190, 0], [-145, 42], [-100, 42], [-75, 126], [-40, 138], [-15, 95], [26, 95], [52, 158], [94, 150], [125, 56], [165, 48], [205, 0]]), true);
      g.fillStyle(highlight, 0.36);
      const cap = points([[-78, 123], [-48, 135], [-16, 93], [-39, 105]]);
      g.fillPoints(cap, true);
    } else if (kind === 'ice-ridge') {
      g.fillPoints(points([[-180, 0], [-132, 76], [-103, 42], [-55, 153], [-17, 67], [24, 126], [62, 52], [107, 143], [144, 65], [185, 0]]), true);
      g.lineStyle(4 * scale, highlight, 0.72);
      for (const [a, b] of [[[-55, 153], [-17, 67]], [[24, 126], [62, 52]], [[107, 143], [144, 65]]] as const) {
        const p1 = at(a[0], a[1]), p2 = at(b[0], b[1]); g.lineBetween(p1.x, p1.y, p2.x, p2.y);
      }
    } else if (kind === 'wreck-arc') {
      g.fillPoints(points([[-178, 0], [-160, 58], [-136, 82], [-112, 22], [-89, 30], [-70, 116], [-45, 138], [-20, 48], [11, 38], [30, 132], [58, 150], [83, 52], [116, 27], [136, 94], [160, 70], [183, 0]]), true);
      g.lineStyle(7 * scale, highlight, 0.6);
      for (const t of [-130, -58, 48, 128]) { const a = at(t, 24), b = at(t + 18, 115); g.lineBetween(a.x, a.y, b.x, b.y); }
    } else if (kind === 'crystal-spires') {
      for (const [t, height, width] of [[-122, 112, 38], [-66, 174, 48], [0, 128, 38], [68, 192, 52], [125, 102, 34]] as const) {
        const shard = points([[t - width / 2, 0], [t - width * 0.22, height * 0.64], [t - width * 0.12, height], [t + width * 0.34, height * 0.57], [t + width / 2, 0]]);
        g.fillPoints(shard, true);
        g.lineStyle(2 * scale, highlight, 0.62);
        const a = at(t - width * 0.12, height), b = at(t - width * 0.03, 10); g.lineBetween(a.x, a.y, b.x, b.y);
      }
    } else if (kind === 'caldera') {
      g.fillPoints(points([[-210, 0], [-158, 61], [-105, 126], [-54, 145], [-22, 96], [12, 93], [50, 142], [98, 126], [152, 54], [208, 0]]), true);
      g.lineStyle(5 * scale, highlight, 0.82);
      const a = at(-20, 96), b = at(-5, 58), c = at(14, 92); g.lineBetween(a.x, a.y, b.x, b.y); g.lineBetween(b.x, b.y, c.x, c.y);
    } else {
      for (const [t, height] of [[-122, 122], [-58, 170], [8, 134], [75, 178], [130, 116]] as const) {
        const trunk = points([[t - 8, 0], [t - 7, height * 0.55], [t + 7, height * 0.55], [t + 8, 0]]);
        g.fillPoints(trunk, true);
        for (const [branch, canopy] of [[-26, 0.75], [23, 1]] as const) {
          const crown = points([[t + branch - 32, height * canopy - 24], [t + branch - 8, height * canopy + 12], [t + branch + 10, height * canopy + 22], [t + branch + 34, height * canopy - 20], [t + branch + 10, height * canopy - 38]]);
          g.fillStyle(highlight, 0.72); g.fillPoints(crown, true);
        }
      }
    }
  }
}
