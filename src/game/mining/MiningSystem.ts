import { CHARGE, FUEL, PHYSICS, SALVAGE_MAGNET, WORLD, drillWidth, type Ore } from '../config';
import { Progress } from '../economy/Progress';
import { TileWorld, type Tile } from '../world/TileWorld';
export function chargeTargets(world: TileWorld, centerX: number, centerY: number, radius: number) {
  const targets: Tile[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const tile = world.get(centerX + dx, centerY + dy);
      if (tile.type !== 'empty' && tile.type !== 'boundary') targets.push(tile);
    }
  return targets;
}
export function aimedDrillTarget(
  world: TileWorld,
  podX: number,
  podY: number,
  aimX: number,
  aimY: number,
  maxDistance = WORLD.tile * 1.8,
) {
  const dx = aimX - podX, dy = aimY - podY, length = Math.hypot(dx, dy);
  if (length < 1) return undefined;
  const nx = dx / length, ny = dy / length;
  const steps = Math.ceil(Math.min(length, maxDistance) / 3);
  for (let i = 1; i <= steps; i++) {
    const distance = Math.min(length, maxDistance) * i / steps;
    const x = Math.floor((podX + nx * distance) / WORLD.tile);
    const y = Math.floor((podY + ny * distance) / WORLD.tile);
    const tile = world.get(x, y);
    if (tile.type === 'boundary') return undefined;
    if (tile.type !== 'empty') return tile;
  }
  return undefined;
}
export function collectOreDrop(progress: Progress, drop: { ore: Ore; units: number }) {
  const collected = progress.collectUnits(drop.ore, drop.units);
  if (collected > 0) drop.units = Math.round((drop.units - collected) * 2) / 2;
  return collected;
}
export function podWithinPickupReach(podX: number, podY: number, dropX: number, dropY: number) {
  const dx = Math.max(0, Math.abs(dropX - podX) - PHYSICS.halfWidth),
    dy = Math.max(0, Math.abs(dropY - podY) - PHYSICS.halfHeight);
  return Math.hypot(dx, dy) <= CHARGE.pickupRadius;
}
export function hasClearMagnetPath(world: TileWorld, fromX: number, fromY: number, toX: number, toY: number) {
  const dx = toX - fromX, dy = toY - fromY;
  const steps = Math.ceil(Math.hypot(dx, dy) / (WORLD.tile * 0.3));
  for (let i = 1; i < steps; i++) {
    const x = Math.floor((fromX + dx * i / steps) / WORLD.tile);
    const y = Math.floor((fromY + dy * i / steps) / WORLD.tile);
    if (world.solid(x, y)) return false;
  }
  return true;
}
export function applySalvageMagnet(
  world: TileWorld,
  drop: { x: number; y: number; vx: number; vy: number },
  podX: number,
  podY: number,
  dt: number,
) {
  const dx = podX - drop.x, dy = podY - drop.y, distance = Math.hypot(dx, dy);
  if (distance > SALVAGE_MAGNET.radius || distance < 1 || !hasClearMagnetPath(world, drop.x, drop.y, podX, podY)) return false;
  drop.vx += dx / distance * SALVAGE_MAGNET.acceleration * dt;
  drop.vy += dy / distance * SALVAGE_MAGNET.acceleration * dt;
  const speed = Math.hypot(drop.vx, drop.vy);
  if (speed > SALVAGE_MAGNET.maxSpeed) {
    drop.vx *= SALVAGE_MAGNET.maxSpeed / speed;
    drop.vy *= SALVAGE_MAGNET.maxSpeed / speed;
  }
  return true;
}
export function updateOreDropPhysics(
  world: TileWorld,
  drop: { x: number; y: number; vx: number; vy: number },
  dt: number,
  gravitySign = world.gravitySign(drop.y),
) {
  drop.vy = Math.max(-220, Math.min(220, drop.vy + gravitySign * 185 * dt));
  const nextX = drop.x + drop.vx * dt,
    nextY = drop.y + drop.vy * dt,
    solidX = Math.floor(nextX / WORLD.tile),
    solidY = Math.floor((nextY + gravitySign * 5) / WORLD.tile);
  if (!world.solid(solidX, solidY)) {
    drop.x = nextX;
    drop.y = nextY;
  } else {
    drop.vy = drop.vy * gravitySign > 16 ? -drop.vy * 0.2 : 0;
    drop.vx *= -0.35;
  }
  drop.vx *= Math.max(0, 1 - dt * 1.8);
}
export function updateChargePhysics(world: TileWorld, charge: { x: number; y: number; vy?: number }, dt: number, gravitySign = world.gravitySign(charge.y)) {
  const vy = Math.max(-CHARGE.maxFallSpeed, Math.min(CHARGE.maxFallSpeed, (charge.vy ?? 0) + gravitySign * CHARGE.gravity * dt));
  const nextY = charge.y + vy * dt;
  const supportRow = Math.floor((nextY + gravitySign * CHARGE.radius) / WORLD.tile);
  if (world.solid(Math.floor(charge.x / WORLD.tile), supportRow)) {
    charge.y = gravitySign > 0 ? supportRow * WORLD.tile - CHARGE.radius : (supportRow + 1) * WORLD.tile + CHARGE.radius;
    charge.vy = 0;
    return true;
  }
  charge.y = nextY;
  charge.vy = vy;
  return false;
}
export class MiningSystem {
  target?: Tile;
  elapsed = 0;
  ratio = 0;
  warningRemaining = 0;
  cargoOverflow = false;
  warningUnits = 0;
  warningSpace = 0;
  affected: Tile[] = [];
  constructor(
    public world: TileWorld,
    public progress: Progress,
  ) {}
  update(dt: number, tile: Tile | undefined, onBreak: (tile: Tile, collected: number, dropped: number) => void, orientation: 'horizontal' | 'vertical' | { x: number; y: number } = 'horizontal', protectedTiles: ReadonlySet<string> = new Set()) {
    if (!tile || tile.type === 'boundary' || tile.type === 'empty') {
      this.warningRemaining = 0;
      this.cargoOverflow = false;
      this.warningUnits = 0;
      this.warningSpace = Math.max(0, this.progress.max('cargo') - this.progress.count);
      this.target = undefined;
      this.affected = [];
      this.elapsed = 0;
      this.ratio = 0;
      return;
    }
    if (this.target?.x !== tile.x || this.target?.y !== tile.y) this.elapsed = 0;
    this.target = tile;
    const width = drillWidth(this.progress.levels.drill);
    const spanStart = -Math.floor((width - 1) / 2);
    this.affected = Array.from({ length: width }, (_, index) => {
      const offset = spanStart + index;
      if (typeof orientation === 'string')
        return this.world.get(tile.x + (orientation === 'horizontal' ? offset : 0), tile.y + (orientation === 'vertical' ? offset : 0));
      const length = Math.hypot(orientation.x, orientation.y) || 1;
      const perpendicularX = -orientation.y / length, perpendicularY = orientation.x / length;
      return this.world.get(Math.round(tile.x + perpendicularX * offset), Math.round(tile.y + perpendicularY * offset));
    }).filter((candidate, index, candidates) => candidate.type !== 'empty' && candidate.type !== 'boundary' && !protectedTiles.has(`${candidate.x},${candidate.y}`) && candidates.findIndex((other) => other.x === candidate.x && other.y === candidate.y) === index);
    this.elapsed += dt;
    const units = this.affected.reduce((sum, target) => sum + (target.ore ? target.oreUnits ?? 1 : 0), 0);
    this.warningUnits = units;
    this.warningSpace = Math.max(0, this.progress.max('cargo') - this.progress.count);
    this.cargoOverflow = units > 0 && units > this.warningSpace;
    // Overflow is recoverable: keep cutting and leave any uncollected yield in the mine.
    this.warningRemaining = 0;
    this.progress.fuel = Math.max(0, this.progress.fuel - dt * FUEL.drilling * width);
    this.ratio = Math.min(1, this.elapsed / this.progress.drillTime(tile.hardness));
    if (this.ratio >= 1) {
      for (const target of this.affected) {
        this.world.break(target.x, target.y);
        const collected = target.ore ? this.progress.collectUnits(target.ore, target.oreUnits ?? 1) : 0;
        onBreak(target, collected, target.ore ? Math.max(0, (target.oreUnits ?? 1) - collected) : 0);
      }
      this.target = undefined;
      this.affected = [];
      this.elapsed = 0;
      this.ratio = 0;
      this.cargoOverflow = false;
      this.warningUnits = 0;
    }
  }
}
