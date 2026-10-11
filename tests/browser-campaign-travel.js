// Verify distance-based interplanetary flight, mid-space persistence, landing, and return.
async (page) => {
  const chart = { radiusRows: 40, columns: 126 }, seed = 77123;
  const save = {
    version: 27, solarPosition: null, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
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
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));

  const initial = await page.evaluate(() => window.__mars);
  if (initial.mapId !== 'cryo-shelf' || initial.coreFuel !== 4 || initial.mothershipBoarded)
    throw Error(`Core-ready fixture should load beside the landed mothership: ${JSON.stringify(initial)}`);
  const startingFuel = initial.fuel, startingCargo = JSON.stringify(initial.cargo), startingMoney = initial.money;
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__mars?.mothershipBoarded);
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.inOrbit && !!document.querySelector('.solar-flight'), {}, { timeout: 30000 });
  } finally { await page.keyboard.up('w'); }

  // The selector replaces manual star steering. WASD cannot move the ship or spend fuel here.
  const beforeKeys = await page.evaluate(() => window.__mars);
  await page.keyboard.down('d'); await page.keyboard.down('s'); await page.waitForTimeout(900);
  await page.keyboard.up('d'); await page.keyboard.up('s');
  const afterKeys = await page.evaluate(() => window.__mars);
  if (JSON.stringify(afterKeys.solarPosition) !== JSON.stringify(beforeKeys.solarPosition) || afterKeys.coreFuel !== beforeKeys.coreFuel)
    throw Error('WASD must not move the mothership or consume fuel on the destination map');
  const hull = page.locator('.solar-planet-choice').filter({ hasText: 'Hull Graveyard' });
  if (!(await hull.isEnabled())) throw Error('Hull Graveyard should be selectable after the ship is complete');
  await hull.click();
  const routeFuel = Number((await page.locator('.solar-status').textContent()).match(/ROUTE ([0-9.]+)/)[1]);
  if (routeFuel <= 0 || routeFuel >= 1) throw Error(`Expected a direct Hull route under one fuel, got ${routeFuel}`);
  await page.screenshot({ path: 'output/playwright/campaign-travel.png' });
  await page.getByRole('button', { name: /TRAVEL TO HULL GRAVEYARD/ }).click();
  await page.waitForFunction(() => window.__mars?.mapId === 'hull-graveyard' && !document.querySelector('.solar-flight'));
  let state = await page.evaluate(() => window.__mars);
  if (state.coreFuel >= 4 || state.coreFuel <= 3 || !state.mothershipBoarded || !state.docked || state.fuel !== startingFuel)
    throw Error(`Landing should spend distance-based core fuel, preserve local fuel, and dock: ${JSON.stringify(state)}`);
  if (state.hull !== 100 || JSON.stringify(state.cargo) !== startingCargo || state.money !== startingMoney)
    throw Error('Interplanetary flight changed miner cargo, hull, or credits');

  // Disembark/reboard and return home to cover both mothership interaction states.
  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (state.mothershipBoarded) throw Error(`E should disembark on arrival: ${JSON.stringify(state)}`);
  await page.keyboard.press('e');
  state = await page.evaluate(() => window.__mars);
  if (!state.mothershipBoarded || !state.docked) throw Error(`E should reboard at the landed ship: ${JSON.stringify(state)}`);
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__mars?.inOrbit && !!document.querySelector('.solar-flight'), {}, { timeout: 30000 }); }
  finally { await page.keyboard.up('w'); }
  await page.locator('.solar-planet-choice').filter({ hasText: 'Cryo Shelf' }).click();
  await page.getByRole('button', { name: /TRAVEL TO CRYO SHELF/ }).click();
  await page.waitForFunction(() => window.__mars?.mapId === 'cryo-shelf' && !document.querySelector('.solar-flight'));
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  state = await page.evaluate(() => window.__mars);
  if (state.mapId !== 'cryo-shelf' || !state.mothershipBoarded || !state.docked || state.fuel !== startingFuel ||
      !state.destroyed.includes('24,0'))
    throw Error(`Return landing, local fuel, and original excavation should persist: ${JSON.stringify(state)}`);
  if (errors.length) throw Error(`Browser page errors: ${errors.join(' | ')}`);
  return { visited: ['cryo-shelf', 'hull-graveyard', 'cryo-shelf'], remainingCoreFuel: state.coreFuel, localFuel: state.fuel, savedMaps: Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('mars-miner.v1'))).maps) };
};
