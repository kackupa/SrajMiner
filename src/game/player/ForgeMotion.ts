import type { VehiclePose } from './VehiclePose';
import {advanceForgeCutters,type ForgeCutters} from './ForgeArm';

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
  lastSpeed: number;
  lastFall: number;
  armLag: number;
  armVelocity: number;
  legTrail: number;
  legVelocity: number;
  suspension: number;
  suspensionVelocity: number;
  headTilt: number;
  cutters?:ForgeCutters;
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
  wind = 0,
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
    lastSpeed: speed,
    lastFall: pose.lastVerticalSpeed,
    armLag: 0,
    armVelocity: 0,
    legTrail: 0,
    legVelocity: 0,
    suspension: 0,
    suspensionVelocity: 0,
    headTilt: 0,
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
  const limit = (v: number, n: number) => Math.max(-n, Math.min(n, v));
  const air = pose.grounded ? 0 : pose.gear;
  // Booster intent leads the chassis; residual speed adds a little coasting.
  // Facing is deliberately absent: looking backwards must not reverse inertia.
  const command=limit(pose.strafe??speed/130,1);
  const travel=air>.05?command*.9+limit(speed/130,1)*.1:speed/130;
  const wanted = limit(travel+(pose.clawAction?.bracing?Math.cos(pose.clawAction.angle)*.18:0)-(pose.clawHandling?.weight??0)*facing*.13,1);
  const acceleration = limit((speed - old.lastSpeed) / Math.max(step, 0.001) / 650, 1);
  const radial = limit((pose.lastVerticalSpeed - old.lastFall) / Math.max(step, 0.001) / 800, 1);
  let armLag = old.armLag,
    armVelocity = old.armVelocity,
    legTrail = old.legTrail,
    legVelocity = old.legVelocity,
    suspension = old.suspension,
    suspensionVelocity = old.suspensionVelocity;
  const armTarget = air * (-command * 6 - acceleration * 1.8 + wind);
  const legTarget = air * (-command * 9 - acceleration * 2.5 + wind * 1.5);
  const suspensionTarget = air * (radial * 2 + pose.pitch * 6) + pose.landing * 3 + (pose.grounded?pose.drill*2:0) + (pose.clawAction&&pose.grounded?4:0);
  // Critically damped-ish chassis suspension; substeps keep long frames stable.
  for (let left = step; left > 0;) {
    const h = Math.min(left, 1 / 120);
    velocity += (110 * (wanted - lean) - 20 * velocity) * h;
    lean += velocity * h;
    armVelocity += (75 * (armTarget - armLag) - 13 * armVelocity) * h;
    armLag += armVelocity * h;
    legVelocity += (48 * (legTarget - legTrail) - 10 * legVelocity) * h;
    legTrail += legVelocity * h;
    suspensionVelocity += (95 * (suspensionTarget - suspension) - 16 * suspensionVelocity) * h;
    suspension += suspensionVelocity * h;
    left -= h;
  }
  const gait = pose.walkPhase ?? 0,
    weight = pose.stride * (1 - pivot * 0.75);
  const localX=pose.lookX*Math.cos(pose.bank)+pose.lookY*Math.sin(pose.bank);
  const localY=-pose.lookX*Math.sin(pose.bank)+pose.lookY*Math.cos(pose.bank);
  const headTarget=limit(Math.atan2(localY,Math.abs(localX)||.001)*(facing<0?-1:1),.38);
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
    chestRoll: reduced
      ? 0
      : lean * (air > 0.5 ? 0.23 : 0.065) +
        Math.sin(gait) * weight * 0.035 -
        pose.fire * 0.018 +
        armLag * 0.006,
    hipRoll: reduced ? 0 : -Math.sin(gait) * weight * 0.025 - legTrail * 0.007,
    heave: reduced ? 0 : (Math.cos(gait * 2) - 1) * weight * 0.7 + pivot * 1.3 + suspension,
    shift: reduced ? 0 : lean * (air>.5?2.6:1.4) + Math.sin(gait) * weight * 0.6,
    lastSpeed: speed,
    lastFall: pose.lastVerticalSpeed,
    armLag: reduced ? 0 : armLag,
    armVelocity: reduced ? 0 : armVelocity,
    legTrail: reduced ? 0 : legTrail,
    legVelocity: reduced ? 0 : legVelocity,
    suspension: reduced ? 0 : suspension,
    suspensionVelocity: reduced ? 0 : suspensionVelocity,
    headTilt:reduced?headTarget:old.headTilt+(headTarget-old.headTilt)*(1-Math.exp(-step*12)),
    cutters:advanceForgeCutters(old.cutters,{...pose,yaw:reduced?target:yaw,forge:{...old,armLag}},step,reduced),
  };
}
