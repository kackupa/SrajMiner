import { HUMAN_RAID } from '../config';
import { advanceHuman, type HumanMotion } from './HumanRaider';
import { weaponRay } from '../player/Weapon';
import { surfaceNests } from './SurfaceTerrain';
import { SURFACE_TERRAIN } from '../config';
import { MOTHERSHIP, SURFACE_RAID, UNDERGROUND_BUILDING, WORLD, type MapId } from '../config';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import { globeSurfaceDistance, surfaceArcCoordinate, surfaceArcPoint, structureIntegrity, surfaceTurretRange, turretStats } from '../building/UndergroundStructures';
import type { TileWorld } from './TileWorld';
import { random } from './TileWorld';
import { planetCartesianToChart, planetChartToCartesian, planetChartVectorToCartesian } from './PlanetChart';

export type SurfaceRaiderState = {
  human?: HumanMotion;
  nestId?: string;
  homeX?: number;
  homeY?: number;
  x: number;
  y: number;
  targetId: string;
  health: number;
  timer: number;
  phase: number;
  hitFlash: number;
  drillCooldown: number;
};

export type SurfaceRaidEvent =
  | { type: 'ship-hit'; x:number;y:number }
  | { type: 'player-hit'; x: number; y: number }
  | { type: 'warning'; target: UndergroundStructure }
  | { type: 'intercepted'; x: number; y: number; source?: 'mothership' }
  | { type: 'damaged' | 'destroyed'; target: UndergroundStructure };

/** A brief colony raid that is telegraphed and has drill/turret counterplay. */
export class SurfaceRaid {
  active?: SurfaceRaiderState;
  private wait: number = SURFACE_RAID.firstWarningSeconds;
  private encounter = 0;
  private humanWait: number = HUMAN_RAID.firstDelay;
  private humanCount = 0;
  private world?: TileWorld;
  private retreatTime = 0;
  private shipReload = 0;
  private shipWait: number = MOTHERSHIP.raidInterval;
  repel() { if(this.active?.nestId)this.world?.clearedTerritories.add(this.active.nestId); this.active = undefined; this.retreatTime = 0; this.resetWait(); }

  private fortOnline = false;
  get secondsUntilArrival() { return Math.max(0, Math.ceil(this.wait)); }

  private resetWait() {
    this.wait = this.fortOnline ? SURFACE_RAID.fortRepeatWarningSeconds : SURFACE_RAID.repeatWarningSeconds;
  }

  constructor(private seed: number, private mapId: MapId) {}

  update(
    dt: number,
    playerAtSurface: boolean,
    world: TileWorld,
    structures: UndergroundStructure[],
    onTurretFire: (x: number, y: number) => void = () => {},
    playerPosition?: { x: number; y: number },
    huntPlayer = false,
    ship?: { x:number; y:number; onFire:(x:number,y:number)=>void;onHit?:()=>void },
  ): SurfaceRaidEvent | undefined {
    this.world=world;
    if (playerAtSurface && huntPlayer) this.humanWait -= dt;
    this.shipReload = Math.max(0, this.shipReload - dt);
    if (!playerAtSurface || this.retreatTime > 0) {
      if (this.active) {
        this.resetWait();
        this.retreatTime += dt;
        if(this.active.human?.kind !== 'ground') this.active.y -= world.gravitySign(this.active.y) * 140 * dt;
        if (this.retreatTime >= 1.8) { this.active=undefined;this.retreatTime=0; }
      }
      return undefined;
    }
    if (!this.active && huntPlayer && playerPosition && this.humanWait <= 0) {
      const kind=this.humanCount%2===0?'ground':'gunship';
      const target=structures.find(s=>s.kind==='extractor'&&globeSurfaceDistance(world,s.x,s.y,playerPosition.x,playerPosition.y)<400) ?? {id:'player',kind:'habitat' as const,...playerPosition};
      const arc=surfaceArcCoordinate(world,target.x,target.y);
      let spawn=surfaceArcPoint(world,arc+HUMAN_RAID.spawnDistance,false);
      if(kind==='ground'){
        let found=false;
        for(const direction of [1,-1]){
          let previousHeight=world.surfaceHeight(target.x,target.y),valid=true;
          for(let d=20;d<=HUMAN_RAID.spawnDistance;d+=20){
            const p=surfaceArcPoint(world,arc+direction*d,false),height=world.surfaceHeight(p.x,p.y),gravity=world.gravitySign(p.y);
            if(Math.abs(height-previousHeight)>24||!world.solid(Math.floor(p.x/WORLD.tile),Math.floor((height+gravity*3)/WORLD.tile))||world.solid(Math.floor(p.x/WORLD.tile),Math.floor((height-gravity*22)/WORLD.tile))){valid=false;break;}
            previousHeight=height;
          }
          if(valid){spawn=surfaceArcPoint(world,arc+direction*HUMAN_RAID.spawnDistance,false);found=true;break;}
        }
        if(!found){this.humanCount++;this.humanWait=15;return;}
      }
      this.humanCount++;
      const gravity=world.gravitySign(spawn.y),ground=world.surfaceHeight(spawn.x,spawn.y);
      this.active={x:spawn.x,y:ground-gravity*(kind==='ground'?22:HUMAN_RAID.altitude),targetId:target.id,health:kind==='ground'?HUMAN_RAID.groundHealth:HUMAN_RAID.flightHealth,timer:HUMAN_RAID.warning,phase:0,hitFlash:0,drillCooldown:0,human:{kind,aimX:target.x,aimY:target.y,moving:0,recoil:0,age:0}};
      this.humanWait=HUMAN_RAID.repeatDelay;
      return {type:'warning',target};
    }
    const hasFort = structures.some(entry => entry.kind === 'fort');
    if (hasFort && !this.fortOnline) this.wait = Math.min(this.wait, SURFACE_RAID.fortFirstWarningSeconds);
    this.fortOnline = hasFort;
    if (!this.active) {
      const buildings = structures.filter(entry => ['habitat','turret','fort','warehouse','trade-post','extractor','wall','gate'].includes(entry.kind) &&
        Math.abs(entry.y-world.surfaceHeight(entry.x,entry.y))<=WORLD.tile*4 &&
        (!playerPosition||globeSurfaceDistance(world,entry.x,entry.y,playerPosition.x,playerPosition.y)<=SURFACE_RAID.visibleColonyRadius));
      // Alternate territorial pressure on the rig and its nearby colony. Underground retreat still ends the encounter.
      let targets: UndergroundStructure[] = huntPlayer&&playerPosition&&(this.encounter%2===0||!buildings.length)
        ? [{id:'player',kind:'habitat',x:playerPosition.x,y:playerPosition.y}] : buildings;
      if(ship?.onHit&&playerPosition&&globeSurfaceDistance(world,ship.x,ship.y,playerPosition.x,playerPosition.y)<SURFACE_RAID.visibleColonyRadius){this.shipWait-=dt;if(this.shipWait<=0)targets=[{id:'mothership',kind:'fort',x:ship.x,y:ship.y}];}
      if (!targets.length) {
        return undefined;
      }
      const nest=world.terrain && playerPosition ? surfaceNests(world).find(n=>!world.clearedTerritories.has(n.id)&&Math.abs(playerPosition.y-world.surfaceHeight(playerPosition.x,playerPosition.y))<240&&globeSurfaceDistance(world,n.x,n.y,playerPosition.x,playerPosition.y)<SURFACE_TERRAIN.territoryRadius) : undefined;
      if(world.terrain){if(!nest&&targets[0]?.id!=='mothership')return undefined;}else{this.wait -= dt;if(this.wait>0)return undefined;}
      const encounter = this.encounter++;
      // An operating outpost inside a nest's territory is a concrete local target.
      // Player turns, ship assaults and underground retreat retain their existing rules.
      const threatenedExtractor = nest && targets.find(entry => entry.kind === 'extractor' && globeSurfaceDistance(world, nest.x, nest.y, entry.x, entry.y) < SURFACE_TERRAIN.territoryRadius);
      const target = threatenedExtractor || targets.find(entry => entry.kind === 'fort') || targets[Math.floor(random(this.seed, encounter, this.mapId.length, 801) * targets.length)]!;
      if(target.id==='mothership')this.shipWait=MOTHERSHIP.raidInterval;
      const sign = random(this.seed, encounter, this.mapId.length, 802) < 0.5 ? -1 : 1;
      const arrival = nest ?? surfaceArcPoint(world, surfaceArcCoordinate(world, target.x, target.y) - sign * SURFACE_RAID.arrivalDistance, false);
      this.active = {
        nestId:nest?.id, homeX:nest?.x, homeY:nest?.y,
        x: arrival.x,
        y: arrival.y - world.gravitySign(arrival.y) * (target.id==='player' ? SURFACE_RAID.approachAltitude : 26),
        targetId: target.id,
        health: target.id==='mothership'?MOTHERSHIP.assaultHealth:SURFACE_RAID.drillHitsToRepel,
        timer: SURFACE_RAID.telegraphSeconds,
        phase: random(this.seed, encounter, this.mapId.length, 803) * Math.PI * 2,
        hitFlash: 0,
        drillCooldown: 0,
      };
      return { type: 'warning', target };
    }

    const raider = this.active;
    if(raider.nestId && playerPosition && globeSurfaceDistance(world,raider.homeX!,raider.homeY!,playerPosition.x,playerPosition.y)>SURFACE_TERRAIN.leashRadius){this.retreatTime=.001;return undefined;}
    raider.hitFlash = Math.max(0, raider.hitFlash - dt);
    raider.drillCooldown = Math.max(0, raider.drillCooldown - dt);
    const attackingPlayer=raider.targetId==='player';
    const target = raider.targetId==='mothership'&&ship ? {id:'mothership',kind:'fort' as const,x:ship.x,y:ship.y} : attackingPlayer && playerPosition ? {id:'player',kind:'habitat' as const,x:playerPosition.x,y:playerPosition.y} : structures.find((entry) => entry.id === raider.targetId);
    if (!target) {
      this.active = undefined;
      this.resetWait();
      return undefined;
    }

    // Limited local protection, never through the planet or into underground territory.
    if (ship && raider.y <= 0 && this.shipReload === 0 && world.gravitySign(raider.y) === world.gravitySign(ship.y) &&
        Math.abs(raider.y-ship.y) <= MOTHERSHIP.defenceAltitude &&
        globeSurfaceDistance(world, ship.x, ship.y, raider.x, raider.y) <= MOTHERSHIP.defenceRange) {
      this.shipReload = MOTHERSHIP.defenceReload;
      ship.onFire(raider.x,raider.y);
    raider.health--; raider.hitFlash = .14;
      if (raider.health <= 0) {
        this.repel();
        return { type:'intercepted', x:ship.x, y:ship.y, source:'mothership' };
      }
    }

    for (const turret of structures) {
      if (turret.kind !== 'turret' || (turret.id === target.id && !raider.human) || (turret.reload ?? 0) > 0) continue;
      if (Math.min(Math.abs(turret.y), Math.abs(turret.y - world.farSurfaceY)) > WORLD.tile * 4) continue;
      if (globeSurfaceDistance(world, turret.x, turret.y, raider.x, raider.y) > surfaceTurretRange(world, turret, structures)) continue;
      turret.reload = turretStats(turret).reloadSeconds;
      onTurretFire(turret.x, turret.y);
      this.repel();
      return { type: 'intercepted', x: turret.x, y: turret.y };
    }

    if(raider.human){
      if(raider.human.age>HUMAN_RAID.lifetime){this.retreatTime=.001;return;}
      const aim={x:target.x,y:target.y-world.gravitySign(target.y)*(attackingPlayer?0:28)};
      const result=advanceHuman(raider,dt,world,aim,structures);
      if(!result.impact)return;
      const shot=result.impact,barriers=structures.filter(s=>s.kind==='wall'||s.kind==='gate');
      const candidates=[...barriers.map(s=>({x:s.x,y:s.y-world.gravitySign(s.y)*28})),aim];
      const hit=weaponRay(world,shot.from,shot.to,HUMAN_RAID.range,candidates).hit;
      if(hit<0)return;
      const victim=hit<barriers.length?barriers[hit]:target;
      if(victim.id==='player')return {type:'player-hit',x:playerPosition!.x,y:playerPosition!.y};
      if(victim.id==='mothership'){ship?.onHit?.();return {type:'ship-hit',x:victim.x,y:victim.y};}
      const health=victim.integrity??structureIntegrity(victim.kind);
      if(health>1){victim.integrity=health-1;return {type:'damaged',target:victim};}
      const index=structures.findIndex(s=>s.id===victim.id);if(index>=0)structures.splice(index,1);
      return {type:'destroyed',target:victim};
    }

    const fullArc = world.widthTiles * WORLD.tile * 2,
      raiderArc = surfaceArcCoordinate(world, raider.x, raider.y), targetArc = surfaceArcCoordinate(world, target.x, target.y),
      rawDelta = ((targetArc - raiderArc) % fullArc + fullArc) % fullArc,
      routeDelta = rawDelta > fullArc / 2 ? rawDelta - fullArc : rawDelta,
      routeDirection = Math.sign(routeDelta), step = Math.min(Math.abs(routeDelta), SURFACE_RAID.approachSpeed * dt),
      barriers = (attackingPlayer ? [] : structures).filter((entry) => entry.kind === 'wall' || entry.kind === 'gate')
        .map((entry) => {
          const difference = ((surfaceArcCoordinate(world, entry.x, entry.y) - raiderArc) % fullArc + fullArc) % fullArc,
            signed = difference > fullArc / 2 ? difference - fullArc : difference,
            along = signed * routeDirection,
            opensForPlayer = entry.kind === 'gate' && !!playerPosition && globeSurfaceDistance(world, playerPosition.x, playerPosition.y, entry.x, entry.y) <= WORLD.tile * 2;
          return { entry, along, opensForPlayer };
        })
        .filter(({ entry, along, opensForPlayer }) => !opensForPlayer && along >= 0 && along <= Math.abs(routeDelta) + UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2)
        .sort((a, b) => a.along - b.along),
      barrier = barriers.find(({ entry, along }) => along <= step + UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2 + 8);
    if (barrier) {
      const stopArc = raiderArc + routeDirection * Math.max(0, barrier.along - UNDERGROUND_BUILDING[barrier.entry.kind].widthTiles * WORLD.tile / 2 - 8),
        point = surfaceArcPoint(world, stopArc, false);
      raider.x = point.x;
      if (!attackingPlayer) raider.y = point.y - world.gravitySign(point.y) * 26;
      raider.timer -= dt;
      if (raider.timer > 0) return undefined;
      const integrity = barrier.entry.integrity ?? structureIntegrity(barrier.entry.kind);
      raider.timer = 2.4;
      if (integrity > 1) {
        barrier.entry.integrity = integrity - 1;
        return { type: 'damaged', target: barrier.entry };
      }
      const index = structures.findIndex((entry) => entry.id === barrier.entry.id);
      if (index >= 0) structures.splice(index, 1);
      return { type: 'destroyed', target: barrier.entry };
    }
    if (step > 0) {
      const point = surfaceArcPoint(world, raiderArc + routeDirection * step, false);
      raider.x = point.x;
      if (!attackingPlayer) raider.y = point.y - world.gravitySign(point.y) * 26;
    }
    if(attackingPlayer && playerPosition) {
      const gravity=world.gravitySign(raider.y), surface=world.surfaceHeight(raider.x,raider.y);
      const altitude = raider.timer > 0 ? SURFACE_RAID.approachAltitude : 26;
      const wanted=gravity>0?Math.min(surface-altitude,playerPosition.y):Math.max(surface+altitude,playerPosition.y);
      raider.y += (wanted-raider.y)*Math.min(1,dt*3);
      raider.y=gravity>0?Math.min(raider.y,surface-26):Math.max(raider.y,surface+26);
      raider.phase += dt*3;
    }
    raider.timer -= dt;
    if (raider.timer > 0 || Math.abs(routeDelta) > step + UNDERGROUND_BUILDING[target.kind].widthTiles * WORLD.tile / 2) return undefined;

    if(attackingPlayer && playerPosition) {
      if(globeSurfaceDistance(world,raider.x,raider.y,playerPosition.x,playerPosition.y)>36 || Math.abs(raider.y-playerPosition.y)>45) return undefined;
      const hit={type:'player-hit' as const,x:raider.x,y:raider.y};this.retreatTime=.001;return hit;
    }
    if(target.id==='mothership'&&ship){ship.onHit?.();this.active=undefined;this.resetWait();return {type:'ship-hit',x:ship.x,y:ship.y};}
    const integrity = target.integrity ?? structureIntegrity(target.kind);
    if (integrity > 1) {
      target.integrity = integrity - 1;
      this.active = undefined;
      this.resetWait();
      return { type: 'damaged', target };
    }
    const index = structures.findIndex((entry) => entry.id === target.id);
    if (index >= 0) structures.splice(index, 1);
    this.active = undefined;
    this.resetWait();
    return { type: 'destroyed', target };
  }

  hitByDrill(world: TileWorld, podX: number, podY: number, aimX: number, aimY: number, reach: number) {
    const raider = this.active;
    if (!raider || raider.drillCooldown > 0 || Math.hypot(aimX, aimY) < 0.001) return false;
    const chart = world.planetChart;
    const origin = chart
      ? planetChartToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { x: podX, y: podY };
    const target = chart
      ? planetChartToCartesian({ u: raider.x / WORLD.tile, v: raider.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { x: raider.x, y: raider.y };
    const vector = chart
      ? planetChartVectorToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, { du: aimX / WORLD.tile, dv: aimY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : { dx: aimX, dy: aimY };
    const length = Math.hypot(vector.dx, vector.dy) || 1;
    const nx = vector.dx / length, ny = vector.dy / length;
    const dx = target.x - origin.x, dy = target.y - origin.y;
    const along = dx * nx + dy * ny, across = Math.abs(dx * ny - dy * nx);
    if (along < 0 || along > reach || across > SURFACE_RAID.drillHitRadius) return false;
    if(weaponRay(world,{x:podX,y:podY},{x:raider.x,y:raider.y},reach,[raider]).hit<0)return false;
    raider.health--;
    raider.drillCooldown = SURFACE_RAID.drillCooldownSeconds;
    raider.hitFlash = 0.14;
    if (raider.health > 0) return false;
    this.repel();
    return true;
  }
}
