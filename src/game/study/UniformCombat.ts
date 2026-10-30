import { FLEET_STUDY, UNIFORM_COMBAT as C, SURFACE_EXPEDITION as E, UNIFORM_PLANET_STUDY as P, type StudyWeaponSpec } from '../config';
import type { Point, UniformPlanet } from './UniformPlanet';
import { caveRoute, clearCreaturePath } from './CaveRoutes';
export type CombatBody = Point & {
  id: number;
  kind: 'crawler' | 'armored' | 'flyer' | 'nest';
  hp: number;
  maxHp: number;
  home: Point;
  site: number;
  phase: 'idle' | 'windup' | 'attack' | 'recover';
  timer: number;
  flash: number;
  face: number;
  moving: number;
  seen: boolean;
  deadAge: number;
  gunship?: boolean; heading?:number; aim?:Point; passDirection?:Point; burst?:number; muzzle?:number;
  route?:Point[]; routeTimer?:number; routeRevision?:number; stuck?:number; retreat?:number; fallSpeed?:number;
};
type Shot = Point & { vx: number; vy: number; life: number; gunship?:boolean };
export class UniformCombat {
  bodies: CombatBody[] = [];
  shots: Shot[] = [];
  hull: number = C.hull;
  grace = 0;
  kills = 0;
  reward = 0;
  shipTimer = 0;
  shipShot?:{target:Point;age:number};
  beams: { a: Point; b: Point; life: number; color: number }[] = [];
  constructor(world: UniformPlanet) {
    C.sites.forEach((s, site) => {
      if(world.relief&&s.kind==='flyer')return;
      const n = this.add(s, 'nest', site, C.nestHealth);
      // Seat cave nests on their existing floor, without excavating or regenerating terrain.
      if (s.kind === 'flyer') {
        const r = Math.hypot(n.x, n.y);
        n.x *= (P.radius + 15) / r;
        n.y *= (P.radius + 15) / r;
      } else
        for (let i = 0; i < 160; i++) {
          const r = Math.hypot(n.x, n.y),
            q = { x: n.x - n.x / r, y: n.y - n.y / r };
          if (world.collides(q, 16)) break;
          n.x = q.x;
          n.y = q.y;
        }
      n.home = { x: n.x, y: n.y };
      for (let i = 0; i < 2; i++) {
        const p = { x: s.x + (i ? 25 : -55), y: s.y - (s.kind === 'flyer' ? 75 : 25) };
        if (!world.collides(p, C.enemyRadius))
          this.add(p, s.kind, site, s.kind === 'armored' ? C.armoredHealth : C.enemyHealth);
      }
    });
    if(world.relief){
      const ship=this.add(world.surfacePoint(E.crater,240),'flyer',0,E.gunshipHealth);ship.gunship=true;ship.heading=0;
      const guard=this.add({x:600,y:-1440},'crawler',5,C.enemyHealth);
      for(let i=0;i<160;i++){const r=Math.hypot(guard.x,guard.y),q={x:guard.x-guard.x/r,y:guard.y-guard.y/r};if(world.collides(q,C.enemyRadius))break;Object.assign(guard,q);}
      guard.home={x:guard.x,y:guard.y};
      // Homes must be actual footholds. Remembering an airborne spawn makes
      // idle creatures repeatedly jump at an unreachable point above the floor.
      for(const b of this.bodies.filter(b=>b.kind==='crawler'||b.kind==='armored')){
        for(let i=0;i<180;i++){const r=Math.hypot(b.x,b.y),q={x:b.x-b.x/r,y:b.y-b.y/r};if(world.collides(q,C.enemyRadius))break;b.x=q.x;b.y=q.y;}
        b.home={x:b.x,y:b.y};
      }
    }
  }
  private add(p: Point, kind: CombatBody['kind'], site: number, hp: number) {
    const b: CombatBody = {
      ...p,
      id: this.bodies.length,
      kind,
      hp,
      maxHp: hp,
      home: { ...p },
      site,
      phase: 'idle',
      timer: 0,
      flash: 0,
      face: 1,
      moving: 0,
      seen: false,
      deadAge: 0,
    };
    this.bodies.push(b);
    return b;
  }
  sight(world: UniformPlanet, a: Point, b: Point) {
    const n = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 4);
    for (let i = 1; i < n; i++)
      if (world.solidAt({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }))
        return false;
    return true;
  }
  target(p: Point) {
    return this.bodies.find(
      (b) =>
        b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) < (b.kind === 'nest' ? 25 : b.gunship?E.gunshipRadius:C.enemyRadius),
    );
  }
  damage(b: CombatBody, amount: number, armor = 1) {
    if (b.hp <= 0) return false;
    b.hp = Math.max(0, b.hp - amount * (b.gunship ? Math.max(.55,armor) : b.kind === 'armored' ? armor : 1));
    b.flash = 0.14;
    if (!b.hp) {
      this.kills++;
      this.reward += b.kind === 'nest' ? C.nestReward : C.reward;
      return true;
    }
    return false;
  }
  impact(world: UniformPlanet, p: Point, w: StudyWeaponSpec) {
    const b = this.target(p);
    if (!b) return false;
    this.damage(b, w.damage, w.armor);
    if (w.id === 'arc') {
      let from = b;
      const visited = new Set([b.id]);
      for (let i = 0; i < 2; i++) {
        const next = this.bodies
          .filter(
            (e) =>
              e.hp > 0 &&
              !visited.has(e.id) &&
              Math.hypot(e.x - from.x, e.y - from.y) < C.chainRange &&
              this.sight(world, from, e),
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
          )[0];
        if (!next) break;
        this.beams.push({ a: { ...from }, b: { ...next }, life: 0.22, color: w.color });
        this.damage(next, w.damage * C.chainFalloff, w.armor);
        visited.add(next.id);
        from = next;
      }
    }
    return true;
  }
  blast(world: UniformPlanet, p: Point, w: StudyWeaponSpec, miner: Point) {
    // Resolve cover before the scene removes rock. Enemies behind a wall are protected for this blast.
    for (const b of this.bodies)
      if (b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) <= w.blast + 13 && this.sight(world, p, b))
        this.damage(b, w.damage, w.armor);
    if (Math.hypot(miner.x - p.x, miner.y - p.y) < w.blast && this.sight(world, p, miner))
      this.hurt(C.blastSelfDamage);
  }
  hurt(n: number) {
    if (this.grace > 0) return;
    this.hull = Math.max(0, this.hull - n);
    this.grace = C.damageGrace;
  }
  private move(world: UniformPlanet, b: CombatBody, dx: number, dy: number, miner?:Point) {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let i = 0; i < count; i++) {
      for (const axis of ['x', 'y'] as const) {
        const x = b.x + (axis === 'x' ? dx / count : 0),
          y = b.y + (axis === 'y' ? dy / count : 0);
        const avoids=miner?[miner]:[];
        avoids.push(...this.bodies.filter(other=>other!==b&&other.hp>0&&other.kind!=='nest'));
        if(avoids.some(p=>Math.hypot(x-p.x,y-p.y)<30&&Math.hypot(x-p.x,y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)))continue;
        const radius = Math.hypot(x, y);
        if (
          (b.kind === 'flyer' && radius < world.surfaceRadiusAt({x,y}) + (b.gunship?45:20)) ||
          (b.kind !== 'flyer' && radius > world.surfaceRadiusAt({x,y}) - 10)
        )
          continue;
        if (!world.collides({ x, y }, b.gunship?E.gunshipRadius:C.enemyRadius)) {
          b.x = x;
          b.y = y;
        }
      }
    }
  }
  private moveCaveCreature(world:UniformPlanet,b:CombatBody,goal:Point,miner:Point,dt:number,speed:number){
    b.retreat=Math.max(0,(b.retreat??0)-dt);b.routeTimer=(b.routeTimer??0)-dt;
    if(b.routeTimer<=0||b.routeRevision!==world.revision){b.route=caveRoute(world,b,goal);b.routeTimer=E.routeRefresh;b.routeRevision=world.revision;}
    while(b.route?.length&&Math.hypot(b.route[0].x-b.x,b.route[0].y-b.y)<18)b.route.shift();
    const target=b.route?.[0]??goal,r=Math.hypot(b.x,b.y),out={x:b.x/r,y:b.y/r},t={x:-out.y,y:out.x};
    const dx=target.x-b.x,dy=target.y-b.y,dir=Math.sign(dx*t.x+dy*t.y);
    const grounded=world.collides({x:b.x-out.x*3,y:b.y-out.y*3},C.enemyRadius);
    b.fallSpeed=grounded?0:Math.min(180,(b.fallSpeed??0)+E.creatureGravity*dt);
    const ahead={x:b.x+t.x*dir*18,y:b.y+t.y*dir*18};
    if(grounded&&speed>0&&(dx*out.x+dy*out.y>10||world.collides(ahead,C.enemyRadius))
      &&clearCreaturePath(world,b,{x:b.x+out.x*18,y:b.y+out.y*18}))b.fallSpeed=-E.jumpSpeed;
    const before={x:b.x,y:b.y};
    const travel=b.route?.length?dir*speed*dt:clearCreaturePath(world,b,goal)?dir*speed*dt:0;
    this.move(world,b,t.x*travel-out.x*b.fallSpeed*dt,t.y*travel-out.y*b.fallSpeed*dt,miner);
    const moved=Math.hypot(b.x-before.x,b.y-before.y);
    b.stuck=speed>0&&Math.hypot(dx,dy)>35&&moved<.08?(b.stuck??0)+dt:0;
    if(b.stuck>1.3){b.retreat=3;b.routeTimer=0;b.stuck=0;}
  }
  private updateGunship(world:UniformPlanet,b:CombatBody,miner:Point,dt:number,safe:boolean){
    b.timer=Math.max(0,b.timer-dt);b.muzzle=Math.max(0,(b.muzzle??0)-dt);
    const distance=Math.hypot(miner.x-b.x,miner.y-b.y),r=Math.hypot(b.x,b.y),out={x:b.x/r,y:b.y/r},t={x:-out.y,y:out.x};
    const exposed=Math.hypot(miner.x,miner.y)>world.surfaceRadiusAt(miner)-12;
    const engage=!safe&&exposed&&distance<E.detection&&this.sight(world,b,miner)&&Math.hypot(miner.x-b.home.x,miner.y-b.home.y)<E.leash;
    b.seen ||= engage;
    if(b.phase==='idle'&&engage){b.phase='windup';b.timer=E.warningSeconds;b.aim={...miner};b.face=Math.sign((miner.x-b.x)*t.x+(miner.y-b.y)*t.y)||1;}
    else if(b.phase==='windup'&&!b.timer){
      if(!engage){b.phase='recover';b.timer=E.turnSeconds;}else{b.phase='attack';b.timer=E.passSeconds;b.burst=0;b.passDirection={x:t.x*b.face,y:t.y*b.face};}
    }else if(b.phase==='attack'&&!b.timer){b.phase='recover';b.timer=E.turnSeconds;}
    else if(b.phase==='recover'&&!b.timer){b.phase='idle';b.face*=-1;}
    if(b.phase==='attack'){
      b.burst=(b.burst??0)-dt;
      if(b.burst<=0&&b.aim){
        // Aim was committed during the warning: moving/diving avoids the burst.
        const dx=b.aim.x-b.x,dy=b.aim.y-b.y,d=Math.hypot(dx,dy)||1;
        const muzzle={x:b.x+dx/d*30,y:b.y+dy/d*30};
        if(this.sight(world,b,muzzle))this.shots.push({...muzzle,vx:dx/d*E.bulletSpeed,vy:dy/d*E.bulletSpeed,life:3,gunship:true});
        b.burst=E.burstInterval;b.muzzle=.1;
      }
    }
    let heading=b.face,altitude=170;
    if(b.phase==='idle'||b.phase==='recover'){
      const homeAngle=Math.atan2(b.home.x,-b.home.y),angle=Math.atan2(b.x,-b.y);
      const delta=Math.atan2(Math.sin(homeAngle-angle),Math.cos(homeAngle-angle));
      if(Math.abs(delta)>.17)b.face=Math.sign(delta);
      heading=b.face;
      altitude=b.phase==='recover'?230:170;
    }
    const desired=world.surfaceRadiusAt(b)+altitude;
    const climb=Math.max(-100,Math.min(155,(desired-r)*2));
    const speed=b.phase==='windup'?35:b.phase==='attack'?E.strafeSpeed:E.patrolSpeed;
    const travel=heading*speed*dt;
    const before={x:b.x,y:b.y};
    this.move(world,b,t.x*travel+out.x*climb*dt,t.y*travel+out.y*climb*dt);
    if(Math.hypot(b.x-before.x,b.y-before.y)<.1){this.move(world,b,out.x*120*dt,out.y*120*dt);b.face*=-1;}
    b.heading=(b.heading??0)+((heading<0?Math.PI:0)-(b.heading??0))*(1-Math.exp(-dt*5));
    b.moving=speed/E.strafeSpeed;
  }
  update(world: UniformPlanet, dt: number, miner: Point, ship: Point, shipLanded: boolean) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.grace = Math.max(0, this.grace - dt);
    this.shipTimer -= dt;
    if(this.shipShot&&(this.shipShot.age+=dt)>.38)this.shipShot=undefined;
    const safe = shipLanded && Math.hypot(miner.x - ship.x, miner.y - ship.y) < FLEET_STUDY.serviceRange;
    if (safe) this.hull = Math.min(C.hull, this.hull + C.repairPerSecond * dt);
    this.beams = this.beams.filter((b) => (b.life -= dt) > 0);
    for (const b of this.bodies) {
      b.flash = Math.max(0, b.flash - dt);
      if (b.hp <= 0) {
        b.deadAge += dt;
        continue;
      }
      if(b.gunship){this.updateGunship(world,b,miner,dt,safe);continue;}
      const dist = Math.hypot(b.x - miner.x, b.y - miner.y),
        los = dist < C.aggro && this.sight(world, b, miner);
      b.seen ||= los;
      if (b.kind === 'nest') continue;
      const sameRegion =
        b.kind === 'flyer'
          ? Math.hypot(miner.x, miner.y) > world.surfaceRadiusAt(miner)
          : Math.hypot(miner.x, miner.y) < world.surfaceRadiusAt(miner);
      const hunting =
        (los || world.relief && dist<240) &&
        sameRegion &&
        !safe &&
        Math.hypot(miner.x - b.home.x, miner.y - b.home.y) < C.territory;
      const pursuing=hunting&&!(b.retreat&&b.retreat>0);
      const goal = pursuing ? miner : b.home,
        dx = goal.x - b.x,
        dy = goal.y - b.y,
        d = Math.hypot(dx, dy) || 1;
      b.face = -b.y * dx + b.x * dy < 0 ? -1 : 1;
      b.timer = Math.max(0, b.timer - dt);
      if (b.phase === 'idle' && hunting && dist < (b.kind === 'flyer' ? C.flyerAttackRange : C.attackRange)) {
        b.phase = 'windup';
        b.timer = C.windup;
      } else if (b.phase === 'windup' && !b.timer) {
        b.phase = 'attack';
        b.timer = 0.3;
        if (hunting && b.kind === 'flyer')
          this.shots.push({ x: b.x, y: b.y, vx: (dx / d) * C.spitSpeed, vy: (dy / d) * C.spitSpeed, life: C.spitLifetime });
      } else if (b.phase === 'attack' && !b.timer) {
        b.phase = 'recover';
        b.timer = C.recover;
      } else if (b.phase === 'recover' && !b.timer) b.phase = 'idle';
      const old = { x: b.x, y: b.y },
        speed =
          b.phase === 'windup' || b.phase === 'recover'
            ? 0
            : b.phase === 'attack'
              ? C.chargeSpeed
              : b.kind === 'flyer'
                ? C.flyerSpeed
                : C.crawlerSpeed;
      if (b.kind === 'flyer') {
        if (d > (hunting?C.flyerStandoff:35)) this.move(world, b, (dx / d) * speed * dt, (dy / d) * speed * dt,miner);
      } else if(world.relief){
        this.moveCaveCreature(world,b,goal,miner,dt,speed);
        if(b.phase==='attack'&&hunting&&dist<C.contactRange&&this.sight(world,b,miner))this.hurt(C.contactDamage);
      } else {
        const r = Math.hypot(b.x, b.y),
          out = { x: b.x / r, y: b.y / r },
          t = { x: -out.y, y: out.x };
        const dir = Math.sign(dx * t.x + dy * t.y);
        let travel = dir * speed * dt;
        const grounded = world.collides({ x: b.x - out.x * 3, y: b.y - out.y * 3 }, C.enemyRadius);
        // Guard the cave floor instead of walking blindly into the central shaft.
        if(grounded&&!world.collides({x:b.x+t.x*dir*24-out.x*24,y:b.y+t.y*dir*24-out.y*24},C.enemyRadius))travel=0;
        if (
          grounded &&
          world.collides({ x: b.x + t.x * travel, y: b.y + t.y * travel }, C.enemyRadius)
        ) {
          // Small ledges only; inspect the full lifting path before stepping.
          for (let h = 1; h <= 20; h++) {
            const up = { x: b.x + out.x * h, y: b.y + out.y * h };
            if (world.collides(up, C.enemyRadius)) break;
            if (
              !world.collides({ x: up.x + t.x * travel, y: up.y + t.y * travel }, C.enemyRadius)
            ) {
              b.x = up.x;
              b.y = up.y;
              break;
            }
          }
        }
        this.move(world, b, t.x * travel - out.x * C.gravity * dt, t.y * travel - out.y * C.gravity * dt,miner);
        if (b.phase === 'attack' && hunting && dist < C.contactRange) this.hurt(C.contactDamage);
      }
      b.moving = Math.min(1, Math.hypot(old.x - b.x, old.y - b.y) / (dt * 45 || 1));
    }
    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      const steps = Math.ceil((Math.hypot(s.vx, s.vy) * dt) / 3);
      for (let i = 0; i < steps; i++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        if (world.solidAt(s)) return false;
        if (Math.hypot(s.x - miner.x, s.y - miner.y) < 18) {
          if (!safe) this.hurt(C.spitDamage);
          return false;
        }
      }
      return s.life > 0;
    });
    if (shipLanded && this.shipTimer <= 0) {
      const enemy = this.bodies.find(
        (b) =>
          b.kind === 'flyer' &&
          b.hp > 0 &&
          Math.hypot(b.x - ship.x, b.y - ship.y) < C.shipRange &&
          this.sight(world, ship, b),
      );
      if (enemy) {
        this.shipTimer = C.shipCooldown;
        this.damage(enemy, C.shipDamage);
        this.shipShot={target:{x:enemy.x,y:enemy.y},age:0};
      }
    }
  }
}
