import { POD_PAINTS, PILOT_SUITS } from '../config';
import type { Progress } from '../economy/Progress';
import { restingVehiclePose, mechanicalFootstep, type VehiclePose } from './VehiclePose';
import type { MinerGroundContact } from '../study/StudyMinerMotion';
import { weaponPlates } from '../study/StudyWeaponArt';
import { STUDY_WEAPONS } from '../config';

import {
  minerBodyOffset,
  minerLampSocket,
  minerGunSocket,
  rigidDrillDirection,
  type RigMark,
} from './ConceptMiner';

/** Forge: industrial humanoid test model. Shares tool sockets with the existing rig.
 * Coordinates are presentation only; fitting never changes the collision body. */
export function forgeMiner(
  p: Progress,
  pose: VehiclePose = restingVehiclePose(),
  aim?: { x: number; y: number },
  unload?: { age: number; kick: number },
  emptyCockpit = false,
  ground?: MinerGroundContact,
): RigMark[] {
  const out: RigMark[] = [];
  let anchor: { x: number; y: number } | undefined, depth: number | undefined;
  const frame = () => ({ ...(anchor ? { anchor } : {}), ...(depth ? { depth } : {}) });
  const poly = (color: number, points: number[][], alpha = 1) =>
    out.push({ kind: 'poly', color, points, alpha, ...frame() });
  const line = (color: number, points: number[][], width = 1, alpha = 1) =>
    out.push({ kind: 'line', color, points, width, alpha, ...frame() });
  const dot = (color: number, x: number, y: number, r: number, alpha = 1) =>
    out.push({ kind: 'circle', color, x, y, r, alpha, ...frame() });
  const box = (c: number, x: number, y: number, w: number, h: number) =>
    poly(c, [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  const solid = (c: number, points: number[][], thickness: number) =>
    out.push({
      kind: 'poly',
      color: c,
      points,
      alpha: 1,
      ...frame(),
      ...(pose.yaw !== undefined ? { thickness } : {}),
    });
  const paint = POD_PAINTS[p.selectedPaint],
    suit = PILOT_SUITS[p.selectedSuit],
    f = p.loadout.fitted;
  const amber = p.selectedPaint === 'hab' ? 0xd99a3b : paint.hull,
    light = p.selectedPaint === 'hab' ? 0xf5c86e : paint.trim;
  const dark = 0x102431,
    metal = 0x55717a,
    steel = 0xb3c2bb,
    cream = 0xf1dfb1;
  const heavy = f.hull === 'bastion',
    cargo = f.hull === 'hauler',
    scout = f.hull === 'scout';
  const bounce = pose.landing * 4;
  const bodyY = minerBodyOffset(p, pose);
  const body = (pts: number[][]) => pts.map(([x, y]) => [x, y + bodyY]);
  const torso = (pts: number[][]) => pts.map(([x, y]) => [x, y + bodyY - 7]);
  // Back-mounted stock and exposed engine block.
  box(dark, -12, -17, 25, 31);
  if (cargo) {
    for (const [x, y] of [
      [-23, -21],
      [-23, -10],
      [16, -24],
    ]) {
      box(dark, x - 1, y - 1, 12, 12);
      box(amber, x, y, 10, 10);
      box(cream, x + 3, y, 2, 10);
      line(
        0x76532c,
        [
          [x, y + 7],
          [x + 10, y + 7],
        ],
        1,
      );
    }
  }
  if (f.battery !== 'standard-cell') {
    const count = f.battery === 'industrial-cell' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      box(dark, -4 + i * 5, -26, 5, 10);
      box(metal, -3 + i * 5, -25, 3, 8);
      box(0x80d8cc, -3 + i * 5, -24, 3, 3);
    }
  }
  // Independent hip, knee and ankle articulation: brace, fold, compress.
  for (const side of [-1, 1]) {
    depth = pose.yaw === undefined ? undefined : side * 7;
    const hipX = side * (heavy ? 10 : 8),
      hipY = -2 + bodyY;
    const contact = ground?.feet[side < 0 ? 0 : 1];
    const gait =
      pose.walkPhase === undefined ? undefined : mechanicalFootstep(pose, side < 0 ? 0 : 1);
    const step = gait
      ? gait.x / 4
      : pose.stride * Math.sin(pose.phase * 10 + (side < 0 ? 0 : Math.PI));
    const kneeX = side * ((heavy ? 15 : scout ? 11 : 13) + pose.drill * 1.5),
      kneeY =
        14 -
        pose.gear * 5 +
        bounce * 0.4 +
        step * 1.6 +
        (contact?.offset ?? 0) * 0.45 +
        (ground?.settle ?? 0) * 0.5;
    const footX =
      side * ((heavy ? 20 : scout ? 15 : 18) + pose.drill * 2) -
      pose.gear * side * 7 +
      (gait?.x ?? step * 3);
    const shuffle =
      pose.yaw === undefined || !pose.grounded
        ? 0
        : Math.max(0, Math.sin(pose.yaw * 2 + (side < 0 ? 0 : Math.PI))) * 3;
    const footY =
      (scout ? 28 : heavy ? 23 : 25) -
      pose.gear * 9 -
      (gait?.lift ?? Math.max(0, step) * (ground ? 6 : 4)) +
      (contact?.offset ?? 0) -
      shuffle;
    const sole = (points: number[][]) =>
      points.map(([x, y]) => {
        const a = contact?.angle ?? 0,
          c = Math.cos(a),
          s = Math.sin(a);
        return [
          footX + (x - footX) * c - (y - footY) * s,
          footY + (x - footX) * s + (y - footY) * c,
        ];
      });
    line(
      dark,
      [
        [hipX, hipY],
        [kneeX, kneeY],
        [footX, footY],
      ],
      10,
    );
    line(
      steel,
      [
        [kneeX, kneeY],
        [footX, footY - 2],
      ],
      2.8,
    );
    line(
      0x243c48,
      [
        [hipX - side * 2, hipY + 2],
        [footX - side * 2, footY - 2],
      ],
      2,
    );
    solid(
      amber,
      [
        [hipX - 5, hipY - 3],
        [hipX + 5, hipY - 3],
        [kneeX + 4, kneeY + 2],
        [kneeX - 4, kneeY + 3],
      ],
      4,
    );
    line(
      light,
      [
        [hipX - 3, hipY - 3],
        [hipX + 4, hipY - 3],
        [kneeX + 3, kneeY],
      ],
      1,
    );
    dot(dark, hipX, hipY, 5);
    dot(metal, hipX, hipY, 3.6);
    dot(steel, hipX, hipY, 1.4);
    solid(
      metal,
      [
        [kneeX - 4, kneeY],
        [kneeX + 4, kneeY],
        [footX + 4, footY - 4],
        [footX - 4, footY - 4],
      ],
      5,
    );
    poly(steel, [
      [kneeX - 4, kneeY],
      [kneeX - 1, kneeY],
      [footX, footY - 5],
      [footX - 4, footY - 4],
    ]);
    line(
      dark,
      [
        [footX - 2, footY - 6],
        [footX + 3, footY - 6],
      ],
      1.5,
    );
    dot(dark, kneeX, kneeY, 4.5);
    dot(amber, kneeX, kneeY, 2.5);
    dot(steel, kneeX, kneeY, 1);
    if (pose.yaw !== undefined) anchor = { x: footX, y: footY };
    solid(
      dark,
      sole([
        [footX - 7, footY - 5],
        [footX + 4, footY - 5],
        [footX + 9, footY - 1],
        [footX + 9, footY + 2],
        [footX - 8, footY + 2],
      ]),
      7,
    );
    poly(
      steel,
      sole([
        [footX - 6, footY - 4],
        [footX + 3, footY - 4],
        [footX + 7, footY],
        [footX - 7, footY],
      ]),
    );
    poly(
      amber,
      sole([
        [footX - 5, footY - 4],
        [footX + 2, footY - 4],
        [footX + 4, footY - 1],
        [footX - 5, footY - 1],
      ]),
    );
    for (let t = 0; t < 3; t++)
      line(
        dark,
        sole([
          [footX - 4 + t * 4, footY],
          [footX - 4 + t * 4, footY + 2],
        ]),
        0.8,
      );
    poly(
      metal,
      sole([
        [footX - 5, footY - 3],
        [footX + 3, footY - 3],
        [footX + 6, footY],
        [footX - 6, footY],
      ]),
    );
    line(
      cream,
      sole([
        [footX - 4, footY - 2],
        [footX + 2, footY - 2],
      ]),
      1,
    );
    anchor = undefined;
    // Shoulder vents exhaust outward to push the rig toward the planet. The
    // opposite flame direction makes a powered dodge distinct from free fall.
    if (pose.dive !== undefined) {
      const x = side * 22,
        y = -13 + bodyY;
      box(dark, x - 4, y - 4, 8, 8);
      box(metal, x - 3, y - 4, 6, 5);
      line(
        steel,
        [
          [x - 3, y - 4],
          [x + 3, y - 4],
        ],
        1.4,
      );
      if (pose.dive > 0.03) {
        const length = pose.dive * (18 + Math.sin(pose.phase * 42 + side) * 3);
        poly(
          0x72d9e8,
          [
            [x - 3, y - 5],
            [x + 3, y - 5],
            [x + 4, y - 10],
            [x, y - 7 - length],
            [x - 4, y - 10],
          ],
          0.8 * pose.dive,
        );
        poly(
          0xe1ffff,
          [
            [x - 1.5, y - 5],
            [x + 1.5, y - 5],
            [x, y - 7 - length * 0.65],
          ],
          pose.dive,
        );
      }
    }
    if (pose.lift > 0.45) {
      const flame = (pose.lift - 0.4) * 18,
        flutter = Math.sin(pose.phase * 37 + side) * 2;
      const color = f.engine === 'efficient-engine' ? 0x79dfc9 : 0xffb65e;
      poly(
        color,
        [
          [kneeX - 3, kneeY + 3],
          [kneeX + 3, kneeY + 3],
          [kneeX + 2, kneeY + 8],
          [kneeX, kneeY + 8 + flame + flutter],
          [kneeX - 2, kneeY + 8],
        ],
        0.8,
      );
      poly(0xf0ffff, [
        [kneeX - 1.5, kneeY + 3],
        [kneeX + 1.5, kneeY + 3],
        [kneeX, kneeY + 9 + flame * 0.4],
      ]);
    }
    if (f.engine === 'lift-engine') {
      box(dark, kneeX - 4, kneeY - 3, 8, 7);
      box(steel, kneeX - 3, kneeY - 2, 6, 2);
      box(amber, kneeX - 3, kneeY + 1, 6, 2);
    } else if (f.engine === 'efficient-engine')
      for (let n = 0; n < 3; n++)
        line(
          0x7dcbbd,
          [
            [kneeX - 3, kneeY - 3 + n * 2],
            [kneeX + 3, kneeY - 3 + n * 2],
          ],
          1,
        );
  }
  depth = undefined;
  // Compact hip and ribbed waist visibly separate the chest from the legs.
  solid(
    dark,
    torso([
      [-10, -5],
      [10, -5],
      [12, 3],
      [6, 7],
      [-7, 7],
      [-12, 2],
    ]),
    10,
  );
  poly(
    metal,
    torso([
      [-9, 0],
      [0, -2],
      [9, 0],
      [7, 5],
      [-7, 5],
    ]),
  );
  poly(
    amber,
    torso([
      [-3, 0],
      [4, 0],
      [5, 5],
      [-4, 5],
    ]),
  );
  for (let n = 0; n < 3; n++)
    line(
      steel,
      torso([
        [-6, -6 + n * 2],
        [6, -6 + n * 2],
      ]),
      0.9,
    );
  // Broad tapered chest, with a recessed pilot cabin and chamfered armour.
  solid(
    dark,
    torso([
      [-17, -23],
      [13, -23],
      [18, -17],
      [14, -5],
      [7, -1],
      [-8, -2],
      [-17, -8],
    ]),
    13,
  );
  solid(
    amber,
    torso([
      [-15, -22],
      [11, -22],
      [16, -16],
      [12, -6],
      [6, -3],
      [-7, -4],
      [-15, -9],
    ]),
    5,
  );
  poly(
    light,
    torso([
      [-15, -22],
      [11, -22],
      [13, -19],
      [-10, -19],
      [-15, -14],
    ]),
  );
  poly(
    0x9b672e,
    torso([
      [-15, -14],
      [-10, -13],
      [-6, -4],
      [-12, -6],
      [-15, -9],
    ]),
  );
  poly(
    steel,
    torso([
      [10, -19],
      [15, -16],
      [12, -7],
      [8, -5],
      [10, -12],
    ]),
  );
  // Cockpit is a small protected operator window, not the entire body shell.
  poly(
    dark,
    torso([
      [-6, -20],
      [7, -20],
      [11, -15],
      [8, -7],
      [-5, -7],
      [-9, -12],
    ]),
  );
  poly(
    0x345966,
    torso([
      [-5, -18],
      [6, -18],
      [9, -14],
      [7, -9],
      [-4, -9],
      [-7, -12],
    ]),
  );
  poly(
    0x77a8ad,
    torso([
      [-5, -18],
      [5, -18],
      [1, -15],
      [-6, -12],
    ]),
    0.65,
  );
  if (!emptyCockpit) {
    const lx = pose.lookX * 0.6,
      ly = pose.lookY * 0.5;
    poly(
      suit.body,
      torso([
        [-1 + lx, -13],
        [3 + lx, -13],
        [5, -9],
        [-3, -9],
      ]),
    );
    dot(suit.trim, 1 + lx, -15 + bodyY - 7 + ly, 2.1);
    box(dark, -0.5 + lx, -15.5 + bodyY - 7 + ly, 3, 1.4);
    line(
      steel,
      torso([
        [-4, -10],
        [5, -10],
      ]),
      1,
    );
  }
  line(
    cream,
    torso([
      [-6, -19],
      [7, -19],
      [10, -14],
      [7, -8],
    ]),
    0.9,
  );
  poly(
    0xe1ffff,
    torso([
      [-5, -17],
      [-3, -17],
      [0, -10],
      [-2, -10],
    ]),
    0.18,
  );
  box(dark, -3, -5 + bodyY - 7, 8, 2);
  box(0x8edbd1, -2, -4.8 + bodyY - 7, 5.5, 1);
  // Distinct helmet above the torso; visor follows the operator's attention.
  solid(
    dark,
    torso([
      [-5, -32],
      [4, -34],
      [10, -30],
      [9, -24],
      [-3, -23],
      [-7, -27],
    ]),
    7,
  );
  poly(
    amber,
    torso([
      [-5, -31],
      [4, -32],
      [9, -29],
      [5, -27],
      [-5, -27],
    ]),
  );
  poly(
    light,
    torso([
      [-4, -31],
      [4, -32],
      [6, -30],
      [-3, -29],
    ]),
  );
  poly(
    metal,
    torso([
      [-5, -27],
      [6, -27],
      [8, -25],
      [3, -23],
      [-3, -24],
    ]),
  );
  poly(
    0x8be5df,
    torso([
      [-1 + pose.lookX, -27],
      [6 + pose.lookX, -27],
      [4 + pose.lookX, -25],
      [0 + pose.lookX, -25],
    ]),
  );
  // Independent heavy shoulder caps, asymmetric amber and gunmetal armour.
  for (const side of [-1, 1]) {
    depth = pose.yaw === undefined ? undefined : side * 5;
    const sx = side * 19,
      sy = -19 + bodyY - 7 + pose.fire * (side > 0 ? 0.7 : 0);
    solid(
      dark,
      [
        [sx - 8, sy - 6],
        [sx + 6, sy - 5],
        [sx + 8, sy + 3],
        [sx + 3, sy + 9],
        [sx - 7, sy + 5],
      ],
      7,
    );
    poly(side < 0 ? amber : metal, [
      [sx - 6, sy - 4],
      [sx + 4, sy - 4],
      [sx + 6, sy + 2],
      [sx + 2, sy + 6],
      [sx - 5, sy + 3],
    ]);
    poly(side < 0 ? light : steel, [
      [sx - 6, sy - 4],
      [sx + 4, sy - 4],
      [sx + 5, sy - 1],
      [sx - 5, sy - 1],
    ]);
    line(
      dark,
      [
        [sx - 3, sy + 1],
        [sx + 2, sy + 3],
      ],
      1.3,
    );
    dot(steel, sx - 4, sy - 2, 0.7);
    dot(dark, sx + 3, sy + 2, 0.8);
  }
  depth = undefined;
  for (const [x, y] of [
    [-12, -19],
    [-11, -8],
    [10, -19],
    [8, -5],
  ]) {
    dot(dark, x, y + bodyY - 7, 0.7);
    dot(steel, x - 0.15, y - 0.2 + bodyY - 7, 0.3);
  }
  if (cargo) {
    solid(
      metal,
      torso([
        [-23, -11],
        [-16, -13],
        [-15, 2],
        [-23, 4],
      ]),
      7,
    );
    line(
      light,
      torso([
        [-22, -9],
        [-17, -10],
        [-17, 1],
      ]),
      1.5,
    );
  }
  // The extruded pressure shell stays solid through a turn, without an overlay sprite.
  // Motorised yoke and cylindrical lamp rotate as one assembly with the beam.
  const lamp = minerLampSocket(p, pose);
  const lampAt = (along: number, across: number) => [
    lamp.pivot.x + lamp.dx * along - lamp.dy * across,
    lamp.pivot.y + lamp.dy * along + lamp.dx * across,
  ];
  line(
    dark,
    body([
      [-11, -18],
      [-16, -23],
    ]),
    4,
  );
  line(
    steel,
    body([
      [-11, -18],
      [-16, -23],
    ]),
    1.5,
  );
  if (pose.yaw !== undefined) anchor = lamp.pivot;
  dot(dark, lamp.pivot.x, lamp.pivot.y, 4);
  poly(dark, [
    lampAt(-7, -6),
    lampAt(5, -8),
    lampAt(8, -6),
    lampAt(8, 6),
    lampAt(5, 8),
    lampAt(-7, 6),
  ]);
  solid(
    amber,
    [lampAt(-6, -5), lampAt(4, -7), lampAt(6, -5), lampAt(6, 5), lampAt(4, 7), lampAt(-6, 5)],
    5,
  );
  line(light, [lampAt(-5, -5), lampAt(4, -6)], 1.3);
  // An elliptical lens exposes the barrel's pitch clearly even at gameplay scale.
  const lensRing = (depth: number, height: number) =>
    Array.from({ length: 16 }, (_, i) =>
      lampAt(6 + Math.cos((i * Math.PI) / 8) * depth, Math.sin((i * Math.PI) / 8) * height),
    );
  poly(metal, lensRing(3, 7));
  poly(0xffd782, lensRing(2.2, 5.8));
  poly(0xfff2c9, lensRing(1.3, 4));
  line(0x97764c, [lampAt(6, -6), lampAt(6, 6)], 0.8);
  line(0x97764c, [lampAt(4, -2), lampAt(8, -2)], 0.8);
  line(0x97764c, [lampAt(4, 2), lampAt(8, 2)], 0.8);
  dot(dark, lamp.pivot.x - 2, lamp.pivot.y + 3, 2.2);
  dot(steel, lamp.pivot.x - 2, lamp.pivot.y + 3, 1.1);
  anchor = undefined;
  if (heavy) {
    poly(
      dark,
      body([
        [-20, -13],
        [-14, -17],
        [-9, -10],
        [-6, 8],
        [-15, 13],
        [-22, 3],
      ]),
    );
    solid(
      0x6e8184,
      body([
        [-19, -12],
        [-15, -14],
        [-11, -9],
        [-8, 6],
        [-15, 10],
        [-20, 2],
      ]),
      6,
    );
    poly(
      amber,
      body([
        [-19, -12],
        [-15, -14],
        [-11, -9],
        [-13, -4],
        [-21, -3],
      ]),
    );
    poly(
      metal,
      body([
        [13, 3],
        [21, 0],
        [21, 10],
        [12, 14],
        [4, 11],
      ]),
    );
    line(
      cream,
      body([
        [14, 5],
        [19, 4],
      ]),
      1.5,
    );
  }
  if (scout) {
    line(
      metal,
      body([
        [12, -20],
        [13, -33],
      ]),
      1,
    );
    dot(cream, 13, -33 + bodyY, 1);
  }
  if (f.utility === 'cargo-rack') {
    box(dark, -10, 9 + bodyY, 19, 6);
    for (let n = 0; n < 3; n++) {
      box(amber, -9 + n * 6, 10 + bodyY, 5, 4);
      box(cream, -7 + n * 6, 10 + bodyY, 1, 4);
    }
  }
  if (f.utility === 'survey-array') {
    line(
      steel,
      body([
        [12, -18],
        [13, -36],
      ]),
      1.3,
    );
    const sweep = Math.sin(pose.phase * 1.8) * 3;
    poly(
      amber,
      body([
        [7, -36],
        [20, -36],
        [16 + sweep, -31],
        [12 + sweep, -31],
      ]),
    );
    line(
      cream,
      body([
        [7, -36],
        [20, -36],
      ]),
      1,
    );
  }
  // Armoured weapon arm with a single shoulder, elbow and wrist.
  if (f.weapon === 'unarmed') {
    box(amber, 20, -2 + bodyY, 6, 6);
    line(
      steel,
      body([
        [21, 4],
        [20, 9],
        [22, 10],
      ]),
      1.6,
    );
    line(
      steel,
      body([
        [25, 4],
        [27, 8],
        [25, 10],
      ]),
      1.6,
    );
  } else {
    if (pose.yaw !== undefined) anchor = { x: 15, y: -7 + bodyY };
    const socket = minerGunSocket(p, pose),
      wx = socket.dx,
      wy = socket.dy;
    const origin = [socket.origin.x, socket.origin.y];
    const elbow = [25 - wy * 3, -12 + bodyY + wy * 3];
    const armShoulder = [20, -25 + bodyY];
    line(dark, [armShoulder, elbow, origin], 8);
    line(steel, [armShoulder, elbow, origin], 4.5);
    solid(
      metal,
      [
        [17, -23 + bodyY],
        [23, -24 + bodyY],
        [elbow[0] + 3, elbow[1]],
        [elbow[0] - 3, elbow[1] + 2],
      ],
      4,
    );
    line(
      steel,
      [
        [19, -22 + bodyY],
        [elbow[0] - 2, elbow[1]],
      ],
      1,
    );
    dot(dark, elbow[0], elbow[1], 3.5);
    dot(amber, elbow[0], elbow[1], 2.5);
    dot(steel, origin[0], origin[1], 2);
    const gun = (along: number, across: number) => [
      origin[0] + wx * along - wy * across,
      origin[1] + wy * along + wx * across,
    ];
    for (const plate of weaponPlates(f.weapon, pose.phase))
      poly(
        plate.color,
        plate.points.map(([x, y]) => gun(x, y)),
      );
    const length = socket.length;
    if (f.weapon === 'machine-gun') line(steel, [gun(4, -2), gun(length, -2)], 1.8);
    line(dark, [gun(length, -3), gun(length, 3)], 2);
    if (pose.fire > 0.2)
      dot(
        f.weapon === 'beam-laser' ? 0x91efdf : 0xffd78d,
        ...(gun(length + 2, 0) as [number, number]),
        2 + pose.fire * 2,
        0.85,
      );
  }
  anchor = undefined;
  // Shoulder -> elbow -> wrist, followed by the actual aimed rotary cutting head.
  const parked = { x: -0.48, y: 0.877 };
  const target = aim ?? parked,
    active = ground && pose.drill < 0.015 ? 0 : pose.drill;
  const dir = rigidDrillDirection(target, active, Math.atan2(parked.y, parked.x)),
    norm = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / norm,
    dy = dir.y / norm,
    px = -dy,
    py = dx;
  const shoulder = [-20, -24 + bodyY];
  const elbow = [shoulder[0] + dx * 12 - dy * 4, shoulder[1] + dy * 12 + dx * 4];
  const wrist = [
    shoulder[0] + dx * (25 + active * 10 - pose.gear * 3),
    shoulder[1] + dy * (25 + active * 10 - pose.gear * 3),
  ];
  if (pose.yaw !== undefined) anchor = { x: shoulder[0], y: shoulder[1] };
  line(dark, [shoulder, elbow, wrist], 7);
  line(metal, [shoulder, elbow, wrist], 4);
  line(
    steel,
    [
      [shoulder[0] + 2, shoulder[1] + 2],
      [elbow[0] + 2, elbow[1] + 2],
      [wrist[0] + px * 2, wrist[1] + py * 2],
    ],
    1.3,
  );
  const ex = elbow[0],
    ey = elbow[1],
    vx = wrist[0] - ex,
    vy = wrist[1] - ey,
    vl = Math.hypot(vx, vy) || 1,
    nx = (-vy / vl) * 3.4,
    ny = (vx / vl) * 3.4;
  solid(
    amber,
    [
      [ex + nx, ey + ny],
      [wrist[0] + nx, wrist[1] + ny],
      [wrist[0] - nx, wrist[1] - ny],
      [ex - nx, ey - ny],
    ],
    4,
  );
  line(
    light,
    [
      [ex + nx, ey + ny],
      [wrist[0] + nx, wrist[1] + ny],
    ],
    1.1,
  );
  for (const pt of [shoulder, elbow, wrist]) {
    dot(dark, pt[0], pt[1], 4);
    dot(amber, pt[0], pt[1], 2.8);
    dot(steel, pt[0], pt[1], 1.1);
  }
  const wide = f.drill === 'excavator' ? 7 : f.drill === 'precision' ? 3 : 5;
  const length = f.drill === 'precision' ? 17 : f.drill === 'excavator' ? 16 : 14;
  const drill = (along: number, across: number) => [
    wrist[0] + dx * along + px * across,
    wrist[1] + dy * along + py * across,
  ];
  {
    // One rigid spindle: the arm articulates at the wrist, never through the bit.
    poly(dark, [
      drill(-9, -5),
      drill(-1, -5),
      drill(2, -3),
      drill(2, 3),
      drill(-1, 5),
      drill(-9, 5),
    ]);
    solid(amber, [drill(-8, -4), drill(-2, -4), drill(-2, 4), drill(-8, 4)], 5);
    line(steel, [drill(-1, 0), drill(4, 0)], 3);
    line(cream, [drill(-7, -3), drill(-3, -3)], 1);
    poly(dark, [drill(2, -wide - 1), drill(2, wide + 1), drill(length + 3, 0)]);
    solid(
      f.drill === 'precision' ? 0x86cfc7 : steel,
      [drill(3, -wide), drill(3, wide), drill(length + 2, 0)],
      3,
    );
    if (pose.yaw !== undefined) poly(metal, [drill(3, 0), drill(3, wide), drill(length + 2, 0)]);
  }
  const rotation = pose.drill > 0.01 ? (pose.phase * 14) % 1 : 0;
  for (let i = 0; i < 4; i++) {
    const t = (i + rotation) / 4,
      a = ground ? 3 + t * (length - 1) : t * length,
      w = wide * (1 - t);
    line(
      i % 2 ? cream : metal,
      ground
        ? [drill(a, -w * 0.8), drill(Math.min(length + 1, a + 1.5), w * 0.65)]
        : [drill(a - 1, -w), drill(a + 2, w)],
      1.7,
    );
  }
  anchor = undefined;
  if (unload && unload.age < 1.5) {
    const open = Math.min(1, unload.age / 0.22, Math.max(0, (1.5 - unload.age) / 0.25));
    box(dark, 9, -22 + bodyY, 15, 12);
    box(metal, 11, -20 + bodyY, 10, 8);
    poly(amber, [
      [9, -22 + bodyY],
      [24, -22 + bodyY],
      [24 + open * 6, -22 + bodyY - open * 10],
      [9 + open * 3, -22 + bodyY - open * 10],
    ]);
    line(
      steel,
      [
        [10, -20 + bodyY],
        [12 + open * 3, -25 + bodyY - open * 5],
      ],
      1.5,
    );
    box(cream, 13, -17 + bodyY - unload.kick * 3, 7, 5);
    dot(0x8ce2bc, 23, -16 + bodyY, 1.5);
  }
  return out;
}
