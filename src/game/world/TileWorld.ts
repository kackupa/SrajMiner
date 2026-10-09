import { CORE, WORLD, ORES, ORE_KEYS, bandAt, coreDepthMetersFor, coreWorldYFor, depthAtWorldY, farSurfaceRowFor, farSurfaceYFor, MAPS, CORE_RELICS, REGION_FINDS, ROUTE_FRAGMENTS, NAVIGATION_HASHES, gravityDirectionAt, type Ore, type MapId, type CoreRelicId } from '../config';
import { planetChartCellIntersectsCoreRadius, wrapPlanetTile, type PlanetChartSize } from './PlanetChart';
export type Tile = {
  x: number;
  y: number;
  type: 'empty' | 'dirt' | 'rock' | 'hard' | 'boundary';
  ore?: Ore;
  oreUnits?: number;
  geode?: boolean;
  regionFind?: keyof typeof REGION_FINDS;
  landmarkId?: (typeof ROUTE_FRAGMENTS)[number]['id'];
  fragmentId?: (typeof ROUTE_FRAGMENTS)[number]['id'];
  signalHashId?: (typeof NAVIGATION_HASHES)[number]['id'];
  coreRelicId?: CoreRelicId;
  hardness: number;
  tint: number;
};
export const keyOf = (x: number, y: number) => `${x},${y}`;
export function random(seed: number, x: number, y: number, salt = 0) {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y ^ salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Chunks are deterministic and disposable; excavation and exploration are separate durable state.
export class TileWorld {
  chunks = new Map<string, Tile[]>();
  destroyed = new Set<string>();
  discovered = new Set<string>();
  constructor(
    public seed: number,
    destroyed: string[] = [],
    discovered: string[] = [],
    public mapId: MapId = 'mars-frontier',
    public planetChart?: PlanetChartSize,
  ) {
    this.destroyed = new Set(destroyed);
    this.discovered = new Set(discovered);
  }
  get widthTiles() { return this.planetChart?.columns ?? WORLD.width; }
  get coreWorldY() { return coreWorldYFor(this.planetChart); }
  get farSurfaceY() { return farSurfaceYFor(this.planetChart); }
  get farSurfaceRow() { return farSurfaceRowFor(this.planetChart); }
  get coreDepthMeters() { return coreDepthMetersFor(this.planetChart); }
  generate(x: number, y: number): Tile {
    if (this.planetChart) ({ x, y } = wrapPlanetTile({ x, y }, this.planetChart.columns, this.planetChart.radiusRows));
    const depthMeters = this.planetChart ? depthAtWorldY(y * WORLD.tile, this.planetChart) : y * WORLD.meters,
      b = bandAt(depthMeters),
      style = MAPS[this.mapId],
      bandIndex = Math.max(0, BANDS_INDEX(depthMeters));
    const tile: Tile = {
      x,
      y,
      type: b.type,
      hardness: b.hardness,
      tint: this.mapId === 'mars-frontier'
        ? b.colors[Math.floor(random(this.seed, x, y, 1) * 3)]
        : MAPS[this.mapId].palette[bandIndex],
    };
    if (x < 0 || x >= this.widthTiles) return { ...tile, type: 'boundary', hardness: Infinity };
    if (y < 0) return { ...tile, type: 'empty' };
    if (y >= this.farSurfaceRow) return { ...tile, type: 'empty', ore: undefined };
    const coreY = this.coreWorldY, coreRow = Math.round(coreY / WORLD.tile), centerX = WORLD.homeColumn;
    const coreRelic = CORE_RELICS.find((entry) => entry.mapId === this.mapId);
    if (x === centerX && y === coreRow && coreRelic)
      return { ...tile, type: 'hard', hardness: Math.max(2.2, b.hardness), ore: undefined, coreRelicId: coreRelic.id, tint: coreRelic.tint };
    if (this.planetChart && planetChartCellIntersectsCoreRadius(
      { x, y }, this.planetChart.columns, this.planetChart.radiusRows, CORE.physicalPassageRadius, WORLD.tile,
    )) return { ...tile, type: 'empty', ore: undefined, tint: 0x74b9ab };
    if ((x - centerX) ** 2 + (y - coreRow) ** 2 <= CORE.passageRadius ** 2)
      return { ...tile, type: 'empty', ore: undefined, tint: 0x74b9ab };
    // Keep the center-of-gravity plane sealed except for the authored passage.
    // This makes the hemisphere flip physically require a core crossing while
    // preserving old saves that may have marked this row as excavated.
    if (y === coreRow) return { ...tile, type: 'boundary', hardness: Infinity, ore: undefined };
    const fragment = this.mapId === 'cryo-shelf' ? ROUTE_FRAGMENTS.find((entry) => entry.x === x && entry.row === y) : undefined;
    if (fragment) return { ...tile, fragmentId: fragment.id, landmarkId: fragment.id, tint: 0x91dfd2, hardness: Math.max(0.8, b.hardness), ore: undefined };
    if (this.mapId === 'cryo-shelf') {
      const chamber = ROUTE_FRAGMENTS.find((entry) =>
        Math.abs(x - entry.x) <= entry.chamber.halfWidth &&
        Math.abs(y - entry.row) <= entry.chamber.halfHeight &&
        (x - entry.x) ** 2 / (entry.chamber.halfWidth + 0.5) ** 2 +
          (y - entry.row) ** 2 / (entry.chamber.halfHeight + 0.5) ** 2 <= 1,
      );
      if (chamber) return { ...tile, type: 'empty', ore: undefined, fragmentId: undefined, landmarkId: chamber.id, tint: 0x668f91 };
    }
    // Coarse cells make veins, with irregular missing edge pieces.
    for (const ore of [...ORE_KEYS].reverse()) {
      const o = ORES[ore],
        d = depthMeters;
      const size = ore === 'diamond' ? 2 : 3;
      if (
        d >= o.min &&
        d <= o.max &&
        random(this.seed, Math.floor(x / size), Math.floor(y / size), ORE_KEYS.indexOf(ore) + 20) <
          Math.min(0.9, o.rarity * style.oreFactors[ore]) &&
        random(this.seed, x, y, 50) > 0.15
      ) {
        tile.ore = ore;
        const yieldRoll = random(this.seed, x, y, 91);
        tile.oreUnits = yieldRoll > 0.996 ? 3 : yieldRoll > 0.96 ? 2 : yieldRoll > 0.88 ? 0.5 : 1;
        if (style.geodeChance > 0 && random(this.seed, x, y, 207) < style.geodeChance) {
          tile.geode = true;
          tile.oreUnits = 3;
        }
        const regionalFind = REGION_FINDS[this.mapId as keyof typeof REGION_FINDS];
        if (regionalFind && random(this.seed, x, y, 311) < regionalFind.chance) {
          tile.regionFind = this.mapId as keyof typeof REGION_FINDS;
          tile.oreUnits = Math.max(tile.oreUnits, regionalFind.units);
        }
        break;
      }
    }
    // A starter seam is seed-independent so every new expedition teaches collection immediately.
    if (y < 3 && x >= 23 && x <= 25) {
      tile.ore = 'copper';
      tile.oreUnits = 1;
    }
    if (
      y > 5 &&
      !tile.ore &&
      random(this.seed, Math.floor((x + 1) / 4), Math.floor(y / 3), 80) < style.caveChance
    )
      tile.type = 'empty';
    const signalHash = NAVIGATION_HASHES.find((entry) => entry.mapId === this.mapId && entry.x === x && entry.row === y);
    if (signalHash) {
      tile.signalHashId = signalHash.id;
      if (tile.type === 'empty') tile.type = 'rock';
    }
    return tile;
  }
  get(x: number, y: number): Tile {
    if (this.planetChart) ({ x, y } = wrapPlanetTile({ x, y }, this.planetChart.columns, this.planetChart.radiusRows));
    if (y < 0 || x < 0 || x >= this.widthTiles) return this.generate(x, y);
    const cx = Math.floor(x / WORLD.chunk),
      cy = Math.floor(y / WORLD.chunk),
      key = keyOf(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = [];
      for (let yy = 0; yy < WORLD.chunk; yy++)
        for (let xx = 0; xx < WORLD.chunk; xx++)
          chunk.push(this.generate(cx * WORLD.chunk + xx, cy * WORLD.chunk + yy));
      this.chunks.set(key, chunk);
    }
    const tile = chunk[(y % WORLD.chunk) * WORLD.chunk + (x % WORLD.chunk)];
    return this.destroyed.has(keyOf(x, y)) && tile.type !== 'boundary'
      ? { ...tile, type: 'empty', ore: undefined, fragmentId: undefined, signalHashId: undefined, coreRelicId: undefined, geode: undefined, regionFind: undefined }
      : tile;
  }
  solid(x: number, y: number) {
    return this.get(x, y).type !== 'empty';
  }
  gravitySign(y: number) {
    return gravityDirectionAt(y, this.planetChart);
  }
  break(x: number, y: number) {
    const point = this.planetChart ? wrapPlanetTile({ x, y }, this.planetChart.columns, this.planetChart.radiusRows) : { x, y };
    if (this.get(point.x, point.y).type !== 'boundary') this.destroyed.add(keyOf(point.x, point.y));
  }
  reveal(px: number, py: number, radiusBonus = 0, baseRadius = 4) {
    const tx = Math.floor(px / WORLD.tile),
      ty = Math.floor(py / WORLD.tile),
      radius = Math.min(this.widthTiles * 2, Math.max(1, baseRadius + radiusBonus)),
      verticalRadius = Math.floor(radius * 6 / 7);
    for (let y = Math.max(0, ty - verticalRadius); y <= ty + verticalRadius; y++)
      for (let x = this.planetChart ? tx - radius : Math.max(0, tx - radius); x <= (this.planetChart ? tx + radius : Math.min(this.widthTiles - 1, tx + radius)); x++)
        if (Math.hypot(x - tx, (y - ty) * 1.1) < radius) {
          const point = this.planetChart ? wrapPlanetTile({ x, y }, this.planetChart.columns, this.planetChart.radiusRows) : { x, y };
          if (!this.planetChart || point.y >= 0 && point.y < this.planetChart.radiusRows * 2)
            this.discovered.add(keyOf(point.x, point.y));
        }
  }
  prune(py: number, px?: number) {
    const cy = Math.floor(py / WORLD.tile / WORLD.chunk), cx = px === undefined ? undefined : Math.floor(px / WORLD.tile / WORLD.chunk);
    for (const key of this.chunks.keys()) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      if (Math.abs(chunkY - cy) > 2 || this.planetChart && cx !== undefined && Math.abs(chunkX - cx) > 3) this.chunks.delete(key);
    }
  }
}

function BANDS_INDEX(depth: number) {
  if (depth >= 1000) return 4;
  if (depth >= 600) return 3;
  if (depth >= 300) return 2;
  if (depth >= 100) return 1;
  return 0;
}
