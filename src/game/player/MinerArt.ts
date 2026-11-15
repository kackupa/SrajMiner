import { ejectorKick } from '../surface/CargoHandling';
import type Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import type { VehiclePose } from './VehiclePose';
import { conceptMiner, minerLampSocket, minerGunSocket } from './ConceptMiner';
import type { MinerGroundContact } from '../study/StudyMinerMotion';
import { drawVolume } from '../study/StudyVolume';

export function minerWidth(pose: VehiclePose) {
  if (pose.forge) return 0.86 + 0.14 * Math.abs(Math.cos(pose.yaw ?? 0));
  return pose.yaw === undefined
    ? (pose.turn < -0.05 ? -1 : 1) * (0.72 + 0.28 * Math.abs(pose.turn))
    : Math.cos(pose.yaw);
}
export function minerPoint(
  x: number,
  y: number,
  scale: number,
  pose: VehiclePose,
  reducedMotion: boolean,
  u: number,
  v: number,
  depth = 0,
) {
  const bank = reducedMotion ? 0 : pose.bank,
    c = Math.cos(bank),
    s = Math.sin(bank);
  const recoil = reducedMotion ? 0 : Math.sin(pose.phase * 43) * pose.drill * 0.35;
  let horizontal =
    u * minerWidth(pose) +
    (pose.yaw === undefined
      ? 0
      : depth *
        (pose.forge ? 0.65 * Math.cos(pose.yaw) : Math.sin(pose.yaw) + 0.32 * Math.cos(pose.yaw)));
  let vertical = v - (pose.yaw === undefined ? 0 : depth * 0.26);
  if (pose.forge && v < -5) {
    const r = pose.forge.chestRoll,
      cr = Math.cos(r),
      sr = Math.sin(r),
      dy = vertical + 5;
    const xx = horizontal;
    horizontal = xx * cr - dy * sr + pose.forge.shift;
    vertical = xx * sr + dy * cr - 5;
  }
  return {
    x: x + (horizontal * c - vertical * s) * scale,
    y: y + (horizontal * s + vertical * c + recoil) * scale,
  };
}
/** Tool anchors rotate with the cabin; their local geometry and aiming stay rigid. */
export function minerPartPoint(
  x: number,
  y: number,
  scale: number,
  pose: VehiclePose,
  reducedMotion: boolean,
  u: number,
  v: number,
  anchor?: { x: number; y: number },
  depth = 0,
) {
  if (!anchor || pose.yaw === undefined)
    return minerPoint(x, y, scale, pose, reducedMotion, u, v, depth);
  const base = minerPoint(x, y, scale, pose, reducedMotion, anchor.x, anchor.y, depth),
    bank = reducedMotion ? 0 : pose.bank,
    c = Math.cos(bank),
    s = Math.sin(bank);
  return {
    x: base.x + ((u - anchor.x) * c - (v - anchor.y) * s) * scale,
    y: base.y + ((u - anchor.x) * s + (v - anchor.y) * c) * scale,
  };
}
export function minerLocalLook(pose: VehiclePose, reducedMotion: boolean) {
  const bank = reducedMotion ? 0 : pose.bank,
    c = Math.cos(bank),
    s = Math.sin(bank);
  const width = pose.yaw === undefined ? minerWidth(pose) : 1;
  return {
    ...pose,
    lookX: (pose.lookX * c + pose.lookY * s) / width,
    lookY: -pose.lookX * s + pose.lookY * c,
  };
}
export function minerLampPoint(
  x: number,
  y: number,
  scale: number,
  p: Progress,
  pose: VehiclePose,
  reducedMotion: boolean,
) {
  const { lens, pivot } = minerLampSocket(p, minerLocalLook(pose, reducedMotion));
  return minerPartPoint(x, y, scale, pose, reducedMotion, lens.x, lens.y, pivot);
}

export function minerGunPoint(
  x: number,
  y: number,
  scale: number,
  p: Progress,
  pose: VehiclePose,
  reducedMotion: boolean,
) {
  const { muzzle, pivot } = minerGunSocket(p, minerLocalLook(pose, reducedMotion));
  return minerPartPoint(
    x,
    y,
    scale,
    pose,
    reducedMotion,
    muzzle.x,
    muzzle.y,
    pose.yaw === undefined ? undefined : pivot,
  );
}

/** Same articulated model as the workshop, animated without changing physics. */
export function drawMiner(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  p: Progress,
  pose: VehiclePose,
  reducedMotion: boolean,
  aim?: { x: number; y: number },
  unload?: { age: number; count: number },
  ground?: MinerGroundContact,
  model: typeof conceptMiner = conceptMiner,
) {
  const bank = reducedMotion ? 0 : pose.bank,
    c = Math.cos(bank),
    s = Math.sin(bank);
  const width = pose.yaw === undefined ? minerWidth(pose) : 1;
  // Inverse-transform aim so body banking never changes where the drill points.
  const localAim = aim
    ? { x: (aim.x * c + aim.y * s) / width, y: -aim.x * s + aim.y * c }
    : undefined;
  const look = minerLocalLook(pose, reducedMotion);
  const kick = unload && !reducedMotion ? ejectorKick(unload.age, unload.count) : 0;
  for (const mark of model(
    p,
    { ...look, landing: look.landing + kick * 0.35 },
    localAim,
    unload ? { age: reducedMotion ? 0.5 : unload.age, kick } : undefined,
    false,
    ground,
  )) {
    const at = (u: number, v: number, z = 0) =>
      minerPartPoint(x, y, scale, pose, reducedMotion, u, v, mark.anchor, (mark.depth ?? 0) + z);
    if (mark.kind === 'circle') {
      g.fillStyle(mark.color, mark.alpha);
      if (pose.yaw !== undefined && !mark.anchor)
        g.fillPoints(
          Array.from({ length: 12 }, (_, i) =>
            at(
              mark.x + Math.cos((i * Math.PI) / 6) * mark.r,
              mark.y + Math.sin((i * Math.PI) / 6) * mark.r,
            ),
          ),
          true,
        );
      else {
        const pt = at(mark.x, mark.y);
        g.fillCircle(pt.x, pt.y, mark.r * scale);
      }
    } else if (mark.kind === 'line') {
      g.lineStyle(mark.width * scale, mark.color, mark.alpha);
      g.strokePoints(
        mark.points.map(([u, v]) => at(u, v)),
        false,
      );
    } else {
      if (mark.thickness) drawVolume(g, mark.points, mark.thickness, at, mark.color, mark.alpha);
      g.fillStyle(mark.color, mark.alpha);
      g.fillPoints(
        mark.points.map(([u, v]) => at(u, v)),
        true,
      );
    }
  }
}
