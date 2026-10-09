async (page) => {
  await page.getByRole('button', { name: /BEGIN EXPEDITION/ }).click();
  const previousSeed = await page.evaluate(() => window.__mars.seed);
  await page.locator('#pause').click();
  await page.locator('#new').click();
  await page.locator('#confirm-new').click();
  await page.getByRole('button', { name: /BEGIN EXPEDITION/ }).waitFor();

  const atlas = page.getByRole('region', { name: 'Vesper system route map' });
  const atlasWorlds = await atlas.getByRole('button').count();
  const cryo = atlas.getByRole('button', { name: /CRYO SHELF.*START HERE/ });
  const mars = atlas.getByRole('button', { name: /MARS FRONTIER.*SHIP REQUIRED/ });
  if (atlasWorlds !== 4) throw Error('Opening system map should show all four worlds');
  if (await cryo.getAttribute('aria-pressed') !== 'true') throw Error('Cryo Shelf should be the first deployment');
  await mars.click();
  if (await mars.getAttribute('aria-pressed') !== 'true' || !(await page.locator('#atlas-copy').textContent())?.includes('rust-red'))
    throw Error('Selecting Mars should preview its world dossier without unlocking travel');
  await cryo.click();
  if (await cryo.getAttribute('aria-pressed') !== 'true') throw Error('Starting world preview should return to Cryo Shelf');
  const goal = await atlas.locator('.atlas-goal').innerText();
  if (!goal.includes('RECOVER 4 SIGNALS') || !goal.includes('BUILD THE FARADAY') || !goal.includes('EXPLORE EVERY WORLD'))
    throw Error(`Opening map should explain the campaign goal: ${goal}`);
  await page.screenshot({ path: 'output/playwright/vesper-start-map.png' });
  await page.setViewportSize({ width: 800, height: 600 });
  const introBounds = await page.locator('.intro').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height, scrollHeight: element.scrollHeight };
  });
  const launchBounds = await page.locator('#launch').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  });
  if (launchBounds.bottom > introBounds.bottom + 1 || launchBounds.top < introBounds.top || launchBounds.bottom > 600)
    throw Error(`Compact briefing should keep Begin Expedition visible inside its panel: ${JSON.stringify({ introBounds, launchBounds })}`);
  await page.screenshot({ path: 'output/playwright/vesper-start-map-800x600.png' });
  await page.getByRole('button', { name: /BEGIN EXPEDITION/ }).click();
  const fresh = await page.evaluate(() => window.__mars);
  if (fresh.seed === previousSeed || fresh.money !== 80 || fresh.destroyed.length || fresh.levels.drill !== 1 || fresh.mapId !== 'cryo-shelf')
    throw Error(`New expedition should start a clean Cryo campaign after preview: ${JSON.stringify(fresh)}`);
  await page.locator('#open-shipyard').click();
  const shipyard = await page.locator('#modal-layer').innerText();
  if (!shipyard.includes('share one balance') || !shipyard.includes('spent on services and upgrades'))
    throw Error(`Shipyard should explain the shared, spendable credit balance: ${shipyard}`);
  for (const landmark of ['THERMAL OBSERVATORY', 'BASALT ENGINE HALL', 'ARK SIGNAL GALLERY', 'FARADAY BEACON VAULT']) {
    if (!shipyard.includes(landmark)) throw Error(`Shipyard should map a route claim to ${landmark}: ${shipyard}`);
  }
  if ((shipyard.match(/SIGNAL CLAIM ·/g) ?? []).length !== 4)
    throw Error(`Fresh shipyard should show four unclaimed signal sources: ${shipyard}`);
  await page.screenshot({ path: 'output/playwright/shipyard-route-claims.png' });
  return { seed: fresh.seed, money: fresh.money, docked: fresh.docked, tiles: fresh.destroyed.length,
    atlasWorlds, goal, compactIntro: introBounds, compactLaunch: launchBounds, shipyardClaims: 4 };
}
