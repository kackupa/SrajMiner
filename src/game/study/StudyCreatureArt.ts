import type Phaser from 'phaser';
import type { CreatureFrame } from '../world/CreatureArt';
export const studyCreatureName = (kind?: string) =>
  kind === 'shard-manta'
    ? 'CRYSTAL SKIMMER'
    : kind === 'hull-scrapper'
      ? 'ARMOURED SCRAPPER'
      : 'CAVE MAULER';

/** Side-on silhouettes share the miner's angular metal/stone illustration language. */
export function drawStudyCreature(
  g: Phaser.GameObjects.Graphics,
  project: (x: number, y: number) => { x: number; y: number },
  f: CreatureFrame,
) {
  const t = f.reduced ? 0 : f.time,
    flying = f.kind === 'flyer' || f.kind === 'shard-manta',
    crab = f.kind === 'hull-scrapper';
  const face = Math.cos(f.angle) < 0 ? -1 : 1,
    lean = flying ? Math.max(-0.35, Math.min(0.35, Math.sin(f.angle) * face)) : 0;
  const attack = f.attack ?? 0,
    wind = f.mode === 'windup',
    charge = f.mode === 'charge';
  const at = (x: number, y: number) =>
    project(
      f.x + face * (x * Math.cos(lean) - y * Math.sin(lean)),
      f.y + x * Math.sin(lean) + y * Math.cos(lean),
    );
  const dark = 0x101f29,
    shell = crab ? 0x75847f : flying ? 0x79667e : 0x537c72,
    light = crab ? 0xbfc5af : flying ? 0xb5a0bb : 0x97b7a0;
  const poly = (p: number[][], color: number, a = 1) => {
    g.fillStyle(f.hit ? 0xffefd2 : color, a);
    g.fillPoints(
      p.map(([x, y]) => at(x, y)),
      true,
    );
  };
  const line = (p: number[][], color: number, w = 1, a = 1) => {
    g.lineStyle(w, color, a);
    g.strokePoints(
      p.map(([x, y]) => at(x, y)),
      false,
    );
  };
  const dot = (x: number, y: number, r: number, color: number) => {
    const p = at(x, y);
    g.fillStyle(color);
    g.fillCircle(p.x, p.y, r);
  };
  const stride = t * (4 + f.moving * 9);
  // Far limbs are darker and move half a step behind the near limbs.
  if (!flying)
    for (const far of [true, false]) {
      for (let i = 0; i < 3; i++) {
        const hip = -17 + i * 12,
          phase = stride + i * 1.8 + (far ? Math.PI : 0),
          step = Math.sin(phase) * 5 * f.moving;
        const knee = [hip - 8 + step, 10 + (far ? 0 : 3)],
          foot = [hip + step, 18 - Math.max(0, Math.cos(phase)) * 5 * f.moving];
        line([[hip, 0], knee, foot], dark, 6);
        line([[hip, 0], knee, foot], far ? 0x354e50 : light, 2.5);
        dot(knee[0], knee[1], 2, far ? shell : 0xcabf9c);
        line([foot, [foot[0] + 5, foot[1]]], dark, 3);
      }
    }
  if (flying) {
    const flap = wind ? -0.4 : charge ? 0.2 : Math.sin(t * 9),
      lift = flap * 22,
      fold = charge ? 0.45 : 1;
    for (const far of [true, false]) {
      const z = far ? 0.65 : 1,
        tip = -34 * fold,
        top = (-28 + lift) * z;
      poly(
        [
          [-7, -6],
          [-16, top],
          [tip - 14, top + 9],
          [-30, 3],
          [-20, -1],
          [-14, 8],
          [1, 4],
        ],
        far ? 0x3d4258 : shell,
      );
      line(
        [
          [-7, -6],
          [-16, top],
          [tip - 14, top + 9],
        ],
        far ? shell : light,
        2,
      );
      for (let i = 0; i < 3; i++)
        line(
          [
            [-16, top],
            [-30 + i * 8, 3 + (i % 2) * 4],
          ],
          dark,
          1.2,
        );
    }
    line(
      [
        [-15, 3],
        [-30, 10],
        [-40, 7 + Math.sin(t * 4) * 4],
      ],
      dark,
      5,
    );
    line(
      [
        [-15, 3],
        [-30, 10],
        [-40, 7 + Math.sin(t * 4) * 4],
      ],
      light,
      1.5,
    );
  }
  const bob = flying ? 0 : Math.sin(stride * 2) * f.moving;
  poly(
    [
      [-26, 1],
      [-22, -12 + bob],
      [-10, -20 + bob],
      [8, -17 + bob],
      [21, -7],
      [19, 8],
      [-16, 11],
    ],
    dark,
  );
  poly(
    [
      [-23, -1],
      [-18, -12 + bob],
      [-8, -17 + bob],
      [7, -14 + bob],
      [17, -5],
      [12, 5],
      [-17, 7],
    ],
    shell,
  );
  poly(
    [
      [-18, -12 + bob],
      [-8, -17 + bob],
      [7, -14 + bob],
      [14, -7],
      [-5, -10],
    ],
    light,
    0.8,
  );
  // Overlapping shell plates and a soft segmented belly, not a floating icon.
  for (let i = 0; i < 4; i++) {
    const x = -19 + i * 8;
    line(
      [
        [x, -9],
        [x + 4, -3],
        [x + 1, 5],
      ],
      dark,
      2,
    );
    line(
      [
        [x + 1, 7],
        [x + 6, 7],
      ],
      0xb99e74,
      2,
    );
  }
  if (f.kind === 'shard-manta')
    for (let i = 0; i < 3; i++)
      poly(
        [
          [-18 + i * 9, -11],
          [-20 + i * 9, -28 - (i % 2) * 5],
          [-10 + i * 9, -13],
        ],
        0xc6b5d7,
      );
  if (crab)
    poly(
      [
        [-22, -12],
        [-14, -24],
        [-2, -18],
        [10, -24],
        [17, -9],
        [3, -12],
      ],
      0x9ba697,
    );
  const jaw = attack * 7 + (wind ? 4 : 0),
    neck = charge ? 5 : 0;
  poly(
    [
      [9, -11],
      [21 + neck, -12],
      [31 + neck, -4],
      [24 + neck, 4],
      [12, 4],
    ],
    dark,
  );
  poly(
    [
      [11, -9],
      [21 + neck, -10],
      [28 + neck, -4],
      [22 + neck, 1],
      [14, 0],
    ],
    light,
  );
  dot(21 + neck, -6, 3.2, dark);
  dot(22 + neck, -6, 1.6, wind || charge ? 0xffac64 : 0xffd68d);
  poly(
    [
      [22, 2],
      [32 + neck, 2 + jaw],
      [24, 8 + jaw],
      [14, 6],
    ],
    shell,
  );
  for (let i = 0; i < 3; i++)
    poly(
      [
        [22 + i * 3, 2 + jaw],
        [24 + i * 3, 2 + jaw],
        [23 + i * 3, -1 + jaw],
      ],
      0xe4d9b8,
    );
  line(
    [
      [12, 0],
      [21, 8],
      [31 + attack * 8, 8 - jaw],
    ],
    dark,
    crab ? 7 : 4,
  );
  line(
    [
      [12, 0],
      [21, 8],
      [31 + attack * 8, 8 - jaw],
    ],
    light,
    crab ? 3 : 1.5,
  );
  if (crab)
    poly(
      [
        [27 + attack * 8, 5 - jaw],
        [39 + attack * 8, 2 - jaw],
        [34 + attack * 8, 10 - jaw],
        [29 + attack * 8, 12 - jaw],
      ],
      0xcabfa0,
    );
  if (wind) {
    const p = at(0, -30);
    g.lineStyle(2, 0xffb16d, 0.9);
    g.strokeTriangle(p.x, p.y - 7, p.x - 6, p.y + 4, p.x + 6, p.y + 4);
  }
}
