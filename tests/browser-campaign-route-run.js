// Physical Cryo Shelf campaign loop from a fresh save; run only on a dedicated dev origin.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank'); await page.goto(baseURL); await page.waitForFunction(() => !!window.__mars);
  const seed = 77124;
  const save = {
    version: 10, campaignSeed: seed, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 }, fuel: 140, hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload(); await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const trips = [];
  for (const [index, fragment] of ['fragment-1', 'fragment-2', 'fragment-3', 'fragment-4'].entries()) {
    await page.keyboard.down('s');
    try {
      await page.waitForFunction(id => window.__mars?.routeFragments.includes(id), fragment, { timeout: 150000 });
    } finally { await page.keyboard.up('s'); }
    const mined = await page.evaluate(() => window.__mars);
    if (mined.overlaps || mined.hull <= 0 || mined.fuel <= 0) throw Error(`Unsafe after ${fragment}: ${JSON.stringify(mined)}`);
    trips.push({ fragment, depth: mined.depth, fuelAtFind: mined.fuel, hullAtFind: mined.hull, money: mined.money });

    await page.keyboard.down('w');
    await page.waitForFunction(() => window.__mars?.y < -35, {}, { timeout: 60000 });
    await page.keyboard.up('w');
    await page.waitForFunction(() => window.__mars?.docked, {}, { timeout: 10000 });
    const docked = await page.evaluate(() => window.__mars);
    if (docked.overlaps || docked.hull <= 0) throw Error(`Unsafe return after ${fragment}: ${JSON.stringify(docked)}`);

    if (Object.values(docked.cargo).some(Boolean)) {
      await page.locator('#open-sell').click();
      await page.locator('#sell').click();
      await page.locator('#close').click();
    }
    await page.locator('#open-service').click();
    const service = page.locator('#service-all');
    if (await service.isEnabled()) await service.click();
    await page.locator('#close').click();
    const ready = await page.evaluate(() => window.__mars);
    if (ready.fuel < 120 || ready.hull < 85) throw Error(`Could not safely service before next descent: ${JSON.stringify(ready)}`);
    trips[index].returnFuel = ready.fuel;
    trips[index].returnHull = ready.hull;
  }

  const archiveBefore = await page.evaluate(() => window.__mars);
  const campaignSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (archiveBefore.routeFragments.length !== 4 || !campaignSave.artifact)
    throw Error(`All route signals and deep transmission should be recovered: ${JSON.stringify({ state: archiveBefore, artifact: campaignSave.artifact })}`);
  await page.locator('#open-shipyard').click();
  for (const id of ['frame', 'propulsion', 'navigation', 'life-support']) {
    const button = page.locator(`#ship-${id}`);
    if (!(await button.isEnabled())) throw Error(`Claim-funded campaign could not afford ${id}: ${JSON.stringify(await page.evaluate(() => window.__mars))}`);
    await button.click();
  }
  await page.locator('#close').click();
  await page.locator('#open-destinations').click();
  for (const id of ['mars-frontier', 'hull-graveyard', 'prism-fault']) {
    const button = page.locator(`#map-${id}`);
    if (await button.isDisabled()) throw Error(`Campaign ship did not unlock ${id}`);
  }
  await page.locator('#map-hull-graveyard').click();
  const traveled = await page.evaluate(() => window.__mars);
  if (traveled.mapId !== 'hull-graveyard' || traveled.routeFragments.length !== 4 || traveled.money < 0)
    throw Error(`Shipyard travel failed: ${JSON.stringify(traveled)}`);
  await page.reload(); await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restored = await page.evaluate(() => window.__mars);
  if (restored.mapId !== 'hull-graveyard' || restored.routeFragments.length !== 4 || restored.shipComponents.length !== 4)
    throw Error(`Campaign did not persist after travel: ${JSON.stringify(restored)}`);
  await page.screenshot({ path: 'output/playwright/campaign-route-run.png' });
  return { trips, assembled: restored.shipComponents, deepSignal: campaignSave.artifact, moneyAfterTravel: restored.money, destination: restored.mapId };
}
