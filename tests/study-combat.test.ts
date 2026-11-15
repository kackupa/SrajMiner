import assert from 'node:assert/strict';
import { StudyAdventure } from '../src/game/study/StudyAdventure';
import { stepStudyCrawler } from '../src/game/study/StudyCreatureMotion';
import type { RockSwimmerState } from '../src/game/world/RockSwimmer';
import { prepareStudy } from '../src/game/study/VisualStudyArt';
import { turretProjection } from '../src/game/study/StudyTurret';
import { surveyProjection } from '../src/game/study/StudySurvey';
import { TileWorld } from '../src/game/world/TileWorld';
import { caveClear, caveHome, caveStep, caveMove } from '../src/game/world/CaveHabitat';
import { RockSwimmer } from '../src/game/world/RockSwimmer';
import { Progress } from '../src/game/economy/Progress';
import { restoreMapState } from '../src/game/campaign/MapState';
import { STARTER_PLANET_CHART, WORLD } from '../src/game/config';
const world = restoreMapState(undefined,'cryo-shelf',271026,STARTER_PLANET_CHART).world;
world.miningOnly=true;
prepareStudy(world);
const adventure = new StudyAdventure();
adventure.prepare(world);
for(const site of adventure.sites)assert(world.solid(site.x-2,site.y+4),'salvage props sit on solid cave floors, not old starter quest voids');
let from = { x: 27.5 * 40, y: 8.5 * 40 };
for (const home of world.studyHabitats!) {
  assert(caveClear(world, home.x, home.y), 'each home has physical clearance');
  assert.equal(
    caveHome(world, Math.floor(home.x / 40 / 12), Math.floor(home.y / 40 / 8))?.id,
    home.id,
  );
  assert(caveStep(world, from, home), 'every site is connected to the preceding cave');
  assert(caveStep(world, home, from), 'return path remains open');
  const creature = new RockSwimmer(271026, 'cryo-shelf', world);
  creature.update(0.016, 100, home.x, home.y);
  assert.equal(creature.active?.kind, home.kind, 'each encounter has its intended creature');
  const body = { ...home, vx: 1e5, vy: 0 };
  caveMove(world, body, world.widthTiles * 40 - 20, body.y);
  assert(caveClear(world, body.x, body.y), 'fast movement cannot cross solid terrain');
  from = home;
}
const site = adventure.sites[0],
  at = { x: (site.x - 1.5) * 40, y: (site.y + 2.5) * 40 },
  p = new Progress();
adventure.update(world, at, p, () => {});
assert.equal(p.count, 0, 'guard protects salvage');
world.clearedCaves.add(site.id);
p.hull=20;p.fuel=20;
p.cargo.copper = p.max('cargo') - 2;
adventure.update(world, at, p, () => {});
assert.equal(p.cargo.iron, 2);
assert.equal(p.hull,40);assert.equal(p.fuel,45,'cache restores a small amount of charge');
assert.equal(site.remaining, 4, 'excess stays in cache');
adventure.update(world, at, p, () => {});
assert.equal(site.remaining, 4, 'full cargo does not delete reward');
p.cargo.copper = 0;
adventure.update(world, at, p, () => {});
assert.equal(p.cargo.iron, 6);
assert.equal(site.remaining, 0);
adventure.update(world, at, p, () => {});
assert.equal(p.cargo.iron, 6, 'no duplicate salvage');
assert.equal(p.hull,40);assert.equal(p.fuel,45,'supplies cannot be claimed again with remaining ore');
for (const [w, h] of [
  [1440, 900],
  [390, 844],
  [844, 390],
]) {
  const m = surveyProjection(world, w, h);
  assert(m.center.x - m.radius >= 0 && m.center.x + m.radius <= w);
  assert(
    m.center.y - m.radius > 80 && m.center.y + m.radius < h - 45,
    'globe fits without scrolling',
  );
  const core = m.point(WORLD.tile * 20, WORLD.tile * STARTER_PLANET_CHART.radiusRows);
  assert(Math.hypot(core.x - m.center.x, core.y - m.center.y) < 1e-8);
}
const projected = [];
for (let a = 0; a <= Math.PI; a += 0.03) {
  const q = turretProjection({ x: 0, y: 0 }, 0, a, 0.2)(40, 0, 0, true);
  assert(Number.isFinite(q.x) && Number.isFinite(q.y));
  projected.push(q);
}
assert(
  Math.hypot(projected[50].x, projected[50].y) < Math.hypot(projected[0].x, projected[0].y) * 0.65,
  'yaw foreshortens the barrel instead of spinning a flat sprite',
);
console.log(
  'PASS combat study: reachable caves, varied inhabitants, safe collision, partial/once-only rewards, responsive survey, turret perspective',
);

const floorWorld=new TileWorld(12),base=floorWorld.generate.bind(floorWorld);
floorWorld.generate=(x,y)=>({...base(x,y),type:x>=2&&x<10&&y>=5&&y<8?'empty':'rock',ore:undefined});
const crawler:RockSwimmerState={x:140,y:307,vx:0,vy:0,kind:'rock-swimmer',mode:'hunt',life:0,phase:0,health:3,drillCooldown:0,hitFlash:0};
stepStudyCrawler(floorWorld,crawler,.016,{x:240,y:307},true);
assert.equal(crawler.mode,'windup','close crawler warns before attacking');
let jumped=false,recovered=false;
for(let i=0;i<160;i++){
  stepStudyCrawler(floorWorld,crawler,1/60,{x:240,y:307},true);
  jumped ||= crawler.mode==='charge'&&crawler.vy<0;
  recovered ||= crawler.mode==='recover';
  assert(caveClear(floorWorld,crawler.x,crawler.y),'pounce never passes through terrain');
}
assert(jumped&&recovered,'ground creature pounces then leaves a counterattack window');
console.log('PASS grounded crawler telegraph, pounce, recovery and solid collision');
