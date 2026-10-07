import { ROCK_SWIMMER, WORLD, type MapId } from '../config';
import { random } from './TileWorld';

export type RockSwimmerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  phase: number;
};

/** A shy, non-combat cave hazard. It phases through rock and can be evaded. */
export class RockSwimmer {
  active?: RockSwimmerState;
  private wait: number = ROCK_SWIMMER.firstArrivalSeconds;
  private encounter = 0;

  constructor(private seed: number, private mapId: MapId) {}

  update(dt: number, depth: number, podX: number, podY: number) {
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
    // A nearby engine makes the creature veer away, leaving a generous warning window.
    if (distance < ROCK_SWIMMER.warningRadius) {
      const flee = (ROCK_SWIMMER.warningRadius - distance) / ROCK_SWIMMER.warningRadius;
      swimmer.vx -= (dx / Math.max(1, distance)) * 52 * flee * dt;
      swimmer.vy -= (dy / Math.max(1, distance)) * 38 * flee * dt;
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
