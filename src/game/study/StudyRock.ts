import type { Point, UniformCell } from './UniformPlanet';

export type RockLayer = { points: Point[]; color: number; alpha: number };
const strata = [0x43515a, 0x394c50, 0x49494f, 0x354650];
const wave = (x: number, row: number) => Math.sin(x / 173 + row * .35) * 25 + Math.sin(x / 397) * 42 + Math.sin(x / 53 + row) * 3;
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Clip decorative geology to real rock, including the curved outer crust.
 * World-space layers cross cell joins; mining simply removes their host cell. */
function clip(subject: Point[], boundary: Point[]): Point[] {
  let result = subject;
  for (let i = 0; i < boundary.length && result.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const input = result; result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], u = side(p), v = side(q);
      if (u >= 0) result.push(p);
      if ((u >= 0) !== (v >= 0)) {
        const t = u / (u - v);
        result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
  }
  return result;
}

export function studyRockLayers(cell: UniformCell): RockLayer[] {
  const left = Math.min(...cell.polygon.map(p => p.x)), right = Math.max(...cell.polygon.map(p => p.x));
  const top = Math.min(...cell.polygon.map(p => p.y)), bottom = Math.max(...cell.polygon.map(p => p.y));
  const result: RockLayer[] = [];
  const add = (points: Point[], color: number, alpha: number) => {
    const clipped = clip(points, cell.polygon);
    if (clipped.length >= 3) result.push({ points: clipped, color, alpha: alpha * (cell.material === 'rock' ? 1 : .55) });
  };
  // Broad folded beds, not a different paint colour for every square.
  for (let row = Math.floor((top - 70) / 115); row <= Math.ceil((bottom + 70) / 115); row++) {
    const upper = Array.from({ length: 5 }, (_, i) => {
      const x = left + (right - left) * i / 4;
      return { x, y: row * 115 + wave(x, row) + noise(row, 13) * 14 };
    });
    const thickness = 35 + noise(row, 9) * 20;
    const bed = (p: Point) => ({ x: p.x, y: p.y + thickness + Math.sin(p.x / 87 + row) * 8 });
    add([...upper, ...upper.map(bed).reverse()], strata[((row % 4) + 4) % 4], .52);
    add([...upper, ...upper.map(p => ({ x: p.x, y: p.y + 2.2 })).reverse()], 0x172c37, .45);
    const seam = upper.map(p => ({ x: p.x, y: bed(p).y - 1.2 }));
    add([...seam, ...seam.map(p => ({ x: p.x, y: p.y + 1.2 })).reverse()], 0x7a8787, .13);
  }
  // Occasional dark faults span several cells. Never use bright ore-like specks.
  for (let by = Math.floor(top / 140) - 1; by <= Math.floor(bottom / 140); by++) {
    for (let bx = Math.floor(left / 150) - 1; bx <= Math.floor(right / 150); bx++) {
      const x = bx * 150 + 30 + noise(bx + 4, by) * 65, y = by * 140 + 12;
      // Dull shale faces add relief without bright collectible-like flecks.
      if (cell.material === 'rock') {
        const skew = noise(bx, by + 3) * 16;
        add([{ x: x - 27, y: y + 66 }, { x: x + 3, y: y + 57 }, { x: x + 53, y: y + 72 + skew }, { x: x + 17, y: y + 79 + skew }, { x: x - 38, y: y + 74 }], 0x142d38, .19);
      }
      if (noise(bx, by) < .48) continue;
      const length = 38 + noise(bx + 7, by + 1) * 65;
      const lean = (noise(bx - 3, by) - .5) * 50;
      const fault = Array.from({ length: 5 }, (_, i) => ({ x: x + lean * i / 4 + (noise(bx + i * 9, by - i) - .5) * 13, y: y + length * i / 4 }));
      add([...fault, ...fault.map(p => ({ x: p.x + 1.5, y: p.y })).reverse()], 0x102631, .44);
      const edge = fault.map(p => ({ x: p.x + 2.2, y: p.y }));
      add([...edge, ...edge.map(p => ({ x: p.x + .8, y: p.y })).reverse()], 0x667d80, .14);
    }
  }
  return result;
}
