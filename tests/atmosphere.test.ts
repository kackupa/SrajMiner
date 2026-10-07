import assert from 'node:assert/strict';
import { CaveAtmosphere } from '../src/game/world/CaveAtmosphere';
import { TileWorld, keyOf } from '../src/game/world/TileWorld';
import { CAVE_ATMOSPHERE } from '../src/game/config';

const world = new TileWorld(42, [], [], 'cryo-shelf');
for (let x = 20; x <= 28; x++) for (let y = 10; y <= 16; y++) {
  world.destroyed.add(keyOf(x, y)); world.discovered.add(keyOf(x, y));
}
const durable = JSON.stringify({ destroyed: [...world.destroyed], discovered: [...world.discovered] });
const view = { x: 600, y: 300, width: 800, height: 600, podX: 980, podY: 540,
  thrusting: true, drilling: true, aimX: 1, aimY: 0 };
const atmosphere = new CaveAtmosphere();
atmosphere.enabled = true;
const originalRandom = Math.random;
let seed = 23;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
try {
  for (let i = 0; i < 500; i++) atmosphere.update(world, 0.02, view, false, false);
  assert.ok(atmosphere.motes.length > 0);
  assert.ok(atmosphere.motes.some(p => p.wake));
  assert.ok(atmosphere.motes.length <= CAVE_ATMOSPHERE.maxParticles);
  for (const p of atmosphere.motes) {
    const x = Math.floor(p.x / 40), y = Math.floor(p.y / 40);
    assert.ok(world.discovered.has(keyOf(x, y)) && !world.solid(x, y));
  }
  assert.equal(JSON.stringify({ destroyed: [...world.destroyed], discovered: [...world.discovered] }), durable);
  const frozen = JSON.stringify(atmosphere.motes);
  atmosphere.update(world, 1, view, false, true);
  assert.equal(JSON.stringify(atmosphere.motes), frozen);
  atmosphere.update(world, 0.02, view, true, true);
  assert.equal(atmosphere.motes.length, 0);
  for (let i = 0; i < 100; i++) atmosphere.update(world, 0.02, view, false, false);
  assert.ok(atmosphere.motes.length > 0);
  atmosphere.update(new TileWorld(43), 0.02, view, false, true);
  assert.equal(atmosphere.motes.length, 0);
  atmosphere.enabled = false;
  atmosphere.update(world, 1, view, false, false);
  assert.equal(atmosphere.motes.length, 0);
  console.log('PASS cave atmosphere: particle cap, open explored space, wakes, immutable terrain, pause, reduced motion, map reset, disabled state');
} finally { Math.random = originalRandom; }
