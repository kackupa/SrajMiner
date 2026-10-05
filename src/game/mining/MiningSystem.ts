import { FUEL, MINING } from '../config';
import { Progress } from '../economy/Progress';
import { TileWorld, type Tile } from '../world/TileWorld';
export class MiningSystem {
  target?: Tile;
  elapsed = 0;
  ratio = 0;
  warningRemaining = 0;
  constructor(
    public world: TileWorld,
    public progress: Progress,
  ) {}
  update(dt: number, tile: Tile | undefined, onBreak: (tile: Tile, collected: boolean) => void) {
    if (!tile || tile.type === 'boundary' || tile.type === 'empty') {
      this.warningRemaining = 0;
      this.target = undefined;
      this.elapsed = 0;
      this.ratio = 0;
      return;
    }
    if (this.target?.x !== tile.x || this.target?.y !== tile.y) this.elapsed = 0;
    this.target = tile;
    this.elapsed += dt;
    const delay =
      tile.ore && this.progress.count >= this.progress.max('cargo')
        ? MINING.fullCargoWarningSeconds
        : 0;
    this.warningRemaining = Math.max(0, delay - this.elapsed);
    if (this.warningRemaining > 0) {
      this.ratio = 0;
      return;
    }
    this.progress.fuel = Math.max(0, this.progress.fuel - dt * FUEL.drilling);
    this.ratio = Math.min(1, (this.elapsed - delay) / (tile.hardness / this.progress.max('drill')));
    if (this.ratio >= 1) {
      this.world.break(tile.x, tile.y);
      const collected = tile.ore ? this.progress.collect(tile.ore) : false;
      onBreak(tile, collected);
      this.target = undefined;
      this.elapsed = 0;
      this.ratio = 0;
    }
  }
}
