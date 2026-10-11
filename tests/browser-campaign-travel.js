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

  // Save and reload after moving away from Cryo Shelf but before entering another world.
  await page.keyboard.down('d'); await page.keyboard.down('s');
  try { await page.waitForFunction(() => {
    const p = window.__mars?.solarPosition;
    return !!p && Math.hypot(p.x + 420, p.y + 130) > 80;
  }, {}, { timeout: 10000 }); }
  finally { await page.keyboard.up('d'); await page.keyboard.up('s'); }
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const beforeReload = await page.evaluate(() => ({ state: window.__mars, save: JSON.parse(localStorage.getItem('mars-miner.v1')) }));
  if (!beforeReload.save.solarPosition || !beforeReload.save.mothershipBoarded)
    throw Error(`Mid-flight position and boarded state should save: ${JSON.stringify(beforeReload.save)}`);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => !!window.__mars && !!document.querySelector('.solar-flight'));
  const restoredFlight = await page.evaluate(() => window.__mars);
  if (!restoredFlight.mothershipBoarded || !restoredFlight.solarPosition ||
      Math.hypot(restoredFlight.solarPosition.x - beforeReload.save.solarPosition.x, restoredFlight.solarPosition.y - beforeReload.save.solarPosition.y) > 0.01 ||
      restoredFlight.coreFuel !== beforeReload.save.coreFuel)
    throw Error(`Space position and fuel should restore exactly: ${JSON.stringify(restoredFlight)}`);

  await page.keyboard.down('d'); await page.keyboard.down('s');
  try { await page.waitForFunction(() => {
    const p = window.__mars?.solarPosition;
    return !!p && Math.hypot(p.x + 190, p.y - 125) <= 44;
  }, {}, { timeout: 20000 }); }
  finally { await page.keyboard.up('d'); await page.keyboard.up('s'); }
  if (!(await page.locator('.solar-flight button').isEnabled())) throw Error('Nearby Hull Graveyard should enable landing');
  await page.screenshot({ path: 'output/playwright/campaign-travel.png' });
  await page.locator('.solar-flight button').click();
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
  await page.keyboard.down('a'); await page.keyboard.down('w');
  try { await page.waitForFunction(() => {
    const p = window.__mars?.solarPosition;
    return !!p && Math.hypot(p.x + 420, p.y + 130) <= 44;
  }, {}, { timeout: 20000 }); }
  finally { await page.keyboard.up('a'); await page.keyboard.up('w'); }
  if (!(await page.locator('.solar-flight button').isEnabled())) throw Error('Return to Cryo Shelf should be landable');
  await page.locator('.solar-flight button').click();
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
