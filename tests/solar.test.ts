import assert from 'node:assert/strict';
import { distance, planetPosition, solarDestinationUnlocked, solarRouteFuel } from '../src/game/campaign/SolarSystem';
import { MAPS, SOLAR_SYSTEM } from '../src/game/config';

const cryo = planetPosition('cryo-shelf'), hull = planetPosition('hull-graveyard');
assert.ok(Math.abs(solarRouteFuel(cryo, hull) - (Math.hypot(230, 255) - SOLAR_SYSTEM.landingRadius) / SOLAR_SYSTEM.distancePerFuel) < 1e-10);
assert.equal(solarRouteFuel(cryo, cryo), 0);
assert.equal(solarRouteFuel(cryo, hull), solarRouteFuel(hull, cryo));
for (const id of Object.keys(MAPS) as (keyof typeof MAPS)[]) {
  assert.equal(solarRouteFuel(planetPosition(id), planetPosition(id)), 0);
  assert.ok(solarRouteFuel(cryo, planetPosition(id)) >= 0, `route to ${id} has a nonnegative cost`);
}
assert.equal(solarDestinationUnlocked('cryo-shelf', 'cryo-shelf', false, []), true);
assert.equal(solarDestinationUnlocked('mars-frontier', 'cryo-shelf', false, []), false);
assert.equal(solarDestinationUnlocked('mars-frontier', 'cryo-shelf', true, []), true);
assert.equal(solarDestinationUnlocked('vesper-9', 'cryo-shelf', true, []), false);
assert.ok(distance(cryo, hull) > 0);
console.log('PASS direct route pricing, current-world return, and destination unlock gates');
