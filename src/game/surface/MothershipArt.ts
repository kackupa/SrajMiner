import type Phaser from 'phaser';
import type { VehiclePose } from '../player/VehiclePose';

/** Original expedition carrier: raised bridge, cargo spine and articulated legs. */
export function drawMothership(
  g: Phaser.GameObjects.Graphics,
  project: (x: number, y: number) => { x: number; y: number },
  thrust: boolean,
  motion?: VehiclePose,
) {
  const bank = (motion?.bank ?? 0) * 0.45,
    c = Math.cos(bank),
    s = Math.sin(bank);
  const phase = motion?.phase ?? 0,
    lift = motion?.lift ?? 0,
    gear = motion?.gear ?? 0;
  const at = (x: number, y: number) =>
    project((x * c - (y + 58) * s) * 1.5, (-58 + x * s + (y + 58) * c) * 1.5);
  const poly = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      points.map(([x, y]) => at(x, y)),
      true,
    );
  };
  const box = (x: number, y: number, w: number, h: number, color: number) =>
    poly(color, [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  const line = (points: number[][], color: number, width = 1, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    g.strokePoints(
      points.map(([x, y]) => at(x, y)),
      false,
    );
  };
  const dot = (x: number, y: number, r: number, color: number, alpha = 1) => {
    const p = at(x, y);
    g.fillStyle(color, alpha);
    g.fillCircle(p.x, p.y, r * 1.5);
  };
  if (!motion || lift < 0.1)
    poly(
      0x06131f,
      [
        [-136, -1],
        [-80, -11],
        [87, -11],
        [139, -1],
        [89, 6],
        [-91, 6],
      ],
      0.35,
    );
  // Four landing struts fold inward under power; cylinders remain attached.
  for (const side of [-1, 1]) {
    const u = side * 89,
      foot = u + side * (15 - gear * 12),
      height = -7 - gear * 23;
    line(
      [
        [u, -39],
        [foot, height],
      ],
      0x102837,
      8,
    );
    line(
      [
        [u, -39],
        [foot, height],
      ],
      0xb4c8ca,
      3,
    );
    line(
      [
        [u - side * 13, -36],
        [foot - side * 4, height],
      ],
      0x668899,
      2,
    );
    poly(0x1b3345, [
      [foot - 16, height - 2],
      [foot + 16, height - 2],
      [foot + 19, height + 4],
      [foot - 18, height + 4],
    ]);
    line(
      [
        [foot - 15, height - 2],
        [foot + 15, height - 2],
      ],
      0xc8d9d7,
      2,
    );
  }
  // Long lower cargo keel, segmented enamel containers and exposed trusses.
  poly(0x0b2436, [
    [-116, -59],
    [-84, -87],
    [81, -86],
    [122, -62],
    [109, -29],
    [-100, -29],
  ]);
  poly(0x567a90, [
    [-111, -57],
    [-83, -81],
    [81, -80],
    [116, -59],
    [104, -36],
    [-98, -36],
  ]);
  poly(0xa7c0c8, [
    [-83, -81],
    [81, -80],
    [110, -62],
    [-105, -61],
  ]);
  for (let i = 0; i < 5; i++) {
    const x = -78 + i * 31;
    poly(i % 2 ? 0x779dad : 0x8eb0be, [
      [x, -61],
      [x + 27, -61],
      [x + 27, -40],
      [x, -40],
    ]);
    box(x + 3, -58, 21, 4, 0xc2d8d9);
    box(x + 4, -49, 19, 7, 0x365a72);
    line(
      [
        [x + 1, -40],
        [x + 26, -40],
      ],
      0x17374d,
      2,
    );
  }
  // Raised forward bridge: side windows, sloped roof and continuous cockpit glass.
  poly(0x132e42, [
    [-55, -81],
    [-39, -115],
    [39, -125],
    [74, -106],
    [87, -79],
    [59, -61],
    [-43, -66],
  ]);
  poly(0xd0ddd9, [
    [-39, -115],
    [39, -125],
    [74, -106],
    [-31, -97],
    [-55, -81],
  ]);
  poly(0x92b3c2, [
    [-31, -97],
    [74, -106],
    [87, -79],
    [59, -61],
    [-43, -66],
    [-55, -81],
  ]);
  poly(0x5a819b, [
    [74, -106],
    [87, -79],
    [59, -61],
    [51, -82],
  ]);
  poly(0x0b293e, [
    [-30, -94],
    [42, -101],
    [62, -91],
    [51, -76],
    [-34, -73],
    [-43, -81],
  ]);
  poly(0x75cedd, [
    [-28, -90],
    [39, -96],
    [51, -89],
    [44, -80],
    [-31, -78],
    [-36, -82],
  ]);
  for (const x of [-17, 1, 20])
    line(
      [
        [x, -93],
        [x + 2, -78],
      ],
      0x16384d,
      3,
    );
  poly(
    0xd3ffff,
    [
      [-28, -90],
      [39, -96],
      [45, -92],
      [-30, -86],
    ],
    0.55,
  );
  poly(0x67b1c9, [
    [58, -91],
    [70, -95],
    [78, -82],
    [64, -73],
    [55, -76],
  ]);
  line(
    [
      [-35, -110],
      [38, -120],
      [64, -107],
    ],
    0xf2efdb,
    2,
  );
  poly(0xe9a86b, [
    [-47, -78],
    [-36, -85],
    [-33, -68],
    [-43, -66],
  ]);
  // Paired heavy drive nacelles: ceramic caps, cooling vanes and nozzle throats.
  for (const side of [-1, 1]) {
    const x = side * 104;
    const flame = thrust ? 28 + lift * 24 + Math.sin(phase * 31 + side) * 5 : 0;
    if (thrust) {
      poly(
        0x6cdded,
        [
          [x - 13, -33],
          [x + 13, -33],
          [x + 18, 0],
          [x, flame],
          [x - 18, 0],
        ],
        0.16,
      );
      poly(0xffb26e, [
        [x - 8, -33],
        [x + 8, -33],
        [x + 6, 2],
        [x, flame - 9],
        [x - 6, 2],
      ]);
      poly(0xdfffff, [
        [x - 4, -33],
        [x + 4, -33],
        [x, flame * 0.45],
      ]);
    }
    poly(0x183348, [
      [x - 17, -83],
      [x - 10, -101],
      [x + 9, -104],
      [x + 19, -84],
      [x + 16, -34],
      [x - 17, -34],
    ]);
    poly(0xbed0d0, [
      [x - 13, -82],
      [x - 8, -98],
      [x + 7, -100],
      [x + 13, -83],
      [x + 11, -50],
      [x - 13, -50],
    ]);
    box(x - 13, -73, 24, 10, 0xeea362);
    for (let i = 0; i < 4; i++) box(x - 10 + i * 5, -59, 2, 8, 0x3e6279);
    poly(0x091d2e, [
      [x - 14, -46],
      [x + 13, -46],
      [x + 16, -34],
      [x - 17, -34],
    ]);
    line(
      [
        [x - 13, -42],
        [x + 12, -42],
      ],
      0x7babbc,
      2,
    );
    dot(x, -36, 2.5, thrust ? 0xd9ffff : 0x52889e);
    if (side * bank < -0.02)
      poly(
        0xb1f0f5,
        [
          [x + side * 17, -69],
          [x + side * 17, -64],
          [x + side * 29, -66],
        ],
        0.8,
      );
  }
  // Warm entrance below the bridge, ramp closes as the legs retract.
  box(-19, -59, 39, 29, 0x203d50);
  box(-14, -55, 28, 25, 0x071d2c);
  if (gear > 0.01) {
    box(-14, -55, 28, 25 * gear, 0x466b81);
    for (let row = 0; row < 4; row++) {
      const shutterY = -52 + row * 6;
      if (shutterY < -55 + 25 * gear)
        line(
          [
            [-12, shutterY],
            [12, shutterY],
          ],
          0x26485f,
          1,
        );
    }
  }
  line(
    [
      [-13, -32],
      [-13, -53],
      [12, -53],
      [12, -32],
    ],
    0x8ce1df,
    1.5,
  );
  const rampEnd = -3 - gear * 26;
  poly(0x6d8b9d, [
    [-14, -30],
    [13, -30],
    [25 - gear * 11, rampEnd],
    [-24 + gear * 10, rampEnd],
  ]);
  for (let i = 1; i < 5; i++) {
    const t = i / 5,
      y = -30 + (rampEnd + 30) * t;
    line(
      [
        [-14 - 10 * t * (1 - gear), y],
        [13 + 12 * t * (1 - gear), y],
      ],
      0xb9cdd1,
      1,
    );
  }
  // Antenna, roof service hatch and readable navigation lamps.
  line(
    [
      [-18, -117],
      [-22, -141],
      [-8, -145],
    ],
    0x9bbdca,
    2,
  );
  dot(-8, -145, 2, 0xffc489);
  poly(0x294d64, [
    [6, -118],
    [24, -121],
    [29, -116],
    [10, -112],
  ]);
  for (const side of [-1, 1]) {
    dot(side * 81, -57, 3, side < 0 ? 0xffbd7d : 0x9fe9ee);
    line(
      [
        [side * 56, -34],
        [side * 83, -34],
      ],
      0xe7bd83,
      2,
    );
  }
}
