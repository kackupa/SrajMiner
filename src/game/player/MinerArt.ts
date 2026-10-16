import type Phaser from 'phaser';
import { POD_PAINTS, POD_PROFILES, POD_DECALS, PILOT_SUITS } from '../config';
import type { Progress } from '../economy/Progress';
import type { VehiclePose } from './VehiclePose';

/** A small piloted pressure cabin, suspended between two gimballed engine pods. */
export function drawMiner(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  p: Progress,
  pose: VehiclePose,
  reducedMotion: boolean,
) {
  const paint = POD_PAINTS[p.selectedPaint],
    suit = PILOT_SUITS[p.selectedSuit];
  const profile = POD_PROFILES[p.selectedProfile],
    decal = POD_DECALS[p.selectedDecal];
  const bank = pose.bank,
    c = Math.cos(bank),
    s = Math.sin(bank);
  const recoil = reducedMotion ? 0 : Math.sin(pose.phase * 43) * pose.drill * 0.65;
  const at = (u: number, v: number) => {
    const depth = v * (1 - Math.abs(pose.pitch) * 0.45);
    return { x: x + (u * c - depth * s) * scale, y: y + (u * s + depth * c + recoil) * scale };
  };
  const poly = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      points.map(([u, v]) => at(u, v)),
      true,
    );
  };
  const line = (color: number, points: number[][], width = 1, alpha = 1) => {
    g.lineStyle(width * scale, color, alpha);
    g.strokePoints(
      points.map(([u, v]) => at(u, v)),
      false,
    );
  };
  const dot = (color: number, u: number, v: number, r: number, alpha = 1) => {
    const pt = at(u, v);
    g.fillStyle(color, alpha);
    g.fillCircle(pt.x, pt.y, r * scale);
  };
  const box = (color: number, u: number, v: number, w: number, h: number, alpha = 1) =>
    poly(
      color,
      [
        [u, v],
        [u + w, v],
        [u + w, v + h],
        [u, v + h],
      ],
      alpha,
    );
  const yaw = pose.turn * 1.8;
  // Articulated suspension. Engines counter-gimbal against the cabin bank.
  for (const side of [-1, 1]) {
    const u = side * 16,
      extension = pose.lift * 2;
    line(
      0x091b29,
      [
        [side * 9, 1],
        [u, 5 + extension],
      ],
      4,
    );
    line(
      0x9bb7c6,
      [
        [side * 9, 0],
        [u, 4 + extension],
      ],
      1.6,
    );
    const nozzle = (du: number, dv: number) => {
      const angle = -bank * 0.7,
        a = Math.cos(angle),
        b = Math.sin(angle);
      return [u + du * a - dv * b, 3 + extension + du * b + dv * a];
    };
    const enginePoly = (color: number, pts: number[][], alpha = 1) =>
      poly(
        color,
        pts.map(([a, b]) => nozzle(a, b)),
        alpha,
      );
    const flame = pose.lift > 0.4 ? (pose.lift - 0.35) * 22 : 0;
    const flutter = reducedMotion ? 0 : Math.sin(pose.phase * 38 + side * 1.2) * 2;
    if (flame > 0) {
      enginePoly(
        0x67cfe9,
        [
          [-6, 10],
          [6, 10],
          [8, 17],
          [0, 19 + flame + flutter],
          [-8, 17],
        ],
        0.15,
      );
      enginePoly(0xffb067, [
        [-3.5, 10],
        [3.5, 10],
        [2, 16 + flame * 0.4],
        [0, 16 + flame + flutter],
        [-2, 16 + flame * 0.4],
      ]);
      enginePoly(0xe0ffff, [
        [-2, 10],
        [2, 10],
        [0, 17 + flame * 0.45],
      ]);
    }
    enginePoly(0x102536, [
      [-5, -12],
      [3, -13],
      [6, -8],
      [5, 11],
      [-5, 11],
      [-7, 5],
    ]);
    enginePoly(0x7299ad, [
      [-4, -11],
      [2, -12],
      [4, -7],
      [3, 6],
      [-4, 6],
    ]);
    enginePoly(paint.trim, [
      [-4, -9],
      [2, -10],
      [3, -6],
      [-4, -5],
    ]);
    for (let i = 0; i < 3; i++)
      enginePoly(0x244456, [
        [-4, -2 + i * 3],
        [3, -2 + i * 3],
        [3, i * 3],
        [-4, i * 3],
      ]);
    enginePoly(0xd2e4e8, [
      [-4, 7],
      [3, 7],
      [4, 9],
      [-5, 9],
    ]);
    // Small correction jets fire opposite the direction of banking.
    if (side * bank < -0.035)
      enginePoly(
        0xa6efff,
        [
          [side * 5, -2],
          [side * 5, 2],
          [side * (10 + Math.abs(bank) * 16), 0],
        ],
        0.8,
      );
    const footY = 15 - pose.gear * 5;
    line(
      0x9cbac8,
      [
        [u, 10],
        [u + side * 2, footY],
      ],
      1.7,
    );
    line(
      0x1b3446,
      [
        [u - 5, footY],
        [u + 5, footY],
      ],
      3,
    );
  }
  // Three-quarter hull: chamfered roof, shaded side, recessed panoramic glazing.
  poly(0x071925, [
    [-13, -15],
    [-6, -21],
    [8, -20],
    [14, -13],
    [14, 8],
    [8, 15],
    [-9, 14],
    [-14, 7],
  ]);
  poly(paint.hull, [
    [-11, -14],
    [-5, -19],
    [7, -18],
    [12, -12],
    [12, 7],
    [7, 12],
    [-8, 11],
    [-12, 5],
  ]);
  poly(paint.trim, [
    [-11, -14],
    [-5, -19],
    [7, -18],
    [12, -12],
    [-2, -13],
  ]);
  poly(
    0x102c40,
    [
      [7, -12],
      [12, -12],
      [12, 7],
      [7, 12],
      [6, 2],
    ].map(([u, v]) => [u * pose.turn, v]),
    0.45,
  );
  line(
    0xfff0cd,
    [
      [-10, -12],
      [-11, 3],
      [-7, 9],
      [3, 10],
    ],
    0.7,
    0.6,
  );
  poly(0x092437, [
    [-10, -10],
    [yaw + 6, -12],
    [10, -7],
    [8, 2],
    [-7, 4],
    [-11, 0],
  ]);
  poly(0x35758e, [
    [-8, -9],
    [yaw + 5, -10],
    [8, -6],
    [6, 0],
    [-6, 2],
    [-9, -1],
  ]);
  poly(
    profile.cabin,
    [
      [-8, -9],
      [yaw + 5, -10],
      [7, -7],
      [-8, -5],
    ],
    0.65,
  );
  // The pilot looks into the turn and works the two controls, rather than
  // remaining a fixed face printed on the front of the machine.
  const head = yaw * 0.7,
    lean = pose.bank * 5;
  poly(suit.body, [
    [head - 3, -1],
    [head + 3, -1],
    [5 + lean, 3],
    [-4 + lean, 3],
  ]);
  box(suit.trim, head - 3, -7, 6, 6);
  box(0x102536, head - 2 + pose.turn * 0.5, -5, 4, 2);
  line(
    0xaddfed,
    [
      [head - 1, -5],
      [head + 1, -5],
    ],
    0.6,
  );
  line(
    suit.body,
    [
      [-2, 1],
      [-5 + lean, 1],
      [-6 + lean, -1],
    ],
    1.3,
  );
  line(
    suit.body,
    [
      [2, 1],
      [5 + lean, 0],
      [6 + lean, -2],
    ],
    1.3,
  );
  dot(0xa1eced, -6 + lean, -1, 0.7);
  dot(0xffbb73, 6 + lean, -2, 0.7);
  poly(
    0xd9ffff,
    [
      [-8, -8],
      [-4, -9],
      [-8, -2],
    ],
    0.25,
  );
  line(
    0xbedce2,
    [
      [-9, -10],
      [yaw + 5, -11],
      [9, -7],
    ],
    0.65,
    0.8,
  );
  box(0x183448, -6, 6, 12, 3);
  if (decal.style === 'stripe')
    line(
      decal.color,
      [
        [-5, 7],
        [4, 7],
      ],
      1,
    );
  else if (decal.style === 'arrow')
    line(
      decal.color,
      [
        [-4, 7],
        [4, 7],
        [1, 5],
        [4, 7],
        [1, 9],
      ],
      0.9,
    );
  else if (decal.style === 'crest')
    poly(decal.color, [
      [0, 5],
      [3, 7],
      [0, 10],
      [-3, 7],
    ]);
  else {
    dot(decal.color, -3, 7, 1);
    dot(decal.color, 2, 8, 1);
  }
  for (const side of [-1, 1]) {
    dot(0xe9e0c9, side * 9, 6, 0.7);
    dot(paint.light, side * 11, -2, 1.2);
  }
  // Existing upgrades and owned equipment remain visibly fitted.
  if (p.levels.hull > 1 || profile.style === 'armor') {
    for (const side of [-1, 1])
      poly(0x8eafbc, [
        [side * 10, 2],
        [side * 14, 3],
        [side * 12, 10],
        [side * 7, 14],
        [side * 7, 10],
      ]);
  }
  if (p.levels.fuel > 1)
    for (const side of [-1, 1]) {
      box(0x234659, side * 8 - 2, -21, 4, 8);
      box(0x93c8cf, side * 8 - 1, -20, 2, 5);
    }
  if (p.levels.cargo > 1) {
    box(0x28495b, -8, 11, 16, 5);
    line(
      paint.trim,
      [
        [-6, 13],
        [6, 13],
      ],
      1,
    );
  }
  if (p.levels.engine > 1) {
    line(
      0xa7e7ed,
      [
        [-21, 10],
        [-13, 10],
      ],
      1.5,
    );
    line(
      0xa7e7ed,
      [
        [13, 10],
        [21, 10],
      ],
      1.5,
    );
  }
  if (p.levels.scanner > 1 || profile.style === 'antenna') {
    line(
      0x91aebf,
      [
        [-4, -19],
        [-5, -26],
        [0, -27],
      ],
      1,
    );
    dot(paint.light, 0, -27, 1.3);
  }
  if (profile.style === 'stabilizers')
    for (const side of [-1, 1])
      poly(0x688e9f, [
        [side * 12, -5],
        [side * 24, -11],
        [side * 22, 3],
        [side * 15, 7],
      ]);
  if (p.grappleOwned) {
    dot(0x132b3e, 12, -10, 3);
    line(
      0xadc4ce,
      [
        [11, -12],
        [15, -10],
        [12, -7],
      ],
      1,
    );
  }
  if (p.returnWinch) {
    dot(0x102637, -11, 7, 3);
    dot(0xb9d0ce, -11, 7, 1.6);
  }
  if (p.salvageMagnet) {
    line(
      0x80daca,
      [
        [-10, 12],
        [-10, 15],
        [-5, 15],
      ],
      1.6,
    );
  }
  if (p.stasisModule) dot(0x85dbf1, 9, 10, 1.8);
  if (p.escapeSuit) box(suit.body, 9, -17, 5, 4);
}
