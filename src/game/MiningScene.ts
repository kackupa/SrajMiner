import Phaser from 'phaser';
import { WORLD, ORES, bandAt } from './config';
import { TileWorld, keyOf, random, type Tile } from './world/TileWorld';
import { PlayerPod, type Controls } from './player/PlayerPod';
import { Progress } from './economy/Progress';
import { MiningSystem } from './mining/MiningSystem';
import { SaveManager } from './save/SaveManager';
import { AudioSystem } from './audio/AudioSystem';
import { HUD } from './ui/HUD';
import { STATIONS, atSurface } from './surface/SurfaceStation';
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  size: number;
};
export class MiningScene extends Phaser.Scene {
  world!: TileWorld;
  pod!: PlayerPod;
  progress = new Progress();
  mining!: MiningSystem;
  saves = new SaveManager();
  soundFx = new AudioSystem();
  ui!: HUD;
  g!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  labels: Phaser.GameObjects.Text[] = [];
  floating: { text: Phaser.GameObjects.Text; x: number; y: number; life: number }[] = [];
  particles: Particle[] = [];
  camX = 0;
  camY = -300;
  tick = 0;
  saveClock = 0;
  uiClock = 0;
  wasSurface = true;
  warned = false;
  shake = 0;
  lastFullWarning = 0;
  constructor() {
    super('mine');
  }
  create() {
    const saved = this.saves.load();
    if (saved) this.saves.restore(this.progress, saved);
    this.world = new TileWorld(
      saved?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0],
      saved?.destroyed,
      saved?.discovered,
    );
    this.pod = new PlayerPod(this.world, this.progress);
    if (saved) {
      this.pod.x = saved.x;
      this.pod.y = saved.y;
      if (this.pod.overlaps(saved.x, saved.y).length) this.pod.reset();
    }
    this.mining = new MiningSystem(this.world, this.progress);
    this.ui = new HUD(
      this.progress,
      {
        start: () => {
          this.soundFx.unlock();
          if (this.saves.warning) this.ui.toast(this.saves.warning);
        },
        pause: () => this.pause(),
        resume: () => this.ui.close(),
        save: () => {
          this.save();
          this.ui.toast(this.saves.warning || 'Expedition saved. Your tunnels are here to stay.');
        },
        sell: () => {
          if (!this.surface) return 0;
          const n = this.progress.sell();
          if (n) {
            this.soundFx.reward();
            this.float(`+$${n}`, this.pod.x, this.pod.y - 45, '#f5ca78');
            this.burst(this.pod.x, this.pod.y, 0xf5ca78, 28);
            this.ui.toast(`+$${n} banked. A little piece of Mars, paid in full.`);
            this.save();
          }
          return n;
        },
        service: (k) => {
          if (!this.surface) return false;
          const ok = this.progress.service(k);
          if (ok) {
            this.soundFx.tone(330, 0.2, 'sine', 0.05, 660);
            this.ui.toast(
              k === 'fuel'
                ? 'Tank topped up. The deep is calling.'
                : 'Hull restored. Ready for a hard landing.',
            );
            this.save();
          }
          return ok;
        },
        buy: (k) => {
          if (!this.surface) return false;
          const ok = this.progress.buy(k);
          if (ok) {
            this.soundFx.reward();
            this.ui.toast(
              `${k.toUpperCase()} upgraded to level ${this.progress.levels[k]}. Make it count.`,
            );
            this.save();
          }
          return ok;
        },
        rescue: () => this.fail(true),
        newGame: () => {
          localStorage.removeItem('mars-miner.v1');
          location.reload();
        },
        mute: () => (this.soundFx.muted = !this.soundFx.muted),
      },
      !!saved,
    );
    document.querySelector('#game')!.appendChild(this.game.canvas);
    const resize = () => {
      const el = document.querySelector('#viewport')!;
      this.scale.resize(el.clientWidth, el.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,ESC,E',
    ) as typeof this.keys;
    this.input.keyboard!.addCapture(['W', 'A', 'S', 'D', 'UP', 'LEFT', 'DOWN', 'RIGHT', 'SPACE']);
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.ui.hasStarted) {
        this.ui.modal ? this.ui.close() : this.pause();
      }
    });
    this.input.keyboard!.on('keydown-E', () => {
      if (this.ui.hasStarted && !this.ui.modal && this.surface) this.ui.open('sell');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.ui.hasStarted) {
        this.pause();
        this.save();
      }
    });
    window.addEventListener('blur', () => {
      if (this.ui.hasStarted && !this.ui.modal) this.pause();
    });
    window.addEventListener('pagehide', () => {
      if (this.ui.hasStarted) this.save();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.ui.modal) {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.modal button:not(:disabled)'),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    this.labels = STATIONS.map((s) =>
      this.add
        .text(0, 0, `${s.label}\n${s.name}`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#e5cbb0',
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = Math.max(-this.scale.height * 0.49, this.pod.y - this.scale.height * 0.44);
    this.world.reveal(this.pod.x, this.pod.y);
    this.ui.update(this.depth, this.surface, 1);
    if (import.meta.env.DEV)
      Object.defineProperty(window, '__mars', {
        configurable: true,
        get: () => ({
          x: this.pod.x,
          y: this.pod.y,
          vx: this.pod.vx,
          vy: this.pod.vy,
          depth: this.depth,
          fuel: this.progress.fuel,
          hull: this.progress.hull,
          cargo: { ...this.progress.cargo },
          money: this.progress.money,
          levels: { ...this.progress.levels },
          destroyed: [...this.world.destroyed],
          chunks: this.world.chunks.size,
          seed: this.world.seed,
          paused: this.ui.paused,
          overlaps: this.pod.overlaps(this.pod.x, this.pod.y).length,
        }),
      });
  }
  get depth() {
    return Math.max(0, Math.floor(((this.pod.y + 16) / WORLD.tile) * WORLD.meters));
  }
  get surface() {
    return atSurface(this.pod.x, this.pod.y);
  }
  pause() {
    if (this.ui.hasStarted && !this.ui.modal) {
      this.ui.open('pause');
      this.soundFx.update(false, false, this.depth, true);
    }
  }
  save() {
    const p = this.progress;
    const ok = this.saves.write({
      version: 1,
      seed: this.world.seed,
      money: p.money,
      levels: { ...p.levels },
      fuel: p.fuel,
      hull: p.hull,
      cargo: { ...p.cargo },
      maxDepth: p.maxDepth,
      artifact: p.artifact,
      x: this.pod.x,
      y: this.pod.y,
      destroyed: [...this.world.destroyed],
      discovered: [...this.world.discovered],
    });
    this.ui.saved(ok);
    if (!ok) this.ui.toast(this.saves.warning);
  }
  fail(recovery = false) {
    this.progress.rescue();
    this.pod.reset();
    this.mining.target = undefined;
    this.mining.ratio = 0;
    this.camY = -this.scale.height * 0.49;
    this.ui.open('failure');
    this.ui.toast(
      recovery
        ? 'Recovery complete. Unsold cargo forfeited.'
        : 'Signal lost. Your pod has been recovered.',
    );
    this.soundFx.tone(100, 0.6, 'sawtooth', 0.04, 25);
    this.save();
  }
  burst(x: number, y: number, color: number, count = 12) {
    for (let i = 0; i < count; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 130,
        vy: -30 - Math.random() * 130,
        life: 0.4 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 3,
      });
  }
  float(label: string, x: number, y: number, color = '#f0d0a0') {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color,
        backgroundColor: '#172024',
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5);
    this.floating.push({ text, x, y, life: 1.6 });
  }
  broken(tile: Tile, collected: boolean) {
    this.shake = 2;
    this.burst(tile.x * 40 + 20, tile.y * 40 + 20, tile.ore ? ORES[tile.ore].color : tile.tint);
    this.soundFx.tone(80, 0.12, 'triangle', 0.06, 30);
    if (tile.ore && collected) {
      this.soundFx.tone(tile.ore === 'diamond' ? 1100 : 650, 0.1, 'sine', 0.04, 950);
      this.float(
        `+1 ${ORES[tile.ore].name.toUpperCase()}`,
        tile.x * 40 + 20,
        tile.y * 40,
        ORES[tile.ore].hex,
      );
    } else if (tile.ore && !collected && this.tick - this.lastFullWarning > 2) {
      this.ui.toast('Cargo full. This ore was left behind — return to sell.');
      this.lastFullWarning = this.tick;
    }
  }
  update(_time: number, delta: number) {
    if (!this.ui) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.tick += dt;
    if (!this.ui.paused) {
      const k = this.keys,
        input: Controls = {
          left: k.A.isDown || k.LEFT.isDown,
          right: k.D.isDown || k.RIGHT.isDown,
          down: k.S.isDown || k.DOWN.isDown,
          up: k.W.isDown || k.UP.isDown || k.SPACE.isDown,
        };
      const target = this.pod.update(dt, input, (damage) => {
        this.progress.hull = Math.max(0, this.progress.hull - damage);
        this.shake = 5;
        this.soundFx.tone(55, 0.22, 'sawtooth', 0.07, 20);
        this.float(`−${Math.ceil(damage)} HULL`, this.pod.x, this.pod.y - 25, '#ff927d');
      });
      this.mining.update(dt, target, (tile, collected) => this.broken(tile, collected));
      this.progress.maxDepth = Math.max(this.progress.maxDepth, this.depth);
      if (this.progress.hull <= 0 || (this.progress.fuel <= 0 && this.pod.y >= 0)) this.fail();
      if (this.progress.fuel <= 0 && this.pod.y < 0) {
        this.progress.rescue();
        this.pod.reset();
        this.ui.toast('Outpost recovery: fresh fuel, cargo forfeited.');
        this.save();
      }
      if (this.surface && !this.wasSurface) {
        this.save();
        this.ui.toast('Welcome back, prospector. Your haul is ready to sell.');
      }
      this.wasSurface = this.surface;
      if (this.progress.fuel / this.progress.max('fuel') < 0.23 && !this.warned) {
        this.soundFx.tone(330, 0.4, 'square', 0.025, 260);
        this.warned = true;
      }
      if (this.progress.fuel / this.progress.max('fuel') > 0.3) this.warned = false;
      if (this.depth > 1050 && !this.progress.artifact) {
        this.progress.artifact = true;
        this.progress.money += 500;
        this.float('UNKNOWN SIGNAL · +$500', this.pod.x, this.pod.y - 40, '#89e8cf');
        this.ui.toast('A buried transmission. Older than the outpost. Survey bounty: $500.');
        this.save();
      }
      this.saveClock += dt;
      if (this.saveClock > 8) {
        this.saveClock = 0;
        this.save();
      }
      this.world.reveal(this.pod.x, this.pod.y);
    }
    this.soundFx.update(this.pod.thrusting, !!this.mining.target, this.depth, this.ui.paused);
    const goalX = Math.max(
        -100,
        Math.min(WORLD.width * 40 - this.scale.width + 100, this.pod.x - this.scale.width / 2),
      ),
      goalY = Math.max(-this.scale.height * 0.49, this.pod.y - this.scale.height * 0.44);
    this.camX += (goalX - this.camX) * (1 - Math.exp(-6 * dt));
    this.camY += (goalY - this.camY) * (1 - Math.exp(-6 * dt));
    this.shake = Math.max(0, this.shake - dt * 15);
    this.world.prune(this.pod.y);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 200 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floating) {
      f.life -= dt;
      f.y -= 20 * dt;
      f.text.setPosition(f.x - this.camX, f.y - this.camY).setAlpha(Math.min(1, f.life * 2));
      if (f.life <= 0) f.text.destroy();
    }
    this.floating = this.floating.filter((f) => f.life > 0);
    this.uiClock += dt;
    if (this.uiClock > 0.08) {
      this.ui.update(this.depth, this.surface, this.uiClock);
      this.uiClock = 0;
    }
    this.draw();
  }
  draw() {
    const g = this.g,
      w = this.scale.width,
      h = this.scale.height,
      T = WORLD.tile;
    const sx = (x: number) => Math.round(x - this.camX + (Math.random() - 0.5) * this.shake),
      sy = (y: number) => Math.round(y - this.camY);
    g.clear();
    g.fillStyle(0x131b20);
    g.fillRect(0, 0, w, h);
    const ground = sy(0);
    if (ground > 0) {
      g.fillGradientStyle(0x17252c, 0x17252c, 0x8c6356, 0x8c6356);
      g.fillRect(0, 0, w, Math.min(h, ground));
      for (let i = 0; i < 65; i++) {
        const x = random(56, i, 1) * w,
          y = random(56, i, 2) * 220;
        g.fillStyle(0xe8d1ba, 0.15 + random(56, i, 3) * 0.35);
        g.fillRect(x, y, 1.5, 1.5);
      }
      g.fillStyle(0xc6b4a2, 0.65);
      g.fillCircle(w * 0.77, ground - 236, 24);
      g.fillStyle(0x21303a, 0.92);
      g.fillCircle(w * 0.77 - 9, ground - 241, 22);
      for (let layer = 0; layer < 3; layer++) {
        const pts: Phaser.Types.Math.Vector2Like[] = [{ x: -50, y: ground }];
        for (let x = -80; x <= w + 160; x += 80) {
          const n = Math.floor((x + this.camX * (0.1 + layer * 0.12)) / 80);
          pts.push({ x, y: ground - 40 - (2 - layer) * 26 - random(440, n, layer) * 75 });
        }
        pts.push({ x: w + 160, y: ground });
        g.fillStyle([0x594f4e, 0x79594e, 0x9c6851][layer]);
        g.fillPoints(pts, true);
      }
      g.fillStyle(0xba805c);
      g.fillRect(0, ground - 8, w, 8);
      g.fillStyle(0xe0a776);
      g.fillRect(0, ground - 8, w, 2);
      for (let i = 0; i < STATIONS.length; i++) {
        const s = STATIONS[i],
          x = sx(s.x),
          y = ground,
          ww = s.width;
        g.fillStyle(0x352e2c);
        g.fillRect(x - ww / 2 - 7, y - 8, ww + 14, 8);
        g.fillStyle(0x39413e);
        g.fillRect(x - ww / 2, y - 57, ww, 49);
        g.fillStyle(0x69736a);
        g.fillRect(x - ww / 2 + 3, y - 61, ww - 6, 6);
        g.fillStyle(0x9b9b80);
        g.fillRect(x - ww / 2 + 8, y - 66, ww - 16, 5);
        g.fillStyle(0x202e30);
        g.fillRect(x - ww / 2 + 8, y - 49, ww - 16, 36);
        g.fillStyle(s.color, 0.9);
        g.fillRect(x - ww / 2 + 10, y - 48, ww - 20, 3);
        if (i === 1) {
          for (let q = 0; q < 3; q++) {
            g.fillStyle(0x82928a);
            g.fillRoundedRect(x - 54 + q * 26, y - 43, 18, 30, 4);
            g.fillStyle(0xb5c6b6);
            g.fillRect(x - 51 + q * 26, y - 40, 3, 22);
          }
          g.lineStyle(2, 0x91c8bb);
          g.strokePoints([
            { x: x + 34, y: y - 37 },
            { x: x + 46, y: y - 37 },
            { x: x + 46, y: y - 13 },
          ]);
        } else {
          for (let q = 0; q < 5; q++) {
            g.fillStyle(s.color, q === 2 ? 0.8 : 0.25);
            g.fillRect(x - 47 + q * 20, y - 39, 12, 11);
          }
          g.fillStyle(0x6c766d);
          g.fillRect(x - 45, y - 21, 90, 4);
        }
        g.fillStyle(0x85917f);
        g.fillRect(x + ww / 2 - 9, y - 103, 3, 39);
        g.fillStyle(s.color, 0.8);
        g.fillRect(x + ww / 2 - 9, y - 101, 21, 10);
        this.labels[i].setVisible(true).setPosition(x, y - 132);
      }
      const ax = sx(490);
      g.lineStyle(3, 0x38413e);
      g.lineBetween(ax, ground - 7, ax, ground - 130);
      g.lineBetween(ax - 22, ground - 7, ax, ground - 90);
      g.lineBetween(ax + 22, ground - 7, ax, ground - 90);
      g.lineStyle(2, 0xabac91);
      g.strokeCircle(ax, ground - 136, 15);
      g.lineBetween(ax - 21, ground - 157, ax + 21, ground - 116);
      g.fillStyle(0xdf9b69, 0.15);
      g.fillEllipse(sx(this.pod.x), ground - 2, 66, 7);
    } else this.labels.forEach((l) => l.setVisible(false));
    const left = Math.max(0, Math.floor(this.camX / T)),
      right = Math.min(WORLD.width - 1, Math.ceil((this.camX + w) / T)),
      top = Math.max(0, Math.floor(this.camY / T)),
      bottom = Math.ceil((this.camY + h) / T);
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const px = sx(x * T),
          py = sy(y * T),
          tile = this.world.get(x, y),
          seen = this.world.discovered.has(keyOf(x, y));
        const distance = Math.hypot((x * T + 20 - this.pod.x) / T, (y * T + 20 - this.pod.y) / T),
          light = Math.max(0.14, 1 - distance / 8);
        if (!seen) {
          g.fillStyle(y < 3 ? 0x3e302e : 0x182023);
          g.fillRect(px, py, T, T);
          g.lineStyle(1, 0x8c6857, 0.05);
          g.strokeRect(px, py, T, T);
          continue;
        }
        if (tile.type === 'empty') {
          g.fillStyle(bandAt(y * 12).colors[2], 0.13);
          g.fillRect(px, py, T, T);
          g.fillStyle(0xcdb296, 0.1 * light);
          g.fillRect(px + 7, py + 31, 2, 2);
          continue;
        }
        g.fillStyle(tile.tint);
        g.fillRect(px, py, T, T);
        g.fillStyle(0xefd0a0, 0.09);
        g.fillRect(px + 1, py + 1, T - 2, 2);
        g.fillStyle(0x0f181d, 0.3);
        g.fillRect(px, py + T - 3, T, 3);
        g.fillRect(px + T - 2, py, 2, T);
        const n = random(this.world.seed, x, y, 100);
        g.fillStyle(0x231f21, 0.25);
        g.fillRect(px + 4 + n * 12, py + 9, 9, 3);
        g.fillRect(px + 20, py + 25 - n * 5, 12, 2);
        g.lineStyle(1, 0x161b20, 0.3);
        g.lineBetween(px + 6, py + 28, px + 13, py + 22);
        if (tile.type === 'hard') {
          g.lineStyle(2, 0xb4a6b2, 0.15);
          g.lineBetween(px + 3, py + 12, px + 28, py + 29);
        }
        if (tile.ore) {
          const color = ORES[tile.ore].color;
          g.fillStyle(color, 0.12);
          g.fillCircle(px + 20, py + 20, 15);
          for (let i = 0; i < 4; i++) {
            const ox = 7 + random(43, x + i, y, 3) * 23,
              oy = 7 + random(51, x, y + i, 6) * 23;
            g.fillStyle(color);
            if (tile.ore === 'diamond')
              g.fillPoints(
                [
                  { x: px + ox, y: py + oy - 4 },
                  { x: px + ox + 4, y: py + oy },
                  { x: px + ox, y: py + oy + 5 },
                  { x: px + ox - 4, y: py + oy },
                ],
                true,
              );
            else g.fillRect(px + ox, py + oy, 5 + (i % 3), 4 + (i % 2));
            g.fillStyle(0xffffff, 0.6);
            g.fillRect(px + ox, py + oy, 2, 1);
          }
        }
        g.fillStyle(0x10191f, 1 - light);
        g.fillRect(px, py, T, T);
        if (this.mining.target?.x === x && this.mining.target?.y === y) {
          g.lineStyle(1, 0xf5d59b, 0.7);
          g.strokeRect(px + 1, py + 1, T - 2, T - 2);
          g.lineStyle(2, 0x1d2528);
          g.strokePoints([
            { x: px + 7, y: py + 2 },
            { x: px + 21, y: py + 17 },
            { x: px + 13, y: py + 27 },
            { x: px + 24, y: py + 39 },
          ]);
          if (this.mining.ratio > 0.4) g.lineBetween(px + 21, py + 17, px + 39, py + 8);
          g.fillStyle(0xecc281);
          g.fillRect(px + 4, py + 34, (T - 8) * this.mining.ratio, 3);
        }
      }
    g.lineStyle(1, 0xc8a078, 0.2);
    for (let y = Math.ceil(top / 5) * 5; y <= bottom; y += 5) {
      g.lineBetween(sx(0), sy(y * T), sx(18), sy(y * T));
      g.lineBetween(sx(WORLD.width * T - 18), sy(y * T), sx(WORLD.width * T), sy(y * T));
    }
    if (this.depth > 1000) {
      g.lineStyle(1, 0x81c5b1, 0.18);
      g.strokeCircle(sx(1200), sy(3560), 50);
      g.strokeCircle(sx(1200), sy(3560), 33);
    }
    const x = sx(this.pod.x),
      y = sy(this.pod.y),
      f = this.pod.facing;
    if (this.pod.thrusting && !this.ui.paused) {
      g.fillStyle(0x9fefe0, 0.12);
      g.fillEllipse(x, y + 30, 42, 44);
      for (const xx of [-10, 10]) {
        g.fillStyle(0xeea95e);
        g.fillTriangle(
          x + xx - 4,
          y + 14,
          x + xx + 4,
          y + 14,
          x + xx,
          y + 27 + Math.sin(this.tick * 47) * 5,
        );
        g.fillStyle(0xc7f2d9);
        g.fillRect(x + xx - 2, y + 14, 4, 7);
      }
    }
    g.fillStyle(0xf5dba0, 0.06);
    g.fillTriangle(x + f * 12, y - 3, x + f * 115, y - 43, x + f * 115, y + 48);
    g.fillStyle(0x121d22);
    g.fillRect(x - 18, y - 9, 36, 23);
    g.fillStyle(0x6c7c78);
    g.fillRect(x - 18, y - 7, 7, 19);
    g.fillRect(x + 11, y - 7, 7, 19);
    g.fillStyle(0x24373b);
    g.fillRect(x - 19, y + 8, 8, 7);
    g.fillRect(x + 11, y + 8, 8, 7);
    g.fillStyle(0xeac781);
    g.fillRoundedRect(x - 12, y - 16, 24, 29, 4);
    g.fillStyle(0xffdfa0);
    g.fillRect(x - 9, y - 15, 18, 3);
    g.fillStyle(0x284a50);
    g.fillRoundedRect(x - 9, y - 10, 18, 12, 3);
    g.fillStyle(0x93d4cc);
    g.fillRect(x - 7, y - 9, 14, 3);
    g.fillStyle(0x6d9293);
    g.fillRect(x - 7, y - 5, 5, 4);
    g.fillStyle(0x715b40);
    g.fillRect(x - 8, y + 6, 16, 3);
    g.fillStyle(0xb1bdb2);
    g.fillTriangle(x - 8, y + 14, x + 8, y + 14, x, y + 22);
    g.lineStyle(1, 0x4b6664);
    g.lineBetween(x - 5, y + 16, x + 4, y + 16);
    g.lineBetween(x - 3, y + 19, x + 2, y + 19);
    g.fillStyle(0xfff0bc);
    g.fillRect(x + f * 13 - 2, y - 6, 4, 4);
    if (this.mining.target && !this.ui.paused && Math.random() < 0.6)
      this.particles.push({
        x: this.pod.x + f * 8,
        y: this.pod.y + 16,
        vx: (Math.random() - 0.5) * 90,
        vy: -Math.random() * 70,
        life: 0.2,
        color: 0xffd383,
        size: 2,
      });
    for (const p of this.particles) {
      g.fillStyle(p.color, Math.min(1, p.life * 2));
      g.fillRect(sx(p.x), sy(p.y), p.size, p.size);
    }
    if (ground > 0)
      for (let i = 0; i < 18; i++) {
        g.fillStyle(0xecc799, 0.18);
        g.fillRect(
          (random(22, i, 0) * w + this.tick * (7 + (i % 4))) % w,
          ground - 14 - random(22, i, 1) * 110,
          2,
          1,
        );
      }
  }
}
