import assert from 'node:assert/strict';
import { StudyDrillEffects, STUDY_ROCK } from '../src/game/study/StudyDrillEffects';
import { TileWorld } from '../src/game/world/TileWorld';

const world = new TileWorld(271026);
const tile = world.generate(19, 4);
const before = JSON.stringify([...world.destroyed]);
const effects = new StudyDrillEffects();
const pod = { x: 760, y: 165 };
effects.break(tile, pod);
assert(effects.fragments.some((p) => p.dust && p.color === STUDY_ROCK.dust));
assert(effects.fragments.some((p) => !p.dust && p.size >= 4));
for (let i = 0; i < 150; i++) effects.update(world, 1 / 60, tile, pod, 0.5);
assert(effects.fragments.length <= 140, 'continuous drilling has a bounded effect budget');
assert.equal(
  JSON.stringify([...world.destroyed]),
  before,
  'visuals cannot excavate or modify saved terrain',
);
for (let i = 0; i < 180; i++) effects.update(world, 1 / 60, undefined, pod, 0);
assert.equal(effects.fragments.length, 0, 'all cosmetic debris expires after drilling stops');

effects.break(tile, pod);
const chunk = effects.fragments.find((p) => !p.dust)!;
Object.assign(chunk, { x: 10, y: 35, vx: 0, vy: 120, life: 10 });
const floor = { solid: (_x: number, y: number) => y >= 1, gravitySign: () => 1 };
for (let i = 0; i < 180; i++) effects.update(floor, 1 / 60, undefined, pod, 0);
assert(chunk.y < 40 && chunk.settled, 'falling debris settles above solid ground');
effects.update(world, 1 / 60, tile, pod, 0.8, true);
assert.equal(effects.fragments.length, 0, 'reduced motion suppresses dust and flying fragments');

const a = new StudyDrillEffects(),
  b = new StudyDrillEffects();
for (let i = 0; i < 15; i++) a.update(world, 1 / 30, tile, pod, 0.4);
for (let i = 0; i < 60; i++) b.update(world, 1 / 120, tile, pod, 0.4);
assert(
  Math.abs(a.fragments.length - b.fragments.length) <= 2,
  'emission is time-based rather than per-render',
);
console.log(
  'PASS study drill effects: bounded, transient, reduced-motion safe, terrain-safe and ground-settling',
);
