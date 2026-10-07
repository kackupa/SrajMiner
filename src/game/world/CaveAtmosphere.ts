import type Phaser from 'phaser';
import { CAVE_ATMOSPHERE, FAR_SURFACE_Y, WORLD } from '../config';
import { TileWorld, keyOf } from './TileWorld';

type Mote = {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; phase: number; size: number;
  foreground: boolean; wake: boolean;
};
type AtmosphereView = {
  x: number; y: number; width: number; height: number;
  podX: number; podY: number; thrusting: boolean; drilling: boolean;
  aimX: number; aimY: number;
};

// Purely transient decoration: never enters world generation or the campaign save.
export class CaveAtmosphere {
  motes: Mote[] = [];
  enabled = true;
  private world?: TileWorld;
  private emission = 0;
  private wakeEmission = 0;

  constructor() {
    try { this.enabled = localStorage.getItem('mars-miner.atmosphere.v1') !== 'off'; } catch { /* Optional preference. */ }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
    try { localStorage.setItem('mars-miner.atmosphere.v1', enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
  }

  clear() {
    this.motes.length = 0;
    this.emission = this.wakeEmission = 0;
  }

  private open(world: TileWorld, x: number, y: number) {
    const tx = Math.floor(x / WORLD.tile), ty = Math.floor(y / WORLD.tile);
    return y > 0 && y < FAR_SURFACE_Y && world.discovered.has(keyOf(tx, ty)) && !world.solid(tx, ty);
  }

  update(world: TileWorld, dt: number, view: AtmosphereView, reducedMotion: boolean, paused: boolean) {
    if (this.world !== world) { this.clear(); this.world = world; }
    if (!this.enabled || reducedMotion) { this.clear(); return; }
    if (paused) return;
    const gravity = world.gravitySign(view.podY);
    for (const p of this.motes) {
      p.age += dt;
      const dx = p.x - view.podX, dy = p.y - view.podY;
      const distance = Math.hypot(dx, dy);
      if (view.thrusting && distance < 90) {
        const strength = (1 - distance / 90) * dt;
        p.vx += dx * strength * 1.8;
        p.vy += (dy + gravity * 55) * strength * 1.8;
      }
      const damping = Math.exp(-dt * (p.wake ? 1.4 : 0.65));
      p.vx *= damping;
      p.vy *= damping;
      p.x += (p.vx + Math.sin(p.phase + p.age * 0.7) * 3 + 3) * dt;
      p.y += (p.vy + gravity * (p.foreground ? 6 : 2)) * dt;
    }
    this.motes = this.motes.filter(p => p.age < p.life &&
      p.x > view.x - 40 && p.x < view.x + view.width + 40 &&
      p.y > view.y - 40 && p.y < view.y + view.height + 40 && this.open(world, p.x, p.y));

    const spawn = (x: number, y: number, wake: boolean, vx = 0, vy = 0) => {
      const limit = wake ? CAVE_ATMOSPHERE.maxParticles : CAVE_ATMOSPHERE.maxParticles - 24;
      if (this.motes.length >= limit || !this.open(world, x, y)) return;
      const foreground = !wake && Math.random() < 0.1;
      this.motes.push({ x, y, vx, vy, age: 0, life: wake ? 1.8 : 8 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2, size: foreground ? 3.2 : 0.8 + Math.random(), foreground, wake });
    };
    // Bounded attempts keep dense rock and narrow shafts cheap, regardless of viewport size.
    this.emission += dt * CAVE_ATMOSPHERE.spawnAttemptsPerSecond;
    for (let i = 0, count = Math.min(8, Math.floor(this.emission)); i < count; i++) {
      this.emission--;
      const nearby = Math.random() < 0.7;
      spawn(nearby ? view.podX + (Math.random() - 0.5) * 300 : view.x + Math.random() * view.width,
        nearby ? view.podY + (Math.random() - 0.5) * 300 : view.y + Math.random() * view.height, false);
    }
    if (view.thrusting || view.drilling) {
      this.wakeEmission += dt * CAVE_ATMOSPHERE.wakePerSecond;
      while (this.wakeEmission >= 1) {
        this.wakeEmission--;
        const drill = view.drilling && (!view.thrusting || Math.random() < 0.5);
        const dx = drill ? view.aimX : 0, dy = drill ? view.aimY : gravity;
        spawn(view.podX + dx * 20 + (Math.random() - 0.5) * 15,
          view.podY + dy * 20 + (Math.random() - 0.5) * 15, true,
          (Math.random() - 0.5) * 45 - dx * (drill ? 22 : 0), dy * (drill ? -22 : 65));
      }
    } else this.wakeEmission = 0;
  }

  draw(g: Phaser.GameObjects.Graphics, world: TileWorld, view: AtmosphereView,
    sx: (x: number) => number, sy: (y: number) => number, foreground: boolean) {
    if (!this.enabled) return;
    const color = CAVE_ATMOSPHERE.colors[world.mapId];
    for (const p of this.motes) {
      if (p.foreground !== foreground || !this.open(world, p.x, p.y)) continue;
      const dx = p.x - view.podX, dy = p.y - view.podY, distance = Math.hypot(dx, dy);
      const proximity = Math.max(0, 1 - distance / CAVE_ATMOSPHERE.lightRadius);
      if (proximity <= 0) continue;
      const beam = Math.max(0, (dx * view.aimX + dy * view.aimY) / Math.max(1, distance));
      const fade = Math.min(1, p.age / 0.8, (p.life - p.age) / 1.5);
      // Leave the vehicle silhouette clear; opaque ore and hazard art stays dominant.
      const clearance = Math.min(1, Math.max(0, (distance - 24) / 30));
      const alpha = fade * clearance * proximity * (0.18 + beam * 0.4);
      const x = sx(p.x), y = sy(p.y);
      const edgeX = p.x % WORLD.tile, edgeY = p.y % WORLD.tile;
      const margin = Math.min(edgeX, WORLD.tile - edgeX, edgeY, WORLD.tile - edgeY);
      const size = Math.min(p.size, margin);
      if (size < 0.4) continue;
      if (foreground || p.wake) {
        g.fillStyle(color, alpha * 0.12);
        g.fillCircle(x, y, Math.min(margin, size * (p.wake ? 5 : 2.5)));
      }
      g.fillStyle(color, alpha);
      if (world.mapId === 'prism-fault') {
        g.fillTriangle(x, y - size, x - size, y + size, x + size, y + size);
      } else if (world.mapId === 'mars-frontier' || p.wake) {
        g.fillCircle(x, y, size * 0.65);
      } else {
        const angle = p.phase + p.age * 0.6;
        g.lineStyle(foreground ? 1.5 : 1, color, alpha);
        g.lineBetween(x - Math.cos(angle) * size, y - Math.sin(angle) * size,
          x + Math.cos(angle) * size, y + Math.sin(angle) * size);
      }
    }
  }
}
