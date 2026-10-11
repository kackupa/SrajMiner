// Verify mothership dock, solar-system entry, safe return landing, and board-state persistence.
async (page) => {
  const chart = { radiusRows: 40, columns: 126 }, seed = 77124;
  const save = {
    version: 27, solarPosition: null, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
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
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));

  let state = await page.evaluate(() => window.__mars);
  if (!state.shipComplete || !state.mothershipBoarded || state.coreFuel !== 4 || state.mapId !== 'cryo-shelf' || !state.docked)
    throw Error(`Aboard save should restore docked at the surface pad: ${JSON.stringify(state)}`);
  const startingFuel = state.fuel;
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__mars?.inOrbit && !!document.querySelector('.solar-flight'), {}, { timeout: 30000 }); }
  finally { await page.keyboard.up('w'); }
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || state.coreFuel > 4 || state.coreFuel < 3.9 || state.fuel !== startingFuel || state.hull !== 100 || !state.solarPosition)
    throw Error(`Takeoff should enter solar flight, spending only the tiny distance flown during the handoff: ${JSON.stringify(state)}`);
  if (!(await page.locator('.solar-planet-choice').filter({ hasText: 'Cryo Shelf' }).isEnabled())) throw Error('The departure planet should be selectable');
  await page.screenshot({ path: 'output/playwright/mothership-orbit.png' });
  await page.getByRole('button', { name: /RETURN TO CRYO SHELF/ }).click();
  await page.waitForFunction(() => !window.__mars?.inOrbit && !document.querySelector('.solar-flight'));
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || !state.docked || state.y !== -22 || state.fuel !== startingFuel || state.coreFuel > 4 || state.coreFuel < 3.9)
    throw Error(`Landing should return the boarded mothership to its pad without fuel cost: ${JSON.stringify(state)}`);

  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (state.mothershipBoarded) throw Error(`E should let the miner disembark at the pad: ${JSON.stringify(state)}`);
  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded) throw Error(`E should let the miner board again: ${JSON.stringify(state)}`);

  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restored = await page.evaluate(() => window.__mars);
  if (restored.mapId !== 'cryo-shelf' || restored.coreFuel > 4 || restored.coreFuel < 3.9 || !restored.mothershipBoarded || !restored.docked || restored.fuel !== startingFuel)
    throw Error(`Surface-pad boarding and separate local/core fuel should survive reload: ${JSON.stringify(restored)}`);
  if (errors.length) throw Error(`Browser page errors: ${errors.join(' | ')}`);
  return { destination: restored.mapId, coreFuel: restored.coreFuel, minerFuel: restored.fuel, boarded: restored.mothershipBoarded };
};
