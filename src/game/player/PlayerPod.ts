import { WORLD, PHYSICS as P, FUEL } from '../config';
import { TileWorld, type Tile } from '../world/TileWorld';
import { Progress } from '../economy/Progress';
export type Controls = { left: boolean; right: boolean; down: boolean; up: boolean };
export class PlayerPod {
  x = WORLD.spawnX;
  y = WORLD.spawnY;
  vx = 0;
  vy = 0;
  facing = 1;
  thrusting = false;
  constructor(
    public world: TileWorld,
    public progress: Progress,
  ) {}
  reset() {
    this.x = WORLD.spawnX;
    this.y = WORLD.spawnY;
    this.vx = 0;
    this.vy = 0;
  }
  overlaps(x: number, y: number) {
    const hits: Tile[] = [];
    for (
      let ty = Math.floor((y - P.halfHeight + 0.00001) / WORLD.tile);
      ty <= Math.floor((y + P.halfHeight - 0.00001) / WORLD.tile);
      ty++
    )
      for (
        let tx = Math.floor((x - P.halfWidth + 0.00001) / WORLD.tile);
        tx <= Math.floor((x + P.halfWidth - 0.00001) / WORLD.tile);
        tx++
      )
        if (this.world.solid(tx, ty)) hits.push(this.world.get(tx, ty));
    return hits;
  }
  update(dt: number, input: Controls, onImpact: (damage: number) => void): Tile | undefined {
    const p = this.progress,
      engine = p.max('engine'),
      dir = Number(input.right) - Number(input.left);
    this.thrusting = input.up && p.fuel > 0;
    if (dir) this.facing = dir;
    // Center a vertical cut gently, so landing near a grid edge does not drill two shafts.
    if (input.down && !dir && this.vy >= 0) {
      const center = Math.floor(this.x / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
      const aligned = this.x + Math.max(-70 * dt, Math.min(70 * dt, center - this.x));
      if (!this.overlaps(aligned, this.y).length) this.x = aligned;
    }
    this.vx += dir * P.acceleration * engine * dt;
    if (!dir) this.vx *= Math.exp(-10 * dt);
    this.vx = Math.max(-P.horizontal * engine, Math.min(P.horizontal * engine, this.vx));
    this.vy += (P.gravity - (this.thrusting ? P.thrust * engine : 0) + (input.down ? 110 : 0)) * dt;
    this.vy = Math.max(-P.rise * engine, Math.min(P.fall, this.vy));
    p.fuel = Math.max(
      0,
      p.fuel - dt * ((dir || input.down ? FUEL.moving : 0) + (this.thrusting ? FUEL.thrust : 0)),
    );
    let target: Tile | undefined;
    const steps = Math.max(1, Math.ceil((Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt) / 7));
    for (let i = 0; i < steps; i++) {
      const nx = this.x + (this.vx * dt) / steps,
        hitsX = this.overlaps(nx, this.y);
      if (hitsX.length) {
        if (dir && Math.sign(this.vx) === dir) target = hitsX.find((t) => t.type !== 'boundary');
        if (Math.abs(this.vx) > P.safeImpact)
          onImpact((Math.abs(this.vx) - P.safeImpact) * P.damageScale);
        this.x =
          this.vx > 0
            ? Math.min(...hitsX.map((t) => t.x * WORLD.tile)) - P.halfWidth
            : Math.max(...hitsX.map((t) => (t.x + 1) * WORLD.tile)) + P.halfWidth;
        this.vx = 0;
      } else this.x = nx;
      const ny = this.y + (this.vy * dt) / steps,
        hitsY = this.overlaps(this.x, ny);
      if (hitsY.length) {
        if (this.vy > 0) {
          if (input.down) target = hitsY.find((t) => t.type !== 'boundary');
          if (this.vy > P.safeImpact) onImpact((this.vy - P.safeImpact) * P.damageScale);
          this.y = Math.min(...hitsY.map((t) => t.y * WORLD.tile)) - P.halfHeight;
        } else this.y = Math.max(...hitsY.map((t) => (t.y + 1) * WORLD.tile)) + P.halfHeight;
        this.vy = 0;
      } else this.y = ny;
      this.x = Math.max(P.halfWidth, Math.min(WORLD.width * WORLD.tile - P.halfWidth, this.x));
      if (this.y < -180) {
        this.y = -180;
        this.vy = 0;
      }
    }
    return input.up ? undefined : target;
  }
}
