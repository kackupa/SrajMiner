import type Phaser from 'phaser';
import { COMBAT_STUDY, WORLD } from '../config';
import type { Progress } from '../economy/Progress';
import { caveSight } from '../world/CaveHabitat';
import { keyOf, type TileWorld } from '../world/TileWorld';
type Point = { x: number; y: number };
export class StudyAdventure {
  sites = COMBAT_STUDY.sites.map((s) => ({
    ...s,
    id: `study:${s.x},${s.y}`,
    remaining: Number(s.units),
    seen: false,
    suppliesTaken: false,
  }));
  prepare(world: TileWorld) {
    // This is a replacement fixture, not an extra layer on the starter quest caves.
    // Leave caves elsewhere on the disposable planet intact.
    world.openingLayout=false;
    if(world.terrain)world.terrain.caves=world.terrain.caves.filter(x=>x<18||x>80);
    const carve = (x: number, y: number) => world.destroyed.add(keyOf(x, y));
    let previous = { x: 27, y: 8 };
    for (const site of this.sites) {
      // Wide winding approach with room to dodge over a crawler.
      const length = Math.ceil(Math.hypot(site.x - previous.x, site.y - previous.y) * 3);
      for (let j = 0; j <= length; j++) {
        const q = j / length,
          x = previous.x + (site.x - previous.x) * q,
          y = previous.y + (site.y - previous.y) * q + 2;
        for (let dx = -2; dx <= 2; dx++)
          for (let dy = -2; dy <= 1; dy++)
            if (dx * dx + dy * dy <= 5) carve(Math.round(x) + dx, Math.round(y) + dy);
      }
      for (let dx = -6; dx <= 6; dx++)
        for (let dy = -4; dy <= 4; dy++)
          if ((dx / 6) ** 2 + (dy / 4) ** 2 < 1) carve(site.x + dx, site.y + dy);
      previous = site;
    }
    world.studyHabitats = this.sites.map((s) => ({
      id: s.id,
      x: (s.x + 0.5) * WORLD.tile,
      y: (s.y + 0.5) * WORLD.tile,
      kind: s.kind,
    }));
    world.chunks.clear();
  }
  update(world: TileWorld, pod: Point, progress: Progress, notice: (text: string) => void) {
    for (const s of this.sites) {
      const p = { x: (s.x - 2 + 0.5) * WORLD.tile, y: (s.y + 3 + 0.5) * WORLD.tile };
      const distance = Math.hypot(pod.x - p.x, pod.y - p.y);
      if (distance < 280 && !s.seen && caveSight(world, pod, p)) {
        s.seen = true;
        notice(world.clearedCaves.has(s.id)?`${s.name} discovered. Salvage is ready to collect.`:`${s.name} discovered. Clear the creature to recover its salvage.`);
      }
      if (
        (s.remaining <= 0 && s.suppliesTaken) ||
        !world.clearedCaves.has(s.id) ||
        distance > COMBAT_STUDY.pickupRadius ||
        !caveSight(world, pod, p)
      )
        continue;
      if(!s.suppliesTaken){
        s.suppliesTaken=true;
        const repair=Math.max(0,Math.min(COMBAT_STUDY.repairSupply,progress.max('hull')-progress.hull));
        const charge=Math.max(0,Math.min(COMBAT_STUDY.chargeSupply,progress.max('fuel')-progress.fuel));
        progress.hull+=repair;progress.fuel+=charge;
        if(repair||charge)notice(`Field supplies recovered · +${Math.round(repair)} hull · +${Math.round(charge)} charge`);
      }
      const collected = progress.collectUnits(s.ore, s.remaining);
      if (collected) {
        s.remaining -= collected;
        notice(
          `Recovered ${collected} ${s.ore}${s.remaining ? ' · cargo full, the rest stays here' : ` · ${s.name} cleared`}`,
        );
      }
    }
  }
  draw(
    g: Phaser.GameObjects.Graphics,
    world: TileWorld,
    project: (x: number, y: number) => Point,
    time: number,
  ) {
    for (const [i, s] of this.sites.entries()) {
      if (!world.discovered.has(keyOf(s.x - 2, s.y + 3))) continue;
      const x = (s.x - 1.5) * WORLD.tile,
        y = (s.y + 3.5) * WORLD.tile,
        free = world.clearedCaves.has(s.id),
        empty = s.remaining === 0;
      const at = (u: number, v: number) => project(x + u, y + v);
      const poly = (p: number[][], color: number, a = 1) => {
        g.fillStyle(color, a);
        g.fillPoints(
          p.map(([u, v]) => at(u, v)),
          true,
        );
      };
      const line = (p: number[][], color: number, w = 1) => {
        g.lineStyle(w, color);
        g.strokePoints(
          p.map(([u, v]) => at(u, v)),
          false,
        );
      };
      // Each cache belongs to a different recognisable abandoned work site.
      if (i === 0) {
        poly(
          [
            [-48, 14],
            [-32, -34],
            [4, -34],
            [18, 14],
          ],
          0x334c55,
        );
        poly(
          [
            [-32, -34],
            [4, -34],
            [-8, -19],
            [-41, -19],
          ],
          0x9e9071,
        );
        line(
          [
            [-25, -26],
            [-25, 12],
          ],
          0x182c36,
          3,
        );
      }
      if (i === 1)
        for (let j = 0; j < 5; j++) {
          const u = -57 + j * 11;
          poly(
            [
              [u, 17],
              [u - 5, -7 - (j % 3) * 14],
              [u + 3, -20 - (j % 3) * 13],
              [u + 9, 17],
            ],
            j % 2 ? 0x89b4b8 : 0x507e8c,
          );
          line(
            [
              [u + 3, -20 - (j % 3) * 13],
              [u + 2, 15],
            ],
            0xc5ddcb,
          );
        }
      if (i === 2) {
        poly(
          [
            [-62, 12],
            [-58, -18],
            [-28, -24],
            [-12, -8],
            [-19, 16],
          ],
          0x647773,
        );
        poly(
          [
            [-55, -16],
            [-31, -21],
            [-21, -10],
            [-37, -5],
          ],
          0xb78e55,
        );
        poly(
          [
            [-22, 5],
            [-8, -13],
            [1, 9],
            [-7, 24],
          ],
          0x8b9993,
        );
        line(
          [
            [-40, -22],
            [-45, -48],
            [-27, -48],
          ],
          0x6f8c91,
          3,
        );
      }
      poly(
        [
          [-13, -12],
          [13, -12],
          [18, -6],
          [18, 13],
          [-13, 13],
        ],
        0x112831,
      );
      poly(
        [
          [-11, -10],
          [11, -10],
          [16, -5],
          [-6, -5],
        ],
        empty ? 0x496468 : 0xc79657,
      );
      poly(
        [
          [-10, -3],
          [15, -3],
          [15, 11],
          [-10, 11],
        ],
        0x526a6a,
      );
      const color = empty ? 0x54686b : free ? 0x94e0bc : 0xffb775;
      line(
        [
          [-7, 3],
          [11, 3],
        ],
        color,
        3,
      );
      if (free && !empty) {
        const p = at(2, -22 - Math.sin(time * 3) * 3);
        g.lineStyle(2, color);
        g.strokePoints(
          [
            { x: p.x - 5, y: p.y - 4 },
            { x: p.x, y: p.y + 1 },
            { x: p.x + 5, y: p.y - 4 },
          ],
          false,
        );
      }
    }
  }
}
