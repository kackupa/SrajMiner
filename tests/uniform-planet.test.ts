import assert from 'node:assert/strict';
import { UNIFORM_PLANET_STUDY as C } from '../src/game/config';
import { UniformPlanet, UniformMiner, cellPolygon } from '../src/game/study/UniformPlanet';

const world = new UniformPlanet();
// Actual excavatable cells, not a visual grid placed over shrinking wedges.
for (const [x, y] of [[5, -40], [5, -22], [5, -4], [-5, 4], [-5, 38]]) {
  const points = cellPolygon(x, y);
  assert.equal(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), C.tile);
  assert.equal(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)), C.tile);
  assert.equal(Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0)) / 2, C.tile ** 2);
}
for (const cell of world.cells.values()) for (const p of cell.polygon) assert(Math.hypot(p.x, p.y) <= C.radius + .001, 'Boundary remains circular');
assert(world.cells.size > 5000, 'A whole round planet, not only the visible surface strip');
for (const station of C.stations) assert(!world.collides(station), `Safe ${station.name} spawn`);

// Return physically from the core to the surface through the test shaft.
const miner = new UniformMiner();
miner.teleport(C.stations[2]);
for (let i = 0; i < 1200; i++) { miner.step(world, 0, true, 1 / 120); assert(!world.collides(miner), 'No penetration during return'); }
assert(miner.y < -C.radius - 20, 'Can return home without a teleport');

// Fast falling must stop at real rock. Substeps are mandatory at low frame rates.
miner.teleport({ x: 300, y: -C.radius - 200 });
for (let i = 0; i < 200; i++) { miner.step(world, 0, false, .1); assert(!world.collides(miner), 'No high-speed tunnelling'); }
assert(miner.grounded);
assert(miner.y < -C.radius + 100);

// Cardinal and far-hemisphere gravity, without the old polar seam.
for (const point of [{ x: 0, y: C.radius + 100 }, { x: C.radius + 100, y: 0 }, { x: -C.radius - 100, y: 0 }]) {
  miner.teleport(point);
  for (let i = 0; i < 300; i++) { miner.step(world, 0, false, 1 / 120); assert(!world.collides(miner)); }
  assert(Math.abs(Math.hypot(miner.x, miner.y) - C.radius - C.bodyRadius) < 3);
  const before = Math.hypot(miner.x, miner.y);
  for (let i = 0; i < 180; i++) miner.step(world, 0, true, 1 / 120);
  assert(Math.hypot(miner.x, miner.y) > before + 100, 'W always flies outward');
}

// Ray selects nearest visible face; removing the same cell twice yields once.
const origin = { x: 0, y: -600 };
const first = world.ray(origin, { x: 1, y: 0 });
assert(first);
assert.equal(first.x, 1);
assert(world.remove(first));
assert(!world.remove(first));
assert.equal(world.excavated.size, 1);
assert.equal(world.ray(origin, { x: 1, y: 0 })?.x, 2);
const untouched = new UniformPlanet();
assert(untouched.get(first.x, first.y), 'New test world resets, campaign state is not an input');
// Dig at a slight radial angle, where a single centre ray used to leave a lip.
const digging = new UniformPlanet(), rig = new UniformMiner();
for (let i = 0; i < 600; i++) {
  if (i % 38 === 0) {
    const out = rig.basis().out;
    for (const cell of digging.drillFace(rig, { x: -out.x, y: -out.y })) digging.remove(cell);
  }
  rig.step(digging, 0, false, 1 / 120);
  assert(!digging.collides(rig));
}
assert(Math.hypot(rig.x, rig.y) < C.radius - 260, 'Rig-width drilling must let the miner descend');
for (let i = 0; i < 600; i++) rig.step(digging, 0, true, 1 / 120);
assert(Math.hypot(rig.x, rig.y) > C.radius, 'Can fly out of its own excavated tunnel');
// Walking over clipped cell joins must follow the round crust without little hops.
for (const direction of [-1, 1]) {
  const walking = new UniformMiner(), surface = new UniformPlanet();
  walking.teleport({ x: direction * 300, y: -1800 });
  for (let i = 0; i < 240; i++) walking.step(surface, 0, false, 1 / 120);
  let previousRadius = Math.hypot(walking.x, walking.y);
  for (let i = 0; i < 1200; i++) {
    walking.step(surface, direction, false, 1 / 120);
    const radius = Math.hypot(walking.x, walking.y);
    assert(Math.abs(radius - previousRadius) < .03, 'No two-pixel step bumps at cell joins');
    assert(walking.grounded, 'Surface joins must not retrigger a landing');
    assert(!surface.collides(walking), 'Smooth movement must stay outside solid terrain');
    previousRadius = radius;
  }
  assert.equal(surface.excavated.size, 0, 'Walking does not alter terrain');
}
// Contact adhesion must release over an open shaft, and W must leave the ground.
const edgeWorld = new UniformPlanet(), edgeWalker = new UniformMiner();
edgeWalker.teleport({ x: 80, y: -1800 });
for (let i = 0; i < 180; i++) edgeWalker.step(edgeWorld, 0, false, 1 / 120);
for (let i = 0; i < 50; i++) edgeWalker.step(edgeWorld, -1, false, 1 / 120);
for (let i = 0; i < 120; i++) edgeWalker.step(edgeWorld, 0, false, 1 / 120);
assert(edgeWalker.y > -C.radius + 70, 'Open cave entrances are not bridged by adhesion');
// The core is a stable landing body, even after extracting all of its fuel.
const coreWorld = new UniformPlanet(), coreMiner = new UniformMiner();
coreMiner.teleport(C.stations[2]);
for (let i = 0; i < 360; i++) { coreMiner.step(coreWorld, 0, false, 1 / 120); assert(!coreWorld.collides(coreMiner)); }
assert(coreMiner.grounded);
assert(Math.abs(Math.hypot(coreMiner.x, coreMiner.y) - C.coreSurfaceRadius - C.bodyRadius) < .03);
assert(coreMiner.y < 0, 'Landing must not cross centre or flip the miner to the other side');
assert(coreWorld.coreHit(coreMiner, { x: 0, y: 1 }));
assert.equal(coreWorld.coreHit(coreMiner, { x: 0, y: -1 }), undefined, 'Cannot mine while aiming away');
assert.equal(coreWorld.coreHit({ x: 0, y: -300 }, { x: 0, y: 1 }), undefined, 'Core must be within drill reach');
assert(coreWorld.solidAt({ x: 0, y: 0 }), 'The searchlight must see a solid core');
let fuel = 0;
for (let unit = 0; unit < C.coreFuelPerCycle; unit++) {
  for (let i = 0; i < 50; i++) fuel += coreWorld.core.mine(.05, true);
  assert.equal(fuel, unit + 1, 'One reward per completed extraction');
}
assert.equal(coreWorld.core.remaining, 0);
for (let i = 0; i < 120; i++) { coreMiner.step(coreWorld, 0, false, 1 / 120); assert(coreMiner.grounded); }
assert(coreMiner.y < 0, 'Depletion must not eject the miner or remove its footing');
for (let i = 0; i < 200; i++) fuel += coreWorld.core.mine(3600, true);
assert.equal(fuel, C.coreFuelPerCycle, 'Holding drill on an empty deposit cannot duplicate fuel');
assert.equal(coreWorld.core.remaining, 0, 'Waiting cannot replenish a deposit during this visit');
coreWorld.core.beginVisit();
assert.equal(coreWorld.core.remaining, C.coreFuelPerCycle);
assert.equal(fuel, C.coreFuelPerCycle, 'Returning restores the deposit, not the wallet');
coreWorld.core.beginVisit();
assert.equal(coreWorld.core.remaining, C.coreFuelPerCycle, 'Repeated visits do not stack refills');
coreWorld.core.mine(3600, true);
assert(coreWorld.core.extraction <= .1, 'Background time cannot grant unattended fuel');
coreWorld.core.mine(.05, false);
assert.equal(coreWorld.core.extraction, 0, 'Releasing the drill stops extraction');
for (let i = 0; i < 1200; i++) {
  coreMiner.step(coreWorld, 1, false, 1 / 120);
  assert(coreMiner.grounded && !coreWorld.collides(coreMiner), 'Can walk around the solid core');
}
for (let i = 0; i < 240; i++) coreMiner.step(coreWorld, 0, true, 1 / 120);
assert(Math.hypot(coreMiner.x, coreMiner.y) > C.coreSurfaceRadius + C.bodyRadius + 20, 'Can lift off voluntarily');
console.log('Uniform round planet: fixed cell dimensions, clipped surface, radial gravity, return route, collision and single excavation passed.');

// Reproduce small roof lips on all four sides of the round planet.
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const startX of [-10,50])for(const dt of [1/60,.1]){
 const rotate=(x:number,y:number)=>({x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)});
 const cornerWorld=new UniformPlanet();cornerWorld.cells.clear();
 const centre=rotate(20,-380),x=Math.floor((centre.x+.001)/40),y=Math.floor((centre.y+.001)/40);
 cornerWorld.cells.set(`${x},${y}`,{x,y,material:'rock',polygon:cellPolygon(x,y)});
 const flyer=new UniformMiner();flyer.teleport(rotate(startX,-340));flyer.fallSpeed=-C.flightSpeed;
 const before=cornerWorld.cells.size;
 for(let i=0;i<Math.ceil(1.2/dt);i++){
  flyer.step(cornerWorld,0,true,dt);
  assert(!cornerWorld.collides(flyer),'Corner assistance sweeps the full hull without penetration');
 }
 const localY=-flyer.x*Math.sin(angle)+flyer.y*Math.cos(angle);
 assert(localY<-420,'Holding thrust alone clears a small roof lip');
 assert(flyer.thrustAssists>0,'Fixture actually exercises the corner assist');
 assert.equal(cornerWorld.cells.size,before,'Assistance never mines terrain');
 assert.equal(cornerWorld.excavated.size,0);
}
const roofWorld=new UniformPlanet();roofWorld.cells.clear();
for(let x=-5;x<=5;x++)roofWorld.cells.set(`${x},-10`,{x,y:-10,material:'rock',polygon:cellPolygon(x,-10)});
const blockedFlyer=new UniformMiner();blockedFlyer.teleport({x:20,y:-340});
for(let i=0;i<120;i++){blockedFlyer.step(roofWorld,0,true,.1);assert(!roofWorld.collides(blockedFlyer));}
assert(blockedFlyer.y>-345,'A broad ceiling remains impassable');
assert.equal(blockedFlyer.thrustAssists,0,'No sideways crawling under an unbroken ceiling');
const falling=new UniformMiner();falling.teleport({x:20,y:-500});
for(let i=0;i<100;i++){falling.step(roofWorld,0,false,.1);assert(!roofWorld.collides(falling));}
assert.equal(falling.thrustAssists,0,'Falling does not invoke upward corner assistance');
console.log('PASS thrust corner clearance: both sides, every hemisphere, low frame rates, solid ceilings and terrain preservation');

// Real angled drilling leaves a stepped shaft. A slight sideways move at its
// bottom must not strand the rig under the next lip when only W is held.
const shaftWorld=new UniformPlanet(),shaftMiner=new UniformMiner();
shaftMiner.teleport({x:-357,y:-1740});let drillingTime=0;
for(let i=0;i<2400&&C.radius-Math.hypot(shaftMiner.x,shaftMiner.y)<270;i++){
 drillingTime+=1/120;
 if(drillingTime>=C.drillSeconds){const out=shaftMiner.basis().out;for(const cell of shaftWorld.drillFace(shaftMiner,{x:-out.x,y:-out.y}))shaftWorld.remove(cell);drillingTime=0;}
 shaftMiner.step(shaftWorld,0,false,1/120);
}
for(let i=0;i<17;i++)shaftMiner.step(shaftWorld,1,false,1/120);
const shaftCells=shaftWorld.cells.size;
for(let i=0;i<600&&Math.hypot(shaftMiner.x,shaftMiner.y)<C.radius+20;i++){
 const before={x:shaftMiner.x,y:shaftMiner.y};
 shaftMiner.step(shaftWorld,0,true,1/120);
 assert(!shaftWorld.collides(shaftMiner));
 assert(Math.hypot(shaftMiner.x-before.x,shaftMiner.y-before.y)<3,'Corner correction is gradual, never a sideways teleport');
}
assert(Math.hypot(shaftMiner.x,shaftMiner.y)>C.radius,'W returns from a naturally excavated stepped shaft');
assert(shaftMiner.thrustAssists>0);
assert.equal(shaftWorld.cells.size,shaftCells);
console.log('PASS gradual clearance and physical return from an angled mined shaft');
