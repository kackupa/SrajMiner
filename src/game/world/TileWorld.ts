import { WORLD, ORES, ORE_KEYS, bandAt, type Ore } from '../config';
export type Tile = {
  x: number;
  y: number;
  type: 'empty' | 'dirt' | 'rock' | 'hard' | 'boundary';
  ore?: Ore;
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
  ) {
    this.destroyed = new Set(destroyed);
    this.discovered = new Set(discovered);
  }
  generate(x: number, y: number): Tile {
    const b = bandAt(y * WORLD.meters);
    const tile: Tile = {
      x,
      y,
      type: b.type,
      hardness: b.hardness,
      tint: b.colors[Math.floor(random(this.seed, x, y, 1) * 3)],
    };
    if (x < 0 || x >= WORLD.width) return { ...tile, type: 'boundary', hardness: Infinity };
    if (y < 0) return { ...tile, type: 'empty' };
    // Coarse cells make veins, with irregular missing edge pieces.
    for (const ore of [...ORE_KEYS].reverse()) {
      const o = ORES[ore],
        d = y * WORLD.meters;
      const size = ore === 'diamond' ? 2 : 3;
      if (
        d >= o.min &&
        d <= o.max &&
        random(this.seed, Math.floor(x / size), Math.floor(y / size), ORE_KEYS.indexOf(ore) + 20) <
          o.rarity &&
        random(this.seed, x, y, 50) > 0.15
      ) {
        tile.ore = ore;
        break;
      }
    }
    // A starter seam is seed-independent so every new expedition teaches collection immediately.
    if (y < 3 && x >= 23 && x <= 25) tile.ore = 'copper';
    if (
      y > 5 &&
      !tile.ore &&
      random(this.seed, Math.floor((x + 1) / 4), Math.floor(y / 3), 80) < 0.12
    )
      tile.type = 'empty';
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
    return this.destroyed.has(keyOf(x, y)) ? { ...tile, type: 'empty', ore: undefined } : tile;
  }
  solid(x: number, y: number) {
    return this.get(x, y).type !== 'empty';
  }
  break(x: number, y: number) {
    if (this.get(x, y).type !== 'boundary') this.destroyed.add(keyOf(x, y));
  }
  reveal(px: number, py: number) {
    const tx = Math.floor(px / WORLD.tile),
      ty = Math.floor(py / WORLD.tile);
    for (let y = Math.max(0, ty - 6); y <= ty + 6; y++)
      for (let x = Math.max(0, tx - 7); x <= Math.min(WORLD.width - 1, tx + 7); x++)
        if (Math.hypot(x - tx, (y - ty) * 1.1) < 7) this.discovered.add(keyOf(x, y));
  }
  prune(py: number) {
    const cy = Math.floor(py / WORLD.tile / WORLD.chunk);
    for (const key of this.chunks.keys())
      if (Math.abs(Number(key.split(',')[1]) - cy) > 2) this.chunks.delete(key);
  }
}
