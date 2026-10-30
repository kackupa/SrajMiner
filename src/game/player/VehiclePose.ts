/** Transient presentation only: never serialized or used by collisions. */
export type VehiclePose = {
  bank: number;
  pitch: number;
  turn: number;
  lift: number;
  gear: number;
  drill: number;
  phase: number;
  landing: number;
  grounded: boolean;
  lastVerticalSpeed: number;
  stride: number;
  lookX: number;
  lookY: number;
  fire: number;
  /** Opt-in art study yaw, in radians. Never saved or used by movement. */
  yaw?: number;
  /** Distance-driven step cycle for the dimensional rig, separate from idle time. */
  walkPhase?: number;
  dive?: number;
  forge?: import('./ForgeMotion').ForgeMotion;
};
export const restingVehiclePose = (): VehiclePose => ({
  bank: 0,
  pitch: 0,
  turn: 0,
  lift: 0,
  gear: 0,
  drill: 0,
  phase: 0,
  lookX: 1,
  lookY: 0,
  fire: 0,
  landing: 0,
  grounded: true,
  lastVerticalSpeed: 0,
  stride: 0,
});
export function advanceVehiclePose(
  pose: VehiclePose,
  input: {
    lookingX?: number;
    lookingY?: number;
    firing?: boolean;
    mechanicalTurn?: boolean;
    downThrust?: boolean;
    sideSpeed: number;
    verticalSpeed: number;
    facing: number;
    thrust: boolean;
    grounded: boolean;
    drilling: boolean;
    paused: boolean;
    reducedMotion: boolean;
  },
  dt: number,
): VehiclePose {
  if (input.paused) return pose;
  const step = Math.max(0, Math.min(dt, 0.05));
  const blend = 1 - Math.exp(-step * 9);
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  const bank = input.reducedMotion
    ? 0
    : input.mechanicalTurn && input.grounded
      ? clamp(input.sideSpeed / 4000, 0.04)
      : clamp(input.sideSpeed / 650, 0.28);
  const pitch = input.reducedMotion || input.grounded ? 0 : clamp(input.verticalSpeed / 900, 0.24);
  const impact =
    input.grounded && !pose.grounded ? Math.min(1, Math.abs(pose.lastVerticalSpeed) / 260) : 0;
  const targetYaw = input.facing < 0 ? Math.PI : 0,
    oldYaw = pose.yaw ?? (pose.turn < 0 ? Math.PI : 0);
  const yaw = input.reducedMotion
    ? targetYaw
    : oldYaw + clamp(targetYaw - oldYaw, (step * Math.PI) / 0.22);
  return {
    ...(input.mechanicalTurn
      ? {
          dive:
            (pose.dive ?? 0) +
            ((input.downThrust && !input.grounded ? 1 : 0) - (pose.dive ?? 0)) *
              (1 - Math.exp(-step * 20)),
        }
      : {}),
    ...(input.mechanicalTurn
      ? {
          yaw,
          walkPhase: input.reducedMotion
            ? 0
            : (pose.walkPhase ?? 0) +
              (input.grounded ? (Math.abs(input.sideSpeed) * step * Math.PI * 2) / 64 : 0),
        }
      : {}),
    lookX: pose.lookX + ((input.lookingX ?? input.facing) - pose.lookX) * blend,
    lookY: pose.lookY + ((input.lookingY ?? 0) - pose.lookY) * blend,
    fire: input.reducedMotion ? 0 : input.firing ? 1 : pose.fire * Math.exp(-step * 22),
    landing: input.reducedMotion ? 0 : Math.max(impact, pose.landing * Math.exp(-step * 10)),
    grounded: input.grounded,
    lastVerticalSpeed: input.verticalSpeed,
    stride: input.reducedMotion
      ? 0
      : pose.stride +
        ((input.grounded ? Math.min(1, Math.abs(input.sideSpeed) / 90) : 0) - pose.stride) * blend,
    bank: input.reducedMotion ? 0 : pose.bank + (bank - pose.bank) * blend,
    pitch: input.reducedMotion ? 0 : pose.pitch + (pitch - pose.pitch) * blend,
    turn: pose.turn + (input.facing - pose.turn) * blend,
    lift:
      pose.lift +
      ((input.thrust ? 1 : input.grounded || input.downThrust ? 0 : 0.35) - pose.lift) * blend,
    gear: pose.gear + ((input.grounded ? 0 : 1) - pose.gear) * blend,
    drill: pose.drill + ((input.drilling ? 1 : 0) - pose.drill) * blend,
    phase: input.reducedMotion ? 0 : pose.phase + step,
  };
}

/** Longer planted stroke, shorter lifted recovery. Opposite feet alternate. */
export function mechanicalFootstep(pose: VehiclePose, index: number) {
  const phase = ((((pose.walkPhase ?? 0) / (Math.PI * 2) + index * 0.5) % 1) + 1) % 1;
  const stance = 0.6;
  const swing = Math.max(0, (phase - stance) / (1 - stance));
  return {
    x: (phase < stance ? 7 - (14 * phase) / stance : -7 * Math.cos(swing * Math.PI)) * pose.stride,
    lift: Math.sin(swing * Math.PI) * 5 * pose.stride,
  };
}
