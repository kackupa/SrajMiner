import type Phaser from 'phaser';
import { drawStudyCreature } from './StudyCreatureArt';
import type { UniformCombat } from './UniformCombat';
import type { Point } from './UniformPlanet';
import { drawRaider } from './ExpeditionArt';
export function drawUniformCombat(
  g: Phaser.GameObjects.Graphics,
  combat: UniformCombat,
  project: (p: Point) => Point,
  scale: number,
  time: number,
  overview: boolean,
) {
  for (const b of combat.bodies) {
    if (b.hp <= 0 && b.deadAge > 1) continue;
    const p = project(b);
    if (
      p.x < -100 ||
      p.y < -100 ||
      p.x > g.scene.scale.width + 100 ||
      p.y > g.scene.scale.height + 100
    )
      continue;
    if (overview) {
      if (b.seen && b.hp > 0) {
        g.fillStyle(b.kind === 'nest' ? 0xefaa78 : 0xc77871);
        g.fillCircle(p.x, p.y, b.kind === 'nest' ? 4 : 2);
      }
      continue;
    }
    const radius = Math.hypot(b.x, b.y) || 1,
      out = { x: b.x / radius, y: b.y / radius };
    const at = (x: number, y: number) =>
      project({ x: b.x - out.y * x - out.x * y, y: b.y + out.x * x - out.y * y });
    if (b.hp <= 0) {
      g.fillStyle(0x82988d, 1 - b.deadAge);
      for (let i = 0; i < 6; i++) {
        const a = i * 2.4,
          q = at(Math.cos(a) * b.deadAge * 45, Math.sin(a) * b.deadAge * 30);
        g.fillTriangle(q.x - 4, q.y, q.x + 3, q.y - 5, q.x + 4, q.y + 3);
      }
      continue;
    }
    if (b.gunship) {
      drawRaider(g,b,at,project,time,scale);
    } else if (b.kind === 'nest') {
      const pulse = 1 + Math.sin(time * 3 + b.id) * 0.05;
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 8,
          y = Math.sin(i * 1.7) * 5;
        g.fillStyle(i % 2 ? 0x4d655d : 0x78917e);
        g.fillPoints(
          [at(x - 10, y + 17), at(x - 7, y - 5), at(x, y - 16 * pulse), at(x + 10, y + 14)],
          true,
        );
        g.lineStyle(1.3 * scale, 0xaab79b);
        g.strokePoints([at(x - 7, y - 5), at(x, y - 16 * pulse)]);
      }
      const q = at(0, 0);
      g.fillStyle(b.flash ? 0xffe5b9 : 0x162e32);
      g.fillEllipse(q.x, q.y, 34 * scale, 26 * scale);
      g.fillStyle(0xe7ad78, 0.8);
      for (let i = 0; i < 3; i++) {
        const q = at((i - 1) * 8, Math.sin(time * 2 + i) * 2);
        g.fillCircle(q.x, q.y, 3 * scale);
      }
    } else {
      drawStudyCreature(g, at, {
        x: 0,
        y: 0,
        kind:
          b.kind === 'flyer'
            ? 'shard-manta'
            : b.kind === 'armored'
              ? 'hull-scrapper'
              : 'rock-swimmer',
        angle: b.face < 0 ? Math.PI : 0,
        time,
        moving: b.moving,
        mode: b.phase === 'attack' ? 'charge' : b.phase,
        attack: b.phase === 'attack' ? 1 : 0,
        hit: b.flash > 0,
      });
    }
    if (b.hp < b.maxHp || b.phase === 'windup') {
      const q = at(0, -36);
      g.fillStyle(0x11212b, 0.9);
      g.fillRoundedRect(q.x - 22 * scale, q.y, 44 * scale, 4 * scale, 2);
      g.fillStyle(b.kind === 'armored' ? 0xd6c8a1 : 0xdfa186);
      g.fillRect(q.x - 22 * scale, q.y, (44 * scale * b.hp) / b.maxHp, 3 * scale);
    }
    if (b.phase === 'windup') {
      const q = at(0, -44);
      g.lineStyle(1.7 * scale, 0xffbd79, 0.85);
      g.strokeTriangle(
        q.x,
        q.y - 6 * scale,
        q.x - 5 * scale,
        q.y + 3 * scale,
        q.x + 5 * scale,
        q.y + 3 * scale,
      );
    }
  }
  if (overview) return;
  for (const s of combat.shots) {
    const p = project(s);
    g.fillStyle(s.gunship?0xffb97a:0xaee495, 0.15);
    g.fillCircle(p.x, p.y, 9 * scale);
    if(s.gunship){const tail=project({x:s.x-s.vx*.035,y:s.y-s.vy*.035});g.lineStyle(2*scale,0xffcf8a);g.strokePoints([tail,p]);}
    g.fillStyle(s.gunship?0xffe9b8:0xd0f4ad);
    g.fillCircle(p.x, p.y, 3 * scale);
  }
  for (const beam of combat.beams) {
    const a = project(beam.a),
      b = project(beam.b),
      points = Array.from({ length: 7 }, (_, i) => ({
        x: a.x + ((b.x - a.x) * i) / 6 + (i && i < 6 ? Math.sin(i * 19 + time * 50) * 4 : 0),
        y: a.y + ((b.y - a.y) * i) / 6,
      }));
    g.lineStyle(4 * scale, beam.color, 0.15);
    g.strokePoints(points);
    g.lineStyle(1.5 * scale, beam.color, 0.9);
    g.strokePoints(points);
  }
}
