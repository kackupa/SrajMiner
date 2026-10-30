import { UNIFORM_PLANET_STUDY as C } from '../config';

/** One deposit per planetary visit. Waiting never replenishes it. */
export class UniformCore {
  remaining: number = C.coreFuelPerCycle;
  extraction = 0;
  beginVisit() {
    this.remaining = C.coreFuelPerCycle;
    this.extraction = 0;
  }
  mine(dt: number, extracting: boolean) {
    if (!extracting || !this.remaining) { this.extraction = 0; return 0; }
    // No background-tab catch-up extraction or rewards for simply returning.
    this.extraction += Math.max(0, Math.min(.1, dt));
    if (this.extraction + 1e-8 < C.coreSecondsPerUnit) return 0;
    this.extraction = 0;
    this.remaining--;
    return 1;
  }
}
