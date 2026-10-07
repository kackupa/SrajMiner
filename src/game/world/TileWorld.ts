import { CORE, CORE_WORLD_Y, FAR_SURFACE_ROW, WORLD, ORES, ORE_KEYS, bandAt, MAPS, CORE_RELICS, REGION_FINDS, ROUTE_FRAGMENTS, NAVIGATION_HASHES, gravityDirectionAt, type Ore, type MapId, type CoreRelicId } from '../config';
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
  ) {
    this.destroyed = new Set(destroyed);
    this.discovered = new Set(discovered);
  }
  generate(x: number, y: number): Tile {
    const b = bandAt(y * WORLD.meters),
      style = MAPS[this.mapId],
      bandIndex = Math.max(0, BANDS_INDEX(y * WORLD.meters));
    const tile: Tile = {
      x,
      y,
      type: b.type,
      hardness: b.hardness,
      tint: this.mapId === 'mars-frontier'
        ? b.colors[Math.floor(random(this.seed, x, y, 1) * 3)]
        : MAPS[this.mapId].palette[bandIndex],
    };
    if (x < 0 || x >= WORLD.width) return { ...tile, type: 'boundary', hardness: Infinity };
    if (y < 0) return { ...tile, type: 'empty' };
    if (y >= FAR_SURFACE_ROW) return { ...tile, type: 'empty', ore: undefined };
    const coreRow = Math.round(CORE_WORLD_Y / WORLD.tile), centerX = Math.floor(WORLD.width / 2);
    const coreRelic = CORE_RELICS.find((entry) => entry.mapId === this.mapId);
    if (x === centerX && y === coreRow && coreRelic)
      return { ...tile, type: 'hard', hardness: Math.max(2.2, b.hardness), ore: undefined, coreRelicId: coreRelic.id, tint: coreRelic.tint };
    if ((x - centerX) ** 2 + (y - coreRow) ** 2 <= CORE.passageRadius ** 2)
      return { ...tile, type: 'empty', ore: undefined, tint: 0x74b9ab };
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
        d = y * WORLD.meters;
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
    if (y < 0 || x < 0 || x >= WORLD.width) return this.generate(x, y);
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
    return this.destroyed.has(keyOf(x, y))
      ? { ...tile, type: 'empty', ore: undefined, fragmentId: undefined, signalHashId: undefined, coreRelicId: undefined, geode: undefined, regionFind: undefined }
      : tile;
  }
  solid(x: number, y: number) {
    return this.get(x, y).type !== 'empty';
  }
  gravitySign(y: number) {
    return gravityDirectionAt(y);
  }
  break(x: number, y: number) {
    if (this.get(x, y).type !== 'boundary') this.destroyed.add(keyOf(x, y));
  }
  reveal(px: number, py: number, radiusBonus = 0, baseRadius = 4) {
    const tx = Math.floor(px / WORLD.tile),
      ty = Math.floor(py / WORLD.tile),
      radius = Math.min(WORLD.width * 2, Math.max(1, baseRadius + radiusBonus)),
      verticalRadius = Math.floor(radius * 6 / 7);
    for (let y = Math.max(0, ty - verticalRadius); y <= ty + verticalRadius; y++)
      for (let x = Math.max(0, tx - radius); x <= Math.min(WORLD.width - 1, tx + radius); x++)
        if (Math.hypot(x - tx, (y - ty) * 1.1) < radius) this.discovered.add(keyOf(x, y));
  }
  prune(py: number) {
    const cy = Math.floor(py / WORLD.tile / WORLD.chunk);
    for (const key of this.chunks.keys())
      if (Math.abs(Number(key.split(',')[1]) - cy) > 2) this.chunks.delete(key);
  }
}

function BANDS_INDEX(depth: number) {
  if (depth >= 1000) return 4;
  if (depth >= 600) return 3;
  if (depth >= 300) return 2;
  if (depth >= 100) return 1;
  return 0;
}
