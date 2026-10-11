// Run through Playwright CLI in an isolated Chromium session opened with --device="Pixel 7".
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  const point = async (label, id) => {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    if (!box) throw Error(`Missing control: ${label}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
  };
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const state = () => page.evaluate(() => {
    const s = window.__mars;
    return { x: s.x, y: s.y, depth: s.depth, cargo: s.cargo, destroyed: s.destroyed,
      overlaps: s.overlaps, hull: s.hull, fuel: s.fuel, paused: s.paused };
  });
  const start = await state();
  const down = await point('Drill down', 1);
  await touch('touchStart', [down]);
  await page.waitForFunction(() => window.__mars.depth > 80, {}, { timeout: 45000 });
  await touch('touchEnd', []);
  const haul = await state();
  if (haul.overlaps || !haul.destroyed.length || !Object.values(haul.cargo).some(Boolean))
    throw Error(`Mining failed: ${JSON.stringify(haul)}`);
  await page.screenshot({ path: 'output/playwright/mobile-haul.png' });
  // Two real touch contacts must remain independent when either finger releases.
  const up = await point('Thrust upward', 2), drill = await point('Drill down', 3);
  await touch('touchStart', [up, drill]);
  if (await page.locator('.touch-controls .held').count() !== 2) throw Error('Multitouch lost a contact');
  await touch('touchCancel', []);
  if (await page.locator('.touch-controls .held').count() !== 0) throw Error('Cancelled touches remained held');
  await touch('touchStart', [up]);
  await page.waitForFunction(() => window.__mars.y < -10, {}, { timeout: 30000 });
  await touch('touchEnd', []);
  await page.waitForTimeout(700);
  const returned = await state();
  if (returned.overlaps || returned.hull <= 0) throw Error('Unsafe return');
  await page.getByRole('button', { name: 'BOARD', exact: true }).click();
  // A first sortie cannot fund the camp + uplink. Seed only that market unlock
  // after earning the haul, keeping the physical expedition and cargo genuine.
  if (!await page.locator('#camp-nav-sell').count()) {
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
    save.maps[save.activeMap].structures.push({ id: 'mobile-market', kind: 'trade-post', x: 1500, y: 0 });
    const marker = `mobile-market-${Date.now()}`;
    await page.addInitScript(({ save, marker }) => {
      if (!sessionStorage.getItem(marker)) {
        localStorage.setItem('mars-miner.v1', JSON.stringify(save));
        sessionStorage.setItem(marker, '1');
      }
    }, { save, marker });
    await page.reload();
    await page.locator('#launch').click();
    await page.getByRole('button', { name: 'SERVICES', exact: true }).click();
  }
  await page.locator('#camp-nav-sell').click();
  await page.screenshot({ path: 'output/playwright/mobile-sale.png' });
  const cargo = await page.evaluate(() => window.__mars.cargo);
  for (const [ore, units] of Object.entries(cargo)) {
    if (units > 0) {
      const field = page.getByLabel(`${ore[0].toUpperCase()}${ore.slice(1)} shipment quantity`);
      await field.fill(String(units));
      await field.press('Tab');
    }
  }
  await page.locator('#ship-selected').click();
  const sold = await page.evaluate(() => ({ money: window.__mars.money, cargo: window.__mars.cargo, destroyed: window.__mars.destroyed }));
  if (Object.values(sold.cargo).some(Boolean) || sold.money <= 0) throw Error('Sale failed');
  await page.reload();
  await page.locator('#launch').click();
  await page.locator('.touch-controls:not([hidden])').waitFor();
  const loaded = await page.evaluate(() => ({ money: window.__mars.money, cargo: window.__mars.cargo, destroyed: window.__mars.destroyed }));
  if (JSON.stringify(sold) !== JSON.stringify(loaded)) throw Error('Reload changed sold ore or excavation');
  if (errors.length) throw Error(errors.join('\n'));
  return { start, haul, returned, sold, loaded, errors };
}
