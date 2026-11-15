import { UNIFORM_COMBAT as C, type StudyWeaponSpec } from '../config';
import type { Point, UniformPlanet } from './UniformPlanet';
import type { UniformCombat } from './UniformCombat';
export type Ordnance = Point & {
  vx: number;
  vy: number;
  age: number;
  distance: number;
  tail: Point;
  spec: StudyWeaponSpec;
  target?: number;
  aimPoint?: Point;
  trail?: Point[];
  bounceAt?:number;
};
export class StudyOrdnance {
  bullets: Ordnance[] = [];
  shots = 0;
  cooldown = 0;
  ready() {
    return this.cooldown <= 0;
  }
  step(
    dt: number,
    fire: boolean,
    muzzle: Point,
    dir: Point,
    spec: StudyWeaponSpec,
    world: UniformPlanet,
    combat: UniformCombat,
    base = muzzle,
    verticalLaunch?: { up: Point; target: Point },
  ) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.cooldown = Math.max(0, this.cooldown - dt);
    const impacts: { point: Point; spec: StudyWeaponSpec }[] = [];
    if (fire && this.ready()) {
      this.cooldown = spec.cooldown;
      this.shots++;
      let source = muzzle;
      const n = Math.max(1, Math.ceil(Math.hypot(muzzle.x - base.x, muzzle.y - base.y) / 2));
      for (let i = 0; i <= n; i++) {
        const p = {
          x: base.x + ((muzzle.x - base.x) * i) / n,
          y: base.y + ((muzzle.y - base.y) * i) / n,
        };
        if (world.solidAt(p)) {
          source = p;
          break;
        }
      }
      const target =
        spec.id === 'missile' && !verticalLaunch
          ? combat.bodies
              .filter(
                (b) =>
                  b.hp > 0 &&
                  b.kind === 'flyer' &&
                  Math.hypot(b.x - muzzle.x, b.y - muzzle.y) < spec.range &&
                  combat.sight(world, muzzle, b),
              )
              .find((b) => {
                const dx = b.x - muzzle.x,
                  dy = b.y - muzzle.y;
                return (dx * dir.x + dy * dir.y) / Math.hypot(dx, dy) > C.missileLockCone;
              })
          : undefined;
      this.bullets.push({
        ...source,
        vx: (verticalLaunch?.up.x ?? dir.x) * (verticalLaunch?C.backpackLaunchSpeed:spec.speed),
        vy: (verticalLaunch?.up.y ?? dir.y) * (verticalLaunch?C.backpackLaunchSpeed:spec.speed),
        tail: { ...source },
        age: 0,
        distance: 0,
        spec,
        target: target?.id,
        aimPoint: verticalLaunch ? {...verticalLaunch.target} : undefined,
        trail: verticalLaunch ? [{...source}] : undefined,
      });
    }
    this.bullets = this.bullets.filter((b) => {
      b.age += dt;
      b.tail = { x: b.x, y: b.y };
      if(b.trail && Math.hypot(b.x-b.trail[b.trail.length-1].x,b.y-b.trail[b.trail.length-1].y)>6){
        b.trail.push({...b.tail});if(b.trail.length>18)b.trail.shift();
      }
      const w = b.spec;
      const target = combat.bodies.find((e) => e.id === b.target && e.hp > 0);
      if(b.aimPoint){
        if(b.age>C.backpackLaunchTime){
          const a=Math.atan2(b.vy,b.vx),to=Math.atan2(b.aimPoint.y-b.y,b.aimPoint.x-b.x);
          const turn=Math.atan2(Math.sin(to-a),Math.cos(to-a));
          const angle=a+Math.max(-dt*C.backpackTurnRate,Math.min(dt*C.backpackTurnRate,turn));
          const speed=Math.min(w.speed,Math.hypot(b.vx,b.vy)+w.speed*dt*3);
          b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;
        }
      } else if (target && combat.sight(world, b, target)) {
        const a = Math.atan2(b.vy, b.vx),
          to = Math.atan2(target.y - b.y, target.x - b.x),
          turn = Math.atan2(Math.sin(to - a), Math.cos(to - a));
        const angle = a + Math.max(-dt * C.missileTurnRate, Math.min(dt * C.missileTurnRate, turn));
        b.vx = Math.cos(angle) * w.speed;
        b.vy = Math.sin(angle) * w.speed;
      } else b.target = undefined;
      if (w.id === 'grenade') {
        const r = Math.hypot(b.x, b.y) || 1;
        b.vx -= (b.x / r) * C.grenadeGravity * dt;
        b.vy -= (b.y / r) * C.grenadeGravity * dt;
      }
      const travel = Math.hypot(b.vx, b.vy) * dt,
        n = Math.max(1, Math.ceil(travel / 2));
      b.distance += travel;
      const explode = () => {
        impacts.push({ point: { x: b.x, y: b.y }, spec: w });
        return false;
      };
      for (let i = 0; i < n; i++) {
        const p = { x: b.x + (b.vx * dt) / n, y: b.y + (b.vy * dt) / n };
        if (world.solidAt(p)) {
          if (w.id === 'grenade' && !world.solidAt(b)) {
            b.bounceAt=b.age;
            if (world.solidAt({ x: p.x, y: b.y })) b.vx *= -C.grenadeBounce;
            if (world.solidAt({ x: b.x, y: p.y })) b.vy *= -C.grenadeBounce;
            break;
          }
          b.x = p.x;
          b.y = p.y;
          return explode();
        }
        b.x = p.x;
        b.y = p.y;
        if(b.aimPoint&&b.age>C.backpackLaunchTime&&Math.hypot(b.x-b.aimPoint.x,b.y-b.aimPoint.y)<C.backpackTargetRadius)return explode();
        if (combat.target(b)) return explode();
      }
      if (w.id === 'grenade' && b.age >= C.grenadeFuse) return explode();
      return b.distance < w.range && b.age < 5;
    });
    return impacts;
  }
}
