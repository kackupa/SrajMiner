import assert from 'node:assert/strict';
import { TileWorld } from '../src/game/world/TileWorld';
import { emptyCargo } from '../src/game/economy/Progress';
import { nextWallStackSite, validateSurfaceStructureSite, type UndergroundStructure } from '../src/game/building/UndergroundStructures';
import { WORLD } from '../src/game/config';

const world = new TileWorld(8128);
const cargo = { ...emptyCargo(), copper: 20 };
for (const surfaceY of [0, world.farSurfaceY]) {
  const gravity = world.gravitySign(surfaceY), walls: UndergroundStructure[] = [];
  for (let layer = 0; layer < 4; layer++) {
    const site = nextWallStackSite(world, { x: 820, y: surfaceY }, walls);
    assert.equal(site.y, surfaceY - gravity * layer * WORLD.tile);
    assert.equal(validateSurfaceStructureSite(world, 'wall', site, walls, cargo, 2000).valid, true);
    walls.push({ id: `wall:${site.x}:${site.y}`, kind: 'wall', ...site });
    assert.equal(validateSurfaceStructureSite(world, 'wall', site, walls, cargo, 2000).valid, false, 'no overlapping purchase');
  }
  assert.equal(nextWallStackSite(world, { x: 860, y: surfaceY }, walls).y, surfaceY, 'a new column starts on the ground');
  assert.equal(nextWallStackSite(world, { x: 805, y: surfaceY }, walls).x, 820, 'snap to a nearby saved column');
  walls.splice(1, 1);
  assert.equal(nextWallStackSite(world, { x: 820, y: surfaceY }, walls).y, surfaceY - gravity * WORLD.tile, 'repair the first missing support');
  assert.equal(validateSurfaceStructureSite(world, 'wall', { x: 1020, y: surfaceY - gravity * WORLD.tile }, walls, cargo, 2000).valid, false, 'no floating foundations');
  assert.equal(validateSurfaceStructureSite(world, 'wall', { x: 1020, y: surfaceY }, walls, cargo, 0).valid, false, 'no free blocks');
}
console.log('PASS wall auto-stacking, both hemispheres, column snapping, missing supports, overlap and affordability');
