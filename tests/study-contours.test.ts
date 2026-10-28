import assert from 'node:assert/strict';
import { studyContourGeometry, type StudyEdge } from '../src/game/study/StudyContours';
const square: StudyEdge[] = [
  { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  { a: { x: 1, y: 0 }, b: { x: 1, y: 1 } },
  { a: { x: 1, y: 1 }, b: { x: 0, y: 1 } },
  { a: { x: 0, y: 1 }, b: { x: 0, y: 0 } },
];
const rock = studyContourGeometry(square);
assert.equal(rock.corners.length, 4);
assert(rock.corners.every((c) => c.cut));
assert(rock.segments.every((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) >= 0.099));
for (const c of rock.corners) {
  assert.deepEqual(c.curve[0], c.entry);
  assert.deepEqual(c.curve.at(-1), c.exit);
  assert(c.curve.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  const middle = c.curve[4];
  assert(Math.hypot(middle.x - c.vertex.x, middle.y - c.vertex.y) * 40 < 6.4);
}
const hole = studyContourGeometry(
  square
    .slice()
    .reverse()
    .map((e) => ({ a: e.b, b: e.a })),
);
assert(hole.corners.every((c) => !c.cut));
// Open viewport edges must not invent a closing wall across the player's path.
const clipped = studyContourGeometry(square.slice(0, 2));
assert.equal(clipped.corners.length, 1);
assert.deepEqual(clipped.segments[0].a, { x: 0, y: 0 });
assert.deepEqual(clipped.segments[1].b, { x: 1, y: 1 });
// Touching diagonals are ambiguous: keep the junction rather than bridging air.
const touching = studyContourGeometry([
  ...square,
  ...square.map((e) => ({ a: { x: e.a.x + 1, y: e.a.y + 1 }, b: { x: e.b.x + 1, y: e.b.y + 1 } })),
]);
assert(!touching.corners.some((c) => c.vertex.x === 1 && c.vertex.y === 1));
assert.deepEqual(studyContourGeometry([]), { corners: [], segments: [] });
console.log(
  'PASS art-study contours: bounded rounding, open passages, cave/rock winding and diagonal junctions',
);
