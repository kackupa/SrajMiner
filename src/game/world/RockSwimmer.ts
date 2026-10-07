import { ROCK_SWIMMER, UNDERGROUND_BUILDING, type MapId } from '../config';
import { random } from './TileWorld';
import type { UndergroundStructure } from '../building/UndergroundStructures';

export type RockSwimmerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  phase: number;
};

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
      const distance = 125 + random(this.seed, n, this.mapId.length, 142) * 90;
      this.active = {
        x: podX + Math.cos(angle) * distance,
        y: podY + Math.sin(angle) * distance * 0.62,
        vx: Math.cos(angle + 1.6) * ROCK_SWIMMER.speed,
        vy: Math.sin(angle + 1.6) * ROCK_SWIMMER.speed * 0.62,
        life: ROCK_SWIMMER.swimSeconds,
        phase: random(this.seed, n, this.mapId.length, 143) * Math.PI * 2,
      };
      return false;
    }

    const swimmer = this.active;
    swimmer.life -= dt;
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
    // The swimmer now homes toward the pod and can attack if the player ignores the warning.
    if (distance > 1) {
      swimmer.vx += dx / distance * 24 * dt;
      swimmer.vy += dy / distance * 18 * dt;
    }
    const speed = Math.hypot(swimmer.vx, swimmer.vy);
    if (speed > ROCK_SWIMMER.speed) {
      swimmer.vx *= ROCK_SWIMMER.speed / speed;
      swimmer.vy *= ROCK_SWIMMER.speed / speed;
    }
    swimmer.x += swimmer.vx * dt;
    swimmer.y += swimmer.vy * dt + Math.sin(swimmer.phase + (ROCK_SWIMMER.swimSeconds - swimmer.life) * 2.1) * 8 * dt;

    if (distance <= ROCK_SWIMMER.contactRadius) {
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

  get warning() {
    return !!this.active;
  }
}
