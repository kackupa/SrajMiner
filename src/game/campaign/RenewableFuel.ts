import { CORE_FUEL } from '../config';
/** Session-only work. A completed cycle yields at most one unit, never a fractional reward. */
export function coreExtractionStep(elapsed: number, dt: number, recovered: boolean, exposed: boolean, working: boolean, fuel: number) {
 if(!recovered||!exposed||!working||fuel>=CORE_FUEL.renewableCeiling) return {elapsed:0,reward:0};
 const next=elapsed+Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
 return next+1e-8>=CORE_FUEL.extractionSeconds?{elapsed:0,reward:Math.min(1,CORE_FUEL.renewableCeiling-fuel)}:{elapsed:next,reward:0};
}
