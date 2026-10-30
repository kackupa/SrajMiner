import assert from 'node:assert/strict';
import { UniformPlanet, UniformMiner } from '../src/game/study/UniformPlanet';
import { UniformCombat } from '../src/game/study/UniformCombat';
import { caveRoute, clearCreaturePath } from '../src/game/study/CaveRoutes';
import { StudyFleet } from '../src/game/study/StudyFleet';
import { SURFACE_EXPEDITION as E, UNIFORM_COMBAT as C, UNIFORM_PLANET_STUDY as P } from '../src/game/config';

const world=new UniformPlanet(true),combat=new UniformCombat(world),fleet=new StudyFleet(world);
assert(world.surfaceRadius(E.mountain)-world.surfaceRadius(E.crater)>250,'mountain and crater are physical relief');
assert(Math.abs(world.surfaceRadius(fleet.angle)-P.radius)<1,'starter apron remains intact');
for(const angle of [-2,-1,.05,.65,1.7,2.3]){
 const rig=new UniformMiner();rig.teleport(world.surfacePoint(angle,70));
 for(let i=0;i<120;i++){rig.step(world,0,false,1/60,true);assert(!world.collides(rig));}
 assert(rig.grounded);assert(Math.abs(Math.hypot(rig.x,rig.y)-world.surfaceRadiusAt(rig)-P.bodyRadius)<12,'land on actual relief');
}
assert(!world.collides({x:460,y:-1610},16),'wreck-side cave mouth fits the miner');
assert(world.solidAt(world.surfacePoint(E.wreckAngle,-12)),'wreck sits on real solid ground');
const shelf=world.at(world.surfacePoint(E.wreckAngle,-12))!,visited=new Set<string>(),queue=[shelf];let connected=false;
for(let i=0;i<queue.length;i++){
 const cell=queue[i],point={x:(cell.x+.5)*P.tile,y:(cell.y+.5)*P.tile};
 if(world.surfaceRadiusAt(point)-Math.hypot(point.x,point.y)>240){connected=true;break;}
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=world.get(cell.x+dx,cell.y+dy),key=`${cell.x+dx},${cell.y+dy}`;if(n&&!visited.has(key)){visited.add(key);queue.push(n);}}
}
assert(connected,'wreck shelf connects to the planetary rock, not a floating island');
assert(fleet.landing(world,fleet.angle),'starter mothership footprint supported');
assert(!fleet.landing(world,.56),'steep mountainside is not a landing pad');
const ship=combat.bodies.find(b=>b.gunship)!;
assert.equal(combat.bodies.filter(b=>b.kind==='flyer').length,1,'one authored hostile spacecraft');
const phases=new Set<string>(),miner=world.surfacePoint(E.crater,22),before={...ship};let sawShot=false,travel=0,last={...ship};
for(let i=0;i<1000;i++){
 combat.update(world,1/60,miner,fleet.position,true);phases.add(ship.phase);sawShot ||= combat.shots.some(s=>s.gunship);
 travel+=Math.hypot(ship.x-last.x,ship.y-last.y);last={...ship};
 for(const b of combat.bodies.filter(b=>b.kind!=='nest'))assert(!world.collides(b,b.gunship?E.gunshipRadius:C.enemyRadius),`body ${b.id} penetrated terrain`);
}
assert.deepEqual([...phases].sort(),['attack','idle','recover','windup']);assert(sawShot&&travel>1000,'ship makes moving firing passes');
assert(Math.hypot(ship.x-before.x,ship.y-before.y)>25);
// Aim is committed before the pass; the miner can dodge away from the marked point.
const dodge=new UniformCombat(world),gun=dodge.bodies.find(b=>b.gunship)!;
dodge.update(world,.05,miner,fleet.position,true);assert.equal(gun.phase,'windup');const locked={...gun.aim!};
for(let i=0;i<25;i++)dodge.update(world,.05,{x:miner.x+45,y:miner.y},fleet.position,true);
assert.deepEqual(gun.aim,locked);assert.equal(gun.phase,'attack');
// Cover cancels the next pass; ship cannot enter a cave to chase the miner.
for(let i=0;i<160;i++)dodge.update(world,.05,{x:500,y:-1490},fleet.position,true);
assert.notEqual(gun.phase,'attack');assert.equal(dodge.shots.length,0);

const caves=new UniformCombat(world),guard=caves.bodies.find(b=>b.site===5)!,target={x:430,y:-1460};
const route=caveRoute(world,guard,target);assert(route.length>3);
let previous={x:guard.x,y:guard.y};for(const p of route){assert(clearCreaturePath(world,previous,p));previous=p;}
const startingDistance=Math.hypot(guard.x-target.x,guard.y-target.y);let closest=startingDistance;
for(let i=0;i<1200;i++){caves.update(world,1/60,target,fleet.position,true);closest=Math.min(closest,Math.hypot(guard.x-target.x,guard.y-target.y));assert(!world.collides(guard,C.enemyRadius));}
assert(closest<C.contactRange,'creature navigates and vaults to its target, not just pushes a wall');
assert(caves.hull<100,'creature reaches attack range');
world.blast({x:470,y:-1400},55);caves.update(world,.05,target,fleet.position,true);
assert.equal(guard.routeRevision,world.revision,'excavation invalidates cached route');
console.log('PASS expedition: solid relief/landing pads, cave entrance, gunship patrol/telegraph/pass/turn, dodge and cover, cave routing/vaults, terrain invalidation and full-body collision');
