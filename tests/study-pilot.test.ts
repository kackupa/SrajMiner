import assert from 'node:assert/strict';
import { StudyPilot, shipLocalPoint, shipDeckPoint } from '../src/game/study/StudyPilot';
import { StudyFleet } from '../src/game/study/StudyFleet';
import { UniformPlanet } from '../src/game/study/UniformPlanet';
import { PILOT_STUDY as P } from '../src/game/config';
import { studyMap } from '../src/game/study/StudyMap';
for (const fps of [30, 60, 120]) {
  const world = new UniformPlanet(true),
    fleet = new StudyFleet(world),
    ship = new StudyPilot(fleet.position),
    initial = { ...ship.position };
  const landing = (a: number) => fleet.landing(world, a),
    before = world.cells.size;
  for (let i = 0; i < fps * 4; i++) ship.step(world, 0, 1, 1 / fps, landing);
  assert(ship.altitude(world) > 650, 'Ship can climb through miner wind into orbit');
  for (let i = 0; i < fps * 2; i++) ship.step(world, 0, 0, 1 / fps, landing);
  const stopped = { ...ship.position };
  ship.step(world, 0, 0, 0.1, landing);
  assert.deepEqual(ship.position, stopped, 'Hover settles without gravity or wind drift');
  assert(!ship.requestLanding(world, landing), 'Cannot land from orbit');
  for (let i = 0; i < fps * 10 && !ship.grounded; i++) ship.step(world, 0, -1, 1 / fps, landing);
  assert(ship.grounded, 'Can return to starting ground');
  assert(Math.hypot(ship.position.x - initial.x, ship.position.y - initial.y) < 0.1);
  for (let i = 0; i < fps; i++) ship.step(world, 0, 1, 1 / fps, landing);
  for (let i = 0; i < fps * 30; i++) {
    ship.step(world, 1, 0, 1 / fps, landing);
    assert(
      !world.solidAt(ship.position),
      'Flying across hills does not put ship centre inside crust',
    );
  }
  assert.equal(world.cells.size, before, 'Flight and landing never pave terrain or fill tunnels');
  assert.equal(world.excavated.size, 0);
}
const w = new UniformPlanet(true),
  ship = new StudyPilot({ x: 0, y: -2400 }),
  fleet = new StudyFleet(w);
ship.grounded = false;
ship.rebase({ x: -100, y: 60 });
assert.deepEqual(ship.position, { x: -100, y: -2340 });
assert.equal(ship.sideSpeed, 0);
const svg = studyMap(w, { x: 0, y: -100 }, { x: 200, y: -1760 }, false);
assert(svg.includes('Your position') || svg.includes('your position'));
assert(!svg.includes('copper'));
const original = new UniformPlanet(true),
  other = new UniformPlanet(true, 1),
  cell = [...original.cells.values()][100];
original.remove(cell);
assert.equal(original.excavated.size, 1);
assert.equal(other.excavated.size, 0, 'Worlds do not share terrain mutations');
assert(
  [...original.cells.values()].some((c) => other.get(c.x, c.y)?.material !== c.material),
  'Second test world has its own ore pattern',
);
console.log(
  'PASS piloted takeoff, wind independence, hover, return, terrain clearance, no terrain mutation, rebase and isolated worlds',
);
const standard=new StudyPilot({x:0,y:-3000}),upgraded=new StudyPilot({x:0,y:-3000});standard.grounded=upgraded.grounded=false;
for(let i=0;i<180;i++){standard.step(w,0,1,1/60,()=>false);upgraded.step(w,0,1,1/60,()=>false,P.thrusterBoost);}
assert(Math.abs(upgraded.riseSpeed/standard.riseSpeed-P.thrusterBoost)<1e-8,'Thruster purchase changes manual cruise speed');
console.log('PASS vector thruster upgrade affects piloted cruise');

for(const fps of [30,60,120]){
 const world=new UniformPlanet(true),ship=new StudyPilot({x:0,y:-2600}),plain=new StudyPilot({x:0,y:-2600});
 assert(!ship.boost(),'No boost while landed');ship.grounded=plain.grounded=false;
 assert(ship.boost());assert(!ship.boost(),'Cannot stack boost');
 for(let i=0;i<fps;i++){ship.step(world,1,0,1/fps,()=>false);plain.step(world,1,0,1/fps,()=>false);}
 assert(ship.sideSpeed>plain.sideSpeed*1.3,'Burst produces real additional thrust');
 assert(ship.bank>0&&ship.bank<=P.bankLimit,'Hull banks within a small safe limit');
 assert(ship.gear>.98,'Landing gear retracts progressively');
 for(let i=0;i<fps*7;i++)ship.step(world,0,0,1/fps,()=>false);
 assert.equal(ship.boostRemaining,0);assert.equal(ship.boostCooldown,0);assert.equal(ship.sideSpeed,0);
 assert(Math.abs(ship.bank)<.001,'Hull settles level while hovering');assert(ship.boost(),'Boost becomes reusable');
 for(let i=0;i<fps*3;i++){ship.step(world,-1,-1,1/fps,()=>false);assert(!world.solidAt(ship.position),'Boost descent does not cross crust');}
}
console.log('PASS timed boost, cooldown, hover braking, bank, retracting gear and boosted terrain clearance');

for(const fps of [30,60,120]){
 const world=new UniformPlanet(true),p=new StudyPilot({x:0,y:-2600});p.grounded=false;
 p.step(world,-1,0,1/fps,()=>false);assert(p.yaw>0&&p.yaw<Math.PI,'Turning starts progressively');
 for(let i=0;i<fps*2;i++)p.step(world,-1,0,1/fps,()=>false);
 assert.equal(p.yaw,Math.PI);assert(p.thrust>.9,'Main engine drives towards the new facing');
 for(let i=0;i<fps*2;i++)p.step(world,1,0,1/fps,()=>false);
 assert.equal(p.yaw,0,'Turn back right');
}
const front=shipLocalPoint(100,-50,0,0,0),back=shipLocalPoint(100,-50,0,0,Math.PI);
assert(front.x>0&&back.x<0,'Bow changes side');
const edgeFront=shipLocalPoint(100,-50,0,0,Math.PI/2),edgeBack=shipLocalPoint(100,-50,-72,0,Math.PI/2);
assert(Math.abs(edgeFront.x-edgeBack.x)>70,'Mid-turn hull retains physical depth');
const mount=shipDeckPoint({x:0,y:-2400},90,-148.5,.12,Math.PI),local=shipLocalPoint(60,-99,0,.12,Math.PI);
assert(Math.abs(mount.x-local.x*1.5)<1e-8&&Math.abs(mount.y-(-2400+local.y*1.5))<1e-8,'Weapon mounts share the hull projection');
console.log('PASS smooth facing changes, directional thrust, broad mid-turn hull and aligned deck mounts');
