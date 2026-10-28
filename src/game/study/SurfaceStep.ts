import { SURFACE_STEP_STUDY as STEP, WORLD, PHYSICS } from '../config';
import type { TileWorld } from '../world/TileWorld';

/** Read-only surface-step plan. Never used unless the caller opts into the experiment. */
export function planSurfaceStep(
  world: TileWorld,
  pod: { x: number; y: number; vy: number },
  nextX: number,
  blocked: (x: number, y: number) => boolean,
) {
  const sign = world.gravitySign(pod.y),
    dir = Math.sign(nextX - pod.x);
  if (!dir || Math.abs(pod.vy) > STEP.maxFallSpeed) return undefined;
  const ground = world.surfaceHeight(pod.x, pod.y);
  if (Math.abs(pod.y - (ground - sign * STEP.footClearance)) > 8) return undefined;
  const supported = (x: number, y: number) =>
    world.solid(Math.floor(x / WORLD.tile), Math.floor((y + sign * 2) / WORLD.tile));
  if (!supported(pod.x, ground)) return undefined;
  const frontX = nextX + dir * (PHYSICS.halfWidth - PHYSICS.horizontalCollisionInset + 2);
  const ledge = world.surfaceHeight(frontX, pod.y),
    rise = (ground - ledge) * sign;
  if (rise <= PHYSICS.horizontalCornerTolerance || rise > STEP.maxRise || !supported(frontX, ledge))
    return undefined;
  const y = ledge - sign * STEP.footClearance;
  // Sweep the complete lift and final sideways move, not just the destination.
  for (let d = 1; d <= Math.ceil(Math.abs(y - pod.y)); d++) {
    if (blocked(pod.x, pod.y + Math.sign(y - pod.y) * Math.min(d, Math.abs(y - pod.y))))
      return undefined;
  }
  for (let i = 1; i <= Math.ceil(Math.abs(nextX - pod.x)); i++) {
    if (blocked(pod.x + dir * Math.min(i, Math.abs(nextX - pod.x)), y)) return undefined;
  }
  return { x: nextX, y };
}
