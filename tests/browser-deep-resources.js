async (page) => {
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  const makeFixture = async (ore) =>
    page.evaluate(async (ore) => {
      const { TileWorld } = await import('/src/game/world/TileWorld.ts');
      const s = JSON.parse(localStorage.getItem('mars-miner.v1'));
      const w = new TileWorld(s.seed);
      let tile;
      for (let y = ore === 'gold' ? 28 : 55; y < 120 && !tile; y++)
        for (let x = 10; x < 38; x++)
          if (w.get(x, y).ore === ore) {
            tile = w.get(x, y);
            break;
          }
      if (!tile) throw Error('No target seam');
      s.x = tile.x * 40 + 20;
      s.y = tile.y * 40 - 16;
      s.fuel = 190;
      s.hull = 100;
      s.cargo = { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 };
      s.destroyed = [];
      for (let y = 0; y < tile.y; y++) s.destroyed.push(`${tile.x},${y}`);
      localStorage.setItem('mars-miner.v1', JSON.stringify(s));
      return { x: tile.x, y: tile.y };
    }, ore);
  const results = {};
  for (const ore of ['gold', 'diamond']) {
    await makeFixture(ore);
    await page.reload();
    await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
    await page.keyboard.down('s');
    await page.waitForTimeout(1800);
    await page.keyboard.up('s');
    await page.keyboard.press('Escape');
    results[ore] = await page.evaluate(() => window.__mars);
    if (results[ore].cargo[ore] < 1 || results[ore].overlaps)
      throw Error(`${ore} pickup regression`);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `output/playwright/09-${ore}.png` });
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  }
  await page.setViewportSize({ width: 960, height: 720 });
  await page.screenshot({ path: 'output/playwright/10-small-screen.png' });
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: document.querySelector('canvas').getBoundingClientRect().toJSON(),
  }));
  if (layout.scrollWidth > layout.width) throw Error('Horizontal overflow');
  return { results, layout };
}
