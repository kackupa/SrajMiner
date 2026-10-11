import assert from 'node:assert/strict';
import {
  flySolar,
  distance,
  planetPosition,
  reachablePlanet,
} from '../src/game/campaign/SolarSystem';
import { SOLAR_SYSTEM } from '../src/game/config';
const start = planetPosition('cryo-shelf');
const straight = flySolar(start, 1, 0, 1, 4, []);
const diagonal = flySolar(start, 1, 1, 1, 4, []);
assert.ok(Math.abs(straight.fuel - diagonal.fuel) < 1e-10);
assert.equal(flySolar(start, 0, 0, 60, 4, []).fuel, 4);
assert.deepEqual(flySolar(start, 1, 0, 1, 0, []).position, start);
let position = { ...start },
  fuel = 0.2,
  stopped = false;
for (let i = 0; i < 200; i++) {
  const next = flySolar(position, -1, 0, 0.05, fuel, []);
  position = next.position;
  fuel = next.fuel;
  stopped ||= next.limited;
  const home = planetPosition(reachablePlanet(position, []));
  assert.ok(
    Math.max(0, distance(position, home) - SOLAR_SYSTEM.landingRadius) <=
      fuel * SOLAR_SYSTEM.distancePerFuel + 1e-6,
  );
}
assert.ok(stopped, 'blocks flight that would consume landing reserve');
for (let i = 0; i < 200 && distance(position, start) > SOLAR_SYSTEM.landingRadius; i++) {
  const next = flySolar(position, start.x - position.x, start.y - position.y, 0.05, fuel, []);
  position = next.position;
  fuel = next.fuel;
}
assert.ok(
  distance(position, start) <= SOLAR_SYSTEM.landingRadius,
  'can return after hitting range limit',
);
assert.notEqual(reachablePlanet(planetPosition('vesper-9'), []), 'vesper-9');
console.log(
  'PASS solar flight distance fuel, normalized input, idle, empty tank, landing reserve and return',
);
