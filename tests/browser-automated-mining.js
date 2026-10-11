// Disposable v29 campaign fixture. Exercises actual warehouse transfers,
// extractor construction, production during interplanetary travel, upgrades,
// and save/reload without touching a player's existing campaign.
async (page) => {
  const baseURL = new URL(page.url()).origin, chart = { columns: 126, radiusRows: 40 }, seed = 321092;
  const empty = { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 };
  const map = (warehouse = false) => ({
    seed, x: 700, y: -22, maxDepth: 0, destroyed: ['24,0'], discovered: ['24,0'], drops: [], activeCharge: null,
    structures: warehouse ? [{ id: 'warehouse:700:0', kind: 'warehouse', x: 700, y: 0, level: 1 }] : [],
    warehouse: { ...empty }, planetChart: chart,
  });
  const fixture = {
    version: 29, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf', productionUpdatedAt: Date.now(),
    maps: { 'cryo-shelf': map(true), 'hull-graveyard': { ...map(), seed: seed + 1 } },
    money: 5000, levels: { drill: 1, fuel: 1, cargo: 2, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 140, hull: 100, cargo: { ...empty, copper: 4, iron: 10, silver: 8 }, maxDepth: 0,
    artifact: false, milestones: ['core-cryo'], shipComponents: [], routeFragments: [], coreFuel: 4,
    solarPosition: null, mothershipBoarded: false, charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard', ownedProfiles: ['standard'], selectedProfile: 'standard',
    specialization: 'balanced', stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false,
    grappleOwned: false,
  };
  const errors = [];
  const surfaceStep = async (targetX) => {
    const circumference = chart.columns * 40;
    const circularDistance = (x, y) => Math.abs(((x - y + circumference / 2) % circumference + circumference) % circumference - circumference / 2);
    for (const key of ['a', 'd']) {
      const before = await page.evaluate(() => window.__mars.x), startDistance = circularDistance(before, targetX);
      await page.keyboard.down(key);
      try {
        await page.waitForTimeout(500);
        const after = await page.evaluate(() => window.__mars.x);
        const movedTowardTarget = circularDistance(after, targetX) < startDistance;
        if (!movedTowardTarget) continue;
        await page.waitForFunction((target) => {
          const length = 126 * 40, delta = Math.abs(((window.__mars.x - target + length / 2) % length + length) % length - length / 2);
          return delta < 72;
        }, targetX, { timeout: 15000 });
        return;
      } catch { /* Try the opposite tangent direction if this key moved away. */ }
      finally { await page.keyboard.up(key); }
    }
    throw Error(`Could not reach surface location ${targetX}`);
  };
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('about:blank'); await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), fixture);
  await page.reload(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => window.__mars?.docked && window.__mars?.maps?.['cryo-shelf']?.warehouse);

  const initial = await page.evaluate(() => window.__mars);
  if (initial.money !== 5000 || initial.mapId !== 'cryo-shelf')
    throw Error(`Unexpected disposable v29 start: ${JSON.stringify(initial)}`);
  await page.keyboard.press('e');
  await page.locator('#warehouse-ore').selectOption('copper');
  await page.locator('#warehouse-units').fill('0.5');
  await page.locator('#warehouse-store').click();
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (save.cargo.copper !== 3.5 || save.maps['cryo-shelf'].warehouse.copper !== 0.5)
    throw Error(`Ore deposit duplicated or failed: ${JSON.stringify({ cargo: save.cargo, stock: save.maps['cryo-shelf'].warehouse })}`);

  await page.locator('#warehouse-build-extractor').click();
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  let extractor = save.maps['cryo-shelf'].structures.find((entry) => entry.kind === 'extractor');
  if (!extractor || extractor.level !== 1 || save.money !== 4780 || save.cargo.copper !== 0.5 || save.cargo.iron !== 9)
    throw Error(`Basic Excavator construction cost/state mismatch: ${JSON.stringify({ extractor, money: save.money, cargo: save.cargo })}`);
  await page.keyboard.press('Escape');
  await surfaceStep(555);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__mars?.mothershipBoarded);

  // Advance only the game page's wall clock while taking a real mothership route.
  // Phaser's frame delta remains performance-clock based; restoring Date.now on
  // arrival prevents the future fixture clock from affecting the reload check.
  await page.evaluate(() => {
    const original = Date.now;
    (window).__miningFixtureRealNow = original;
    Date.now = () => original() + 3_600_000;
  });
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__mars?.inOrbit, {}, { timeout: 30000 }); }
  finally { await page.keyboard.up('w'); }
  await page.locator('.solar-planet-choice').filter({ hasText: 'Hull Graveyard' }).click();
  await page.getByRole('button', { name: /TRAVEL TO HULL GRAVEYARD/ }).click();
  await page.waitForFunction(() => window.__mars?.mapId === 'hull-graveyard' && !window.__mars?.inOrbit);
  await page.evaluate(() => { Date.now = (window).__miningFixtureRealNow; delete (window).__miningFixtureRealNow; });
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const cryo = save.maps['cryo-shelf'];
  const storedAfterTravel = Object.values(cryo.warehouse).reduce((sum, amount) => sum + amount, 0);
  const productionWhileAway = storedAfterTravel - 0.5;
  if (Math.abs(productionWhileAway - 2) > 0.001)
    throw Error(`Expected 2 ore produced while away after one hour, got ${productionWhileAway}: ${JSON.stringify(cryo.warehouse)}`);

  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__mars?.inOrbit, {}, { timeout: 30000 }); }
  finally { await page.keyboard.up('w'); }
  await page.locator('.solar-planet-choice').filter({ hasText: 'Cryo Shelf' }).click();
  await page.getByRole('button', { name: /TRAVEL TO CRYO SHELF/ }).click();
  await page.waitForFunction(() => window.__mars?.mapId === 'cryo-shelf' && !window.__mars?.inOrbit);
  await page.keyboard.press('e');
  await surfaceStep(700);
  await page.keyboard.press('e');
  const warehouseUI = await page.locator('.modal').innerText();
  if (!warehouseUI.includes(`STORED × ${cryo.warehouse.copper}`) || !warehouseUI.includes(`${storedAfterTravel} / 40 ORE`))
    throw Error(`Warehouse did not show accumulated stock/capacity: ${warehouseUI}`);
  await page.locator(`[id="upgrade-extractor-${encodeURIComponent(extractor.id)}"]`).click();
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  extractor = save.maps['cryo-shelf'].structures.find((entry) => entry.kind === 'extractor');
  if (extractor.level !== 2 || save.money !== 4100 || save.cargo.iron !== 3 || save.cargo.silver !== 6)
    throw Error(`Industrial Drill upgrade cost/materials did not persist: ${JSON.stringify({ extractor, money: save.money, cargo: save.cargo })}`);
  const totalBeforeReload = Object.values(save.maps['cryo-shelf'].warehouse).reduce((sum, amount) => sum + amount, 0);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const totalAfterReload = Object.values(save.maps['cryo-shelf'].warehouse).reduce((sum, amount) => sum + amount, 0);
  if (totalAfterReload !== totalBeforeReload || save.maps['cryo-shelf'].structures.find((entry) => entry.kind === 'extractor')?.level !== 2)
    throw Error(`Reload duplicated/lost automated stock or upgraded tier: ${totalBeforeReload} -> ${totalAfterReload}`);
  if (errors.length) throw Error(`Browser page errors: ${errors.join(' | ')}`);
  return { depositedCopper: 0.5, producedWhileAway, extractorTier: extractor.level,
    capacity: 40, moneyAfterBuildAndUpgrade: save.money, errors };
}
