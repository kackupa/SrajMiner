// Verify recovered signals assemble the Faraday automatically and legacy saves migrate safely.
async (page) => {
  const seed = 77124, chart = { columns: 471, radiusRows: 150 };
  const save = {
    version: 20, planetChart: chart, campaignSeed: seed, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
    money: 0, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 }, fuel: 140, hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: [], shipComponents: [], routeFragments: ['fragment-1', 'fragment-2', 'fragment-3', 'fragment-4'], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const assembled = await page.evaluate(() => window.__mars);
  if (assembled.money !== 0 || assembled.shipComponents.length !== 4 || assembled.shipStatus !== 'FLIGHT READY')
    throw Error(`Already-recovered signals should install all four parts for free: ${JSON.stringify(assembled)}`);
  await page.screenshot({ path: 'output/playwright/faraday-hub-flight-ready.png' });
  await page.locator('#open-shipyard').click();
  const parts = await page.locator('#modal-layer').innerText();
  if (!parts.includes('shipyard purchase needed') || (parts.match(/FOUND · INSTALLED AUTOMATICALLY/g) ?? []).length !== 4)
    throw Error(`Ship-parts panel should show four recovered parts with no purchases: ${parts}`);
  await page.locator('#close').click();
  await page.locator('#open-destinations').click();
  const surfaceBoard = await page.locator('#modal-layer').innerText();
  if (!surfaceBoard.includes('Hold W to climb above the globe') ||
      await page.locator('#map-hull-graveyard').isEnabled())
    throw Error(`Other worlds must remain gated until the Faraday reaches orbit: ${surfaceBoard}`);
  await page.locator('#close').click();
  const orbitY = -Math.max(900, Math.round(chart.radiusRows * 40 * 0.72));
  await page.keyboard.down('w');
  try {
    await page.waitForFunction((threshold) => window.__mars?.y <= threshold && window.__mars?.orbitalOverviewActive,
      orbitY, { timeout: 30000 });
  } finally {
    await page.keyboard.up('w');
  }
  const orbital = await page.evaluate(() => window.__mars);
  if (orbital.hull !== 100 || orbital.fuel <= 0 || !(await page.locator('#orbit-worlds').isVisible()))
    throw Error(`Takeoff should park safely with Worlds available: ${JSON.stringify(orbital)}`);
  await page.screenshot({ path: 'output/playwright/faraday-orbital-cutaway.png' });
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restoredOrbit = await page.evaluate(() => window.__mars);
  if (restoredOrbit.y > orbitY || !restoredOrbit.orbitalOverviewActive ||
      !(await page.locator('#orbit-worlds').isVisible()))
    throw Error(`Orbital parking position should survive reload: ${JSON.stringify(restoredOrbit)}`);
  await page.locator('#orbit-worlds').click();
  for (const id of ['mars-frontier', 'hull-graveyard', 'prism-fault']) {
    if (await page.locator(`#map-${id}`).isDisabled()) throw Error(`Recovered parts did not unlock ${id}`);
  }
  await page.locator('#map-hull-graveyard').click();
  const traveled = await page.evaluate(() => window.__mars);
  if (traveled.mapId !== 'hull-graveyard' || traveled.money !== 0 || traveled.shipComponents.length !== 4)
    throw Error(`Travel after automatic ship assembly failed: ${JSON.stringify(traveled)}`);
  if (traveled.hull !== 100 || traveled.y > -21.9 || await page.locator('#orbit-worlds').isVisible())
    throw Error(`Arrival should be a safe surface landing, ready to explore: ${JSON.stringify(traveled)}`);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const restored = await page.evaluate(() => window.__mars);
  if (restored.mapId !== 'hull-graveyard' || restored.shipComponents.length !== 4 || restored.money !== 0)
    throw Error('Ship parts and destination did not survive reload');
  await page.screenshot({ path: 'output/playwright/ship-parts-auto-travel.png' });

  // Reload at the far-side orbit to verify the same world selector and outward thrust there.
  const farOrbitY = chart.radiusRows * 40 * 2 + Math.max(900, Math.round(chart.radiusRows * 40 * 0.72));
  save.maps['cryo-shelf'].y = farOrbitY;
  const farContext = await page.context().browser().newContext(),
    farPage = await farContext.newPage(), baseURL = new URL(page.url()).origin;
  await farPage.goto(baseURL);
  await farPage.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).waitFor();
  await farPage.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await farPage.reload();
  await farPage.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await farPage.waitForFunction(() => window.__mars?.inOrbit && window.__mars?.orbitalOverviewActive);
  if (!(await farPage.locator('#orbit-worlds').isVisible()) ||
      (await farPage.locator('#low-warning').innerText()).includes('FAST DESCENT'))
    throw Error('Far-side orbit should expose Worlds without a false fast-descent warning');
  const farBefore = await farPage.evaluate(() => window.__mars.y);
  let farDeparture;
  await farPage.keyboard.down('w');
  try {
    await farPage.waitForFunction((y) => window.__mars?.y > y, farBefore, { timeout: 5000 });
    farDeparture = await farPage.evaluate(() => window.__mars.y);
    if (!(await farPage.locator('#orbit-worlds').isVisible()))
      throw Error('World selector should remain available while leaving far-side orbit');
  } finally {
    await farPage.keyboard.up('w');
  }
  const farAfter = await farPage.evaluate(() => window.__mars);
  return { shipComponents: restored.shipComponents, money: restored.money, mapId: restored.mapId,
    farOrbit: { before: farBefore, departing: farDeparture, parked: farAfter.y, worldsVisible: true,
      warning: await farPage.locator('#low-warning').innerText() } };
};
