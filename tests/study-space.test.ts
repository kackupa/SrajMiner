import assert from 'node:assert/strict';
import { StudyPilot,shipDeckPoint } from '../src/game/study/StudyPilot';
import { UniformPlanet } from '../src/game/study/UniformPlanet';
import { PILOT_STUDY as C } from '../src/game/config';
import { spaceMap,SpaceCache } from '../src/game/study/StudySpace';

for(const fps of [30,60,120]){
 const world=new UniformPlanet(true),ship=new StudyPilot({x:0,y:-3000});ship.grounded=false;
 const before=world.excavated.size;
 for(let i=0;i<fps*3;i++)ship.step(world,1,0,1/fps,()=>false);
 assert(ship.inSpace);assert.equal(ship.frameAngle,0);
 assert(Math.abs(ship.position.y+3000)<1e-8,'Space strafe is a straight line, not a planetary orbit');
 assert(ship.position.x>2000);
 for(let i=0;i<fps*3;i++)ship.step(world,0,0,1/fps,()=>false);
 const stopped={...ship.position};ship.step(world,0,0,.05,()=>false);assert.deepEqual(ship.position,stopped,'Release brakes to a stable stop');
 assert.equal(world.excavated.size,before);
 const down=new StudyPilot({x:0,y:-3000});down.grounded=false;
 for(let i=0;i<fps*12&&!down.grounded;i++)down.step(world,0,-1,1/fps,()=>true);
 assert(down.grounded&&!down.inSpace,'Can return from space and land without collision');
 assert(!world.solidAt(down.position));
 const approach=new StudyPilot({x:300,y:-4000});approach.grounded=false;approach.step(world,1,1,.05,()=>true);
 approach.rebase({x:-100,y:5000});assert(!approach.inSpace);assert.equal(approach.riseSpeed,0);assert.equal(approach.sideSpeed,0,'Arrival brakes before descent');
}
const ship={x:900,y:-3000},mount=shipDeckPoint(ship,90,-150,0,0,0);
assert(Math.abs(mount.x-990)<1e-8,'Deck mount keeps the spaceflight frame');
const chart=spaceMap({x:15000,y:-23000},1);
assert(chart.includes('Cryo Shelf')&&chart.includes('Ember Reach')&&!chart.includes('NaN'));
console.log('PASS free-space Cartesian flight, fixed flight frame, braking, atmospheric return, arrival brake, deck attachment and sector chart');

const cache=new SpaceCache();assert.equal(cache.take({x:0,y:0}),undefined);
assert.deepEqual(cache.take(C.spaceCache),{copper:12,iron:8,silver:2,kredits:60});
assert.equal(cache.take(C.spaceCache),undefined,'Repeated input and return visits cannot duplicate cargo');
assert(!cache.near(C.spaceCache),'Recovered cache signal disappears');
console.log('PASS drifting cache range and one-time recovery');
