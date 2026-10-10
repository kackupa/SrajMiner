// Verify v26 core-powered mothership takeoff, landing, jump spend, and reload on a dedicated dev origin.
async (page) => {
  const chart = { radiusRows: 40, columns: 126 }, seed = 77124;
  const save = {
    version: 26, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': {
      seed, x: 555, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null,
      structures: [], warehouse: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, planetChart: chart,
    } },
    money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 140, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0, artifact: false, milestones: ['core-cryo'], shipComponents: [], routeFragments: [],
    coreFuel: 4, mothershipBoarded: true, charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  const baseURL = new URL(page.url()).origin;
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));

  const loaded = await page.evaluate(() => window.__mars);
  if (!loaded.shipComplete || !loaded.mothershipBoarded || loaded.coreFuel !== 4 || loaded.mapId !== 'cryo-shelf' || !loaded.docked)
    throw Error(`Core-ready surface save should restore aboard at its pad: ${JSON.stringify(loaded)}`);
  if (await page.locator('#control-e').innerText() !== 'DISEMBARK' ||
      await page.locator('#control-w').innerText() !== 'TAKE OFF' || await page.locator('#control-s').innerText() !== '—')
    throw Error('The footer should show mothership-specific controls while parked on the surface');

  await page.locator('#open-destinations').click();
  if (await page.locator('#map-hull-graveyard').isEnabled())
    throw Error('The mothership must reach orbit before opening the world jump controls');
  await page.locator('#close').click();

  const startingFuel = loaded.fuel;
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.inOrbit && window.__mars?.orbitalOverviewActive, {}, { timeout: 30000 });
  } finally { await page.keyboard.up('w'); }
  let state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || state.coreFuel !== 4 || state.fuel !== startingFuel || state.hull !== 100)
    throw Error(`Mothership takeoff should preserve core and local fuel and avoid damage: ${JSON.stringify(state)}`);
  await page.waitForFunction(() => document.querySelector('#control-s')?.textContent?.trim() === 'LAND');
  if (await page.locator('#control-s').innerText() !== 'LAND' || await page.locator('#control-w').innerText() !== 'THRUST')
    throw Error('The footer should switch to orbital takeoff/landing instructions');
  if (!(await page.locator('#orbit-worlds').isVisible())) throw Error('Orbit should expose the Worlds control');
  await page.screenshot({ path: 'output/playwright/mothership-orbit.png' });

  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => !window.__mars?.inOrbit && window.__mars?.docked, {}, { timeout: 10000 });
  } finally { await page.keyboard.up('s'); }
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || state.y !== -22 || state.fuel !== startingFuel || state.hull !== 100)
    throw Error(`S should land the mothership safely back at its pad: ${JSON.stringify(state)}`);

  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (state.mothershipBoarded || state.docked) throw Error(`E should disembark the miner at the pad: ${JSON.stringify(state)}`);
  await page.waitForFunction(() => document.querySelector('#control-e')?.textContent?.trim() === 'BOARD MOTHERSHIP');
  if (await page.locator('#control-e').innerText() !== 'BOARD MOTHERSHIP')
    throw Error('The footer should point back to boarding when the miner stands beside the landed ship');
  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || !state.docked) throw Error(`E should board the mothership at the pad: ${JSON.stringify(state)}`);

  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.inOrbit && window.__mars?.orbitalOverviewActive, {}, { timeout: 30000 });
  } finally { await page.keyboard.up('w'); }
  await page.locator('#orbit-worlds').click();
  if (!(await page.locator('#map-hull-graveyard').isEnabled()) || !(await page.locator('#map-cinder-vale').isEnabled()) ||
      await page.locator('#map-vesper-9').isEnabled())
    throw Error('The five known worlds should be available after the first core, while Vesper-9 stays chapter-locked');
  await page.locator('#map-hull-graveyard').click();
  state = await page.evaluate(() => window.__mars);
  if (state.mapId !== 'hull-graveyard' || state.coreFuel !== 3 || !state.mothershipBoarded || !state.docked || state.fuel !== startingFuel)
    throw Error(`A jump should spend one core-fuel unit, arrive at the new pad, and preserve local fuel: ${JSON.stringify(state)}`);

  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restored = await page.evaluate(() => window.__mars);
  if (restored.mapId !== 'hull-graveyard' || restored.coreFuel !== 3 || !restored.mothershipBoarded || !restored.docked)
    throw Error(`Destination, core fuel, and boarding state should survive reload: ${JSON.stringify(restored)}`);
  await page.screenshot({ path: 'output/playwright/mothership-arrival.png' });
  return { destination: restored.mapId, remainingCoreFuel: restored.coreFuel, minerFuel: restored.fuel, boarded: restored.mothershipBoarded };
};
