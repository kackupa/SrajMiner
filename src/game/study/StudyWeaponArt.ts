import { STUDY_WEAPONS } from '../config';
export type WeaponPlate = { points: number[][]; color: number };
/** One geometric source for catalogue thumbnails and the fitted weapon. */
export function weaponPlates(id: string, phase = 0): WeaponPlate[] {
  const w = STUDY_WEAPONS.find((w) => w.id === id) ?? STUDY_WEAPONS[0],
    l = w.length;
  const plates: WeaponPlate[] = [];
  const poly = (color: number, points: number[][]) => plates.push({ color, points });
  const box = (color: number, x: number, y: number, width: number, height: number) =>
    poly(color, [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ]);
  poly(0x13232e, [
    [-7, -6],
    [7, -6],
    [10, -3],
    [10, 5],
    [-7, 5],
  ]);
  poly(0x8a9b94, [
    [-6, -6],
    [5, -6],
    [9, -3],
    [-4, -3],
  ]);
  poly(0x506977, [
    [-6, -3],
    [7, -3],
    [9, 0],
    [7, 4],
    [-6, 4],
  ]);
  poly(0xd0a360, [
    [-5, -2],
    [1, -2],
    [3, 0],
    [1, 3],
    [-5, 3],
  ]);
  box(0xc7d6cb, -5, -3, 5, 0.6);
  if (id === 'minigun') {
    box(0x233843, 5, -6, l - 5, 12);
    for (let i = 0; i < 3; i++) {
      const y = Math.sin(phase * 35 + (i * Math.PI * 2) / 3) * 4;
      box(0xb2c5c1, 6, y - 1, l - 6, 1.6);
    }
    box(0x698187, l - 5, -6, 3, 12);
    box(0x172a35, -5, 5, 10, 5);
  } else if (id === 'beam-laser' || id === 'arc') {
    box(0x243d48, 4, -4, l - 4, 8);
    box(w.color, 7, -1, l - 8, 2);
    for (let i = 0; i < 3; i++) box(0x7e9b9e, 7 + i * 4, -5, 2, 10);
    if (id === 'arc') {
      box(w.color, l - 4, -7, 4, 3);
      box(w.color, l - 4, 4, 4, 3);
    } else box(0xc6e3da, l - 2, -4, 2, 8);
  } else if (w.slot === 'secondary') {
    box(0x899d92, 1, -6, l - 1, 12);
    box(0x304954, 2, 1, l - 2, 4);
    box(0xe1b773, 4, -6, 2, 12);
    box(0x122730, l - 2, -5, 3, 10);
    if (id === 'missile') for (const y of [-3, 3]) box(w.color, l - 1, y - 1, 2, 2);
    if (id === 'grenade') box(0x607950, -5, 5, 12, 5);
  } else {
    box(0x9db1b2, 5, -(id === 'autocannon' ? 3 : 2), l - 5, id === 'autocannon' ? 6 : 4);
    poly(0x637f8a, [
      [l - 4, -4],
      [l, -3],
      [l, 3],
      [l - 4, 4],
    ]);
    box(0xc3d1c6, 6, -2, l - 8, 0.7);
    for (let i = 0; i < 2; i++) box(0x223945, 9 + i * 3, -1, 1, 2);
    poly(0x304b57, [
      [-2, 4],
      [5, 4],
      [3, 11],
      [-3, 10],
    ]);
    box(0xa6b7b4, -2, 6, 5, 0.7);
    box(0xa6b7b4, -2, 8, 4, 0.7);
    box(0x152b36, l - 1, -2, 1, 4);
  }
  // Fasteners and receiver bevels remain readable on the larger catalogue drawing.
  for (const x of [-4, 5])
    poly(0xcbd7c9, [
      [x, -0.8],
      [x + 0.6, 0],
      [x, 0.8],
      [x - 0.6, 0],
    ]);
  box(0x1b303a, -6, 3, 11, 1);
  box(0x9db6b8, 0, -7, 6, 1.2);
  return plates;
}
export function weaponSVG(id: string) {
  return `<svg viewBox="-14 -20 52 40" role="img" aria-label="${STUDY_WEAPONS.find((w) => w.id === id)?.name ?? 'Weapon'}">${weaponPlates(
    id,
  )
    .map(
      (p) =>
        `<polygon points="${p.points.map((p) => p.join(',')).join(' ')}" fill="#${p.color.toString(16).padStart(6, '0')}"/>`,
    )
    .join('')}</svg>`;
}
