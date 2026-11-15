import { UNDERGROUND_BUILDING } from '../config';
import type { TileWorld } from '../world/TileWorld';
import { traceWorkLamp } from '../world/WorkLamp';
import type { UndergroundStructure } from './UndergroundStructures';

/** Cached separately from durable structures; excavation invalidates nearby light rays. */
export class TunnelLights {
  lit = new Set<string>();
  traces = new Map<string, ReturnType<typeof traceWorkLamp>>();
  private revisions = new Map<string, number>();
  private world?: TileWorld;
  private elapsed = 1;
  update(world: TileWorld, structures: readonly UndergroundStructure[], viewer: {x:number;y:number}, dt: number) {
    if (this.world !== world) { this.world=world; this.traces.clear(); this.revisions.clear(); this.elapsed=1; }
    this.elapsed += dt;
    if (this.elapsed < UNDERGROUND_BUILDING.light.refreshSeconds) return;
    this.elapsed=0;
    const lamps=structures.filter(s=>s.kind==='light'), ids=new Set(lamps.map(s=>s.id));
    for (const id of this.traces.keys()) if (!ids.has(id)) { this.traces.delete(id); this.revisions.delete(id); }
    for (const lamp of lamps) {
      if (this.traces.has(lamp.id) && (this.revisions.get(lamp.id)===world.destroyed.size || Math.hypot(viewer.x-lamp.x,viewer.y-lamp.y)>1600)) continue;
      const trace=traceWorkLamp(world,lamp,{x:lamp.x+1,y:lamp.y},UNDERGROUND_BUILDING.light.range,Math.PI,UNDERGROUND_BUILDING.light.rays);
      this.traces.set(lamp.id,trace); this.revisions.set(lamp.id,world.destroyed.size);
    }
    this.lit.clear();
    for (const trace of this.traces.values()) for (const key of trace.lit) { this.lit.add(key); world.discovered.add(key); }
  }
}
