// Verify the complete four-jump, core-fueled mothership route on a disposable dev origin.
async (page) => {
  const chart = { radiusRows: 40, columns: 126 }, seed = 77123;
  const save = {
    version: 26, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': {
      seed, x: 555, y: -22, maxDepth: 0, destroyed: ['24,0'], discovered: ['24,0', '24,1'],
      drops: [], activeCharge: null, structures: [], warehouse: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, planetChart: chart,
    } },
    money: 5000, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 43, hull: 100, cargo: { copper: 1.5, iron: 1, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0, artifact: false, milestones: ['core-cryo'], shipComponents: [], routeFragments: [],
    coreFuel: 4, mothershipBoarded: false, charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));

  const initial = await page.evaluate(() => window.__mars);
  if (initial.mapId !== 'cryo-shelf' || initial.coreFuel !== 4 || initial.mothershipBoarded)
    throw Error(`Core-ready fixture should load beside the landed mothership: ${JSON.stringify(initial)}`);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__mars?.mothershipBoarded);
  const boarded = await page.evaluate(() => ({ state: window.__mars, save: JSON.parse(localStorage.getItem('mars-miner.v1')) }));
  if (!boarded.state.mothershipBoarded || !boarded.save.mothershipBoarded)
    throw Error(`Pressing E beside the mothership should board and save immediately: ${JSON.stringify(boarded)}`);
  const startingFuel = initial.fuel, startingCargo = JSON.stringify(initial.cargo), startingMoney = initial.money;
  const visited = [];
  for (const id of ['mars-frontier', 'hull-graveyard', 'prism-fault', 'cinder-vale']) {
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(() => window.__mars?.inOrbit && window.__mars?.orbitalOverviewActive, {}, { timeout: 30000 });
    } finally { await page.keyboard.up('w'); }
    await page.locator('#orbit-worlds').click();
    const jump = page.locator(`#map-${id}`);
    if (!(await jump.isEnabled())) throw Error(`${id} should be reachable with a core-fuel charge in orbit`);
    await jump.click();
    const state = await page.evaluate(() => window.__mars);
    const expectedFuel = 3 - visited.length;
    if (state.mapId !== id || state.coreFuel !== expectedFuel || !state.mothershipBoarded || !state.docked)
      throw Error(`Core-fuel jump to ${id} did not arrive aboard with the expected reserve: ${JSON.stringify(state)}`);
    if (state.fuel !== startingFuel || state.hull !== 100 || JSON.stringify(state.cargo) !== startingCargo || state.money !== startingMoney)
      throw Error(`Interplanetary travel changed miner fuel, hull, cargo, or credits at ${id}`);
    visited.push({ id, coreFuel: state.coreFuel, seed: state.seed });
  }

  const final = await page.evaluate(() => ({
    state: window.__mars,
    save: JSON.parse(localStorage.getItem('mars-miner.v1')),
  }));
  if (final.save.activeMap !== 'cinder-vale' || final.save.coreFuel !== 0)
    throw Error(`The four-core-fuel jump reserve should be exhausted on Cinder Vale: ${JSON.stringify(final.save)}`);
  if (!final.save.maps['cryo-shelf'].destroyed.includes('24,0')) throw Error('The original excavated tile did not persist');
  if (Object.keys(final.save.maps).length !== 5) throw Error('Each visited world should have an independent saved map');
  await page.screenshot({ path: 'output/playwright/campaign-travel.png' });
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restored = await page.evaluate(() => window.__mars);
  if (restored.mapId !== 'cinder-vale' || restored.coreFuel !== 0 || !restored.mothershipBoarded || !restored.docked)
    throw Error(`Final planet, depleted core fuel, and aboard state should survive reload: ${JSON.stringify(restored)}`);
  return { visited, savedMaps: Object.keys(final.save.maps), remainingCoreFuel: restored.coreFuel, localFuel: restored.fuel };
};
