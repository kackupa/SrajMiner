import assert from 'node:assert/strict';
import { StudyFleet } from '../src/game/study/StudyFleet';
import { UniformPlanet } from '../src/game/study/UniformPlanet';
import { UniformCombat } from '../src/game/study/UniformCombat';
import { StudyOrdnance } from '../src/game/study/StudyOrdnance';
import { STUDY_WEAPONS as W, UNIFORM_PLANET_STUDY as P } from '../src/game/config';
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
assert.equal(combat.bodies.filter((b) => b.kind === 'nest').length, 5);
assert(combat.bodies.length >= 12);
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
