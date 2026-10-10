import { CHARGE, CORE, FUEL, PHYSICS, SALVAGE_MAGNET, WORLD, drillReachTiles, drillWidth, type Ore } from '../config';
import { Progress } from '../economy/Progress';
import { TileWorld, type Tile } from '../world/TileWorld';
import { planetCartesianToChart, planetCartesianVectorToWorld, planetChartToCartesian, planetChartVectorToCartesian, wrapPlanetWorldX } from '../world/PlanetChart';
export function directionalDrillOrientation(input: { left: boolean; right: boolean; down: boolean }): 'horizontal' | 'vertical' {
  return input.left || input.right ? 'horizontal' : 'vertical';
}
/** Protect the miner's hull, except for the solid tile the player is explicitly cutting to clear an obstruction. */
export function drillProtection(overlappingTiles: readonly Tile[], target?: Tile) {
  const protectedTiles = new Set(overlappingTiles.map((tile) => `${tile.x},${tile.y}`));
  if (target && target.type !== 'boundary') protectedTiles.delete(`${target.x},${target.y}`);
  return protectedTiles;
}
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
  maxDistance = WORLD.tile * drillReachTiles(1),
) {
  if (world.planetChart) {
    const chart = world.planetChart,
      origin = planetPoint(world, podX, podY), pointer = planetPoint(world, aimX, aimY),
      dx = pointer.x - origin.x, dy = pointer.y - origin.y, length = Math.hypot(dx, dy);
    if (length < 1) return undefined;
    const distanceLimit = Math.min(length, maxDistance), steps = Math.ceil(distanceLimit / 3);
    for (let i = 1; i <= steps; i++) {
      const distance = distanceLimit * i / steps,
        point = planetCartesianToChart({ x: origin.x + dx / length * distance, y: origin.y + dy / length * distance }, chart.columns, chart.radiusRows, WORLD.tile),
        tile = world.get(Math.floor(point.u), Math.floor(point.v));
      if (tile.type === 'boundary') return undefined;
      if (tile.type !== 'empty') return tile;
    }
    return undefined;
  }
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
/** Convert a screen/world pointer into the miner's local aim direction, even through empty tunnels. */
export function pointerDrillDirection(world: TileWorld, podX: number, podY: number, aimX: number, aimY: number) {
  let dx = aimX - podX, dy = aimY - podY;
  if (world.planetChart) {
    const chart = world.planetChart,
      origin = planetPoint(world, podX, podY), pointer = planetPoint(world, aimX, aimY),
      local = planetCartesianVectorToWorld(
        { u: podX / WORLD.tile, v: podY / WORLD.tile },
        { x: pointer.x - origin.x, y: pointer.y - origin.y },
        chart.columns, chart.radiusRows, WORLD.tile,
      );
    dx = local.x;
    dy = local.y;
  }
  const length = Math.hypot(dx, dy);
  return length < 1 ? undefined : { x: dx / length, y: dy / length };
}
export function collectOreDrop(progress: Progress, drop: { ore: Ore; units: number }) {
  const collected = progress.collectUnits(drop.ore, drop.units);
  if (collected > 0) drop.units = Math.round((drop.units - collected) * 2) / 2;
  return collected;
}
function planetPoint(world: TileWorld, x: number, y: number) {
  const chart = world.planetChart!;
  return planetChartToCartesian({ u: x / WORLD.tile, v: y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile);
}
export function podWithinPickupReach(podX: number, podY: number, dropX: number, dropY: number, world?: TileWorld) {
  if (world?.planetChart) {
    const pod = planetPoint(world, podX, podY), drop = planetPoint(world, dropX, dropY);
    return Math.hypot(drop.x - pod.x, drop.y - pod.y) <= CHARGE.pickupRadius + Math.hypot(PHYSICS.halfWidth, PHYSICS.halfHeight);
  }
  const dx = Math.max(0, Math.abs(dropX - podX) - PHYSICS.halfWidth),
    dy = Math.max(0, Math.abs(dropY - podY) - PHYSICS.halfHeight);
  return Math.hypot(dx, dy) <= CHARGE.pickupRadius;
}
export function hasClearMagnetPath(world: TileWorld, fromX: number, fromY: number, toX: number, toY: number) {
  if (world.planetChart) {
    const from = planetPoint(world, fromX, fromY), to = planetPoint(world, toX, toY),
      dx = to.x - from.x, dy = to.y - from.y,
      steps = Math.ceil(Math.hypot(dx, dy) / (WORLD.tile * 0.3));
    for (let i = 1; i < steps; i++) {
      const chart = world.planetChart,
        point = planetCartesianToChart({ x: from.x + dx * i / steps, y: from.y + dy * i / steps }, chart.columns, chart.radiusRows, WORLD.tile);
      if (world.solid(Math.floor(point.u), Math.floor(point.v))) return false;
    }
    return true;
  }
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
  const chart = world.planetChart,
    from = chart ? planetPoint(world, drop.x, drop.y) : undefined,
    to = chart ? planetPoint(world, podX, podY) : undefined,
    dx = to && from ? to.x - from.x : podX - drop.x,
    dy = to && from ? to.y - from.y : podY - drop.y,
    distance = Math.hypot(dx, dy);
  if (distance > SALVAGE_MAGNET.radius || distance < 0.001 || !hasClearMagnetPath(world, drop.x, drop.y, podX, podY)) return false;
  if (chart && from) {
    const acceleration = planetCartesianVectorToWorld({ u: drop.x / WORLD.tile, v: drop.y / WORLD.tile }, {
      x: dx / distance * SALVAGE_MAGNET.acceleration * dt,
      y: dy / distance * SALVAGE_MAGNET.acceleration * dt,
    }, chart.columns, chart.radiusRows, WORLD.tile);
    drop.vx += acceleration.x;
    drop.vy += acceleration.y;
  } else {
    drop.vx += dx / distance * SALVAGE_MAGNET.acceleration * dt;
    drop.vy += dy / distance * SALVAGE_MAGNET.acceleration * dt;
  }
  const physicalVelocity = chart
      ? planetChartVectorToCartesian({ u: drop.x / WORLD.tile, v: drop.y / WORLD.tile }, { du: drop.vx / WORLD.tile, dv: drop.vy / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { dx: drop.vx, dy: drop.vy },
    speed = Math.hypot(physicalVelocity.dx, physicalVelocity.dy);
  if (speed > SALVAGE_MAGNET.maxSpeed) {
    const scale = SALVAGE_MAGNET.maxSpeed / speed;
    if (chart) {
      const velocity = planetCartesianVectorToWorld({ u: drop.x / WORLD.tile, v: drop.y / WORLD.tile }, {
        x: physicalVelocity.dx * scale, y: physicalVelocity.dy * scale,
      }, chart.columns, chart.radiusRows, WORLD.tile);
      drop.vx = velocity.x;
      drop.vy = velocity.y;
    } else {
      drop.vx *= scale;
      drop.vy *= scale;
    }
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
    seam = world.planetChart
      ? wrapPlanetWorldX(nextX, nextY, drop.vx, drop.vy, 0, 0, world.widthTiles * WORLD.tile, world.farSurfaceY)
      : { x: nextX, y: nextY, vx: drop.vx, vy: drop.vy },
    nextGravity = world.gravitySign(seam.y),
    solidX = Math.floor(seam.x / WORLD.tile),
    solidY = Math.floor((seam.y + nextGravity * 5) / WORLD.tile);
  if (!world.solid(solidX, solidY)) {
    drop.x = seam.x;
    drop.y = seam.y;
    drop.vy = seam.vy;
  } else {
    drop.vy = seam.vy * nextGravity > 16 ? -seam.vy * 0.2 : 0;
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
  effectiveWidth = 1;
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
      this.effectiveWidth = drillWidth(this.progress.levels.drill);
      return;
    }
    if (this.target?.x !== tile.x || this.target?.y !== tile.y) this.elapsed = 0;
    this.target = tile;
    const chart = this.world.planetChart,
      radialAim = typeof orientation === 'string' ? orientation === 'vertical' : Math.abs(orientation.y) >= Math.abs(orientation.x),
      radiusRowsAtTarget = chart ? Math.abs(chart.radiusRows - (tile.y + 0.5)) : Infinity,
      tangentCellWidth = chart ? Math.max(0.1, WORLD.tile * radiusRowsAtTarget * Math.PI / chart.columns) : WORLD.tile,
      physicalClearanceWidth = chart && radialAim && radiusRowsAtTarget * WORLD.tile > CORE.physicalPassageRadius
        ? Math.ceil((2 * PHYSICS.halfWidth + 4) / tangentCellWidth)
        : 1,
      upgradeWidth = drillWidth(this.progress.levels.drill),
      width = Math.max(upgradeWidth, physicalClearanceWidth),
      fuelWidth = Math.max(1, upgradeWidth / physicalClearanceWidth);
    this.effectiveWidth = width;
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
    // Angular cells physically shrink toward the core. The extra adjacent cells
    // are mandatory hull clearance, not a free multi-drill upgrade, so only
    // charge additional fuel when the purchased tier exceeds that baseline.
    this.progress.fuel = Math.max(0, this.progress.fuel - dt * FUEL.drilling * fuelWidth);
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
      this.effectiveWidth = drillWidth(this.progress.levels.drill);
      this.cargoOverflow = false;
      this.warningUnits = 0;
    }
  }
}
