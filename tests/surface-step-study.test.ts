import assert from 'node:assert/strict';
import { PlayerPod } from '../src/game/player/PlayerPod';
import { Progress } from '../src/game/economy/Progress';
import { TileWorld } from '../src/game/world/TileWorld';
import { createSurfaceTerrain } from '../src/game/world/SurfaceTerrain';
import { STARTER_PLANET_CHART, WORLD } from '../src/game/config';
import { planetCameraFrameAngle } from '../src/game/world/Projection';
import { prepareStudy } from '../src/game/study/VisualStudyArt';
import { planSurfaceStep } from '../src/game/study/SurfaceStep';

function course(assist: boolean) {
  const world = new TileWorld(271026, [], [], 'cryo-shelf', STARTER_PLANET_CHART);
  world.terrain = createSurfaceTerrain(world);
  prepareStudy(world);
  const progress = new Progress();
  progress.milestones.push('mothership-origin');
  const pod = new PlayerPod(world, progress);
  pod.x = 680;
  pod.y = -22;
  assert.equal(
    pod.surfaceStepEnabled,
    false,
    'normal gameplay defaults to no experimental stepping',
  );
  pod.surfaceStepEnabled = assist;
  const before = JSON.stringify([...world.destroyed]);
  let maxRise = 0;
  const walk = (left: boolean, until: () => boolean) => {
    for (let i = 0; i < 900 && !until(); i++) {
      const oldY = pod.y;
      pod.update(
        1 / 60,
        { left, right: !left, down: false, up: false, grappleEnabled: false },
        () => {},
        planetCameraFrameAngle(pod.x / WORLD.tile, pod.y / WORLD.tile, world.planetChart!) ?? 0,
      );
      maxRise = Math.max(maxRise, oldY - pod.y);
    }
  };
  walk(true, () => pod.x < 115);
  const leftX = pod.x;
  if (assist) {
    assert(leftX < 115, `assisted miner crosses the west hill course: ${leftX}`);
    assert(maxRise < 10, 'step height is eased over frames rather than teleported');
    walk(false, () => pod.x > 500);
    assert(pod.x > 500, `rightward stepping returns to the mothership: ${pod.x}`);
  } else assert(leftX > 120, 'switching assist off restores the existing ledge behaviour');
  assert.equal(JSON.stringify([...world.destroyed]), before, 'walking never mines terrain');
  return { leftX, returnX: pod.x, maxRise };
}
console.log('course', { off: course(false), on: course(true) });
{
  const world = new TileWorld(100);
  world.terrain = { heights: Array(world.widthTiles * 2).fill(2), caves: [], nests: [] };
  world.terrain.heights[8] = 1;
  const pod = new PlayerPod(world, new Progress());
  pod.x = 314;
  pod.y = 58;
  const blocked = (x: number, y: number) => pod.overlaps(x, y).length > 0;
  assert(planSurfaceStep(world, pod, 316, blocked));
  world.terrain.heights[8] = 0;
  world.chunks.clear();
  assert.equal(
    planSurfaceStep(world, pod, 316, blocked),
    undefined,
    'two-block cliffs cannot be climbed',
  );
  world.terrain.heights[8] = 1;
  world.chunks.clear();
  world.get(7, 0).type = 'hard';
  assert.equal(
    planSurfaceStep(world, pod, 316, blocked),
    undefined,
    'overhead solid rock prevents the lift',
  );
  world.chunks.clear();
  world.break(7, 2);
  assert.equal(
    planSurfaceStep(world, pod, 316, blocked),
    undefined,
    'no walking in mid-air over a cave entrance',
  );
}
console.log(
  'PASS surface step study: default off, reversible comparison, both directions, eased lift, cliff/roof/gap protection',
);
