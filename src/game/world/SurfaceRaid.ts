import { SURFACE_RAID, UNDERGROUND_BUILDING, WORLD, type MapId } from '../config';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import { globeSurfaceDistance, surfaceArcCoordinate, surfaceArcPoint, structureIntegrity, surfaceTurretRange, turretStats } from '../building/UndergroundStructures';
import type { TileWorld } from './TileWorld';
import { random } from './TileWorld';
import { planetCartesianToChart, planetChartToCartesian, planetChartVectorToCartesian } from './PlanetChart';

export type SurfaceRaiderState = {
  x: number;
  y: number;
  targetId: string;
  health: number;
  timer: number;
  phase: number;
  hitFlash: number;
  drillCooldown: number;
};

export type SurfaceRaidEvent =
  | { type: 'warning'; target: UndergroundStructure }
  | { type: 'intercepted'; x: number; y: number }
  | { type: 'damaged' | 'destroyed'; target: UndergroundStructure };

/** A brief colony raid that is telegraphed and has drill/turret counterplay. */
export class SurfaceRaid {
  active?: SurfaceRaiderState;
  private wait: number = SURFACE_RAID.firstWarningSeconds;
  private encounter = 0;
  private fortOnline = false;
  get secondsUntilArrival() { return Math.max(0, Math.ceil(this.wait)); }

  private resetWait() {
    this.wait = this.fortOnline ? SURFACE_RAID.fortRepeatWarningSeconds : SURFACE_RAID.repeatWarningSeconds;
  }

  constructor(private seed: number, private mapId: MapId) {}

  update(
    dt: number,
    playerAtSurface: boolean,
    world: TileWorld,
    structures: UndergroundStructure[],
    onTurretFire: (x: number, y: number) => void = () => {},
    playerPosition?: { x: number; y: number },
  ): SurfaceRaidEvent | undefined {
    if (!playerAtSurface) return undefined;
    const hasFort = structures.some(entry => entry.kind === 'fort');
    if (hasFort && !this.fortOnline) this.wait = Math.min(this.wait, SURFACE_RAID.fortFirstWarningSeconds);
    this.fortOnline = hasFort;
    if (!this.active) {
      const targets = structures.filter((entry) => ['habitat', 'turret', 'fort'].includes(entry.kind) &&
        Math.min(Math.abs(entry.y), Math.abs(entry.y - world.farSurfaceY)) <= WORLD.tile * 4 &&
        (!playerPosition || globeSurfaceDistance(world, entry.x, entry.y, playerPosition.x, playerPosition.y) <= SURFACE_RAID.visibleColonyRadius));
      if (!targets.length) {
        return undefined;
      }
      this.wait -= dt;
      if (this.wait > 0) return undefined;
      const encounter = this.encounter++;
      const target = targets.find(entry => entry.kind === 'fort') ?? targets[Math.floor(random(this.seed, encounter, this.mapId.length, 801) * targets.length)]!;
      const sign = random(this.seed, encounter, this.mapId.length, 802) < 0.5 ? -1 : 1;
      const arrival = surfaceArcPoint(world, surfaceArcCoordinate(world, target.x, target.y) - sign * SURFACE_RAID.arrivalDistance, false);
      this.active = {
        x: arrival.x,
        y: arrival.y - world.gravitySign(arrival.y) * 26,
        targetId: target.id,
        health: SURFACE_RAID.drillHitsToRepel,
        timer: SURFACE_RAID.telegraphSeconds,
        phase: random(this.seed, encounter, this.mapId.length, 803) * Math.PI * 2,
        hitFlash: 0,
        drillCooldown: 0,
      };
      return { type: 'warning', target };
    }

    const raider = this.active;
    raider.hitFlash = Math.max(0, raider.hitFlash - dt);
    raider.drillCooldown = Math.max(0, raider.drillCooldown - dt);
    const target = structures.find((entry) => entry.id === raider.targetId);
    if (!target) {
      this.active = undefined;
      this.resetWait();
      return undefined;
    }

    for (const turret of structures) {
      if (turret.kind !== 'turret' || turret.id === target.id || (turret.reload ?? 0) > 0) continue;
      if (Math.min(Math.abs(turret.y), Math.abs(turret.y - world.farSurfaceY)) > WORLD.tile * 4) continue;
      if (globeSurfaceDistance(world, turret.x, turret.y, raider.x, raider.y) > surfaceTurretRange(world, turret, structures)) continue;
      turret.reload = turretStats(turret).reloadSeconds;
      onTurretFire(turret.x, turret.y);
      this.active = undefined;
      this.resetWait();
      return { type: 'intercepted', x: turret.x, y: turret.y };
    }

    const fullArc = world.widthTiles * WORLD.tile * 2,
      raiderArc = surfaceArcCoordinate(world, raider.x, raider.y), targetArc = surfaceArcCoordinate(world, target.x, target.y),
      rawDelta = ((targetArc - raiderArc) % fullArc + fullArc) % fullArc,
      routeDelta = rawDelta > fullArc / 2 ? rawDelta - fullArc : rawDelta,
      routeDirection = Math.sign(routeDelta), step = Math.min(Math.abs(routeDelta), SURFACE_RAID.approachSpeed * dt),
      barriers = structures.filter((entry) => entry.kind === 'wall' || entry.kind === 'gate')
        .map((entry) => {
          const difference = ((surfaceArcCoordinate(world, entry.x, entry.y) - raiderArc) % fullArc + fullArc) % fullArc,
            signed = difference > fullArc / 2 ? difference - fullArc : difference,
            along = signed * routeDirection,
            opensForPlayer = entry.kind === 'gate' && !!playerPosition && globeSurfaceDistance(world, playerPosition.x, playerPosition.y, entry.x, entry.y) <= WORLD.tile * 2;
          return { entry, along, opensForPlayer };
        })
        .filter(({ entry, along, opensForPlayer }) => !opensForPlayer && along >= 0 && along <= Math.abs(routeDelta) + UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2)
        .sort((a, b) => a.along - b.along),
      barrier = barriers.find(({ entry, along }) => along <= step + UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2 + 8);
    if (barrier) {
      const stopArc = raiderArc + routeDirection * Math.max(0, barrier.along - UNDERGROUND_BUILDING[barrier.entry.kind].widthTiles * WORLD.tile / 2 - 8),
        point = surfaceArcPoint(world, stopArc, false);
      raider.x = point.x;
      raider.y = point.y - world.gravitySign(point.y) * 26;
      raider.timer -= dt;
      if (raider.timer > 0) return undefined;
      const integrity = barrier.entry.integrity ?? structureIntegrity(barrier.entry.kind);
      raider.timer = 2.4;
      if (integrity > 1) {
        barrier.entry.integrity = integrity - 1;
        return { type: 'damaged', target: barrier.entry };
      }
      const index = structures.findIndex((entry) => entry.id === barrier.entry.id);
      if (index >= 0) structures.splice(index, 1);
      return { type: 'destroyed', target: barrier.entry };
    }
    if (step > 0) {
      const point = surfaceArcPoint(world, raiderArc + routeDirection * step, false);
      raider.x = point.x;
      raider.y = point.y - world.gravitySign(point.y) * 26;
    }
    raider.timer -= dt;
    if (raider.timer > 0 || Math.abs(routeDelta) > step + UNDERGROUND_BUILDING[target.kind].widthTiles * WORLD.tile / 2) return undefined;

    const integrity = target.integrity ?? structureIntegrity(target.kind);
    if (integrity > 1) {
      target.integrity = integrity - 1;
      this.active = undefined;
      this.resetWait();
      return { type: 'damaged', target };
    }
    const index = structures.findIndex((entry) => entry.id === target.id);
    if (index >= 0) structures.splice(index, 1);
    this.active = undefined;
    this.resetWait();
    return { type: 'destroyed', target };
  }

  hitByDrill(world: TileWorld, podX: number, podY: number, aimX: number, aimY: number, reach: number) {
    const raider = this.active;
    if (!raider || raider.drillCooldown > 0 || Math.hypot(aimX, aimY) < 0.001) return false;
    const chart = world.planetChart;
    const origin = chart
      ? planetChartToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { x: podX, y: podY };
    const target = chart
      ? planetChartToCartesian({ u: raider.x / WORLD.tile, v: raider.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { x: raider.x, y: raider.y };
    const vector = chart
      ? planetChartVectorToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, { du: aimX / WORLD.tile, dv: aimY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { dx: aimX, dy: aimY };
    const length = Math.hypot(vector.dx, vector.dy) || 1;
    const nx = vector.dx / length, ny = vector.dy / length;
    const dx = target.x - origin.x, dy = target.y - origin.y;
    const along = dx * nx + dy * ny, across = Math.abs(dx * ny - dy * nx);
    if (along < 0 || along > reach || across > SURFACE_RAID.drillHitRadius) return false;
    raider.health--;
    raider.drillCooldown = SURFACE_RAID.drillCooldownSeconds;
    raider.hitFlash = 0.14;
    if (raider.health > 0) return false;
    this.active = undefined;
    this.resetWait();
    return true;
  }
}
