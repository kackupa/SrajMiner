import assert from 'node:assert/strict';
import { PlayerPod, type Controls } from '../src/game/player/PlayerPod';
import { Progress } from '../src/game/economy/Progress';
import { TileWorld } from '../src/game/world/TileWorld';
import { PHYSICS, STARTER_PLANET_CHART, WORLD } from '../src/game/config';
import { planetCameraFrameAngle } from '../src/game/world/Projection';

const idle: Controls = { left: false, right: false, up: false, down: false, grappleEnabled: false };
function fixture(direction: number, ceiling = false) {
  const world = new TileWorld(734),
    pod = new PlayerPod(world, new Progress());
  for (let y = 16; y <= 24; y++) for (let x = 4; x <= 12; x++) world.get(x, y).type = 'empty';
  world.get(8, ceiling ? 19 : 20).type = 'hard';
  pod.x = direction > 0 ? 314 : 366;
  pod.y = ceiling ? 810 : 790;
  pod.vx = direction * 100;
  pod.docked = false;
  return { world, pod, input: { ...idle, right: direction > 0, left: direction < 0 } };
}
for (const direction of [-1, 1])
  for (const ceiling of [false, true]) {
    const { world, pod, input } = fixture(direction, ceiling),
      start = { x: pod.x, y: pod.y };
    const target = pod.update(1 / 60, input, () =>
      assert.fail('a small lip should not damage the miner'),
    );
    assert((pod.x - start.x) * direction > 1, 'left and right steering clear a six-pixel lip');
    assert(Math.abs(pod.y - start.y) <= PHYSICS.horizontalCornerTolerance + 0.2);
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0);
    assert.equal(target, undefined, 'skimmed lip is not automatically drilled');
    assert.equal(world.get(8, ceiling ? 19 : 20).type, 'hard');
    assert.equal(world.destroyed.size, 0, 'movement cannot mine or mutate terrain');
  }
{
  const { pod, input } = fixture(1);
  pod.y = 820;
  for (let i = 0; i < 10; i++) pod.update(1 / 60, input, () => {});
  assert(pod.x <= 315, 'a full-height wall still blocks horizontal movement');
}
{
  const { pod, input } = fixture(1);
  pod.vy = PHYSICS.fall;
  pod.update(1 / 60, input, () => {});
  assert(pod.x <= 315, 'fast falls cannot use corner assistance to bypass collisions');
}
{
  const { pod, input } = fixture(1);
  input.down = true;
  assert(
    pod.update(1 / 60, input, () => {}),
    'deliberate downward drilling keeps its obstruction',
  );
}
// Exercise actual curved-cell SAT contact, not just the rectangular legacy map.
{
  const world = new TileWorld(735, [], [], 'cryo-shelf', STARTER_PLANET_CHART);
  const pod = new PlayerPod(world, new Progress());
  for (let y = 0; y < 18; y++) for (let x = 10; x < 35; x++) world.get(x, y).type = 'empty';
  world.get(24, 10).type = 'hard';
  let skimmed = false;
  for (let y = 370; y < 430 && !skimmed; y++)
    for (let x = 930; x < 970 && !skimmed; x++) {
      const frame =
        planetCameraFrameAngle(x / WORLD.tile, y / WORLD.tile, STARTER_PLANET_CHART) ?? 0;
      if (pod.overlaps(x, y, frame).length || !pod.overlaps(x + 2, y, frame).length) continue;
      pod.x = x;
      pod.y = y;
      pod.vx = 100;
      pod.vy = 0;
      pod.docked = false;
      const target = pod.update(1 / 60, { ...idle, right: true }, () => {}, frame);
      if (!target && pod.x > x + 1) {
        assert(Math.abs(pod.y - y) <= PHYSICS.horizontalCornerTolerance + 1);
        assert.equal(pod.overlaps(pod.x, pod.y, frame).length, 0);
        skimmed = true;
      }
    }
  assert(skimmed, 'curved planet corners can be passed without mining or wedging');
}
console.log(
  'PASS movement clearance: floor/ceiling lips, both directions, curved terrain, solid walls and fast-fall protection',
);
