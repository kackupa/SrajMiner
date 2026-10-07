// Run on a dedicated development origin; uses an isolated version-10 campaign fixture.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const seed = 78235;
  const save = {
    version: 10,
    campaignSeed: seed,
    activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 5000,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
    fuel: 140,
    hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0,
    artifact: false,
    milestones: [],
    shipComponents: [],
    routeFragments: [],
    charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  let state = await page.evaluate(() => window.__mars);
  if (state.specialization !== 'balanced') throw Error('Version-10 save did not migrate to the balanced path');
  if (JSON.parse(await page.evaluate(() => localStorage.getItem('mars-miner.v1'))).version !== 12)
    throw Error('Starting the migrated expedition did not save version 12');
  if (state.scannerRadius !== 4) throw Error(`Migrated scanner should start at 4 tiles: ${JSON.stringify(state)}`);

  await page.locator('#open-upgrades').click();
  await page.locator('#buy-scanner').click();
  await page.locator('#close').click();
  await page.waitForFunction(() => window.__mars?.scannerRadius === 8);
  state = await page.evaluate(() => window.__mars);
  if (state.levels.scanner !== 2) throw Error('Scanner purchase did not expand the field of view');
  await page.locator('#open-upgrades').click();
  await page.locator('#buy-stasis').click();
  await page.locator('#close').click();
  state = await page.evaluate(() => window.__mars);
  if (!state.stasisModule) throw Error('Stasis module purchase did not install');

  const select = async (key) => {
    await page.locator('#open-upgrades').click();
    await page.locator(`#specialization-${key}`).click();
    await page.locator('#close').click();
  };
  await select('seamCutter');
  state = await page.evaluate(() => window.__mars);
  if (state.specialization !== 'seamCutter') throw Error('Seam Cutter choice did not apply');
  await select('surveyor');
  await page.waitForFunction((previous) => window.__mars?.surveyedCells > previous, state.surveyedCells);
  state = await page.evaluate(() => window.__mars);
  if (state.specialization !== 'surveyor') throw Error('Surveyor choice did not apply');
  const surveyedCells = state.surveyedCells;
  await select('hauler');
  state = await page.evaluate(() => window.__mars);
  if (state.specialization !== 'hauler' || state.cargoCapacity !== 20)
    throw Error(`Hauler bonus was not applied: ${JSON.stringify(state)}`);
  for (const radius of [13, 22, 48]) {
    await page.locator('#open-upgrades').click();
    await page.locator('#buy-scanner').click();
    await page.locator('#close').click();
    await page.waitForFunction((expected) => window.__mars?.scannerRadius === expected, radius);
  }
  state = await page.evaluate(() => window.__mars);
  if (state.levels.scanner !== 5 || state.scannerRadius !== 48)
    throw Error(`Max scanner should reveal the full map width: ${JSON.stringify(state)}`);
  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__mars?.y > 240);
  await page.keyboard.up('s');
  await page.waitForFunction(() => window.__mars?.vy > 0);
  await page.keyboard.down('x');
  await page.waitForFunction(() => window.__mars?.stasisActive);
  const hoverStart = await page.evaluate(() => window.__mars);
  await page.waitForTimeout(600);
  const hoverHold = await page.evaluate(() => window.__mars);
  if (Math.abs(hoverHold.y - hoverStart.y) > 1 || !(hoverHold.fuel < hoverStart.fuel))
    throw Error(`Stasis must hold altitude while consuming fuel: ${JSON.stringify({ hoverStart, hoverHold })}`);
  await page.keyboard.up('x');
  await page.waitForFunction(() => !window.__mars?.stasisActive && window.__mars?.vy > 0);
  const persisted = JSON.parse(await page.evaluate(() => localStorage.getItem('mars-miner.v1')));
  if (persisted.specialization !== 'hauler' || persisted.version !== 12)
    throw Error('Selected specialization did not persist in the current save');
  if (persisted.levels.scanner !== 5 || persisted.stasisModule !== true)
    throw Error('Scanner progression and stasis module did not persist');

  persisted.cargo.copper = 17;
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), persisted);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#open-upgrades').click();
  const balanced = page.locator('#specialization-balanced');
  if (!(await balanced.isDisabled()) || !(await balanced.innerText()).includes('SELL 1 UNIT FIRST'))
    throw Error('Smaller cargo specialization was not blocked for a 17-unit haul');
  await page.screenshot({ path: 'output/playwright/pilot-specialization-capacity-guard.png' });
  await page.setViewportSize({ width: 960, height: 560 });
  const panel = await page.locator('.modal').boundingBox();
  if (!panel || panel.x < 0 || panel.y < 0 || panel.x + panel.width > 960 || panel.y + panel.height > 560)
    throw Error(`Workshop panel is clipped at 960×560: ${JSON.stringify(panel)}`);
  return { migration: 'v10 → v12 balanced + scanner/stasis defaults', specializationPersisted: persisted.specialization, surveyedCells, scanner: state.scannerRadius, stasisFuelUse: hoverStart.fuel - hoverHold.fuel, haulCapacity: state.cargoCapacity, overCapacitySwitchDisabled: true, compactPanel: panel };
}
