// Exercise low-fuel auto recovery and confirmed hull repair from version-20 fixtures.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const chart = { columns: 471, radiusRows: 150 }, seed = 41339,
    mapState = (x, y) => ({ seed, x, y, maxDepth: 0, destroyed: [], discovered: [], drops: [],
      activeCharge: null, structures: [], planetChart: chart }),
    base = {
      version: 20, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
      maps: { 'cryo-shelf': mapState(980, 24) }, money: 80,
      levels: { drill: 2, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
      fuel: 140, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
      maxDepth: 0, artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
      ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
      ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
      ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
      stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
    };

  const fuelFixture = { ...base, fuel: 0.02, cargo: { ...base.cargo, copper: 2 } };
  await page.evaluate((save) => window.localStorage.setItem('mars-miner.v1', JSON.stringify(save)), fuelFixture);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.keyboard.down('s');
  await page.waitForTimeout(180);
  await page.keyboard.up('s');
  await page.waitForTimeout(500);
  const fuelFailure = await page.evaluate(() => window.__mars);
  if (fuelFailure.depth !== 0 || fuelFailure.fuel < 139 || fuelFailure.fuel > 140 || fuelFailure.hull !== 100 ||
    Object.values(fuelFailure.cargo).some(Boolean) || fuelFailure.money !== base.money ||
    fuelFailure.levels.drill !== base.levels.drill)
    throw Error(`Fuel recovery regression: ${JSON.stringify(fuelFailure)}`);
  await page.screenshot({ path: 'output/playwright/08-fuel-recovery.png' });

  const hullFixture = { ...base, maps: { ...base.maps, 'cryo-shelf': mapState(980, 24) }, fuel: 190,
    hull: 1, cargo: { copper: 0, iron: 2, silver: 0, gold: 0, diamond: 0 } };
  await page.evaluate((save) => window.localStorage.setItem('mars-miner.v1', JSON.stringify(save)), hullFixture);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Emergency recovery' }).click();
  await page.getByRole('dialog', { name: 'EMERGENCY RECOVERY' }).waitFor();
  await page.getByRole('button', { name: /RECOVER POD/ }).click();
  await page.getByRole('dialog', { name: 'POD RECOVERED / CARGO LOST' }).waitFor();
  const hullFailure = await page.evaluate(() => window.__mars);
  if (hullFailure.depth !== 0 || hullFailure.hull !== 100 || hullFailure.fuel !== 140 ||
    Object.values(hullFailure.cargo).some(Boolean) || hullFailure.money !== base.money ||
    hullFailure.levels.drill !== base.levels.drill)
    throw Error(`Hull recovery regression: ${JSON.stringify(hullFailure)}`);
  return { fuelFailure: { depth: fuelFailure.depth, fuel: fuelFailure.fuel, hull: fuelFailure.hull,
    cargoLost: true, upgradesRetained: fuelFailure.levels.drill === base.levels.drill },
    hullFailure: { depth: hullFailure.depth, fuel: hullFailure.fuel, hull: hullFailure.hull,
      cargoLost: true, upgradesRetained: hullFailure.levels.drill === base.levels.drill } };
}
