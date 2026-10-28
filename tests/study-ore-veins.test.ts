import assert from 'node:assert/strict';
import { studyOreVeins, type OreAt } from '../src/game/study/StudyOreVeins';
const ore: OreAt = (x, y) => (x >= 0 && x < 4 && y === 2 ? 'copper' : undefined);
const left = studyOreVeins(73, 1, 2, 'copper', ore),
  right = studyOreVeins(73, 2, 2, 'copper', ore);
const a = left.flat().find((p) => p.x === 1)!,
  b = right.flat().find((p) => p.x === 0)!;
assert(a && b);
assert.equal(a.y, b.y);
assert.equal(a.width, b.width);
const vertical: OreAt = (x, y) => (x === 2 && y >= 0 && y < 5 ? 'iron' : undefined);
const up = studyOreVeins(81, 2, 1, 'iron', vertical)
  .flat()
  .find((p) => p.y === 1)!;
const down = studyOreVeins(81, 2, 2, 'iron', vertical)
  .flat()
  .find((p) => p.y === 0)!;
assert(up && down);
assert.equal(up.x, down.x);
assert.equal(up.width, down.width);
const mixed: OreAt = (x) => (x === 1 ? 'copper' : 'iron');
assert(
  !studyOreVeins(7, 1, 2, 'copper', mixed)
    .flat()
    .some((p) => p.x === 0 || p.x === 1),
);
const isolated = studyOreVeins(73, 1, 2, 'copper', () => undefined);
assert(isolated.every((path) => path.at(-1)!.width === 0));
for (let seed = 0; seed < 100; seed++) {
  const paths = studyOreVeins(seed, 1, 2, 'copper', ore);
  assert(
    paths
      .flat()
      .every(
        (p) =>
          Number.isFinite(p.x + p.y + p.width) &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1 &&
          p.width >= 0,
      ),
  );
  assert.deepEqual(paths, studyOreVeins(seed, 1, 2, 'copper', ore));
}
console.log(
  'PASS study ore veins: matching seams/widths, separated ore types, tapering isolated deposits and stable geometry',
);
