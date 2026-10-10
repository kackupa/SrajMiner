import { atSurface, surfaceTownTier, MAX_TOWN_ALTITUDE } from '../surface/SurfaceStation';
import { WORLD, CORE, CORE_CROSSING_CLEARANCE, PHYSICS as P, FUEL, STASIS_MODULE, RETURN_WINCH, ESCAPE_SUIT, AUTO_GRAPPLE, surfaceYAt, value } from '../config';
import { TileWorld, type Tile } from '../world/TileWorld';
import { crossedStructureDeck, type UndergroundStructure } from '../building/UndergroundStructures';
import { Progress } from '../economy/Progress';
import { planetCartesianToChart, planetCartesianVectorToWorld, planetChartCellCorners, planetChartToCartesian, wrapPlanetSeam } from '../world/PlanetChart';
import { planetCameraFrameAngle, screenDirectionToWorld } from '../world/Projection';
export type Controls = { left: boolean; right: boolean; down: boolean; up: boolean; stasis?: boolean; reel?: boolean; winchTarget?: { x: number; y: number }; escapePack?: boolean };
export type GrappleAnchor = { x: number; y: number };
export function findGrappleAnchor(world: TileWorld, x: number, y: number, reach: number, gravitySign = 1): GrappleAnchor | undefined {
    const tx = Math.floor(x / WORLD.tile), ty = Math.floor(y / WORLD.tile), cells = Math.ceil(reach / WORLD.tile);
  let best: GrappleAnchor | undefined, bestDistance = Infinity;
  const firstY = gravitySign > 0 ? Math.max(0, ty - cells) : ty + 1,
    lastY = gravitySign > 0 ? ty - 1 : ty + cells;
  const firstX = world.planetChart ? tx - cells : Math.max(0, tx - cells),
    lastX = world.planetChart ? tx + cells : Math.min(world.widthTiles - 1, tx + cells);
  for (let gy = firstY; gy <= lastY; gy++) for (let gx = firstX; gx <= lastX; gx++) {
    if (world.get(gx, gy).type === 'empty') continue;
    const ax = gx * WORLD.tile + WORLD.tile / 2,
      ay = gravitySign > 0 ? (gy + 1) * WORLD.tile + 2 : gy * WORLD.tile - 2;
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

function horizontalInsetAt(y: number, chart?: { radiusRows: number }) {
  if (!chart) return P.horizontalCollisionInset;
  const radiusFraction = Math.abs(chart.radiusRows - y / WORLD.tile) / chart.radiusRows;
  // Preserve the wider collision needed in the cramped core passage. Near the
  // outer globe, let the visible pod shell skim past small curved tile lips.
  return radiusFraction < 0.65 ? Math.min(3, P.horizontalCollisionInset) : P.horizontalCollisionInset;
}

function polarCellOverlapsPod(
  world: TileWorld,
  tileX: number,
  tileY: number,
  podX: number,
  podY: number,
  cameraRotation: number,
) {
  const chart = world.planetChart!;
  const halfWidth = P.halfWidth - horizontalInsetAt(podY, chart);
  const rotate = (point: { x: number; y: number }) => ({
    x: point.x * Math.cos(cameraRotation) - point.y * Math.sin(cameraRotation),
    y: point.x * Math.sin(cameraRotation) + point.y * Math.cos(cameraRotation),
  });
  const corners = planetChartCellCorners({ x: tileX, y: tileY }, chart.columns, chart.radiusRows, WORLD.tile),
    center = rotate(planetChartToCartesian({ u: podX / WORLD.tile, v: podY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)),
    polygon = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map(rotate);
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y;
    axes.push({ x: -dy, y: dx });
  }
  for (const axis of axes) {
    const length = Math.hypot(axis.x, axis.y) || 1, nx = axis.x / length, ny = axis.y / length,
      tileProjection = polygon.map((point) => point.x * nx + point.y * ny),
      podCenter = center.x * nx + center.y * ny,
      podRadius = Math.abs(nx) * halfWidth + Math.abs(ny) * P.halfHeight;
    if (Math.max(...tileProjection) < podCenter - podRadius || Math.min(...tileProjection) > podCenter + podRadius) return false;
  }
  return true;
}

function chartTilesUnderPod(world: TileWorld, x: number, y: number, cameraRotation: number) {
  const chart = world.planetChart!;
  const halfWidth = P.halfWidth - horizontalInsetAt(y, chart);
  const corners = [
    { x: -halfWidth, y: -P.halfHeight }, { x: halfWidth, y: -P.halfHeight },
    { x: halfWidth, y: P.halfHeight }, { x: -halfWidth, y: P.halfHeight },
  ].map((offset) => {
    const wx = x + offset.x * Math.cos(cameraRotation) + offset.y * Math.sin(cameraRotation),
      wy = y - offset.x * Math.sin(cameraRotation) + offset.y * Math.cos(cameraRotation),
      polar = planetChartToCartesian({ u: wx / WORLD.tile, v: wy / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile);
    return planetCartesianToChart(polar, chart.columns, chart.radiusRows, WORLD.tile);
  });
  const us = corners.map((point) => point.u), vs = corners.map((point) => point.v), minU = Math.min(...us), maxU = Math.max(...us),
    spansSeam = maxU - minU > chart.columns / 2,
    minX = spansSeam ? 0 : Math.floor(minU) - 2,
    maxX = spansSeam ? chart.columns - 1 : Math.ceil(maxU) + 1,
    minY = Math.max(-1, Math.floor(Math.min(...vs)) - 2),
    maxY = Math.min(chart.radiusRows * 2, Math.ceil(Math.max(...vs)) + 1),
    tiles: Tile[] = [];
  for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
    const tile = world.get(tx, ty);
    if (tile.type !== 'empty' && polarCellOverlapsPod(world, tx, ty, x, y, cameraRotation) &&
        !tiles.some((other) => other.x === tile.x && other.y === tile.y)) tiles.push(tile);
  }
  return tiles;
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
  planetSeamCrossings = 0;
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
  overlaps(x: number, y: number, cameraRotation?: number) {
    if (this.world.planetChart) return chartTilesUnderPod(
      this.world, x, y, cameraRotation ?? planetCameraFrameAngle(x / WORLD.tile, y / WORLD.tile, this.world.planetChart) ?? 0,
    );
    const hits: Tile[] = [];
    for (
      let ty = Math.floor((y - P.halfHeight + 0.00001) / WORLD.tile);
      ty <= Math.floor((y + P.halfHeight - 0.00001) / WORLD.tile);
      ty++
    )
      for (
        let tx = Math.floor((x - P.halfWidth + P.horizontalCollisionInset + 0.00001) / WORLD.tile);
        tx <= Math.floor((x + P.halfWidth - P.horizontalCollisionInset - 0.00001) / WORLD.tile);
        tx++
      )
        if (this.world.solid(tx, ty)) hits.push(this.world.get(tx, ty));
    return hits;
  }
  private townPlatformCrossing(x: number, fromY: number, toY: number, gravitySign: number, dropThrough: boolean) {
    if (dropThrough || x < 430 || x > 1540 || Math.abs(toY - fromY) < 0.00001) return undefined;
    const tier = surfaceTownTier(this.progress.shipComponents, this.progress.milestones.filter((id) => id.startsWith('core-')));
    for (let level = 0; level <= tier; level++) {
    const deckY = surfaceYAt(fromY, this.world.planetChart) - gravitySign * (132 + level * 94);
      const fromFeet = fromY + gravitySign * P.halfHeight;
      const toFeet = toY + gravitySign * P.halfHeight;
      if ((fromFeet - deckY) * gravitySign <= 0 && (toFeet - deckY) * gravitySign >= 0) return deckY - gravitySign * P.halfHeight;
    }
    return undefined;
  }
  private predictsDamagingImpact(input: Controls, cameraRotation: number) {
    let x = this.x, y = this.y, vx = this.vx, vy = this.vy;
    const engine = this.progress.max('engine');
    const dir = Number(input.right) - Number(input.left);
    const speedMultiplier = input.escapePack ? ESCAPE_SUIT.speedMultiplier : 1;
    const maxRise = P.rise * engine * speedMultiplier;
    const step = AUTO_GRAPPLE.predictionStepSeconds;
    for (let elapsed = 0; elapsed < AUTO_GRAPPLE.impactWindowSeconds; elapsed += step) {
      const gravitySign = this.world.gravitySign(y);
      vx += dir * P.acceleration * engine * speedMultiplier * step;
      if (!dir) vx *= Math.exp(-10 * step);
      vx = Math.max(-P.horizontal * engine * speedMultiplier, Math.min(P.horizontal * engine * speedMultiplier, vx));
      const nextX = x + vx * step;
      if (this.overlaps(nextX, y, cameraRotation).length) vx = 0;
      else x = nextX;

      vy += gravitySign * (P.gravity + (input.down ? 110 : 0)) * step;
      vy = gravitySign > 0 ? Math.max(-maxRise, Math.min(P.fall, vy)) : Math.max(-P.fall, Math.min(maxRise, vy));
      const nextY = y + vy * step;
      const townLanding = this.townPlatformCrossing(x, y, nextY, gravitySign, !!input.down);
      const structureLanding = crossedStructureDeck(this.structures, x, y, nextY, gravitySign, P.halfHeight, !!input.down);
      const surfaceY = surfaceYAt(y, this.world.planetChart), dockY = surfaceY - gravitySign * 22;
      const movingOutward = vy * -gravitySign > 0;
      const crossesDock = movingOutward && (gravitySign > 0
        ? y >= dockY && nextY <= dockY
        : y <= dockY && nextY >= dockY);
      if (townLanding !== undefined || structureLanding !== undefined || crossesDock) return false;

      const hitsY = this.overlaps(x, nextY, cameraRotation);
      if (hitsY.length && vy * gravitySign > 0) return Math.abs(vy) > P.safeImpact;
      if (hitsY.length) vy = 0;
      else y = nextY;
    }
    return false;
  }
  private wrapPlanetPosition() {
    const chart = this.world.planetChart;
    if (!chart) return;
    const seam = wrapPlanetSeam(
      { u: this.x / WORLD.tile, v: this.y / WORLD.tile }, this.vy / WORLD.tile, 0, chart.columns, chart.radiusRows,
    );
    if (!seam.crossings) return;
    this.x = seam.u * WORLD.tile;
    this.y = seam.v * WORLD.tile;
    this.vy = seam.dv * WORLD.tile;
    this.planetSeamCrossings += seam.crossings;
  }
  update(dt: number, input: Controls, onImpact: (damage: number) => void, cameraRotation = 0): Tile | undefined {
    this.planetSeamCrossings = 0;
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
    const screenDir = Number(input.right) - Number(input.left),
      cartesianMove = screenDirectionToWorld(screenDir, 0, cameraRotation),
      cartesianThrust = screenDirectionToWorld(0, -1, cameraRotation),
      chart = this.world.planetChart,
      moveAxis = chart ? planetCartesianVectorToWorld(
        { u: this.x / WORLD.tile, v: this.y / WORLD.tile }, cartesianMove, chart.columns, chart.radiusRows, WORLD.tile,
      ) : cartesianMove;
    let thrustAxis = chart ? planetCartesianVectorToWorld(
        { u: this.x / WORLD.tile, v: this.y / WORLD.tile }, cartesianThrust, chart.columns, chart.radiusRows, WORLD.tile,
      ) : cartesianThrust;
    if (requestWinch && input.winchTarget) {
      const current = chart
          ? planetChartToCartesian({ u: this.x / WORLD.tile, v: this.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
          : { x: this.x, y: this.y },
        target = chart
          ? planetChartToCartesian({ u: input.winchTarget.x / WORLD.tile, v: input.winchTarget.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
          : input.winchTarget,
        dx = target.x - current.x, dy = target.y - current.y, length = Math.hypot(dx, dy);
      if (length > 1) {
        const cartesianPull = { x: dx / length, y: dy / length };
        thrustAxis = chart
          ? planetCartesianVectorToWorld({ u: this.x / WORLD.tile, v: this.y / WORLD.tile }, cartesianPull, chart.columns, chart.radiusRows, WORLD.tile)
          : cartesianPull;
      }
    }
    const dir = moveAxis.x, sideAcceleration = moveAxis.y;
    const escapePack = !!input.escapePack;
    this.stasisActive = requestStasis;
    this.reeling = requestWinch;
    this.thrusting = (input.up || requestWinch) && (p.fuel > 0 || escapePack) && !this.stasisActive;
    if (screenDir) this.facing = screenDir;
    // Center a vertical cut gently, so landing near a grid edge does not drill two shafts.
    if (input.down && !screenDir && this.vy * gravitySign >= 0) {
      const center = Math.floor(this.x / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
      const aligned = this.x + Math.max(-70 * dt, Math.min(70 * dt, center - this.x));
      if (!this.overlaps(aligned, this.y, cameraRotation).length) this.x = aligned;
    }
    const escapeSpeed = escapePack ? ESCAPE_SUIT.speedMultiplier : 1;
    const escapeThrust = escapePack ? ESCAPE_SUIT.thrustMultiplier : 1;
    this.vx += dir * P.acceleration * engine * escapeSpeed * dt;
    this.vy += sideAcceleration * P.acceleration * engine * escapeSpeed * dt;
    if (!screenDir) this.vx *= Math.exp(-10 * dt);
    this.vx = Math.max(-P.horizontal * engine * escapeSpeed, Math.min(P.horizontal * engine * escapeSpeed, this.vx));
    if (this.stasisActive) this.vy = 0;
    else {
      const thrust = this.thrusting ? P.thrust * engine * escapeThrust * (this.reeling ? RETURN_WINCH.pullMultiplier : 1) : 0;
      this.vx += thrustAxis.x * thrust * dt;
      this.vy += (gravitySign * (P.gravity + (input.down ? 110 : 0)) + thrustAxis.y * thrust) * dt;
      this.vx = Math.max(-P.horizontal * engine * escapeSpeed, Math.min(P.horizontal * engine * escapeSpeed, this.vx));
    }
    const maxRise = P.rise * engine * escapeSpeed * (this.reeling ? RETURN_WINCH.pullMultiplier : 1),
      // Preserve the pod's ballistic speed through the gravity center. Without
      // this passage-only allowance, the far-side climb cap clips a falling
      // pod from 430 px/s to 185 px/s as soon as gravity reverses, before it
      // can clear the passage and complete the camera turn.
      coreTransit = !!this.world.planetChart && Math.abs(this.y - this.world.coreWorldY) <= CORE_CROSSING_CLEARANCE,
      maxOutward = coreTransit ? Math.max(maxRise, P.fall) : maxRise;
    this.vy = gravitySign > 0 ? Math.max(-maxOutward, Math.min(P.fall, this.vy)) : Math.max(-P.fall, Math.min(maxOutward, this.vy));
    if (p.grappleOwned && this.grappleCooldown <= 0 && gravitySign * this.vy >= AUTO_GRAPPLE.fallSpeed && !input.up && !requestWinch && !this.stasisActive && this.predictsDamagingImpact(input, cameraRotation)) {
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
        hitsX = this.overlaps(nx, this.y, cameraRotation);
      if (hitsX.length) {
        // Steering into any solid side contact means the player is trying to
        // pass it. Offer that obstruction to the drill, including on the globe
        // where tangent motion can map mostly onto chart Y rather than X.
        if (screenDir) target = hitsX.find((t) => t.type !== 'boundary');
        if (Math.abs(this.vx) > P.safeImpact)
          onImpact((Math.abs(this.vx) - P.safeImpact) * P.damageScale);
        // A charted globe's tile indices are angular/radial coordinates, not
        // Cartesian collision bounds. Keep the last known-clear position when
        // the swept step hits a curved cell; snapping to x * tile here can
        // launch the pod across the chart (or wedge it into unrelated terrain).
        if (!this.world.planetChart) this.x =
          this.vx > 0
            ? Math.min(...hitsX.map((t) => t.x * WORLD.tile)) - (P.halfWidth - P.horizontalCollisionInset)
            : Math.max(...hitsX.map((t) => (t.x + 1) * WORLD.tile)) + (P.halfWidth - P.horizontalCollisionInset);
        this.vx = 0;
      } else this.x = nx;
      this.wrapPlanetPosition();
      const stepGravity = this.world.gravitySign(this.y),
        ny = this.y + (this.vy * dt) / steps,
        coreCenterX = WORLD.homeColumn,
        coreCenterY = Math.round(this.world.coreWorldY / WORLD.tile),
        inCorePassage = (x: number, y: number) => {
          const tileX = Math.floor(x / WORLD.tile), tileY = Math.floor(y / WORLD.tile);
          return (tileX - coreCenterX) ** 2 + (tileY - coreCenterY) ** 2 <= CORE.passageRadius ** 2;
        },
        insideCorePassage = inCorePassage(this.x, this.y),
        hitsY = this.overlaps(this.x, ny, cameraRotation);
      const platformY = this.townPlatformCrossing(this.x, this.y, ny, stepGravity, input.down);
      const builtDeckY = crossedStructureDeck(this.structures, this.x, this.y, ny, stepGravity, P.halfHeight, input.down);
      const surfaceY = surfaceYAt(this.y, this.world.planetChart), dockY = surfaceY - stepGravity * 22,
        movingOutward = this.vy * -stepGravity > 0,
        crossesDock = stepGravity > 0 ? this.y >= dockY && ny <= dockY : this.y <= dockY && ny >= dockY;
      if (
        crossesDock && movingOutward && atSurface(this.x, dockY, this.world.planetChart) &&
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
      if (crossesSurfaceFromOutside && movingInward && !input.up && !input.down && atSurface(this.x, dockY, this.world.planetChart)) {
        this.y = dockY;
        if (!input.left && !input.right) this.vx = 0;
        this.vy = 0;
        this.docked = !input.left && !input.right;
        this.thrusting = false;
        this.reeling = false;
        return;
      }
      const crossedCoreThroughPassage =
        insideCorePassage && inCorePassage(this.x, ny) &&
        (this.y < this.world.coreWorldY && ny >= this.world.coreWorldY || this.y > this.world.coreWorldY && ny <= this.world.coreWorldY);
      const landingY = crossedCoreThroughPassage ? undefined : platformY ?? builtDeckY;
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
        // As above, polar chart cells curve in Cartesian space. Their row
        // boundaries cannot be used as player y coordinates.
        if (!this.world.planetChart) this.y = this.vy * stepGravity > 0
          ? stepGravity > 0 ? top - P.halfHeight : bottom + P.halfHeight
          : stepGravity > 0 ? bottom + P.halfHeight : top - P.halfHeight;
        this.vy = 0;
      } else this.y = ny;
      if (!this.world.planetChart)
        this.x = Math.max(P.halfWidth, Math.min(this.world.widthTiles * WORLD.tile - P.halfWidth, this.x));
      if (!this.world.planetChart && this.y < -MAX_TOWN_ALTITUDE) {
        this.y = -MAX_TOWN_ALTITUDE;
        this.vy = 0;
      }
    }
    return input.up || escapePack ? undefined : target;
  }
}
