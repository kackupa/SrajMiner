// Verify the upgraded planetary town's upper deck and drop-through in isolated Chromium.
async (page) => {
  const chart = { columns: 471, radiusRows: 150 }, farSurfaceY = chart.radiusRows * 2 * 40,
    save = {
      version: 20, planetChart: chart, campaignSeed: 81405, activeMap: 'cryo-shelf',
      maps: { 'cryo-shelf': { seed: 81405, x: 980, y: farSurfaceY + 550, maxDepth: 1800, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
      money: 5000, levels: { drill: 1, fuel: 5, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
      fuel: 480, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 1800,
      artifact: false, milestones: ['core-mars', 'core-cryo', 'core-hull', 'core-prism'],
      shipComponents: ['frame', 'propulsion', 'navigation', 'life-support'], routeFragments: [], charges: 0,
      ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
      ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
      ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
      stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
    };
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank'); await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload(); await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const expectedTopDeck = farSurfaceY + 508 + 22;
  await page.waitForFunction(y => Math.abs(window.__mars.y - y) < 16 && Math.abs(window.__mars.vy) < 5,
    expectedTopDeck, { timeout: 12000 });
  const topLanding = await page.evaluate(() => window.__mars);
  if (topLanding.overlaps || !topLanding.farHemisphere || topLanding.hull !== 100 || topLanding.shipStatus !== 'FLIGHT READY')
    throw Error(`The upgraded far-side town should catch the miner cleanly: ${JSON.stringify(topLanding)}`);
  await page.screenshot({ path: 'output/playwright/surface-town-upper-deck.png' });
  await page.keyboard.down('s'); await page.waitForTimeout(100); await page.keyboard.up('s');
  const nextDeck = farSurfaceY + 414 + 22;
  try { await page.waitForFunction(y => Math.abs(window.__mars.y - y) < 16 && Math.abs(window.__mars.vy) < 5,
    nextDeck, { timeout: 10000 }); }
  catch (error) {
    const current = await page.evaluate(() => window.__mars);
    await page.screenshot({ path: 'output/playwright/surface-town-drop-stalled.png' });
    throw Error(`Drop-through did not land on the next town deck: ${JSON.stringify({ y: current.y, vy: current.vy, depth: current.depth, far: current.farHemisphere, hull: current.hull, overlaps: current.overlaps })}; ${error}`);
  }
  const lowerLanding = await page.evaluate(() => window.__mars);
  if (lowerLanding.overlaps || !lowerLanding.farHemisphere || lowerLanding.hull < 98 || lowerLanding.fuel <= 0)
    throw Error(`Dropping through one sky deck should land safely on the next: ${JSON.stringify(lowerLanding)}`);
  await page.screenshot({ path: 'output/playwright/surface-town-drop-through.png' });
  const nearSave = JSON.parse(JSON.stringify(save));
  nearSave.maps['cryo-shelf'].y = -550;
  await page.goto('about:blank'); await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), nearSave);
  await page.reload();
  await page.waitForFunction(() => !!window.__mars);
  const nearLaunch = await page.locator('#launch').textContent().catch(() => 'missing');
  const nearStoredY = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1'))?.maps?.['cryo-shelf']?.y);
  if (!nearLaunch.includes('CONTINUE'))
    throw Error(`Near-side fixture save was not accepted: ${JSON.stringify({ nearLaunch, nearStoredY })}`);
  await page.locator('#launch').click();
  try {
    await page.waitForFunction(() => Math.abs(window.__mars.y + 524) < 16 && Math.abs(window.__mars.vy) < 5,
      null, { timeout: 12000 });
  } catch (error) {
    const current = await page.evaluate(() => ({ state: window.__mars, savedY: JSON.parse(localStorage.getItem('mars-miner.v1')).maps['cryo-shelf'].y }));
    await page.screenshot({ path: 'output/playwright/surface-town-near-side-stalled.png' });
    throw Error(`The home-side town did not catch the upper deck: ${JSON.stringify({ y: current.state.y, vy: current.state.vy, far: current.state.farHemisphere, savedY: current.savedY, hull: current.state.hull, overlaps: current.state.overlaps })}; ${error}`);
  }
  const nearLanding = await page.evaluate(() => window.__mars);
  if (nearLanding.overlaps || nearLanding.farHemisphere || nearLanding.hull !== 100)
    throw Error(`The home-side town should render and catch the matching upper deck: ${JSON.stringify(nearLanding)}`);
  await page.screenshot({ path: 'output/playwright/surface-town-near-side-upper-deck.png' });
  await page.setViewportSize({ width: 800, height: 600 });
  const compact = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    canvas: document.querySelector('#game canvas')?.getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  if (compact.overflow || !compact.canvas || compact.canvas.width > 800 || compact.canvas.height > 600)
    throw Error(`The compact surface view should fit its viewport: ${JSON.stringify(compact)}`);
  await page.screenshot({ path: 'output/playwright/surface-town-800x600.png' });
  return { upperDeckY: topLanding.y, lowerDeckY: lowerLanding.y, farSide: lowerLanding.farHemisphere,
    nearDeckY: nearLanding.y, nearFarSide: nearLanding.farHemisphere, hullAfterDrop: lowerLanding.hull, compact };
}
