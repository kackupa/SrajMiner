import { STATIONS, TOWN_TIER_HEIGHTS } from './SurfaceStation';
import { WORLD, type MapId } from '../config';

/** Draw the Hab and service buildings in tangent/radial coordinates on a globe. */
export function drawPlanetSurfaceOutpost(
  g: Phaser.GameObjects.Graphics,
  project: (x: number, y: number) => { x: number; y: number },
  surfaceRow: number,
  tier: number,
  tick: number,
  reducedMotion: boolean,
  mapId: MapId = 'cryo-shelf',
) {
  const far = surfaceRow > 0;
  // Surface elevations and x positions are already world pixels; only the
  // chart's surface row is in tiles. Scale that row once, then add elevation.
  const surfaceWorldY = surfaceRow * WORLD.tile;
  const at = (worldX: number, height: number) => project(worldX, surfaceWorldY + (far ? height : -height));
  const poly = (points: { x: number; height: number }[]) => g.fillPoints(
    points.map(({ x, height }) => at(x, height)), true,
  );
  const line = (x1: number, h1: number, x2: number, h2: number) => {
    const a = at(x1, h1), b = at(x2, h2);
    g.lineBetween(a.x, a.y, b.x, b.y);
  };
  const box = (x: number, width: number, bottom: number, height: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    poly([
      { x: x - width / 2, height: bottom }, { x: x + width / 2, height: bottom },
      { x: x + width / 2, height: bottom + height }, { x: x - width / 2, height: bottom + height },
    ]);
  };
  const arcBand = (left: number, right: number, bottom: number, height: number, color: number, alpha = 1) => {
    const points: { x: number; height: number }[] = [];
    const segments = Math.max(2, Math.ceil((right - left) / 28));
    for (let i = 0; i <= segments; i++) points.push({ x: left + (right - left) * i / segments, height: bottom });
    for (let i = segments; i >= 0; i--) points.push({ x: left + (right - left) * i / segments, height: bottom + height });
    g.fillStyle(color, alpha);
    poly(points);
  };
  const warm = 0xe8ba79, mint = 0x8be1cf, metal = 0x344443, edge = 0x83958a;
  const planetAccent = mapId === 'mars-frontier' ? 0xe59b70
    : mapId === 'cryo-shelf' ? 0x9bd9e2
      : mapId === 'hull-graveyard' ? 0xb8c8a9
        : mapId === 'prism-fault' ? 0xc5a7ff
          : mapId === 'cinder-vale' ? 0xf08a58 : 0xb2e98e;

  // A curved bed of regolith ties the buildings to the visible polar surface.
  arcBand(400, 1580, 0, 9, 0x273631, 0.96);
  g.lineStyle(2, 0x9c8061, 0.9);
  line(400, 1, 1580, 1);

  // Service huts and the ship frame use curved corners, so their feet track the globe.
  for (const station of STATIONS) {
    const color = station.color;
    box(station.x, station.width + 18, 8, 59, 0x352e2c);
    box(station.x, station.width, 8, 50, 0x39413e);
    box(station.x, station.width - 10, 52, 5, 0x69736a);
    box(station.x, station.width - 22, 16, 34, 0x202e30);
    box(station.x, station.width - 32, 47, 3, color, 0.92);
    for (let window = -2; window <= 2; window++) {
      const wx = station.x + window * 17, p = at(wx, 34);
      g.fillStyle(window === 0 ? 0xf3d29a : color, window === 0 ? 0.85 : 0.42);
      g.fillRect(p.x - 4, p.y - 5, 8, 10);
    }
  }

  // A short shared utility trunk visually connects the three service modules.
  arcBand(777, 903, 9, 6, 0x202c2a, 0.96);
  g.lineStyle(1.5, 0x8b9b8e, 0.74);
  line(777, 12, 903, 12);
  for (const couplerX of [780, 900]) {
    const coupler = at(couplerX, 12);
    g.fillStyle(planetAccent, 0.9);
    g.fillRect(coupler.x - 2, coupler.y - 2, 4, 4);
  }

  // Large, function-specific shapes make the service choices readable before
  // the player reaches the labels: ore hopper, open service cradle, drill gantry.
  const oreStation = STATIONS[0]!;
  g.fillStyle(0x293532, 1);
  poly([
    { x: oreStation.x - 27, height: 57 }, { x: oreStation.x + 27, height: 57 },
    { x: oreStation.x + 13, height: 69 }, { x: oreStation.x - 13, height: 69 },
  ]);
  box(oreStation.x, 18, 54, 5, 0x9b7950);
  for (const [index, dx] of [-29, -10, 10, 29].entries()) {
    box(oreStation.x + dx, 10, 11, 13, index % 2 ? 0x697b70 : 0x8a6f50);
    const binLight = at(oreStation.x + dx, 18);
    g.fillStyle(index % 2 ? 0x9bd3bc : 0xf0c47f, 0.9);
    g.fillRect(binLight.x - 3, binLight.y - 1, 6, 2);
  }

  const serviceStation = STATIONS[1]!;
  box(serviceStation.x, 38, 13, 34, 0x1c2928);
  box(serviceStation.x, 28, 17, 24, 0x52675f);
  box(serviceStation.x, 20, 20, 16, 0x2b403e);
  g.lineStyle(2, mint, 0.84);
  line(serviceStation.x - 25, 55, serviceStation.x - 25, 26);
  line(serviceStation.x + 25, 55, serviceStation.x + 25, 26);
  line(serviceStation.x - 25, 55, serviceStation.x + 25, 55);
  for (const dx of [-50, 50]) {
    box(serviceStation.x + dx, 14, 12, 19, 0x263534);
    box(serviceStation.x + dx, 10, 14, 15, 0x718b7e);
    const tankLight = at(serviceStation.x + dx, 29);
    g.fillStyle(mint, 0.9);
    g.fillRect(tankLight.x - 3, tankLight.y - 1, 6, 2);
  }

  const workshop = STATIONS[2]!;
  g.lineStyle(3, 0x414f4c, 0.98);
  line(workshop.x - 35, 51, workshop.x - 35, 77);
  line(workshop.x + 35, 51, workshop.x + 35, 77);
  line(workshop.x - 35, 77, workshop.x + 35, 77);
  g.lineStyle(2, planetAccent, 0.9);
  line(workshop.x, 76, workshop.x, 59);
  const bit = at(workshop.x, 57);
  g.fillStyle(0x222f2d, 1);
  g.fillTriangle(bit.x - 5, bit.y - 3, bit.x + 5, bit.y - 3, bit.x, bit.y + 6);
  g.fillStyle(planetAccent, 0.92);
  for (const dx of [-42, 42]) box(workshop.x + dx, 9, 14, 18, 0x7a8c80);
  for (const drawerY of [19, 26]) {
    const drawer = at(workshop.x - 42, drawerY);
    g.fillStyle(0xd0b9d7, 0.92);
    g.fillRect(drawer.x - 2, drawer.y - 1, 4, 2);
  }

  // Launch frame remains a distinct campaign objective at either surface.
  const shipX = 555;
  g.lineStyle(2, 0x9aab9a, 0.7);
  line(shipX - 43, 9, shipX - 43, 47);
  line(shipX + 43, 9, shipX + 43, 47);
  line(shipX - 43, 47, shipX + 43, 47);
  if (tier > 0) {
    g.fillStyle(0x98a79a, 0.95);
    poly([{ x: shipX, height: 150 }, { x: shipX + 15, height: 124 }, { x: shipX + 12, height: 22 },
      { x: shipX - 12, height: 22 }, { x: shipX - 15, height: 124 }]);
    box(shipX, 18, 63, 20, 0x203239);
  } else {
    g.lineStyle(3, 0x38413e, 1);
    line(490, 8, 490, 138); line(468, 8, 490, 98); line(512, 8, 490, 98);
    g.lineStyle(2, 0xabac91, 1);
    const mast = at(490, 138);
    g.strokeCircle(mast.x, mast.y, 15);
    line(469, 117, 511, 159);
  }

  // Tiered walkways are made from short chords; their projected ends follow the arc.
  const deckXs = [430, 1540];
  for (let level = 0; level <= tier; level++) {
    const height = 132 + level * 94;
    arcBand(deckXs[0], deckXs[1], height, 8, level === tier && tier >= 3 ? mint : metal, 0.98);
    g.lineStyle(2, edge, 0.8);
    line(deckXs[0], height + 12, deckXs[1], height + 12);
    for (const tower of deckXs) {
      g.lineStyle(4, metal, 0.98);
      line(tower - 25, 8, tower - 25, height + 8);
      line(tower + 25, 8, tower + 25, height + 8);
      g.lineStyle(2, edge, 0.78);
      for (let rung = 28; rung < height; rung += 28) line(tower - 25, rung, tower + 25, rung);
    }
    for (let post = deckXs[0] + 28; post < deckXs[1]; post += 62) {
      const p = at(post, height + 17);
      g.fillStyle((Math.floor(post / 62) + level) % 3 ? mint : warm, 0.86);
      g.fillCircle(p.x, p.y, 2.1);
    }
  }
  if (tier >= 1) {
    box(720, 92, 140, 48, 0x465650);
    box(1260, 92, 140, 48, 0x465650);
    g.lineStyle(4, 0x334340, 1);
    for (const tower of deckXs) line(tower - 25, 8, tower - 25, TOWN_TIER_HEIGHTS[tier]);
  }
  if (tier >= 2) {
    g.lineStyle(2, warm, 0.84);
    line(780, 244, 1430, 244);
    box(1090, 54, 244, 18, 0x263330);
    box(1090, 34, 249, 4, 0x8be1cf);
  }
  if (tier >= 3) {
    g.lineStyle(3, metal, 1);
    line(980, 414, 980, 540);
    g.lineStyle(2, mint, 0.9);
    line(946, 433, 1014, 433);
    const beacon = at(980, 540);
    g.fillStyle(mint, reducedMotion ? 0.85 : 0.65 + Math.sin(tick * 2.5) * 0.18);
    g.fillCircle(beacon.x, beacon.y, 7);
    g.lineStyle(2, mint, 0.7);
    g.strokeCircle(beacon.x, beacon.y, reducedMotion ? 15 : 15 + Math.sin(tick * 2.5) * 2);
  }
}

/** Draws the original, modular Hab 07 skyline as campaign records are recovered. */
export function drawSurfaceTown(
  g: Phaser.GameObjects.Graphics,
  ground: number,
  projectX: (x: number) => number,
  tier: number,
  tick: number,
  reducedMotion: boolean,
) {
  const height = TOWN_TIER_HEIGHTS[tier];
  const towers = [430, 1540];
  const structure = 0x344443, edge = 0x83958a, warm = 0xe8ba79, mint = 0x8be1cf;

  // Twin elevator frames turn the original three-hut stop into a readable skyline.
  for (const worldX of towers) {
    const x = projectX(worldX);
    g.lineStyle(5, structure, 0.96);
    g.lineBetween(x - 25, ground - 8, x - 25, ground - height);
    g.lineBetween(x + 25, ground - 8, x + 25, ground - height);
    g.lineStyle(2, edge, 0.72);
    for (let rise = 22; rise < height - 8; rise += 25) {
      g.lineBetween(x - 25, ground - rise, x + 25, ground - Math.min(height, rise + 25));
      g.lineBetween(x + 25, ground - rise, x - 25, ground - Math.min(height, rise + 25));
      g.lineBetween(x - 29, ground - rise, x + 29, ground - rise);
    }
    g.fillStyle(0x202b2a);
    g.fillRect(x - 6, ground - height + 8, 12, height - 20);
    g.fillStyle(tier >= 3 ? mint : warm, 0.8);
    g.fillRect(x - 2, ground - height + 18, 4, Math.max(18, height - 35));
    g.fillStyle(0x283330);
    g.fillRect(x - 32, ground - height - 3, 64, 8);
    g.fillStyle(edge);
    g.fillRect(x - 26, ground - height - 7, 52, 4);
    g.fillStyle(tier >= 4 ? 0xaeeede : warm, 0.9);
    g.fillCircle(x, ground - height - 11, 4);
  }

  // Every durable campaign stage adds another elevated walkway and its lights.
  for (let level = 0; level <= tier; level++) {
    const offset = 132 + level * 94;
    const y = ground - offset;
    const left = projectX(towers[0]), right = projectX(towers[1]);
    const minX = Math.min(left, right), span = Math.abs(right - left);
    g.fillStyle(0x263532, 0.98);
    g.fillRect(minX, y, span, 8);
    g.fillStyle(level === tier && tier >= 3 ? mint : edge, 0.86);
    g.fillRect(minX, y - 3, span, 3);
    g.lineStyle(2, structure, 0.94);
    g.lineBetween(minX, y + 12, minX + span, y + 12);
    for (let post = minX + 22; post < minX + span; post += 46) {
      g.lineBetween(post, y - 1, post, y - 15);
      g.fillStyle((Math.floor(post / 46) + level) % 3 === 0 ? warm : mint, 0.78);
      g.fillRect(post - 2, y - 19, 4, 4);
    }
    g.lineStyle(2, edge, 0.65);
    g.lineBetween(minX, y - 15, minX + span, y - 15);
    for (const worldX of towers) {
      const x = projectX(worldX);
      g.lineStyle(3, edge, 0.8);
      g.lineBetween(x - 25, y + 5, x - 25, ground - Math.min(height, offset + 34));
      g.lineBetween(x + 25, y + 5, x + 25, ground - Math.min(height, offset + 34));
      // Ladders make the decks read as connected play spaces, like Terraria platforms.
      const ladderX = x + 35;
      g.lineStyle(2, warm, 0.75);
      g.lineBetween(ladderX, y + 13, ladderX, y + 75);
      g.lineBetween(ladderX + 9, y + 13, ladderX + 9, y + 75);
      for (let rung = 20; rung < 75; rung += 13) g.lineBetween(ladderX, y + rung, ladderX + 9, y + rung);
    }
  }

  const drawHab = (worldX: number, deck: number, color: number, wide = false) => {
    const x = projectX(worldX), y = ground - deck - 48, width = wide ? 96 : 72;
    g.fillStyle(0x222d2b);
    g.fillRoundedRect(x - width / 2, y, width, 48, 3);
    g.fillStyle(color);
    g.fillRect(x - width / 2 + 4, y + 4, width - 8, 4);
    g.fillStyle(0x465650);
    g.fillRect(x - width / 2 + 6, y + 12, width - 12, 29);
    for (let window = -1; window <= 1; window++) {
      g.fillStyle((window + Math.floor(worldX / 10)) % 2 ? 0x9de5d4 : 0xf4d19a, 0.88);
      g.fillRoundedRect(x + window * 20 - 5, y + 17, 10, 14, 2);
    }
    g.fillStyle(0x293632);
    g.fillRect(x - width / 2 - 3, y + 46, width + 6, 4);
    g.lineStyle(2, edge, 0.7);
    g.lineBetween(x - width / 2 + 8, y + 10, x - width / 2 + 8, y + 43);
    g.lineBetween(x + width / 2 - 8, y + 10, x + width / 2 - 8, y + 43);
  };
  if (tier >= 1) {
    drawHab(720, 132, 0xd3a76c);
    drawHab(1260, 132, 0x82bdb0);
  }
  if (tier >= 2) {
    drawHab(870, 226, 0x849d9b, true);
    drawHab(1430, 226, 0xc2b1d1);
    const tramY = ground - 244;
    g.lineStyle(2, warm, 0.78);
    g.lineBetween(projectX(780), tramY, projectX(1430), tramY);
    const tramX = projectX(1090);
    g.fillStyle(0x263330);
    g.fillRoundedRect(tramX - 27, tramY - 19, 54, 18, 4);
    g.fillStyle(mint, 0.85);
    g.fillRect(tramX - 17, tramY - 14, 11, 5);
    g.fillRect(tramX + 6, tramY - 14, 11, 5);
  }
  if (tier >= 3) {
    drawHab(980, 414, 0x547d78, true);
    const antennaX = projectX(980), antennaY = ground - 466;
    g.lineStyle(4, structure, 1);
    g.lineBetween(antennaX, ground - 414, antennaX, antennaY);
    g.lineStyle(2, mint, 0.86);
    g.lineBetween(antennaX - 34, antennaY + 19, antennaX + 34, antennaY + 19);
    g.lineBetween(antennaX - 25, antennaY + 8, antennaX + 25, antennaY + 30);
    g.lineBetween(antennaX + 25, antennaY + 8, antennaX - 25, antennaY + 30);
    g.fillStyle(mint, reducedMotion ? 0.78 : 0.58 + Math.sin(tick * 2.5) * 0.18);
    g.fillCircle(antennaX, antennaY, 8);
    g.lineStyle(2, 0xa0efdf, 0.7);
    g.strokeCircle(antennaX, antennaY, reducedMotion ? 17 : 17 + Math.sin(tick * 2.5) * 3);
  }
  if (tier >= 4) {
    const peakX = projectX(980), peakY = ground - TOWN_TIER_HEIGHTS[4] + 28;
    g.lineStyle(3, warm, 0.8);
    g.lineBetween(projectX(430), ground - 510, projectX(1540), ground - 510);
    g.fillStyle(0x273330);
    g.fillRoundedRect(peakX - 18, peakY - 28, 36, 34, 3);
    g.fillStyle(mint, 0.92);
    g.fillCircle(peakX, peakY - 11, 6);
    g.lineStyle(2, mint, 0.65);
    g.strokeCircle(peakX, peakY - 11, 15);
    g.lineStyle(3, edge, 0.9);
    g.lineBetween(peakX, peakY - 27, peakX, peakY - 68);
    g.fillStyle(warm, 1);
    g.fillTriangle(peakX - 9, peakY - 54, peakX + 9, peakY - 54, peakX, peakY - 72);
  }

  // Tiny crews walk the upper decks as the settlement gains workshops and a signal archive.
  const drawWorker = (worldX: number, deckOffset: number, suit: number, phase: number) => {
    const step = reducedMotion ? 0 : Math.sin(tick * 1.1 + phase) * 15;
    const x = projectX(worldX + step), feet = ground - deckOffset - 3;
    g.fillStyle(0x1f2928, 0.72);
    g.fillEllipse(x, feet + 2, 12, 3);
    g.fillStyle(suit);
    g.fillRect(x - 4, feet - 14, 8, 9);
    g.fillStyle(0xd5d8c8);
    g.fillRect(x - 3, feet - 21, 6, 6);
    g.fillStyle(warm);
    g.fillRect(x - 4, feet - 22, 8, 2);
    g.fillStyle(0x263330);
    g.fillRect(x - 5, feet - 5, 4, 5);
    g.fillRect(x + 1, feet - 5, 4, 5);
    g.fillStyle(mint, 0.8);
    g.fillRect(x + 2, feet - 18, 1, 2);
  };
  if (tier >= 1) {
    drawWorker(660, 132, 0x68b4aa, 0.2);
    drawWorker(1320, 132, 0xb48360, 2.5);
  }
  if (tier >= 2) {
    drawWorker(840, 226, 0xd0b36d, 1.6);
    drawWorker(1450, 226, 0x8e9cc4, 4.1);
  }
  if (tier >= 3) drawWorker(980, 414, 0x99cdbb, 3.3);
  if (tier >= 4) drawWorker(1010, 508, 0xdcb777, 5.2);
}
