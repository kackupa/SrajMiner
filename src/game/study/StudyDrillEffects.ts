import type Phaser from 'phaser';
import { ORES, WORLD } from '../config';
import type { Tile, TileWorld } from '../world/TileWorld';

type Point = { x: number; y: number };
type Fragment = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  angle: number;
  spin: number;
  dust: boolean;
  color: number;
  mineral?: number;
  shape: number[];
  settled: boolean;
};
export const STUDY_ROCK = { body: 0x314751, facet: 0x617880, dust: 0x71858a };

/** Cosmetic debris only. No terrain writes, pickups, collision bodies or save data. */
export class StudyDrillEffects {
  fragments: Fragment[] = [];
  private clock = 0;
  private contact?: { tile: Tile; point: Point; ratio: number };
  clear() {
    this.fragments.length = 0;
    this.clock = 0;
    this.contact = undefined;
  }

  private face(tile: Tile, pod: Point) {
    const x = (tile.x + 0.5) * WORLD.tile,
      y = (tile.y + 0.5) * WORLD.tile;
    const dx = pod.x - x,
      dy = pod.y - y,
      length = Math.hypot(dx, dy) || 1;
    const nx = dx / length,
      ny = dy / length;
    const distance = (WORLD.tile / 2 + 1) / Math.max(Math.abs(nx), Math.abs(ny), 0.1);
    return { x: x + nx * distance, y: y + ny * distance, nx, ny };
  }

  private emit(point: Point, nx: number, ny: number, dust: boolean, large: boolean, tile: Tile) {
    const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.8;
    const speed = dust ? 12 + Math.random() * 24 : (large ? 36 : 25) + Math.random() * 65;
    this.fragments.push({
      x: point.x + (Math.random() - 0.5) * 5,
      y: point.y + (Math.random() - 0.5) * 5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: dust
        ? 0.6 + Math.random() * 0.5
        : large
          ? 1.6 + Math.random() * 0.7
          : 0.45 + Math.random() * 0.4,
      size: dust
        ? 4 + Math.random() * 4
        : large
          ? 6 + Math.random() * 5
          : 1.3 + Math.random() * 1.7,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (large ? 8 : 14),
      dust,
      color: dust ? STUDY_ROCK.dust : STUDY_ROCK.body,
      mineral: tile.ore && Math.random() < 0.35 ? ORES[tile.ore].color : undefined,
      shape: Array.from({ length: 6 }, () => 0.65 + Math.random() * 0.35),
      settled: false,
    });
    if (this.fragments.length > 140) this.fragments.splice(0, this.fragments.length - 140);
  }

  break(tile: Tile, pod: Point) {
    const face = this.face(tile, pod);
    // Peel fragments out of the exposed half of the rock, not a single explosion point.
    for (let i = 0; i < 9; i++) {
      const point = {
        x: (tile.x + 0.5) * WORLD.tile + face.nx * 8 + (Math.random() - 0.5) * 24,
        y: (tile.y + 0.5) * WORLD.tile + face.ny * 8 + (Math.random() - 0.5) * 24,
      };
      this.emit(point, face.nx, face.ny, false, i < 5, tile);
    }
    for (let i = 0; i < 7; i++) this.emit(face, face.nx, face.ny, true, false, tile);
    this.contact = undefined;
  }

  /** Brief footfall puffs and grit, using the same slate as mined debris. */
  tread(point: Point, gravity: number, tile: Tile, landing: boolean) {
    for (let i = 0; i < (landing ? 5 : 2); i++) {
      this.emit(point, 0, -gravity, i !== 0, false, tile);
      const p = this.fragments[this.fragments.length - 1];
      p.size *= .55; p.vx *= .45; p.vy *= .35; p.life *= .65;
      p.mineral = undefined;
    }
  }

  update(
    world: Pick<TileWorld, 'solid' | 'gravitySign'>,
    dt: number,
    tile: Tile | undefined,
    pod: Point,
    ratio: number,
    reduced = false,
  ) {
    if (reduced) this.fragments.length = 0;
    if (tile) {
      const face = this.face(tile, pod);
      this.contact = { tile, point: face, ratio };
      this.clock = reduced ? 0 : this.clock + dt;
      // Time-based emission stays consistent across different frame rates.
      while (this.clock >= 0.065) {
        this.clock -= 0.065;
        this.emit(face, face.nx, face.ny, false, false, tile);
        this.emit(face, face.nx, face.ny, true, false, tile);
      }
    } else {
      this.contact = undefined;
      this.clock = 0;
    }
    const solid = (x: number, y: number) =>
      world.solid(Math.floor(x / WORLD.tile), Math.floor(y / WORLD.tile));
    for (const p of this.fragments) {
      p.age += dt;
      if (p.settled) continue;
      const gravity = world.gravitySign(p.y);
      if (p.dust) {
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-3 * dt);
        p.vy -= gravity * 12 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.vy += gravity * 220 * dt;
        const x = p.x + p.vx * dt,
          y = p.y + p.vy * dt;
        if (solid(x, p.y)) p.vx *= -0.28;
        else p.x = x;
        if (solid(p.x, y)) {
          p.vy *= -0.23;
          p.vx *= 0.65;
          p.spin *= 0.4;
          if (Math.abs(p.vy) < 10) p.settled = true;
        } else p.y = y;
        p.angle += p.spin * dt;
      }
    }
    this.fragments = this.fragments.filter((p) => p.age < p.life);
  }

  draw(g: Phaser.GameObjects.Graphics, project: (x: number, y: number) => Point, reduced: boolean) {
    const hit = this.contact;
    if (hit && hit.ratio > 0.08) {
      const cx = (hit.tile.x + 0.5) * WORLD.tile,
        cy = (hit.tile.y + 0.5) * WORLD.tile;
      // Cracks grow into the rock from the drill face, without outlining its tile.
      for (let branch = -1; branch <= 1; branch++) {
        const points = Array.from({ length: 5 }, (_, i) => {
          const t = (i / 4) * Math.min(1, hit.ratio * 1.2);
          return project(
            hit.point.x + (cx - hit.point.x) * t + branch * 11 * t,
            hit.point.y +
              (cy - hit.point.y) * t +
              branch * 9 * t +
              Math.sin(i * 2 + branch) * 2 * t,
          );
        });
        g.lineStyle(1.3, 0x071923, 0.8);
        g.strokePoints(points, false);
      }
    }
    if (reduced) return;
    // Dust first, then solid fragments, so chips remain legible through the plume.
    for (const p of this.fragments.filter((p) => p.dust)) {
      const pos = project(p.x, p.y),
        t = p.age / p.life;
      const size = p.size * (1 + t * 2.2),
        alpha = Math.min(1, t * 12) * (1 - t) * 0.14;
      g.fillStyle(p.color, alpha);
      g.fillEllipse(pos.x, pos.y, size * 2.1, size * 1.4);
      g.fillStyle(p.color, alpha * 0.45);
      g.fillCircle(pos.x - size * 0.2, pos.y - size * 0.2, size * 0.65);
    }
    for (const p of this.fragments.filter((p) => !p.dust)) {
      const alpha = Math.min(1, (p.life - p.age) / 0.4);
      const points = p.shape.map((r, i) => {
        const a = p.angle + (i * Math.PI) / 3;
        return project(p.x + Math.cos(a) * r * p.size, p.y + Math.sin(a) * r * p.size * 0.7);
      });
      g.fillStyle(p.color, alpha);
      g.fillPoints(points, true);
      g.fillStyle(STUDY_ROCK.facet, alpha * 0.8);
      g.fillPoints([points[0], points[1], points[2], project(p.x, p.y)], true);
      if (p.mineral) {
        g.lineStyle(1, p.mineral, alpha * 0.85);
        g.lineBetween(points[0].x, points[0].y, points[3].x, points[3].y);
      }
    }
  }
}
