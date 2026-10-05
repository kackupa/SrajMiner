import assert from 'node:assert/strict';
import { TileWorld } from '../src/game/world/TileWorld';
import { Progress } from '../src/game/economy/Progress';
import { MiningSystem } from '../src/game/mining/MiningSystem';
import { PlayerPod, type Controls } from '../src/game/player/PlayerPod';
import { validateSave, SaveManager, type SaveData } from '../src/game/save/SaveManager';
import { ORE_KEYS, WORLD, UPGRADES, UPGRADE_KEYS } from '../src/game/config';
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}
const idle: Controls = { left: false, right: false, up: false, down: false };
function sim(pod: PlayerPod, seconds: number, input: Controls, mining?: MiningSystem) {
  let damage = 0;
  for (let i = 0; i < seconds * 120; i++) {
    const tile = pod.update(1 / 120, input, (d) => {
      damage += d;
      pod.progress.hull -= d;
    });
    mining?.update(1 / 120, tile, () => {});
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0, 'pod must not clip terrain');
  }
  return damage;
}
test('same seed generates identical tiles independent of chunk order', () => {
  const a = new TileWorld(422),
    b = new TileWorld(422);
  for (let y = 140; y >= 0; y--)
    for (let x = 0; x < 48; x++) assert.deepEqual(a.get(x, y), b.generate(x, y));
});
test('different seeds create different geology', () => {
  const a = new TileWorld(1),
    b = new TileWorld(2);
  let differences = 0;
  for (let y = 10; y < 90; y++)
    for (let x = 0; x < 48; x++) if (a.get(x, y).ore !== b.get(x, y).ore) differences++;
  assert.ok(differences > 400);
});
test('all five ores obey depth bands and form adjacent veins', () => {
  const w = new TileWorld(7),
    found = new Set();
  let neighbors = 0;
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < 48; x++) {
      const t = w.get(x, y);
      if (t.ore) {
        found.add(t.ore);
        if (t.ore === 'diamond') assert.ok(y * 12 >= 612);
        if (t.ore === 'gold') assert.ok(y * 12 >= 312);
        if (w.get(x + 1, y).ore === t.ore) neighbors++;
      }
    }
  assert.equal(found.size, 5);
  assert.ok(neighbors > 200);
  assert.ok(w.get(20, 60).hardness > w.get(20, 1).hardness);
});
test('chunk eviction preserves excavation and exploration', () => {
  const w = new TileWorld(42);
  w.get(24, 0);
  w.break(24, 0);
  w.reveal(980, 0);
  for (let y = 0; y < 1000; y += 16) {
    w.get(24, y);
    w.prune(y * 40);
  }
  assert.ok(w.chunks.size <= 3);
  assert.equal(w.get(24, 0).type, 'empty');
  const reload = new TileWorld(42, [...w.destroyed], [...w.discovered]);
  assert.equal(reload.get(24, 0).type, 'empty');
  assert.ok(reload.discovered.has('24,0'));
});
test('cargo limit, pricing, and sale clear inventory exactly once', () => {
  const p = new Progress();
  for (let i = 0; i < 16; i++) assert.ok(p.collect('copper'));
  assert.equal(p.collect('diamond'), false);
  assert.equal(p.count, 16);
  assert.equal(p.sell(), 288);
  assert.equal(p.money, 368);
  assert.equal(p.count, 0);
  assert.equal(p.sell(), 0);
});
test('all five upgrades improve stats and stop at level five', () => {
  const p = new Progress();
  p.money = 100000;
  for (const k of UPGRADE_KEYS) {
    for (let level = 1; level < 5; level++) {
      const before = p.max(k),
        money = p.money,
        cost = p.cost(k);
      assert.ok(p.buy(k));
      assert.ok(p.max(k) > before);
      assert.equal(p.money, money - cost);
    }
    assert.equal(p.buy(k), false);
    assert.equal(p.levels[k], 5);
  }
  assert.equal(p.fuel, p.max('fuel'));
  assert.equal(p.hull, p.max('hull'));
});
test('unaffordable upgrades and service do not mutate state', () => {
  const p = new Progress();
  p.money = 0;
  p.fuel = 1;
  p.hull = 1;
  assert.equal(p.buy('drill'), false);
  assert.equal(p.service('fuel'), false);
  assert.equal(p.service('hull'), false);
  assert.equal(p.fuel, 1);
  assert.equal(p.levels.drill, 1);
});
test('fuel and hull services use separate costs', () => {
  const p = new Progress();
  p.money = 200;
  p.fuel = 40;
  p.hull = 50;
  assert.equal(p.serviceCost('fuel'), 30);
  assert.equal(p.serviceCost('hull'), 23);
  p.service('fuel');
  p.service('hull');
  assert.equal(p.money, 147);
  assert.equal(p.fuel, 140);
  assert.equal(p.hull, 100);
});
test('recovery loses cargo but keeps credits and upgrades', () => {
  const p = new Progress();
  p.money = 1000;
  p.buy('engine');
  const credits = p.money;
  p.collect('gold');
  p.fuel = 0;
  p.hull = 0;
  p.rescue();
  assert.equal(p.count, 0);
  assert.equal(p.money, credits);
  assert.equal(p.levels.engine, 2);
  assert.equal(p.fuel, 140);
  assert.equal(p.hull, 100);
});
test('down drilling breaks tiles, collects ore, spends fuel, and allows a return', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  sim(pod, 4, { ...idle, down: true }, m);
  assert.ok(w.destroyed.size >= 3);
  assert.ok(p.count >= 3);
  assert.ok(p.fuel < 140);
  assert.ok(pod.y > 0);
  sim(pod, 6, { ...idle, up: true });
  assert.ok(pod.y < 0);
  assert.equal(p.hull, 100);
});
test('sideways drilling and reverse travel cannot wedge the pod', () => {
  const w = new TileWorld(21),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  sim(pod, 2, { ...idle, down: true }, m);
  const start = pod.x;
  sim(pod, 5, { ...idle, right: true }, m);
  assert.ok(pod.x > start + 80);
  sim(pod, 6, { ...idle, left: true }, m);
  assert.ok(pod.x < start);
});
test('upward thrust never drills a ceiling', () => {
  const w = new TileWorld(12),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  w.break(24, 5);
  pod.x = 980;
  pod.y = 220;
  sim(pod, 2, { ...idle, up: true });
  assert.equal(w.destroyed.size, 1);
  assert.ok(pod.y >= 216);
});
test('hard falls damage hull, short falls are safe', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  for (let y = 0; y < 15; y++) w.break(24, y);
  assert.ok(sim(pod, 3, idle) > 0);
  assert.ok(p.hull < 100);
  const q = new PlayerPod(new TileWorld(2), new Progress());
  assert.equal(sim(q, 1, idle), 0);
});
test('collision remains solid at maximum engine speed and 50 ms frames', () => {
  const w = new TileWorld(13),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  p.levels.engine = 5;
  for (let i = 0; i < 1000; i++) {
    pod.update(
      0.05,
      { ...idle, right: i % 200 < 100, left: i % 200 >= 100, up: i % 60 < 30 },
      () => {},
    );
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0);
  }
  assert.ok(pod.x >= 13 && pod.x <= WORLD.width * 40 - 13);
});
test('drill upgrade measurably shortens rock break time', () => {
  function duration(level: number) {
    const w = new TileWorld(7),
      p = new Progress(),
      m = new MiningSystem(w, p);
    p.levels.drill = level;
    let row = 40;
    while (w.get(24, row).type === 'empty') row++;
    const tile = w.get(24, row);
    let seconds = 0;
    while (w.get(24, row).type !== 'empty') {
      m.update(0.01, tile, () => {});
      seconds += 0.01;
    }
    return seconds;
  }
  assert.ok(duration(2) < duration(1) * 0.72);
});
test('versioned save validation and reconstruction', () => {
  const p = new Progress(),
    w = new TileWorld(2);
  w.break(24, 0);
  w.reveal(980, 0);
  const d: SaveData = {
    version: 1,
    seed: 2,
    money: 500,
    levels: { ...p.levels },
    fuel: 110,
    hull: 80,
    cargo: { ...p.cargo },
    maxDepth: 120,
    artifact: false,
    x: 980,
    y: 24,
    destroyed: [...w.destroyed],
    discovered: [...w.discovered],
  };
  assert.ok(validateSave(d));
  assert.equal(validateSave({ ...d, version: 2 }), false);
  assert.equal(validateSave({ ...d, fuel: NaN }), false);
  assert.equal(validateSave({ ...d, levels: { ...d.levels, drill: 7 } }), false);
  assert.equal(validateSave({ ...d, destroyed: ['oops'] }), false);
  new SaveManager().restore(p, d);
  assert.equal(p.money, 500);
  assert.equal(p.fuel, 110);
});

test('off-center downward drilling aligns into one clean shaft', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  pod.x = 916;
  sim(pod, 3, { ...idle, down: true }, m);
  assert.ok(Math.abs(pod.x - 900) < 0.01);
  assert.ok([...w.destroyed].every((k) => k.startsWith('22,')));
});

test('storage failures are reported without crashing the game', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw Error('denied');
        },
        setItem: () => {
          throw Error('quota');
        },
      },
    });
    const m = new SaveManager();
    assert.equal(m.load(), null);
    assert.match(m.warning, /unavailable/);
    assert.equal(m.write({} as SaveData), false);
    assert.match(m.warning, /Save failed/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as any).localStorage;
  }
});
console.log(`\n${passed} system tests passed.`);
