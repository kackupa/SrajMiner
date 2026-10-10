import { HULL_SCRAPPER, ROCK_SWIMMER, SHARD_MANTA, UNDERGROUND_BUILDING, WORLD, type MapId } from '../config';
import { random } from './TileWorld';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import type { TileWorld } from './TileWorld';
import { planetCartesianToChart, planetChartToCartesian, planetChartVectorToCartesian } from './PlanetChart';

export type RockSwimmerState = {
  kind?: 'rock-swimmer' | 'shard-manta' | 'hull-scrapper';
  mode?: 'hunt' | 'windup' | 'charge' | 'recover';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  phase: number;
  health: number;
  drillCooldown: number;
  hitFlash: number;
  modeTimer?: number;
  chargeX?: number;
  chargeY?: number;
  warningPlayed?: boolean;
  armorBlockedFlash?: number;
};

export function swimmerKindForEncounter(encounter: number, mapId: MapId = 'cryo-shelf'): RockSwimmerState['kind'] {
  if (Math.floor(encounter) % 3 !== 2) return 'rock-swimmer';
  return mapId === 'hull-graveyard' ? 'hull-scrapper' : 'shard-manta';
}

/** A cave predator that phases through rock, pressures the pod, and can be deterred by turrets. */
export class RockSwimmer {
  active?: RockSwimmerState;
  private wait: number = ROCK_SWIMMER.firstArrivalSeconds;
  private encounter = 0;

  constructor(private seed: number, private mapId: MapId) {}

  update(dt: number, depth: number, podX: number, podY: number, structures: UndergroundStructure[] = [], onTurretFire: (x: number, y: number) => void = () => {}) {
    for (const turret of structures.filter((entry) => entry.kind === 'turret')) turret.reload = Math.max(0, (turret.reload ?? 0) - dt);
    if (depth < ROCK_SWIMMER.firstDepth) {
      this.active = undefined;
      this.wait = ROCK_SWIMMER.firstArrivalSeconds;
      return false;
    }
    if (!this.active) {
      this.wait -= dt;
      if (this.wait > 0) return false;
      const n = this.encounter++;
      const angle = random(this.seed, n, this.mapId.length, 141) * Math.PI * 2;
      const kind = swimmerKindForEncounter(n, this.mapId)!,
        distance = kind !== 'rock-swimmer'
          ? 115 + random(this.seed, n, this.mapId.length, 142) * 48
          : 125 + random(this.seed, n, this.mapId.length, 142) * 90;
      this.active = {
        kind,
        mode: 'hunt',
        modeTimer: 0,
        x: podX + Math.cos(angle) * distance,
        y: podY + Math.sin(angle) * distance * 0.62,
        vx: Math.cos(angle + 1.6) * ROCK_SWIMMER.speed,
        vy: Math.sin(angle + 1.6) * ROCK_SWIMMER.speed * 0.62,
        life: ROCK_SWIMMER.swimSeconds,
        phase: random(this.seed, n, this.mapId.length, 143) * Math.PI * 2,
        health: kind === 'shard-manta' ? SHARD_MANTA.drillHitsToDefeat
          : kind === 'hull-scrapper' ? HULL_SCRAPPER.drillHitsToDefeat : ROCK_SWIMMER.drillHitsToDefeat,
        drillCooldown: 0,
        hitFlash: 0,
      };
      return false;
    }

    const swimmer = this.active;
    swimmer.kind ??= 'rock-swimmer';
    swimmer.mode ??= 'hunt';
    swimmer.modeTimer ??= 0;
    swimmer.life -= dt;
    swimmer.drillCooldown = Math.max(0, swimmer.drillCooldown - dt);
    swimmer.hitFlash = Math.max(0, swimmer.hitFlash - dt);
    swimmer.armorBlockedFlash = Math.max(0, (swimmer.armorBlockedFlash ?? 0) - dt);
    const dx = podX - swimmer.x, dy = podY - swimmer.y;
    const distance = Math.hypot(dx, dy);
    for (const turret of structures) {
      if (turret.kind !== 'turret' || (turret.reload ?? 0) > 0) continue;
      if (Math.hypot(turret.x - swimmer.x, turret.y - swimmer.y) <= UNDERGROUND_BUILDING.turret.range) {
        turret.reload = UNDERGROUND_BUILDING.turret.reloadSeconds;
        onTurretFire(turret.x, turret.y);
        this.active = undefined;
        this.wait = ROCK_SWIMMER.repeatSeconds;
        return false;
      }
    }
    if (swimmer.kind === 'shard-manta') {
      if (swimmer.mode === 'hunt' && distance <= SHARD_MANTA.windupDistance) {
        swimmer.mode = 'windup';
        swimmer.modeTimer = SHARD_MANTA.windupSeconds;
        swimmer.chargeX = dx / (distance || 1);
        swimmer.chargeY = dy / (distance || 1);
        swimmer.vx = 0;
        swimmer.vy = 0;
      }
      if (swimmer.mode === 'windup') {
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) {
          swimmer.mode = 'charge';
          swimmer.modeTimer = SHARD_MANTA.chargeSeconds;
          swimmer.vx = (swimmer.chargeX ?? dx / (distance || 1)) * SHARD_MANTA.chargeSpeed;
          swimmer.vy = (swimmer.chargeY ?? dy / (distance || 1)) * SHARD_MANTA.chargeSpeed;
          const chargeTime = Math.min(dt, SHARD_MANTA.chargeSeconds);
          swimmer.x += swimmer.vx * chargeTime;
          swimmer.y += swimmer.vy * chargeTime;
          swimmer.modeTimer -= chargeTime;
        }
      } else if (swimmer.mode === 'charge') {
        swimmer.x += swimmer.vx * dt;
        swimmer.y += swimmer.vy * dt;
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) {
          swimmer.mode = 'recover';
          swimmer.modeTimer = SHARD_MANTA.recoverSeconds;
          swimmer.vx = 0;
          swimmer.vy = 0;
        }
      } else if (swimmer.mode === 'recover') {
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) swimmer.mode = 'hunt';
      } else if (distance > 1) {
        swimmer.vx += dx / distance * 17 * dt;
        swimmer.vy += dy / distance * 13 * dt;
        const speed = Math.hypot(swimmer.vx, swimmer.vy);
        if (speed > SHARD_MANTA.huntSpeed) {
          swimmer.vx *= SHARD_MANTA.huntSpeed / speed;
          swimmer.vy *= SHARD_MANTA.huntSpeed / speed;
        }
        swimmer.x += swimmer.vx * dt;
        swimmer.y += swimmer.vy * dt + Math.sin(swimmer.phase + (ROCK_SWIMMER.swimSeconds - swimmer.life) * 2.1) * 6 * dt;
      }
    } else {
      // The swimmer homes toward the pod, asking the player to keep moving and aim the drill.
      if (distance > 1) {
        swimmer.vx += dx / distance * 24 * dt;
        swimmer.vy += dy / distance * 18 * dt;
      }
      const speed = Math.hypot(swimmer.vx, swimmer.vy);
      const speedCap = swimmer.kind === 'hull-scrapper' ? HULL_SCRAPPER.huntSpeed : ROCK_SWIMMER.speed;
      if (speed > speedCap) {
        swimmer.vx *= speedCap / speed;
        swimmer.vy *= speedCap / speed;
      }
      swimmer.x += swimmer.vx * dt;
      swimmer.y += swimmer.vy * dt + Math.sin(swimmer.phase + (ROCK_SWIMMER.swimSeconds - swimmer.life) * 2.1) * 8 * dt;
    }

    const collisionDistance = Math.hypot(podX - swimmer.x, podY - swimmer.y),
      contactRadius = swimmer.kind === 'shard-manta' ? SHARD_MANTA.contactRadius
        : swimmer.kind === 'hull-scrapper' ? HULL_SCRAPPER.contactRadius : ROCK_SWIMMER.contactRadius;
    if (collisionDistance <= contactRadius) {
      this.active = undefined;
      this.wait = ROCK_SWIMMER.repeatSeconds;
      return true;
    }
    if (swimmer.life <= 0) {
      this.active = undefined;
      this.wait = ROCK_SWIMMER.repeatSeconds;
    }
    return false;
  }

  /** Hit the active swimmer with a held drill beam. Returns true when defeated. */
  hitByDrill(world: TileWorld, podX: number, podY: number, aimX: number, aimY: number, reach: number) {
    const swimmer = this.active;
    if (!swimmer || swimmer.drillCooldown > 0 || Math.hypot(aimX, aimY) < 0.001) return false;
    const chart = world.planetChart, origin = chart
        ? planetChartToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { x: podX, y: podY },
      target = chart
        ? planetChartToCartesian({ u: swimmer.x / WORLD.tile, v: swimmer.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { x: swimmer.x, y: swimmer.y },
      vector = chart
        ? planetChartVectorToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, { du: aimX / WORLD.tile, dv: aimY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { dx: aimX, dy: aimY },
      length = Math.hypot(vector.dx, vector.dy), nx = vector.dx / (length || 1), ny = vector.dy / (length || 1),
      dx = target.x - origin.x, dy = target.y - origin.y, along = dx * nx + dy * ny,
      across = Math.abs(dx * ny - dy * nx);
    if (along < 0 || along > reach || across > ROCK_SWIMMER.drillHitRadius) return false;
    const steps = Math.ceil(along / (WORLD.tile * 0.2));
    for (let i = 1; i < steps; i++) {
      const point = { x: origin.x + nx * along * i / steps, y: origin.y + ny * along * i / steps },
        cell = chart
          ? planetCartesianToChart(point, chart.columns, chart.radiusRows, WORLD.tile)
          : { u: point.x / WORLD.tile, v: point.y / WORLD.tile };
      if (world.solid(Math.floor(cell.u), Math.floor(cell.v))) return false;
    }
    if (swimmer.kind === 'hull-scrapper') {
      const facing = chart
          ? planetChartVectorToCartesian(
            { u: swimmer.x / WORLD.tile, v: swimmer.y / WORLD.tile },
            { du: swimmer.vx / WORLD.tile, dv: swimmer.vy / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile,
          )
          : { dx: swimmer.vx, dy: swimmer.vy },
        facingLength = Math.hypot(facing.dx, facing.dy), targetLength = Math.hypot(dx, dy),
        facingPlayerDot = facingLength && targetLength ? (facing.dx * -dx + facing.dy * -dy) / (facingLength * targetLength) : 0;
      if (facingPlayerDot > HULL_SCRAPPER.armorFrontDot) {
        swimmer.armorBlockedFlash = 0.24;
        swimmer.drillCooldown = ROCK_SWIMMER.drillHitCooldownSeconds;
        return false;
      }
    }
    swimmer.health--;
    swimmer.drillCooldown = ROCK_SWIMMER.drillHitCooldownSeconds;
    swimmer.hitFlash = 0.14;
    if (swimmer.kind === 'shard-manta') {
      swimmer.mode = 'recover';
      swimmer.modeTimer = SHARD_MANTA.recoverSeconds;
      swimmer.vx = 0;
      swimmer.vy = 0;
    }
    if (swimmer.health > 0) return false;
    this.active = undefined;
    this.wait = ROCK_SWIMMER.repeatSeconds;
    return true;
  }

  get warning() {
    return !!this.active;
  }
}
