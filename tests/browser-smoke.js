// Run via Playwright CLI in a dedicated session; this replaces only that session's save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(() =>
    localStorage.setItem(
      'mars-miner.v1',
      JSON.stringify({
        version: 1,
        seed: 1410513364,
        money: 80,
        levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
        fuel: 140,
        hull: 100,
        cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
        maxDepth: 0,
        artifact: false,
        x: 980,
        y: -22,
        destroyed: [],
        discovered: [],
      }),
    ),
  );
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.keyboard.down('s');
  await page.waitForTimeout(35000);
  await page.keyboard.up('s');
  const haul = await page.evaluate(() => window.__mars);
  if (
    haul.depth < 200 ||
    Object.values(haul.cargo).reduce((a, b) => a + b, 0) < 10 ||
    haul.overlaps
  )
    throw Error(`Haul regression: ${JSON.stringify({ depth: haul.depth, fuel: haul.fuel, cargo: haul.cargo, overlaps: haul.overlaps })}`);
  await page.screenshot({ path: 'output/playwright/regression-haul.png' });
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__mars.y < -35, {}, { timeout: 20000 });
  await page.keyboard.down('a');
  await page.waitForTimeout(430);
  await page.keyboard.up('a');
  await page.keyboard.up('w');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '01 SELL ORE ↗' }).click();
  const prices = { copper: 18, iron: 28, silver: 55, gold: 105, diamond: 260 };
  const payout = Object.entries(haul.cargo).reduce(
    (sum, [key, count]) => sum + count * prices[key],
    0,
  );
  await page.getByRole('button', { name: 'SELL CARGO ↗' }).click();
  const sold = await page.evaluate(() => window.__mars);
  if (sold.money !== 80 + payout || Object.values(sold.cargo).some(Boolean))
    throw Error('Sale regression');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: '02 SERVICE ＋' }).click();
  await page.locator('#service-fuel').click();
  await page.locator('#service-hull').click();
  const serviced = await page.evaluate(() => window.__mars);
  if (serviced.fuel !== 140 || serviced.hull !== 100) throw Error('Service regression');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: '03 UPGRADES ↑' }).click();
  await page.getByRole('button', { name: '$140 ↑', exact: true }).click();
  const purchased = await page.evaluate(() => window.__mars);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  const restored = await page.evaluate(() => window.__mars);
  if (
    restored.money !== purchased.money ||
    restored.levels.drill !== 2 ||
    restored.seed !== purchased.seed ||
    JSON.stringify(restored.destroyed) !== JSON.stringify(purchased.destroyed)
  )
    throw Error('Save regression');
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.keyboard.down('s');
  await page.waitForTimeout(22000);
  await page.keyboard.up('s');
  await page.keyboard.press('Escape');
  const second = await page.evaluate(() => window.__mars);
  if (second.depth < 100 || second.overlaps || second.x >= 980)
    throw Error(`Upgraded expedition regression: ${JSON.stringify({ firstDepth: haul.depth, depth: second.depth, x: second.x, overlaps: second.overlaps, fuel: second.fuel })}`);
  return { haul, payout, sold, serviced, purchased, restored, second };
}
