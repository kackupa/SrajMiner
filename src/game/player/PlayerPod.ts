import { atSurface, surfaceTownTier, TOWN_TIER_HEIGHTS } from '../surface/SurfaceStation';
import { WORLD, PHYSICS as P, FUEL, STASIS_MODULE, RETURN_WINCH, ESCAPE_SUIT, AUTO_GRAPPLE, surfaceYAt, value } from '../config';
import { TileWorld, type Tile } from '../world/TileWorld';
import { crossedStructureDeck, type UndergroundStructure } from '../building/UndergroundStructures';
import { Progress } from '../economy/Progress';
export type Controls = { left: boolean; right: boolean; down: boolean; up: boolean; stasis?: boolean; reel?: boolean; escapePack?: boolean };
export type GrappleAnchor = { x: number; y: number };
export function findGrappleAnchor(world: TileWorld, x: number, y: number, reach: number, gravitySign = 1): GrappleAnchor | undefined {
    const tx = Math.floor(x / WORLD.tile), ty = Math.floor(y / WORLD.tile), cells = Math.ceil(reach / WORLD.tile);
  let best: GrappleAnchor | undefined, bestDistance = Infinity;
  const firstY = gravitySign > 0 ? Math.max(0, ty - cells) : ty + 1,
    lastY = gravitySign > 0 ? ty - 1 : ty + cells;
  for (let gy = firstY; gy <= lastY; gy++) for (let gx = Math.max(0, tx - cells); gx <= Math.min(WORLD.width - 1, tx + cells); gx++) {
    if (world.get(gx, gy).type === 'empty') continue;
    const ax = gx * WORLD.tile + WORLD.tile / 2, ay = (gy + 1) * WORLD.tile + 2;
    const dx = ax - x, dy = ay - y, distance = Math.hypot(dx, dy);
    if (dy * gravitySign > -AUTO_GRAPPLE.minRise || distance > reach || distance >= bestDistance) continue;
    let clear = true;
    const steps = Math.ceil(distance / (WORLD.tile / 3));
    for (let step = 1; step < steps; step++) {
      const sx = x + dx * step / steps, sy = y + dy * step / steps;
      if (world.solid(Math.floor(sx / WORLD.tile), Math.floor(sy / WORLD.tile))) { clear = false; break; }
    }
    if (clear) { best = { x: ax, y: ay }; bestDistance = distance; }
  }
  return best;
}
export class PlayerPod {
  x = WORLD.spawnX;
  y = WORLD.spawnY;
  vx = 0;
  vy = 0;
  facing = 1;
  thrusting = false;
  stasisActive = false;
  reeling = false;
  grappleAnchor?: GrappleAnchor;
  structures: readonly UndergroundStructure[] = [];
  private grappleHang = 0;
  private grappleCooldown = 0;
  scannerRadius = 4;
  docked = true;
  constructor(
    public world: TileWorld,
    public progress: Progress,
  ) {}
  reset() {
    this.docked = true;
    this.thrusting = false;
    this.stasisActive = false;
    this.reeling = false;
    this.grappleAnchor = undefined;
    this.grappleHang = this.grappleCooldown = 0;
    this.x = WORLD.spawnX;
    this.y = WORLD.spawnY;
    this.vx = 0;
    this.vy = 0;
  }
  overlaps(x: number, y: number) {
    const hits: Tile[] = [];
    for (
      let ty = Math.floor((y - P.halfHeight + 0.00001) / WORLD.tile);
      ty <= Math.floor((y + P.halfHeight - 0.00001) / WORLD.tile);
      ty++
    )
      for (
        let tx = Math.floor((x - P.halfWidth + 0.00001) / WORLD.tile);
        tx <= Math.floor((x + P.halfWidth - 0.00001) / WORLD.tile);
        tx++
      )
        if (this.world.solid(tx, ty)) hits.push(this.world.get(tx, ty));
    return hits;
  }
  private townPlatformCrossing(x: number, fromY: number, toY: number, gravitySign: number, dropThrough: boolean) {
    if (dropThrough || x < 430 || x > 1540 || Math.abs(toY - fromY) < 0.00001) return undefined;
    const tier = surfaceTownTier(this.progress.shipComponents, this.progress.milestones.filter((id) => id.startsWith('core-')));
    for (let level = 0; level <= tier; level++) {
      const deckY = surfaceYAt(fromY) - gravitySign * (132 + level * 94);
      const fromFeet = fromY + gravitySign * P.halfHeight;
      const toFeet = toY + gravitySign * P.halfHeight;
      if ((fromFeet - deckY) * gravitySign <= 0 && (toFeet - deckY) * gravitySign >= 0) return deckY - gravitySign * P.halfHeight;
    }
    return undefined;
  }
  update(dt: number, input: Controls, onImpact: (damage: number) => void): Tile | undefined {
    const gravitySign = this.world.gravitySign(this.y),
      p = this.progress,
      engine = p.max('engine'),
      requestStasis = !!input.stasis && p.stasisModule && p.fuel > 0 && this.y > 0,
      requestWinch = !!input.reel && p.returnWinch && p.fuel > 0 && this.y > 0 && !requestStasis;
    if (this.docked) {
      if (!input.left && !input.right && !input.down && !input.up && !requestStasis) {
        this.vx = 0;
        this.vy = 0;
        this.thrusting = false;
        this.stasisActive = false;
        this.reeling = false;
        return;
      }
      if (!input.left && !input.right && !input.down && !input.up && input.stasis && !requestStasis) return;
      this.docked = false;
    }
    this.grappleCooldown = Math.max(0, this.grappleCooldown - dt);
    if (this.grappleAnchor) {
      this.grappleHang = Math.max(0, this.grappleHang - dt);
      if (input.up || this.grappleHang <= 0) this.grappleAnchor = undefined;
      else {
        this.vx = this.vy = 0;
        this.thrusting = this.reeling = this.stasisActive = false;
        return;
      }
    }
    const dir = Number(input.right) - Number(input.left);
    const escapePack = !!input.escapePack;
    this.stasisActive = requestStasis;
    this.reeling = requestWinch;
    this.thrusting = (input.up || requestWinch) && (p.fuel > 0 || escapePack) && !this.stasisActive;
    if (dir) this.facing = dir;
    // Center a vertical cut gently, so landing near a grid edge does not drill two shafts.
    if (input.down && !dir && this.vy * gravitySign >= 0) {
      const center = Math.floor(this.x / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
      const aligned = this.x + Math.max(-70 * dt, Math.min(70 * dt, center - this.x));
      if (!this.overlaps(aligned, this.y).length) this.x = aligned;
    }
    const escapeSpeed = escapePack ? ESCAPE_SUIT.speedMultiplier : 1;
    const escapeThrust = escapePack ? ESCAPE_SUIT.thrustMultiplier : 1;
    this.vx += dir * P.acceleration * engine * escapeSpeed * dt;
    if (!dir) this.vx *= Math.exp(-10 * dt);
    this.vx = Math.max(-P.horizontal * engine * escapeSpeed, Math.min(P.horizontal * engine * escapeSpeed, this.vx));
    if (this.stasisActive) this.vy = 0;
    else this.vy += gravitySign * (P.gravity + (input.down ? 110 : 0) - (this.thrusting ? P.thrust * engine * escapeThrust * (this.reeling ? RETURN_WINCH.pullMultiplier : 1) : 0)) * dt;
    const maxRise = P.rise * engine * escapeSpeed * (this.reeling ? RETURN_WINCH.pullMultiplier : 1);
    this.vy = gravitySign > 0 ? Math.max(-maxRise, Math.min(P.fall, this.vy)) : Math.max(-P.fall, Math.min(maxRise, this.vy));
    if (this.grappleCooldown <= 0 && gravitySign * this.vy >= AUTO_GRAPPLE.fallSpeed && !input.up && !requestWinch && !this.stasisActive) {
      const anchor = findGrappleAnchor(this.world, this.x, this.y, value(p.levels, 'grapple'), gravitySign);
      if (anchor) {
        this.grappleAnchor = anchor;
        this.grappleHang = AUTO_GRAPPLE.hangSeconds;
        this.grappleCooldown = Math.max(1, AUTO_GRAPPLE.cooldownSeconds.at(-1)! - Math.max(0, p.levels.grapple - AUTO_GRAPPLE.cooldownSeconds.length));
        this.vx = this.vy = 0;
        this.thrusting = this.reeling = false;
        return;
      }
    }
    p.fuel = Math.max(
      0,
      p.fuel - (escapePack ? 0 : dt * ((dir || input.down ? FUEL.moving : 0) + (this.thrusting ? FUEL.thrust * (this.reeling ? RETURN_WINCH.fuelMultiplier : 1) : 0) + (this.stasisActive ? STASIS_MODULE.fuelPerSecond : 0))),
    );
    let target: Tile | undefined;
    const steps = Math.max(1, Math.ceil((Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt) / 7));
    for (let i = 0; i < steps; i++) {
      const nx = this.x + (this.vx * dt) / steps,
        hitsX = this.overlaps(nx, this.y);
      if (hitsX.length) {
        if (dir && Math.sign(this.vx) === dir) target = hitsX.find((t) => t.type !== 'boundary');
        if (Math.abs(this.vx) > P.safeImpact)
          onImpact((Math.abs(this.vx) - P.safeImpact) * P.damageScale);
        this.x =
          this.vx > 0
            ? Math.min(...hitsX.map((t) => t.x * WORLD.tile)) - P.halfWidth
            : Math.max(...hitsX.map((t) => (t.x + 1) * WORLD.tile)) + P.halfWidth;
        this.vx = 0;
      } else this.x = nx;
      const stepGravity = this.world.gravitySign(this.y),
        ny = this.y + (this.vy * dt) / steps,
        hitsY = this.overlaps(this.x, ny);
      const platformY = this.townPlatformCrossing(this.x, this.y, ny, stepGravity, input.down);
      const builtDeckY = crossedStructureDeck(this.structures, this.x, this.y, ny, stepGravity, P.halfHeight, input.down);
      const surfaceY = surfaceYAt(this.y), dockY = surfaceY - stepGravity * 22,
        movingOutward = this.vy * -stepGravity > 0,
        crossesDock = stepGravity > 0 ? this.y >= dockY && ny <= dockY : this.y <= dockY && ny >= dockY;
      if (
        crossesDock && movingOutward && atSurface(this.x, dockY) &&
        (this.reeling || !input.up && !input.down)
      ) {
        this.y = dockY;
        this.vy = 0;
        this.thrusting = false;
        this.reeling = false;
        this.docked = !input.left && !input.right;
        return;
      }
      const movingInward = this.vy * stepGravity > 0,
        crossesSurfaceFromOutside = stepGravity > 0 ? this.y <= dockY && ny >= dockY : this.y >= dockY && ny <= dockY;
      if (crossesSurfaceFromOutside && movingInward && !input.up && !input.down && atSurface(this.x, dockY)) {
        this.y = dockY;
        if (!input.left && !input.right) this.vx = 0;
        this.vy = 0;
        this.docked = !input.left && !input.right;
        this.thrusting = false;
        this.reeling = false;
        return;
      }
      const landingY = platformY ?? builtDeckY;
      if (landingY !== undefined && this.vy * stepGravity > 0) {
        if (Math.abs(this.vy) > P.safeImpact) onImpact((Math.abs(this.vy) - P.safeImpact) * P.damageScale);
        this.y = landingY;
        this.vy = 0;
      } else
      if (hitsY.length) {
        if (this.vy * stepGravity > 0) {
          if (input.down) target = hitsY.find((t) => t.type !== 'boundary');
          if (Math.abs(this.vy) > P.safeImpact) onImpact((Math.abs(this.vy) - P.safeImpact) * P.damageScale);
        }
        const top = Math.min(...hitsY.map((t) => t.y * WORLD.tile)),
          bottom = Math.max(...hitsY.map((t) => (t.y + 1) * WORLD.tile));
        this.y = this.vy * stepGravity > 0
          ? stepGravity > 0 ? top - P.halfHeight : bottom + P.halfHeight
          : stepGravity > 0 ? bottom + P.halfHeight : top - P.halfHeight;
        this.vy = 0;
      } else this.y = ny;
      this.x = Math.max(P.halfWidth, Math.min(WORLD.width * WORLD.tile - P.halfWidth, this.x));
      if (this.y < -TOWN_TIER_HEIGHTS[4] - 100) {
        this.y = -TOWN_TIER_HEIGHTS[4] - 100;
        this.vy = 0;
      }
    }
    return input.up || escapePack ? undefined : target;
  }
}
