// Run on a dedicated development origin; only synthetic ore visibility fixtures are written.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const oreTypes = ['copper', 'iron', 'silver', 'gold', 'diamond'];
  const ranges = [
    { name: 'near', distance: 2 },
    { name: 'mid', distance: 5 },
    { name: 'outer', distance: 7 },
  ];
  const results = [];
  for (const range of ranges) {
    for (const ore of oreTypes) {
      await page.goto('about:blank'); await page.goto(baseURL); await page.waitForFunction(() => !!window.__mars);
      const fixture = await page.evaluate(async ({ ore, distance }) => {
        const { TileWorld } = await import('/src/game/world/TileWorld.ts');
        const row = { copper: 10, iron: 20, silver: 30, gold: 40, diamond: 60 }[ore];
        const anchor = { x: 24, y: row }, target = { x: 24 + distance, y: row };
        let seed = 0, units = 1;
        for (let candidateSeed = 1; candidateSeed < 10000; candidateSeed++) {
          const tile = new TileWorld(candidateSeed, [], [], 'mars-frontier').get(target.x, target.y);
          if (tile.ore === ore && !tile.regionFind && !tile.geode) { seed = candidateSeed; units = tile.oreUnits ?? 1; break; }
        }
        if (!seed) throw Error(`Could not locate ${ore} at ${distance} tiles`);
        const destroyed = [];
        for (let y = 0; y < anchor.y; y++) for (let x = 0; x < 48; x++) destroyed.push(`${x},${y}`);
        for (let x = 0; x < 48; x++) if (x !== anchor.x && x !== target.x) destroyed.push(`${x},${anchor.y}`);
        const discovered = [];
        for (let y = anchor.y - 9; y <= anchor.y + 9; y++) for (let x = anchor.x - 9; x <= anchor.x + 9; x++) discovered.push(`${x},${y}`);
        const depth = anchor.y * 12;
        return {
          version: 10, campaignSeed: 92231, activeMap: 'mars-frontier',
          maps: { 'mars-frontier': { seed, x: anchor.x * 40 + 20, y: anchor.y * 40 - 16, maxDepth: depth, destroyed, discovered, drops: [], activeCharge: null } },
          money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 }, fuel: 190, hull: 100,
          cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: depth, artifact: false,
          milestones: [], shipComponents: [], routeFragments: [], charges: 0,
          ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab',
          ownedDecals: ['standard'], selectedDecal: 'standard', ownedProfiles: ['standard'], selectedProfile: 'standard',
          fixture: { seed, anchor, target, units },
        };
      }, { ore, distance: range.distance });
      const { fixture: expected, ...save } = fixture;
      await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
      await page.reload(); await page.setViewportSize({ width: 960, height: 560 });
      await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
      await page.waitForFunction(() => window.__mars?.camera);
      await page.waitForTimeout(150);
      const src = await page.evaluate(() => window.__mars.snapshot());
      const sample = await page.evaluate(async (options) => {
        const image = new Image(); image.src = options.src; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        const rect = document.querySelector('#game canvas').getBoundingClientRect();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const sx = (options.target.x * 40 + 20 - options.camera.x) * canvas.width / rect.width;
        const sy = (options.target.y * 40 + 20 - options.camera.y) * canvas.height / rect.height;
        let colored = 0, bright = 0, oreTint = 0;
        for (let y = Math.max(0, Math.floor(sy - 18)); y < Math.min(canvas.height, sy + 18); y++)
          for (let x = Math.max(0, Math.floor(sx - 18)); x < Math.min(canvas.width, sx + 18); x++) {
            const i = (y * canvas.width + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            if (pixels[i + 3] > 0 && Math.max(r, g, b) - Math.min(r, g, b) > 35 && Math.max(r, g, b) > 90) colored++;
            if (pixels[i + 3] > 0 && Math.max(r, g, b) > 150) bright++;
            const warmOre = options.ore === 'copper' || options.ore === 'gold';
            if (pixels[i + 3] > 0 && (warmOre ? r > b + 5 : b > r + 5) && Math.max(r, g, b) > 80) oreTint++;
          }
        return { x: rect.x + sx * rect.width / canvas.width, y: rect.y + sy * rect.height / canvas.height,
          width: rect.width, height: rect.height, colored, bright, oreTint, imageWidth: canvas.width, imageHeight: canvas.height };
      }, { src, target: expected.target, ore, camera: await page.evaluate(() => window.__mars.camera) });
      if (sample.x < 24 || sample.x > sample.width - 24 || sample.y < 24 || sample.y > sample.height - 24)
        throw Error(`${range.name}/${ore}: deposit outside viewport: ${JSON.stringify(sample)}`);
      await page.screenshot({ path: `output/playwright/ore-${ore}-${range.name}-960x560.png` });
      if (sample.oreTint < 16)
        throw Error(`${range.name}/${ore}: ore marker too faint/small at 960×560 (${JSON.stringify(sample)})`);
      results.push({ range: range.name, ore, seed: expected.seed, units: expected.units, coloredPixels: sample.colored, brightPixels: sample.bright, oreTintPixels: sample.oreTint });
    }
  }
  return results;
}
