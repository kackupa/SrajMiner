import type Phaser from 'phaser';
type Point = { x: number; y: number };
/** Local yaw (around the deck) and pitch (around the trunnion) are independent. */
export function turretProjection(
  pivot: Point,
  base: number,
  yaw: number,
  pitch: number,
  recoil = 0,
) {
  return (x: number, y: number, z: number, barrel = false): Point => {
    if (barrel) {
      x -= recoil;
      const q = x;
      x = q * Math.cos(pitch) - y * Math.sin(pitch);
      y = q * Math.sin(pitch) + y * Math.cos(pitch);
    }
    const X = x * Math.cos(yaw) - z * Math.sin(yaw),
      Z = x * Math.sin(yaw) + z * Math.cos(yaw);
    const u = X + Z * 0.42,
      v = Z * 0.27 - y;
    return {
      x: pivot.x + u * Math.cos(base) - v * Math.sin(base),
      y: pivot.y + u * Math.sin(base) + v * Math.cos(base),
    };
  };
}
export function drawStudyTurret(
  g: Phaser.GameObjects.Graphics,
  pivot: Point,
  base: number,
  time: number,
  index: number,
  target?: Point,
  age?: number,
) {
  const dx = target
    ? (target.x - pivot.x) * Math.cos(base) + (target.y - pivot.y) * Math.sin(base)
    : 0;
  const dy = target
    ? -(target.x - pivot.x) * Math.sin(base) + (target.y - pivot.y) * Math.cos(base)
    : 0;
  const yaw = target
    ? dx < 0
      ? Math.PI
      : 0
    : Math.PI * (0.5 + 0.48 * Math.sin(time * 0.32 + index * 2.1));
  const pitch = target
    ? Math.atan2(-dy, Math.abs(dx))
    : 0.22 + Math.sin(time * 0.23 + index) * 0.08;
  const recoil = age === undefined ? 0 : Math.max(0, 1 - age / 0.18) * 5;
  const at = turretProjection(pivot, base, yaw, pitch, recoil);
  const poly = (points: number[][], color: number, barrel = false) => {
    g.fillStyle(color);
    g.fillPoints(
      points.map(([x, y, z]) => at(x, y, z, barrel)),
      true,
    );
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    barrel = false,
  ) => {
    const faces = [
      {
        p: [
          [x, y, z],
          [x + w, y, z],
          [x + w, y + h, z],
          [x, y + h, z],
        ],
        c: 0x52696c,
        z: -Math.cos(yaw),
      },
      {
        p: [
          [x, y, z + d],
          [x + w, y, z + d],
          [x + w, y + h, z + d],
          [x, y + h, z + d],
        ],
        c: 0x354d55,
        z: Math.cos(yaw),
      },
      {
        p: [
          [x + w, y, z],
          [x + w, y, z + d],
          [x + w, y + h, z + d],
          [x + w, y + h, z],
        ],
        c: 0x263b46,
        z: Math.sin(yaw),
      },
      {
        p: [
          [x, y, z],
          [x, y, z + d],
          [x, y + h, z + d],
          [x, y + h, z],
        ],
        c: 0x6b7e7b,
        z: -Math.sin(yaw),
      },
    ];
    faces.sort((a, b) => a.z - b.z).forEach((f) => poly(f.p, f.c, barrel));
    poly(
      [
        [x, y + h, z],
        [x + w, y + h, z],
        [x + w, y + h, z + d],
        [x, y + h, z + d],
      ],
      0xa4b3a4,
      barrel,
    );
  };
  // Fixed circular mounting ring, rotating armored head, twin elevating cannons.
  g.fillStyle(0x101f29);
  g.fillEllipse(pivot.x, pivot.y + 8, 44, 17);
  g.lineStyle(2, 0xa6b5a7);
  g.strokeEllipse(pivot.x, pivot.y + 5, 39, 12);
  box(-12, 0, -9, 24, 12, 18);
  box(-14, 4, 9, 12, 9, 5);
  for (const z of [-6, 6]) {
    box(0, 9, z - 2, 19, 5, 4, true);
    box(18, 10, z - 1.5, 18, 3, 3, true);
    box(33, 9, z - 3, 6, 5, 6, true);
    poly(
      [
        [39, 9, z - 2],
        [39, 13, z - 2],
        [39, 13, z + 2],
        [39, 9, z + 2],
      ],
      0x06131d,
      true,
    );
    const muzzle = at(40, 11, z, true);
    if (target && age !== undefined) {
      if (age < 0.1) {
        g.fillStyle(0xffce7b, 0.22);
        g.fillCircle(muzzle.x, muzzle.y, 12);
        g.fillStyle(0xfff0cf);
        g.fillCircle(muzzle.x, muzzle.y, 3);
      }
      const p = Math.min(1, age / 0.25),
        q = Math.max(0, p - 0.2);
      g.lineStyle(2, 0xffd699, Math.max(0, 1 - age / 0.38));
      g.lineBetween(
        muzzle.x + (target.x - muzzle.x) * q,
        muzzle.y + (target.y - muzzle.y) * q,
        muzzle.x + (target.x - muzzle.x) * p,
        muzzle.y + (target.y - muzzle.y) * p,
      );
    }
  }
  const sensor = at(3, 16, 0);
  g.fillStyle(0xffc783);
  g.fillCircle(sensor.x, sensor.y, 2);
}
