import assert from 'node:assert/strict';
import { StudyFleet, cargoTotal } from '../src/game/study/StudyFleet';
import { UniformPlanet, UniformMiner } from '../src/game/study/UniformPlanet';
import { UNIFORM_PLANET_STUDY as C } from '../src/game/config';

const f = new StudyFleet();
// The actual ship spawn grazes a clipped crust corner. The cutting width must
// clear that sliver rather than excavating a shaft the rig cannot enter.
const terrain = new UniformPlanet(), rig = new UniformMiner();
rig.teleport({ x: -357.7408773201489, y: -1739.5745500079688 });
let cutTime = 0, collected = 0;
for (let i = 0; i < 720; i++) {
  rig.step(terrain, 0, false, 1 / 120); cutTime += 1 / 120;
  if (cutTime >= C.drillSeconds) {
    for (const cell of terrain.drillFace(rig, { x: -rig.outward.x, y: -rig.outward.y })) {
      if (terrain.remove(cell) && cell.material !== 'rock') collected++;
    }
    cutTime = 0;
  }
  assert(!terrain.collides(rig));
}
assert(collected > 0, 'Can reach ore from the mothership spawn');
assert(Math.hypot(rig.x, rig.y) < C.radius - 150, 'No remaining crust sliver traps the miner');
for (let i = 0; i < 1200; i++) { rig.step(terrain, 0, true, 1 / 120); assert(!terrain.collides(rig)); }
assert(Math.hypot(rig.x, rig.y) > C.radius, 'Can physically fly back out of the new shaft');
for (let i = 0; i < 48; i++) assert(f.collect('copper'));
assert(!f.collect('iron'), 'Only the miner has a capacity limit');
f.storage.copper = 100000;
assert.equal(f.unload(), 48);
assert.equal(f.storage.copper, 100048);
assert.equal(f.unload(), 0, 'Repeated unload cannot duplicate ore');
assert.equal(cargoTotal(f.miner), 0);
const q = f.quote('copper', 8)!;
assert(!f.sell({ ...q, value: q.value + 1 }));
assert(!f.quote('copper', -1));
assert(!f.quote('copper', 0.5));
assert(!f.quote('copper', Infinity));
assert(f.sell(q));
assert.equal(f.credits, 96);
assert.equal(f.storage.copper, 100040);
const stale = f.quote('copper')!;
assert(f.sell(f.quote('copper', 1)!));
assert(!f.sell(stale), 'Stale sale cannot overspend ore');

const shared = new StudyFleet();
shared.miner.copper = 3;
shared.storage.copper = 5;
shared.miner.iron = 1;
shared.storage.iron = 3;
shared.credits = 59;
const before = JSON.stringify([shared.miner, shared.storage, shared.credits]);
assert(!shared.buy('rack'));
assert.equal(
  JSON.stringify([shared.miner, shared.storage, shared.credits]),
  before,
  'Failed purchase is atomic',
);
shared.credits++;
assert(shared.buy('rack'), 'Miner and ship materials are pooled');
assert.equal(shared.capacity, 72);
assert.equal(shared.credits, 0);
assert.equal(cargoTotal(shared.miner) + cargoTotal(shared.storage), 0);
assert(!shared.buy('rack'));
assert(shared.loadTestSupplies());
assert(!shared.loadTestSupplies(), 'Explicit test supplies are one-shot');
assert(shared.buy('drill'));
assert(shared.drillSeconds < C.drillSeconds);
assert(shared.buy('thrusters'));

const world = new UniformPlanet(),
  ship = new StudyFleet();
assert(ship.landing(world, ship.angle), 'Initial ship has solid ground under its footprint');
assert(!ship.landing(world, 0), 'Cannot bridge the access shaft');
assert(!ship.landing(world, NaN));
assert(!ship.relocate(world, ship.angle));
assert(ship.landing(world, Math.PI / 2));
const cell = world.ray({ x: C.radius + 30, y: 0 }, { x: -1, y: 0 })!;
assert(cell);
world.remove(cell);
assert(!ship.landing(world, Math.PI / 2), 'Landing does not fill excavated ground');
const intact = new UniformPlanet();
ship.storage.iron = 100;
ship.credits = 321;
assert(ship.relocate(intact, Math.PI / 2));
assert(!ship.near(ship.position), 'Cannot unload to an airborne ship');
assert(!ship.relocate(intact, Math.PI));
for (let i = 0; i < 500 && ship.flight; i++) {
  ship.update(1 / 60);
  assert(Number.isFinite(ship.position.x) && Number.isFinite(ship.position.y));
  assert(Math.hypot(ship.position.x, ship.position.y) >= C.radius + 7.99);
}
assert(!ship.flight);
assert.equal(ship.angle, Math.PI / 2);
assert.equal(ship.storage.iron, 100);
assert.equal(ship.credits, 321);
assert.equal(intact.excavated.size, 0, 'Relocation never edits terrain or tunnels');
assert(ship.near(ship.position));
assert(shared.relocate(intact, Math.PI / 2));
assert.equal(shared.flight?.duration, 4.2);
ship.angle = Math.PI - 0.2;
assert(ship.relocate(intact, -Math.PI + 0.2));
for (let i = 0; i < 210; i++) ship.update(1 / 60);
assert(ship.position.y > C.radius, 'Cross-seam travel takes the short route around the far side');
console.log(
  'Mothership prototype: cargo conservation, shared purchases, unlimited hold and relocation passed.',
);

// Pads contact the same circular cross-section on every hemisphere, independent of camera.
const {landingFoot,roundLandingSurface}=await import('../src/game/surface/LandingGear');
for(const angle of [0,.7,Math.PI/2,Math.PI,-2.4])for(const anchor of [-102,-64,65,106]){
 const leg=landingFoot(anchor,0,roundLandingSurface(C.radius,C.radius+8));
 const [x,y]=leg.pad(0,0),tangent={x:Math.cos(angle),y:Math.sin(angle)},out={x:Math.sin(angle),y:-Math.cos(angle)};
 const point={x:out.x*(C.radius+8-y*1.5)+tangent.x*x*1.5,y:out.y*(C.radius+8-y*1.5)+tangent.y*x*1.5};
 assert(Math.abs(Math.hypot(point.x,point.y)-C.radius)<1e-8,'Actual sole centre touches permanent crust');
 assert.equal(Math.sign(leg.angle),Math.sign(anchor),'Pad tilts with crust');
 for(const edge of [-18,18]){
  const [u,v]=leg.pad(edge,0);
  assert(Math.abs(Math.hypot(u*1.5,C.radius+8-v*1.5)-C.radius)<.3,'Both pad edges sit within a fraction of a pixel of crust');
 }
}
for(const anchor of [-102,-64,65,106]){
 const air=landingFoot(anchor,1,roundLandingSurface(C.radius,C.radius+200));
 const legacy=landingFoot(anchor,1);
 assert.equal(air.y,legacy.y,'Flight retracts legs rather than stretching to the ground');
 assert.equal(air.angle,0);
}
const outer=landingFoot(106,0,roundLandingSurface(C.radius,C.radius+8)),inner=landingFoot(65,0,roundLandingSurface(C.radius,C.radius+8));
assert(outer.y>inner.y,'Each leg extends independently for curvature');
console.log('PASS landing pad crust contact, tilt, individual extension, all hemispheres and airborne retraction');
