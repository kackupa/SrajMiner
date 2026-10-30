import { COMBAT_STUDY } from '../config';
import { caveClear, caveMove } from '../world/CaveHabitat';
import type { RockSwimmerState } from '../world/RockSwimmer';
import type { TileWorld } from '../world/TileWorld';
/** Test cave crawlers plant their feet, telegraph a short pounce, then recover. */
export function stepStudyCrawler(
  world: TileWorld,
  s: RockSwimmerState,
  dt: number,
  goal: { x: number; y: number },
  visible: boolean,
) {
  const c = COMBAT_STUDY.crawler,
    grounded = !caveClear(world, s.x, s.y + 3),
    dx = goal.x - s.x;
  if (
    s.mode === 'hunt' &&
    grounded &&
    visible &&
    Math.abs(dx) < c.range &&
    Math.abs(goal.y - s.y) < 65
  ) {
    s.mode = 'windup';
    s.modeTimer = c.windup;
    s.chargeX = Math.sign(dx) || 1;
  }
  if (s.mode === 'windup') {
    s.vx = 0;
    s.modeTimer = Math.max(0, (s.modeTimer ?? 0) - dt);
    if (!s.modeTimer) {
      s.mode = 'charge';
      s.modeTimer = c.charge;
      s.vx = (s.chargeX ?? 1) * c.lungeSpeed;
      s.vy = -c.jumpSpeed;
    }
  } else if (s.mode === 'charge' || s.mode === 'recover') {
    s.modeTimer = Math.max(0, (s.modeTimer ?? 0) - dt);
    if (!s.modeTimer) {
      s.mode = s.mode === 'charge' ? 'recover' : 'hunt';
      s.modeTimer = c.recover;
    }
    if (s.mode === 'recover') s.vx *= Math.exp(-10 * dt);
  } else {
    s.vx +=
      (Math.sign(dx) * (s.kind === 'hull-scrapper' ? 0.65 : 1) * c.speed - s.vx) *
      Math.min(1, dt * 7);
  }
  s.vy = Math.min(180, s.vy + c.gravity * dt);
  const nx = s.x + s.vx * dt;
  if (grounded && s.mode === 'hunt' && !caveClear(world, nx, s.y)) {
    for (let lift = 4; lift <= 40; lift += 4) {
      if (!caveClear(world, s.x, s.y - lift)) break;
      if (caveClear(world, nx, s.y - lift)) {
        s.y -= lift;
        break;
      }
    }
  }
  const blocked = caveMove(world, s, nx, s.y + s.vy * dt);
  if (blocked && s.mode === 'charge' && !s.vx) {
    s.mode = 'recover';
    s.modeTimer = c.recover;
  }
}
