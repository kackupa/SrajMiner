import { UNIFORM_PLANET_STUDY as C, FLEET_STUDY as F } from '../config';
import { UniformCore } from './UniformCore';
import { expeditionRadius, expeditionCave, radialPoint, surfaceAngle } from './ExpeditionTerrain';

export type Point = { x: number; y: number };
export type StudyMaterial = 'rock' | 'copper' | 'iron' | 'silver';
export type UniformCell = { x: number; y: number; material: StudyMaterial; polygon: Point[] };
export const uniformKey = (x: number, y: number) => `${x},${y}`;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Equal Cartesian cells clipped by a circular planet, not angular wedges.
 * Coordinates, collision, targeting and excavation all use this same lattice.
 * No persistence API: this experiment cannot load or modify a campaign. */
export class UniformPlanet {
  readonly core = new UniformCore();
  readonly cells = new Map<string, UniformCell>();
  readonly excavated = new Set<string>();
  readonly fractures = new Map<string,number>();
  revision = 0;
  constructor(readonly relief = false) {
    const n = Math.ceil((C.radius + (relief ? 220 : 0)) / C.tile);
    for (let y = -n; y < n; y++) for (let x = -n; x < n; x++) {
      const polygon = cellPolygon(x, y, relief ? this.outline : undefined);
      if (polygon.length < 3 || this.cave(x, y)) continue;
      const wave = y - 2.5 * Math.sin(x * .19) - .35 * x;
      const vein = ((wave % 8) + 8) % 8 < 1.4;
      const depth = C.radius - Math.hypot((x + .5) * C.tile, (y + .5) * C.tile);
      const material: StudyMaterial = !vein ? 'rock' : depth > 1250 ? 'silver' : depth > 600 ? 'iron' : 'copper';
      this.cells.set(uniformKey(x, y), { x, y, material, polygon });
    }
  }
  surfaceRadius(angle:number){return this.relief?expeditionRadius(angle):C.radius;}
  surfaceRadiusAt(p:Point){return this.surfaceRadius(surfaceAngle(p));}
  surfacePoint(angle:number,altitude=0){return radialPoint(angle,this.surfaceRadius(angle)+altitude);}
  get outline(){return this.boundary??=Array.from({length:1440},(_,i)=>this.surfacePoint(i*Math.PI/720));}
  private boundary?:Point[];
  private cave(x: number, y: number) {
    const px = (x + .5) * C.tile, py = (y + .5) * C.tile;
    if (this.relief && expeditionCave({x:px,y:py})) return true;
    if (Math.hypot(px, py) < C.coreRadius) return true;
    // A visible access shaft joins all test levels. It is terrain, not teleport physics.
    if (x >= -1 && x <= 0 && y < 0) return true;
    return [{ x: 160, y: -1320 }, { x: -40, y: -760 }, { x: 140, y: -200 }]
      .some(p => ((px - p.x) / 230) ** 2 + ((py - p.y) / 110) ** 2 < 1);
  }
  get(x: number, y: number) { return this.cells.get(uniformKey(x, y)); }
  at(p: Point) { return this.get(Math.floor(p.x / C.tile), Math.floor(p.y / C.tile)); }
  remove(cell: UniformCell) {
    const key = uniformKey(cell.x, cell.y);
    if (!this.cells.delete(key)) return false;
    this.fractures.delete(key);
    this.excavated.add(key); this.revision++;
    return true;
  }
  weakening(cell:UniformCell) { return this.fractures.get(uniformKey(cell.x,cell.y))??0; }
  weaken(point:Point) {
    const cell=this.at(point);
    if(!cell||!this.solidAt(point)||Math.hypot(point.x,point.y)<=C.coreSurfaceRadius)return;
    this.fractures.set(uniformKey(cell.x,cell.y),Math.min(F.terrainDamage.maxBulletWeakening,this.weakening(cell)+F.terrainDamage.bullet));
    return cell;
  }
  /** Destruction deliberately has no inventory/reward path. Core support is never a cell. */
  blast(point:Point, radius:number=F.terrainDamage.blastRadius) {
    const removed:UniformCell[]=[];
    for(let y=Math.floor((point.y-radius)/C.tile);y<=Math.floor((point.y+radius)/C.tile);y++)for(let x=Math.floor((point.x-radius)/C.tile);x<=Math.floor((point.x+radius)/C.tile);x++){
      const cell=this.get(x,y);
      if(cell&&Math.hypot((x+.5)*C.tile-point.x,(y+.5)*C.tile-point.y)<=radius&&this.remove(cell))removed.push(cell);
    }
    return removed;
  }
  collides(p: Point, radius:number = C.bodyRadius) {
    // Depleting fuel never removes the support or sends the rig through centre.
    if (Math.hypot(p.x, p.y) < C.coreSurfaceRadius + radius - .01) return true;
    for (let y = Math.floor((p.y - radius) / C.tile); y <= Math.floor((p.y + radius) / C.tile); y++) {
      for (let x = Math.floor((p.x - radius) / C.tile); x <= Math.floor((p.x + radius) / C.tile); x++) {
        const cell = this.get(x, y);
        if (cell && circlePolygon(p, radius, cell.polygon)) return true;
      }
    }
    return false;
  }
  solidAt(p: Point) {
    if (Math.hypot(p.x, p.y) <= C.coreSurfaceRadius) return true;
    const cell = this.at(p);
    return !!cell && pointInPolygon(p, cell.polygon);
  }
  /** Visible impact on the core; an intervening rock face blocks extraction. */
  coreHit(from: Point, direction: Point): Point | undefined {
    const length = Math.hypot(direction.x, direction.y);
    if (length < .001) return;
    const dx = direction.x / length, dy = direction.y / length;
    const along = from.x * dx + from.y * dy;
    const discriminant = along ** 2 - (from.x ** 2 + from.y ** 2 - C.coreSurfaceRadius ** 2);
    if (discriminant < 0) return;
    const distance = -along - Math.sqrt(discriminant);
    if (distance < 0 || distance > C.drillReach) return;
    const rock = this.trace(from, direction, distance);
    if (rock && rock.distance < distance) return;
    return { x: from.x + dx * distance, y: from.y + dy * distance };
  }
  /** Stop at the first solid cell. No mining through a nearer rock face. */
  ray(from: Point, direction: Point, reach = C.drillReach): UniformCell | undefined {
    return this.trace(from, direction, reach)?.cell;
  }
  drillDirectionAllowed(from: Point, direction: Point) {
    const radius = Math.hypot(from.x, from.y), length = Math.hypot(direction.x, direction.y);
    if (!radius || !length) return false;
    // A rising surface lip may be slightly above the local tangent. This small
    // allowance stops a sideways cut flickering off as gravity/camera rotate;
    // it does not permit drilling a ceiling or drilling straight outward.
    const rise = radius >= this.surfaceRadiusAt(from) - C.tile ? C.surfaceDrillRise : C.undergroundDrillRise;
    return (direction.x * from.x + direction.y * from.y) / (radius * length) <= rise;
  }
  /** Cut a rig-width passage, including a cell edge under either foot. A thin
   * centre ray alone leaves the miner caught on sub-pixel lips of adjacent cells. */
  drillFace(from: Point, direction: Point): UniformCell[] {
    const length = Math.hypot(direction.x, direction.y);
    if (length < .001) return [];
    // Sample the whole cutting width. Only centre/outer rays can straddle a
    // clipped surface sliver, leaving a corner under the circular collider.
    const halfWidth = C.bodyRadius + 2;
    const offsets = Array.from({ length: 13 }, (_, i) => -halfWidth + i * halfWidth / 6);
    const hits = offsets.flatMap(offset => {
      const origin = { x: from.x - direction.y / length * offset, y: from.y + direction.x / length * offset };
      const hit = this.trace(origin, direction, C.drillReach);
      return hit ? [hit] : [];
    });
    const nearest = Math.min(...hits.map(h => h.distance));
    return [...new Set(hits.filter(h => h.distance < nearest + C.tile * .6).sort((a,b)=>a.distance-b.distance).map(h => h.cell))];
  }
  private trace(from: Point, direction: Point, reach: number): { cell: UniformCell; distance: number } | undefined {
    const length = Math.hypot(direction.x, direction.y);
    if (length < .001) return;
    for (let d = 0; d <= reach; d += 2) {
      const p = { x: from.x + direction.x / length * d, y: from.y + direction.y / length * d };
      const cell = this.at(p);
      if (cell && pointInPolygon(p, cell.polygon)) return { cell, distance: d };
    }
  }
}

/** Boundary cells are clipped once. Interior cells remain exactly 40 × 40,
 * including at the core and on the far hemisphere. */
export function cellPolygon(x: number, y: number, boundary?:Point[]): Point[] {
  const l = x * C.tile, t = y * C.tile, r = l + C.tile, b = t + C.tile;
  const corners = [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }];
  const radius=(p:Point)=>boundary?expeditionRadius(surfaceAngle(p)):C.radius;
  if (corners.every(p => Math.hypot(p.x, p.y) <= radius(p)-.05)) return corners;
  const center={x:(l+r)/2,y:(t+b)/2};
  if(boundary?Math.hypot(center.x,center.y)>radius(center)+C.tile*1.5:Math.hypot(clamp(0,l,r),clamp(0,t,b))>=C.radius)return [];
  // Clip a finely sampled circle against this edge cell's rectangle.
  let points = boundary ?? Array.from({ length: 720 }, (_, i) => ({ x: C.radius * Math.cos(i * Math.PI / 360), y: C.radius * Math.sin(i * Math.PI / 360) }));
  for (const [axis, boundary, sign] of [['x', l, 1], ['x', r, -1], ['y', t, 1], ['y', b, -1]] as const) {
    const next: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], z = points[(i + 1) % points.length];
      const insideA = (a[axis] - boundary) * sign >= 0, insideZ = (z[axis] - boundary) * sign >= 0;
      if (insideA) next.push(a);
      if (insideA !== insideZ) {
        const f = (boundary - a[axis]) / (z[axis] - a[axis]);
        next.push({ x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f });
      }
    }
    points = next;
  }
  return points;
}
function pointInPolygon(p:Point,polygon:Point[]){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<.001)return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
function circlePolygon(p: Point, radius: number, polygon: Point[]) {
  if (pointInPolygon(p, polygon)) return true;
  return polygon.some((a, i) => {
    const b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < radius - .01;
  });
}

export class UniformMiner {
  x: number = C.stations[0].x; y: number = C.stations[0].y;
  sideSpeed = 0; fallSpeed = 0; grounded = false;
  diving = false;
  thrustAssists = 0;
  outward: Point = { x: 0, y: -1 };
  teleport(p: Point) { this.x = p.x; this.y = p.y; this.sideSpeed = 0; this.fallSpeed = 0; this.grounded = false; this.diving = false; this.basis(); }
  basis() {
    const r = Math.hypot(this.x, this.y);
    // Keep a stable up direction inside the small, open central chamber.
    if (r > 45) this.outward = { x: this.x / r, y: this.y / r };
    return { out: this.outward, tangent: { x: -this.outward.y, y: this.outward.x } };
  }
  step(world: UniformPlanet, side: number, flying: boolean, dt: number, descend = false) {
    const steps = Math.ceil(Math.min(.1, dt) / (1 / 120));
    for (let i = 0; i < steps; i++) this.integrate(world, side, flying, Math.min(.1, dt) / steps, descend);
  }
  private integrate(world: UniformPlanet, side: number, flying: boolean, dt: number, descend: boolean) {
    const { out, tangent } = this.basis();
    this.grounded = world.collides({ x: this.x - out.x * 2, y: this.y - out.y * 2 });
    this.diving = descend && !flying && !this.grounded;
    this.sideSpeed += (side * C.walkSpeed - this.sideSpeed) * (1 - Math.exp(-dt * 14));
    this.fallSpeed = flying ? Math.max(-C.flightSpeed, this.fallSpeed - C.gravity * 2.7 * dt)
      : this.diving ? Math.min(C.diveSpeed, this.fallSpeed + C.diveAcceleration * dt)
      : this.fallSpeed > C.maxFallSpeed ? Math.max(C.maxFallSpeed, this.fallSpeed - C.gravity * dt)
      : Math.min(C.maxFallSpeed, this.fallSpeed + C.gravity * dt);
    const across = { x: this.x + tangent.x * this.sideSpeed * dt, y: this.y + tangent.y * this.sideSpeed * dt };
    if (!world.collides(across)) { this.x = across.x; this.y = across.y; }
    else if (this.grounded && side) {
      // Find the smallest clearance instead of jumping in two-pixel increments
      // at every joint in the circular crust. Keep the same bounded step height.
      for (let up = .5; up <= 10; up += .5) {
        const raised = { x: this.x + out.x * up, y: this.y + out.y * up };
        const next = { x: across.x + out.x * up, y: across.y + out.y * up };
        if (world.collides(raised)) break; // Never step through a low cave roof.
        if (!world.collides(next)) {
          let lo = Math.max(0, up - .5), hi = up;
          for (let j = 0; j < 10; j++) {
            const mid = (lo + hi) / 2;
            if (world.collides({ x: across.x + out.x * mid, y: across.y + out.y * mid })) lo = mid;
            else hi = mid;
          }
          this.x = across.x + out.x * hi; this.y = across.y + out.y * hi; break;
        }
      }
    }
    // Maintain contact on gentle downslope joins instead of repeatedly dropping
    // and landing. Gaps deeper than this tolerance still use normal gravity.
    const stick = this.grounded && !flying && this.fallSpeed >= 0
      && world.collides({ x: this.x - out.x * 2.5, y: this.y - out.y * 2.5 });
    const distance = stick ? Math.max(2.5, this.fallSpeed * dt) : this.fallSpeed * dt;
    let radial = { x: this.x - out.x * distance, y: this.y - out.y * distance };
    if(flying&&distance<0&&world.collides(radial)){
      const clearance=this.thrustClearance(world,out,tangent,-distance,side);
      if(clearance){
        const dx=clearance.x-this.x,dy=clearance.y-this.y;
        const blend=Math.min(1,C.thrustClearanceSpeed*dt/Math.hypot(dx,dy));
        this.x+=dx*blend;this.y+=dy*blend;this.thrustAssists++;
        radial={x:this.x-out.x*distance,y:this.y-out.y*distance};
      }
    }
    if (!world.collides(radial)) { this.x = radial.x; this.y = radial.y; }
    else {
      // Resolve to the actual contact point, not the previous frame's position.
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const t = (lo + hi) / 2;
        if (world.collides({ x: this.x - out.x * distance * t, y: this.y - out.y * distance * t })) hi = t;
        else lo = t;
      }
      this.x -= out.x * distance * lo; this.y -= out.y * distance * lo;
      this.fallSpeed = 0;
    }
    this.grounded = !flying && world.collides({ x: this.x - out.x * 2, y: this.y - out.y * 2 });
    if (this.grounded) this.diving = false;
    // Finite sandbox airspace; steer or fly home without entering an endless void.
    const radius = Math.hypot(this.x, this.y), limit = C.radius + 500;
    if (radius > limit) { this.x *= limit / radius; this.y *= limit / radius; this.fallSpeed = 0; }
  }
  /** Find a nearby roof corner exit only when both the sideways path and
   * outward exit fit the full hull. Never excavates or reduces the collider. */
  private thrustClearance(world:UniformPlanet,out:Point,tangent:Point,rise:number,steering:number):Point|undefined {
    const preferred=steering<0?-1:1,blocked=new Set<number>();
    const probe=Math.max(rise,C.thrustClearanceProbe);
    for(let offset=.5;offset<=C.thrustCornerClearance;offset+=.5){
      for(const direction of [preferred,-preferred]){
        if(blocked.has(direction))continue;
        const shifted={x:this.x+tangent.x*offset*direction,y:this.y+tangent.y*offset*direction};
        // Successive half-unit samples sweep the whole lateral path. A wall
        // permanently rules out that side, even if an empty pocket lies beyond.
        if(world.collides(shifted)){blocked.add(direction);continue;}
        let clear=true;
        for(let d=.5;d<probe+.5;d+=.5){
          const height=Math.min(d,probe);
          if(world.collides({x:shifted.x+out.x*height,y:shifted.y+out.y*height})){clear=false;break;}
        }
        if(clear)return shifted;
      }
    }
  }
}
