import { TOWN_TIER_HEIGHTS } from './SurfaceStation';

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
