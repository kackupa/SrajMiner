import type { VehiclePose } from './VehiclePose';

/** Disposable visual state. Never controls movement, collisions or saved progress. */
export type ForgeMotion = {
  yaw: number;
  hipsYaw: number;
  from: number;
  target: number;
  elapsed: number;
  pivot: number;
  pivotSide: number;
  lean: number;
  leanVelocity: number;
  chestRoll: number;
  hipRoll: number;
  heave: number;
  shift: number;
};
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
export function advanceForgeMotion(
  previous: ForgeMotion | undefined,
  pose: VehiclePose,
  facing: number,
  speed: number,
  dt: number,
  reduced = false,
): ForgeMotion {
  const target = facing < 0 ? Math.PI : 0;
  const old = previous ?? {
    yaw: target,
    hipsYaw: target,
    from: target,
    target,
    elapsed: 1,
    pivot: 0,
    pivotSide: 1,
    lean: 0,
    leanVelocity: 0,
    chestRoll: 0,
    hipRoll: 0,
    heave: 0,
    shift: 0,
  };
  if (dt <= 0 && !reduced) return old;
  const step = Math.min(0.05, Math.max(0, dt));
  const changed = target !== old.target;
  const from = changed ? old.yaw : old.from;
  const elapsed = reduced ? 1 : changed ? step : old.elapsed + step;
  const duration = pose.grounded ? 0.42 : 0.32;
  const t = elapsed / duration;
  const yaw = from + (target - from) * smooth(t / 0.88);
  // Lower body completes after the shoulders. A reversal reuses its current angle.
  const hipsYaw =
    old.hipsYaw +
    (target - old.hipsYaw) * (reduced || t >= 1 ? 1 : 1 - Math.exp(-step * (t < 0.18 ? 3 : 14)));
  const pivot = Math.abs(target - from) > 0.05 && t < 1 ? Math.sin(Math.PI * t) : 0;
  let lean = old.lean,
    velocity = old.leanVelocity;
  const wanted = Math.max(-1, Math.min(1, speed / 130));
  // Critically damped-ish chassis suspension; substeps keep long frames stable.
  for (let left = step; left > 0;) {
    const h = Math.min(left, 1 / 120);
    velocity += (110 * (wanted - lean) - 20 * velocity) * h;
    lean += velocity * h;
    left -= h;
  }
  const gait = pose.walkPhase ?? 0,
    weight = pose.stride * (1 - pivot * 0.75);
  if (reduced) {
    lean = 0;
    velocity = 0;
  }
  return {
    yaw: reduced ? target : yaw,
    hipsYaw: reduced ? target : hipsYaw,
    from,
    target,
    elapsed,
    pivot: reduced ? 0 : pivot,
    pivotSide: changed ? (Math.cos(old.yaw) >= 0 ? 1 : -1) : old.pivotSide,
    lean,
    leanVelocity: velocity,
    chestRoll: reduced ? 0 : lean * 0.065 + Math.sin(gait) * weight * 0.035 - pose.fire * 0.018,
    hipRoll: reduced ? 0 : -Math.sin(gait) * weight * 0.025,
    heave: reduced ? 0 : (Math.cos(gait * 2) - 1) * weight * 0.7 + pivot * 1.3,
    shift: reduced ? 0 : lean * 1.4 + Math.sin(gait) * weight * 0.6,
  };
}
