import type { VehiclePose } from '../player/VehiclePose';

export type FootContact = { offset: number; angle: number; supported: boolean };
export type MinerGroundContact = { feet: FootContact[]; settle: number };
const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));

/** Presentation-only foot probes. All coordinates are in the rig's local frame. */
export function findFootContact(x: number, sole: number, solid: (x: number, y: number) => boolean): FootContact {
  const height = (u: number) => {
    // Starting inside rock is a wall, not a walkable foothold.
    if (solid(u, sole - 14)) return undefined;
    for (let d = -13; d <= 12; d++) if (solid(u, sole + d)) return d - .8;
    return undefined;
  };
  const offset = height(x);
  if (offset === undefined) return { offset: 0, angle: 0, supported: false };
  const left = height(x - 4), right = height(x + 4);
  return { offset, angle: left === undefined || right === undefined ? 0 : clamp(Math.atan2(right - left, 8), .22), supported: true };
}

export class StudyMinerMotion {
  contact: MinerGroundContact = { feet: [{ offset: 0, angle: 0, supported: false }, { offset: 0, angle: 0, supported: false }], settle: 0 };
  lean = 0;
  appliedLean = 0;
  private lastStride = 0;
  private wasGrounded = true;
  reset() { this.contact = { feet: [{ offset: 0, angle: 0, supported: false }, { offset: 0, angle: 0, supported: false }], settle: 0 }; this.lean = 0; this.appliedLean = 0; this.lastStride = 0; this.wasGrounded = true; }
  update(pose: VehiclePose, feet: FootContact[], dt: number, reduced: boolean) {
    const blend = 1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 24);
    this.contact.feet = feet.map((foot, i) => ({ ...foot,
      offset: reduced ? foot.offset : this.contact.feet[i].offset + (foot.offset - this.contact.feet[i].offset) * blend,
      angle: reduced ? foot.angle : this.contact.feet[i].angle + (foot.angle - this.contact.feet[i].angle) * blend,
    }));
    const slope = feet.every(f => f.supported) ? (feet[1].offset - feet[0].offset) / 42 : 0;
    this.lean += ((reduced ? 0 : clamp(slope * .35 * (pose.yaw===undefined?(pose.turn < -.05 ? -1 : 1):Math.cos(pose.yaw)), .12)) - this.lean) * blend;
    this.contact.settle = reduced ? 0 : pose.landing * 2;
    const beat = Math.floor(pose.phase * 10 / Math.PI);
    const landing = pose.grounded && !this.wasGrounded && pose.landing > .12;
    const tread = pose.grounded && pose.stride > .25 && beat !== this.lastStride;
    this.lastStride = beat; this.wasGrounded = pose.grounded;
    return reduced ? [] : landing ? [0, 1].filter(i => feet[i].supported) : tread && feet[beat % 2].supported ? [beat % 2] : [];
  }
}
