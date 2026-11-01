import assert from 'node:assert/strict';
import { StudyFleet } from '../src/game/study/StudyFleet';
import { UniformPlanet } from '../src/game/study/UniformPlanet';
import { UniformCombat } from '../src/game/study/UniformCombat';
import { StudyOrdnance } from '../src/game/study/StudyOrdnance';
import { STUDY_WEAPONS as W, UNIFORM_PLANET_STUDY as P, UNIFORM_COMBAT as C } from '../src/game/config';
import { weaponPlates } from '../src/game/study/StudyWeaponArt';
const f = new StudyFleet();
assert.equal(f.primary, 'machine-gun');
assert.equal(f.secondary, 'rocket');
assert(!f.buyWeapon('autocannon'));
assert(!f.equipWeapon('arc'));
assert(!f.buyWeapon('invalid'));
f.loadTestSupplies();
const before = { ...f.storage },
  credits = f.credits,
  w = W.find((w) => w.id === 'autocannon')!;
assert(f.buyWeapon(w.id));
assert.equal(f.credits, credits - w.credits);
assert.equal(f.storage.iron, before.iron - w.iron);
assert.equal(f.primary, w.id);
assert(!f.buyWeapon(w.id));
assert(f.equipWeapon('machine-gun'));
assert(f.equipWeapon(w.id));
assert.equal(f.credits, credits - w.credits);
assert.equal(f.secondary, 'rocket');
assert(f.buyWeapon('grenade'));
assert.equal(f.secondary, 'grenade');
assert.equal(f.primary, 'autocannon');
assert.equal(
  new Set(W.map((w) => JSON.stringify(weaponPlates(w.id)))).size,
  W.length,
  'Every weapon silhouette is distinct',
);
for (const w of W)
  assert(weaponPlates(w.id).every((p) => p.points.every((p) => p.every(Number.isFinite))));
const world = new UniformPlanet(),
  combat = new UniformCombat(world),
  original = world.cells.size;
assert.equal(combat.bodies.filter((b) => b.kind === 'nest').length, 4);
assert(combat.bodies.length >= 10);
for (let i = 0; i < 1200; i++) {
  const target = i < 600 ? { x: 0, y: -760 } : { x: 460, y: -1790 };
  combat.update(world, 1 / 60, target, { x: -440, y: -1710 }, true);
  for (const b of combat.bodies.filter((b) => b.kind !== 'nest' && b.hp > 0)) {
    assert(!world.collides(b, 13), `Enemy ${b.id} clipped terrain`);
    assert(
      b.kind === 'flyer' ? Math.hypot(b.x, b.y) >= P.radius : Math.hypot(b.x, b.y) < P.radius,
      'Region separation',
    );
  }
}
assert.equal(world.cells.size, original, 'Enemies cannot destroy or tunnel through blocks');
const armored = combat.bodies.find((b) => b.kind === 'armored')!,
  hp = armored.hp;
combat.damage(armored, 8, 0.35);
assert.equal(armored.hp, hp - 2.8);
combat.damage(armored, 34, 1);
assert.equal(armored.hp, hp - 36.8);
const nest = combat.bodies.find((b) => b.kind === 'nest')!;
combat.damage(nest, 1000);
const reward = combat.reward;
combat.damage(nest, 1000);
assert.equal(combat.reward, reward, 'One reward per kill');
for (let i = 0; i < 300; i++)
  combat.update(world, 0.05, { x: 0, y: -760 }, { x: -440, y: -1710 }, false);
assert.equal(nest.hp, 0, 'No interval respawns');
const wallA = { x: -200, y: -1000 },
  wallB = { x: 200, y: -1000 };
assert(!combat.sight(world, wallA, wallB), 'Rock blocks attacks');
const ammo = new StudyOrdnance(),
  rocket = W.find((w) => w.id === 'rocket')!;
let impacts = ammo.step(0.05, true, { x: 0, y: -1000 }, { x: 1, y: 0 }, rocket, world, combat);
for (let i = 0; i < 100; i++)
  impacts.push(
    ...ammo.step(0.05, false, { x: 0, y: -1000 }, { x: 1, y: 0 }, rocket, world, combat),
  );
assert.equal(ammo.shots, 1);
assert.equal(impacts.length, 1, 'Rocket swept impact stops at rock');
const grenade = W.find((w) => w.id === 'grenade')!,
  grenades = new StudyOrdnance();
let bursts = grenades.step(0.05, true, { x: 0, y: -760 }, { x: 1, y: 0 }, grenade, world, combat);
for (let i = 0; i < 40; i++)
  bursts.push(
    ...grenades.step(0.05, false, { x: 0, y: -760 }, { x: 1, y: 0 }, grenade, world, combat),
  );
assert.equal(bursts.length, 1, 'Grenade bounces and detonates once');
assert.equal(grenades.bullets.length, 0);
const missile = W.find((w) => w.id === 'missile')!,
  homing = new StudyOrdnance(),
  flyer = combat.bodies.find((b) => b.kind === 'flyer')!;
flyer.hp = 48;
flyer.x = 400;
flyer.y = -1860;
homing.step(0.01, true, { x: 0, y: -1860 }, { x: 1, y: 0 }, missile, world, combat);
assert.equal(homing.bullets[0].target, flyer.id);
flyer.y -= 70;
for (let i = 0; i < 8; i++)
  homing.step(0.02, false, { x: 0, y: -1860 }, { x: 1, y: 0 }, missile, world, combat);
assert(homing.bullets[0].vy < 0, 'Hunter steers towards flyer');
combat.hull = 40;
combat.grace = 0;
combat.update(world, 0.05, { x: -440, y: -1710 }, { x: -440, y: -1710 }, true);
assert(combat.hull > 40, 'Ship repairs hull');
console.log(
  'PASS loadout ownership, exact costs, slot independence, silhouettes, terrain collision, region separation, armour, rewards, no respawns, cover, rockets, grenade fuse, missile guidance, repair',
);
const chainWorld=new UniformPlanet(),chain=new UniformCombat(chainWorld),arc=W.find(w=>w.id==='arc')!;
const victims=chain.bodies.filter(b=>b.kind==='crawler'||b.kind==='armored').slice(0,3);
for(let i=0;i<victims.length;i++){victims[i].x=80+i*55;victims[i].y=-1320;victims[i].hp=90;}
assert(chain.impact(chainWorld,{x:80,y:-1320},arc));assert(victims.every(b=>b.hp<90),'Arc chains through open cave');assert.equal(chain.beams.length,2);
const defence=new UniformCombat(new UniformPlanet()),intruder=defence.bodies.find(b=>b.kind==='flyer')!;
intruder.x=100;intruder.y=-1840;defence.update(new UniformPlanet(),.05,{x:0,y:-1780},{x:0,y:-1768},true);
assert(defence.shipShot,'Ship records a turret shot at the visible attacker');assert(intruder.hp<intruder.maxHp);
console.log('PASS arc chain and mothership turret defence');

// No authored residents, pursuit, or projectiles in the core sanctuary.
for(const relief of [false,true]){
  const w=new UniformPlanet(relief), c=new UniformCombat(w);
  assert(c.bodies.every(b=>Math.hypot(b.x,b.y)>C.coreExclusionRadius+ C.enemyRadius));
  const guard=c.bodies.find(b=>b.kind==='crawler')!;
  Object.assign(guard,{x:0,y:-420,home:{x:0,y:-420}});
  c.hull=65;
  for(let i=0;i<900;i++)c.update(w,1/60,{x:0,y:-90},{x:0,y:-1800},false);
  assert(Math.hypot(guard.x,guard.y)>=C.coreExclusionRadius+C.enemyRadius,'Gravity and pursuit cannot enter core');
  assert.equal(c.hull,65,'Core is safe but does not provide free repairs');
  c.shots.push({x:0,y:-401,vx:0,vy:220,life:3});
  c.update(w,.05,{x:0,y:-90},{x:0,y:-1800},false);
  assert.equal(c.shots.length,0,'Hostile shots stop at core boundary');
}
console.log('PASS core exclusion for spawn, movement, attacks and projectiles');

// Forge VLS captures the launch aim, clears the backpack, then turns without retargeting.
for(const fps of [30,60,120]){
 const sky=new UniformPlanet(),targets=new UniformCombat(sky);targets.bodies=[];
 const vls=new StudyOrdnance(),aim={x:350,y:-2400},source={x:0,y:-2400};
 const spec=W.find(w=>w.id==='rocket')!;
 vls.step(1/fps,true,source,{x:1,y:0},spec,sky,targets,source,{up:{x:0,y:-1},target:aim});
 assert.equal(vls.bullets[0].vx,0,'Missile initially leaves vertically');
 assert(vls.bullets[0].vy<0);aim.x=-350;
 assert.equal(vls.bullets[0].aimPoint!.x,350,'Launch aim is copied, not a live cursor reference');
 let impacts:ReturnType<StudyOrdnance['step']>=[];
 for(let frame=0;frame<fps*4;frame++)impacts.push(...vls.step(1/fps,false,source,{x:-1,y:0},spec,sky,targets));
 assert.equal(impacts.length,1,'Turns and reaches original cursor point');
 assert(Math.hypot(impacts[0].point.x-350,impacts[0].point.y+2400)<C.backpackTargetRadius+1);
 assert.equal(vls.shots,1);
 const ceiling=Object.assign(new UniformPlanet(),{solidAt:(p:{x:number;y:number})=>p.y<=-2415});
 const blocked=new StudyOrdnance();
 let collisions=blocked.step(.05,true,source,{x:1,y:0},spec,ceiling,targets,source,{up:{x:0,y:-1},target:{x:350,y:-2400}});
 collisions.push(...blocked.step(.05,false,source,{x:1,y:0},spec,ceiling,targets));
 assert.equal(collisions.length,1,'Vertical launch still collides with a low cave ceiling');
 assert.equal(blocked.bullets.length,0);
}
console.log('PASS backpack vertical clearance, captured cursor guidance, frame rates and ceiling collision');


// Aboard: no autonomous fire; cursor-controlled shots work without a creature lock.
for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 const w=new UniformPlanet(),c=new UniformCombat(w),b=c.bodies.find(b=>b.kind==='flyer')!;
 const ship={x:Math.sin(angle)*2400,y:-Math.cos(angle)*2400};
 const mount=c.shipMount(ship,0),tangent={x:Math.cos(angle),y:Math.sin(angle)};
 Object.assign(b,{x:mount.x+tangent.x*500,y:mount.y+tangent.y*500,hp:100,maxHp:100});b.home={x:b.x,y:b.y};c.bodies=[b];
 c.update(w,.01,ship,ship,false,true);assert.equal(c.shipShots,0,'No auto-fire aboard');
 const controls={aim:{x:b.x,y:b.y},fire:false};
 c.update(w,.01,ship,ship,false,true,0,controls);assert(c.shipTarget);assert.equal(c.shipShots,0);
 controls.fire=true;c.update(w,.01,ship,ship,false,true,0,controls);assert.equal(c.shipShots,1);assert.equal(b.hp,82);
 c.update(w,.01,ship,ship,false,true,0,controls);assert.equal(c.shipShots,1,'Cooldown');
 c.bodies=[];for(let i=0;i<40;i++)c.update(w,.01,ship,ship,false,true,0,controls);
 assert.equal(c.shipShots,2,'Can fire into empty space');assert.equal(c.shipShot!.turret,1);
 controls.fire=false;for(let i=0;i<80;i++)c.update(w,.01,ship,ship,true,true,0,controls);
 assert.equal(c.shipShots,2,'Release stops firing even when landed aboard');
}
{
 const w=new UniformPlanet(),c=new UniformCombat(w),b=c.bodies.find(b=>b.kind==='flyer')!;
 const ship={x:0,y:-2400};Object.assign(b,{x:500,y:-2550,home:{x:500,y:-2550}});c.bodies=[b];
 w.solidAt=p=>p.x>200&&p.x<300;
 c.update(w,.05,ship,ship,false,true,0,{aim:b,fire:true});assert.equal(b.hp,b.maxHp,'Rock stops cannon damage');
 assert(c.shipShot!.target.x<=202,'Tracer stops at rock');
}
console.log('PASS manual mothership aim, no autonomous pilot fire, empty-space shots, alternating barrels, cooldown, release and cover');
