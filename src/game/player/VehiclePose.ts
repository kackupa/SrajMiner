/** Transient presentation only: never serialized or used by collisions. */
export type VehiclePose = {
  bank: number;
  pitch: number;
  turn: number;
  lift: number;
  gear: number;
  drill: number;
  phase: number;
};
export const restingVehiclePose = (): VehiclePose => ({
  bank: 0,
  pitch: 0,
  turn: 0,
  lift: 0,
  gear: 0,
  drill: 0,
  phase: 0,
});
export function advanceVehiclePose(
  pose: VehiclePose,
  input: {
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
  const bank = input.reducedMotion ? 0 : clamp(input.sideSpeed / 650, 0.28);
  const pitch = input.reducedMotion || input.grounded ? 0 : clamp(input.verticalSpeed / 900, 0.24);
  return {
    bank: input.reducedMotion ? 0 : pose.bank + (bank - pose.bank) * blend,
    pitch: input.reducedMotion ? 0 : pose.pitch + (pitch - pose.pitch) * blend,
    turn: pose.turn + (input.facing - pose.turn) * blend,
    lift: pose.lift + ((input.thrust ? 1 : input.grounded ? 0 : 0.35) - pose.lift) * blend,
    gear: pose.gear + ((input.grounded ? 0 : 1) - pose.gear) * blend,
    drill: pose.drill + ((input.drilling ? 1 : 0) - pose.drill) * blend,
    phase: input.reducedMotion ? 0 : pose.phase + step,
  };
}
