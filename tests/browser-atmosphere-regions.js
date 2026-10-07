// Synthetic open-cavern fixtures; use an isolated Playwright session.
async (page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.waitForFunction(() => !!window.__mars);
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const results = [];
  for (const id of ['cryo-shelf', 'hull-graveyard', 'prism-fault', 'mars-frontier', 'far-cryo']) {
    const far = id === 'far-cryo', mapId = far ? 'cryo-shelf' : id;
    await page.reload(); // Paused Continue screen prevents pagehide overwriting the fixture.
    await page.waitForFunction(() => !!window.__mars);
    await page.evaluate(async ({ base, mapId, far }) => {
      const { FAR_SURFACE_ROW, FAR_SURFACE_Y } = await import('/src/game/config.ts');
      const destroyed = [], discovered = [];
      const key = (x, y) => `${x},${far ? FAR_SURFACE_ROW - 1 - y : y}`;
      for (let y = 0; y < 12; y++) destroyed.push(key(24, y));
      for (let x = 20; x <= 28; x++) for (let y = 4; y < 12; y++) destroyed.push(key(x, y));
      for (let x = 18; x <= 30; x++) for (let y = 0; y < 15; y++) discovered.push(key(x, y));
      base.activeMap = mapId;
      base.maps = { [mapId]: { seed: 42, x: 980, y: far ? FAR_SURFACE_Y - 464 : 464,
        maxDepth: 144, destroyed, discovered, drops: [], activeCharge: null, structures: [] } };
      base.fuel = 140; base.hull = 100;
      localStorage.setItem('mars-miner.v1', JSON.stringify(base));
      localStorage.setItem('mars-miner.atmosphere.v1', 'on');
    }, { base, mapId, far });
    await page.reload();
    await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
    await page.waitForTimeout(3200);
    const state = await page.evaluate(() => window.__mars);
    if (state.mapId !== mapId || state.farHemisphere !== far || state.overlaps || !state.atmosphere.count || state.atmosphere.count > 96)
      throw Error(`Cavern failure ${id}: ${JSON.stringify(state)}`);
    await page.screenshot({ path: `output/playwright/atmosphere-${id}.png` });
    results.push({ id, count: state.atmosphere.count, foreground: state.atmosphere.foreground, overlaps: state.overlaps });
  }
  return results;
}
