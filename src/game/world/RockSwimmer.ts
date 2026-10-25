import { caveHome, caveMove, caveSight, caveStep } from './CaveHabitat';
import { turretStats } from '../building/UndergroundStructures';
import { CAVE_CREATURES, HULL_SCRAPPER, ROCK_SWIMMER, SHARD_MANTA, UNDERGROUND_BUILDING, WORLD, type MapId } from '../config';
import { random } from './TileWorld';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import type { TileWorld } from './TileWorld';
import { planetCartesianToChart, planetChartToCartesian, planetChartVectorToCartesian } from './PlanetChart';

export type RockSwimmerState = {
  habitat?: string; homeX?: number; homeY?: number; contactCooldown?: number;
  kind?: 'rock-swimmer' | 'shard-manta' | 'hull-scrapper';
  mode?: 'hunt' | 'windup' | 'charge' | 'recover';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  phase: number;
  health: number;
  drillCooldown: number;
  hitFlash: number;
  modeTimer?: number;
  chargeX?: number;
  chargeY?: number;
  warningPlayed?: boolean;
  armorBlockedFlash?: number;
};

export function swimmerKindForEncounter(encounter: number, mapId: MapId = 'cryo-shelf'): RockSwimmerState['kind'] {
  if (Math.floor(encounter) % 3 !== 2) return 'rock-swimmer';
  return mapId === 'hull-graveyard' ? 'hull-scrapper' : 'shard-manta';
}

/** Seeded cave inhabitants. Solid terrain separates their territory from the miner. */
export class RockSwimmer {
  active?: RockSwimmerState;
  private residents=new Map<string,RockSwimmerState>();
  private surveyed=new Set<string>();
  private navigationTime=0;
  private waypoint?: {x:number;y:number};
  withdraw(_dt: number) {
    // Shelter/surface breaks pursuit. Residents remain in their existing open cave.
    if(this.active){this.active.vx=0;this.active.vy=0;this.active.mode='hunt';}
    this.active=undefined;
  }
  repel() {
    if(this.active?.habitat){this.world?.clearedCaves.add(this.active.habitat);this.residents.delete(this.active.habitat);}
    this.active=undefined;
  }
  constructor(private seed:number,private mapId:MapId,private world?:TileWorld) {}
  private selectResident(x:number,y:number) {
    const world=this.world;if(!world)return;
    const sx=Math.floor(x/WORLD.tile/CAVE_CREATURES.sectorColumns),sy=Math.floor(y/WORLD.tile/CAVE_CREATURES.sectorRows);
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      const a=sx+ox,b=sy+oy,key=a+','+b;if(a<0||b<0||this.surveyed.has(key))continue;
      this.surveyed.add(key);const home=caveHome(world,a,b);if(!home||world.clearedCaves.has(home.id))continue;
      const n=Math.floor(random(this.seed,a,b,141)*9),kind=swimmerKindForEncounter(n,this.mapId);
      this.residents.set(home.id,{habitat:home.id,homeX:home.x,homeY:home.y,x:home.x,y:home.y,kind,mode:'hunt',vx:0,vy:0,
        life:0,phase:random(this.seed,a,b,143)*Math.PI*2,health:kind==='shard-manta'?SHARD_MANTA.drillHitsToDefeat:kind==='hull-scrapper'?HULL_SCRAPPER.drillHitsToDefeat:ROCK_SWIMMER.drillHitsToDefeat,drillCooldown:0,hitFlash:0});
    }
    const candidate=[...this.residents.values()].filter(r=>!world.clearedCaves.has(r.habitat!)&&Math.hypot(r.x-x,r.y-y)<CAVE_CREATURES.activationTiles*WORLD.tile)
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
    this.active=candidate;this.navigationTime=0;this.waypoint=undefined;
  }

  update(dt: number, depth: number, podX: number, podY: number, structures: UndergroundStructure[] = [], onTurretFire: (x: number, y: number) => void = () => {}) {
    for (const turret of structures.filter((entry) => entry.kind === 'turret')) turret.reload = Math.max(0, (turret.reload ?? 0) - dt);
    if (depth <= 0) { this.withdraw(dt); return false; }
    if(this.active?.habitat&&Math.hypot(this.active.x-podX,this.active.y-podY)>CAVE_CREATURES.activationTiles*WORLD.tile*1.5)this.active=undefined;
    if(!this.active)this.selectResident(podX,podY);
    if(!this.active)return false;

    const swimmer = this.active;
    swimmer.kind ??= 'rock-swimmer';
    swimmer.mode ??= 'hunt';
    swimmer.modeTimer ??= 0;
    swimmer.life += dt;
    swimmer.contactCooldown=Math.max(0,(swimmer.contactCooldown??0)-dt);
    const oldX=swimmer.x,oldY=swimmer.y;
    swimmer.drillCooldown = Math.max(0, swimmer.drillCooldown - dt);
    swimmer.hitFlash = Math.max(0, swimmer.hitFlash - dt);
    swimmer.armorBlockedFlash = Math.max(0, (swimmer.armorBlockedFlash ?? 0) - dt);
    const visible=!this.world||caveSight(this.world,swimmer,{x:podX,y:podY});
    this.navigationTime-=dt;
    if(this.world&&this.navigationTime<=0){
      this.navigationTime=.3;
      this.waypoint=caveStep(this.world,swimmer,{x:podX,y:podY});
    }
    const goal=this.world&&!visible?(this.waypoint??{x:(swimmer.homeX??swimmer.x)+Math.sin(swimmer.life*.6)*18,y:(swimmer.homeY??swimmer.y)+Math.cos(swimmer.life*.5)*12}):{x:podX,y:podY};
    const dx = goal.x - swimmer.x, dy = goal.y - swimmer.y;
    const distance = Math.hypot(dx, dy);
    for (const turret of structures) {
      if (turret.kind !== 'turret' || (turret.reload ?? 0) > 0) continue;
      if (Math.hypot(turret.x - swimmer.x, turret.y - swimmer.y) <= turretStats(turret).range && (!this.world || caveSight(this.world,turret,swimmer))) {
        turret.reload = turretStats(turret).reloadSeconds;
        onTurretFire(turret.x, turret.y);
        this.repel();
        return false;
      }
    }
    if (swimmer.kind === 'shard-manta') {
      if (swimmer.mode === 'hunt' && visible && distance <= SHARD_MANTA.windupDistance) {
        swimmer.mode = 'windup';
        swimmer.modeTimer = SHARD_MANTA.windupSeconds;
        swimmer.chargeX = dx / (distance || 1);
        swimmer.chargeY = dy / (distance || 1);
        swimmer.vx = 0;
        swimmer.vy = 0;
      }
      if (swimmer.mode === 'windup') {
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) {
          swimmer.mode = 'charge';
          swimmer.modeTimer = SHARD_MANTA.chargeSeconds;
          swimmer.vx = (swimmer.chargeX ?? dx / (distance || 1)) * SHARD_MANTA.chargeSpeed;
          swimmer.vy = (swimmer.chargeY ?? dy / (distance || 1)) * SHARD_MANTA.chargeSpeed;
          const chargeTime = Math.min(dt, SHARD_MANTA.chargeSeconds);
          swimmer.x += swimmer.vx * chargeTime;
          swimmer.y += swimmer.vy * chargeTime;
          swimmer.modeTimer -= chargeTime;
        }
      } else if (swimmer.mode === 'charge') {
        swimmer.x += swimmer.vx * dt;
        swimmer.y += swimmer.vy * dt;
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) {
          swimmer.mode = 'recover';
          swimmer.modeTimer = SHARD_MANTA.recoverSeconds;
          swimmer.vx = 0;
          swimmer.vy = 0;
        }
      } else if (swimmer.mode === 'recover') {
        swimmer.modeTimer = Math.max(0, swimmer.modeTimer - dt);
        if (swimmer.modeTimer === 0) swimmer.mode = 'hunt';
      } else if (distance > 1) {
        swimmer.vx += dx / distance * 17 * dt;
        swimmer.vy += dy / distance * 13 * dt;
        const speed = Math.hypot(swimmer.vx, swimmer.vy);
        if (speed > SHARD_MANTA.huntSpeed) {
          swimmer.vx *= SHARD_MANTA.huntSpeed / speed;
          swimmer.vy *= SHARD_MANTA.huntSpeed / speed;
        }
        swimmer.x += swimmer.vx * dt;
        swimmer.y += swimmer.vy * dt + Math.sin(swimmer.phase + swimmer.life * 2.1) * 6 * dt;
      }
    } else {
      // The swimmer homes toward the pod, asking the player to keep moving and aim the drill.
      if (distance > 1) {
        swimmer.vx += dx / distance * 24 * dt;
        swimmer.vy += dy / distance * 18 * dt;
      }
      const speed = Math.hypot(swimmer.vx, swimmer.vy);
      const speedCap = swimmer.kind === 'hull-scrapper' ? HULL_SCRAPPER.huntSpeed : ROCK_SWIMMER.speed;
      if (speed > speedCap) {
        swimmer.vx *= speedCap / speed;
        swimmer.vy *= speedCap / speed;
      }
      swimmer.x += swimmer.vx * dt;
      swimmer.y += swimmer.vy * dt + Math.sin(swimmer.phase + swimmer.life * 2.1) * 8 * dt;
    }

    if(this.world){
      const wantedX=swimmer.x,wantedY=swimmer.y;swimmer.x=oldX;swimmer.y=oldY;
      if(caveMove(this.world,swimmer,wantedX,wantedY)&&swimmer.mode==='charge'){
        swimmer.mode='recover';swimmer.modeTimer=SHARD_MANTA.recoverSeconds;
      }
    }
    const collisionDistance=Math.hypot(podX-swimmer.x,podY-swimmer.y);
    if(collisionDistance<=ROCK_SWIMMER.contactRadius && !swimmer.contactCooldown &&
       (!this.world||caveSight(this.world,swimmer,{x:podX,y:podY}))){
      swimmer.contactCooldown=CAVE_CREATURES.contactCooldown;
      swimmer.vx=0;swimmer.vy=0;
      return true;
    }
    return false;
  }

  /** Hit the active swimmer with a held drill beam. Returns true when defeated. */
  hitByDrill(world: TileWorld, podX: number, podY: number, aimX: number, aimY: number, reach: number) {
    const swimmer = this.active;
    if (!swimmer || swimmer.drillCooldown > 0 || Math.hypot(aimX, aimY) < 0.001) return false;
    const chart = world.planetChart, origin = chart
        ? planetChartToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { x: podX, y: podY },
      target = chart
        ? planetChartToCartesian({ u: swimmer.x / WORLD.tile, v: swimmer.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { x: swimmer.x, y: swimmer.y },
      vector = chart
        ? planetChartVectorToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, { du: aimX / WORLD.tile, dv: aimY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
        : { dx: aimX, dy: aimY },
      length = Math.hypot(vector.dx, vector.dy), nx = vector.dx / (length || 1), ny = vector.dy / (length || 1),
      dx = target.x - origin.x, dy = target.y - origin.y, along = dx * nx + dy * ny,
      across = Math.abs(dx * ny - dy * nx);
    if (along < 0 || along > reach || across > ROCK_SWIMMER.drillHitRadius) return false;
    const steps = Math.ceil(along / (WORLD.tile * 0.2));
    for (let i = 1; i < steps; i++) {
      const point = { x: origin.x + nx * along * i / steps, y: origin.y + ny * along * i / steps },
        cell = chart
          ? planetCartesianToChart(point, chart.columns, chart.radiusRows, WORLD.tile)
          : { u: point.x / WORLD.tile, v: point.y / WORLD.tile };
      if (world.solid(Math.floor(cell.u), Math.floor(cell.v))) return false;
    }
    if (swimmer.kind === 'hull-scrapper') {
      const facing = chart
          ? planetChartVectorToCartesian(
            { u: swimmer.x / WORLD.tile, v: swimmer.y / WORLD.tile },
            { du: swimmer.vx / WORLD.tile, dv: swimmer.vy / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile,
          )
          : { dx: swimmer.vx, dy: swimmer.vy },
        facingLength = Math.hypot(facing.dx, facing.dy), targetLength = Math.hypot(dx, dy),
        facingPlayerDot = facingLength && targetLength ? (facing.dx * -dx + facing.dy * -dy) / (facingLength * targetLength) : 0;
      if (facingPlayerDot > HULL_SCRAPPER.armorFrontDot) {
        swimmer.armorBlockedFlash = 0.24;
        swimmer.drillCooldown = ROCK_SWIMMER.drillHitCooldownSeconds;
        return false;
      }
    }
    swimmer.health--;
    swimmer.drillCooldown = ROCK_SWIMMER.drillHitCooldownSeconds;
    swimmer.hitFlash = 0.14;
    if (swimmer.kind === 'shard-manta') {
      swimmer.mode = 'recover';
      swimmer.modeTimer = SHARD_MANTA.recoverSeconds;
      swimmer.vx = 0;
      swimmer.vy = 0;
    }
    if (swimmer.health > 0) return false;
    this.repel();
    return true;
  }

  get warning() {
    return !!this.active;
  }
}
