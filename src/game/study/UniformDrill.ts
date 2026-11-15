import type { UniformCell } from './UniformPlanet';

/** One physical cutter: finish one exposed block before starting the next.
 * Keep its target through small aim changes, but never through intervening rock. */
export class UniformDrill {
  target?: UniformCell;
  elapsed = 0;
  reset() { this.target = undefined; this.elapsed = 0; }
  step(face: UniformCell[], active: boolean, dt: number, seconds: number,
    weakening: (cell: UniformCell) => number, available: (cell: UniformCell) => boolean) {
    const target = this.target && face.includes(this.target) ? this.target : face[0];
    if (target !== this.target || !active) this.elapsed = 0;
    this.target = target;
    if (!active || !target || !available(target)) return;
    this.elapsed += dt;
    if (this.elapsed < seconds * (1 - weakening(target))) return;
    this.elapsed = 0;
    return target;
  }
}
