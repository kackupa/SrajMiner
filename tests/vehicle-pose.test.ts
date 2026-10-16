import assert from 'node:assert/strict';
import { advanceVehiclePose, restingVehiclePose } from '../src/game/player/VehiclePose';
const input = {
  sideSpeed: 180,
  verticalSpeed: -180,
  facing: 1,
  thrust: true,
  grounded: false,
  drilling: false,
  paused: false,
  reducedMotion: false,
};
let pose = restingVehiclePose();
for (let i = 0; i < 120; i++) pose = advanceVehiclePose(pose, input, 1 / 60);
assert.ok(pose.bank > 0.25 && pose.bank <= 0.28, 'bank follows travel but stays bounded');
assert.ok(pose.pitch < 0 && pose.lift > 0.99, 'climb pitches the cabin and extends thrust');
assert.ok(pose.gear > 0.99, 'airborne landing gear retracts');
assert.equal(
  advanceVehiclePose(pose, { ...input, paused: true }, 10),
  pose,
  'pause freezes every animation channel',
);
for (let i = 0; i < 120; i++)
  pose = advanceVehiclePose(pose, { ...input, sideSpeed: -180, facing: -1 }, 1 / 60);
assert.ok(
  pose.bank < -0.25 && pose.turn < -0.99,
  'reverse motion banks and turns the pilot the other way',
);
for (let i = 0; i < 180; i++)
  pose = advanceVehiclePose(
    pose,
    { ...input, sideSpeed: 0, verticalSpeed: 0, thrust: false, grounded: true },
    1 / 60,
  );
assert.ok(
  Math.abs(pose.bank) < 0.0001 &&
    pose.lift < 0.0001 &&
    pose.gear < 0.0001 &&
    Math.abs(pose.pitch) < 0.0001,
  'landing settles to rest',
);
const quiet = advanceVehiclePose(
  restingVehiclePose(),
  { ...input, reducedMotion: true, drilling: true },
  1 / 60,
);
assert.equal(quiet.bank, 0);
assert.equal(quiet.pitch, 0);
assert.equal(quiet.phase, 0);
const normal = advanceVehiclePose(restingVehiclePose(), input, 0.05);
assert.deepEqual(
  advanceVehiclePose(restingVehiclePose(), input, 100),
  normal,
  'long frames cannot jump animation',
);
console.log(
  'PASS vehicle presentation: banking, pilot reversal, climb, landing, pause, reduced motion and long-frame bounds',
);
