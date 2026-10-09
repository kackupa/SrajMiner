// Isolated polar-geometry regression: radial drilling keeps enough physical hull clearance to cross the core.
async (page) => {
  const chart = { columns: 471, radiusRows: 150 }, home = 24, tile = 40, halfWidth = 13,
    destroyed = [];
  // Prepare a collision-clear radial bore all the way to both crusts so this
  // round trip can verify surface docking as well as the center passage.
  for (let row = 0; row < chart.radiusRows * 2; row++) {
    const radiusRows = Math.abs(chart.radiusRows - (row + 0.5)),
      tangentCellWidth = tile * radiusRows * Math.PI / chart.columns,
      width = radiusRows * tile > 72 ? Math.ceil((2 * halfWidth + 4) / Math.max(0.1, tangentCellWidth)) : 1,
      half = Math.ceil(width / 2);
    for (let x = home - half; x <= home + half; x++) destroyed.push(`${x},${row}`);
  }
  const save = {
    version: 20, planetChart: chart, campaignSeed: 74011, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 74011, x: 980, y: 140 * tile + tile / 2, maxDepth: 1700, destroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
    money: 0, levels: { drill: 1, fuel: 5, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 480, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 1700,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: true, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank'); await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const start = await page.evaluate(() => window.__mars);
  if (start.depth < 1600 || start.overlaps || start.y < 5500)
    throw Error(`Polar bore should restore without a hull overlap: ${JSON.stringify(start)}`);
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__mars?.y >= 6000, null, { timeout: 30000 });
    const centerTurn = await page.evaluate(() => ({
      y: window.__mars?.y,
      remaining: window.__mars?.cameraTurnLabelRemaining,
    }));
    if (centerTurn.remaining <= 0)
      throw Error(`Crossing the gravity center did not trigger the camera turn cue: ${JSON.stringify(centerTurn)}`);
  } finally { await page.keyboard.up('s'); }
  try {
    await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars?.y > 6200, null, { timeout: 30000 });
  } catch (error) {
    const current = await page.evaluate(() => window.__mars),
      blocked = { x: current.x, y: current.y, vy: current.vy, depth: current.depth, farHemisphere: current.farHemisphere,
        gravitySign: current.gravitySign, fuel: current.fuel, hull: current.hull, overlaps: current.overlaps, destroyed: current.destroyed.length };
    await page.screenshot({ path: 'output/playwright/polar-core-blocked.png' });
    throw Error(`Core crossing timed out at ${JSON.stringify(blocked)}; ${error}`);
  }
  await page.waitForFunction(
    () => window.__mars?.cameraRotation !== undefined && Math.abs(Math.abs(window.__mars.cameraRotation) - Math.PI) < 0.12,
    null,
    { timeout: 5000 },
  );
  const crossed = await page.evaluate(() => ({ state: window.__mars, save: JSON.parse(localStorage.getItem('mars-miner.v1')) }));
  if (!crossed.state.farHemisphere || crossed.state.overlaps || crossed.state.hull < 100)
    throw Error(`Polar collision blocked a clean core crossing: ${JSON.stringify(crossed.state)}`);
  if (crossed.state.money !== 2700 || !crossed.save.artifact)
    throw Error(`The deep core trip should pay one $2,200 crossing claim and the $500 buried-signal bounty: ${crossed.state.money}`);
  if (crossed.state.cameraRotation === undefined || Math.abs(Math.abs(crossed.state.cameraRotation) - Math.PI) > 0.12)
    throw Error(`Camera did not settle upright on the far side after the center turn: ${JSON.stringify(crossed.state)}`);
  await page.screenshot({ path: 'output/playwright/polar-core-crossing.png' });
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars.depth <= 1500, null, { timeout: 30000 }); }
  finally { await page.keyboard.up('w'); }
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars.y >= 12150,
      null, { timeout: 40000 });
  } catch (error) {
    const current = await page.evaluate(() => window.__mars);
    await page.screenshot({ path: 'output/playwright/polar-core-far-side-dock-stalled.png' });
    throw Error(`Far-side surface docking stalled: ${JSON.stringify(current)}; ${error}`);
  } finally { await page.keyboard.up('w'); }
  try {
    await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars.depth === 0 &&
      Math.abs(window.__mars.y - 12148) < 5 && Math.abs(window.__mars.vy) < 1,
    null, { timeout: 15000 });
    // On the far hemisphere, the first curved town deck sits just outside the dock.
    // Drop through it so gravity can settle the pod onto the service surface.
    await page.keyboard.down('s');
    await page.waitForTimeout(350);
    await page.keyboard.up('s');
    await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars.depth === 0 && window.__mars.docked,
      null, { timeout: 15000 });
  } catch (error) {
    const current = await page.evaluate(() => window.__mars);
    await page.screenshot({ path: 'output/playwright/polar-core-far-side-dock-stalled.png' });
    throw Error(`Far-side surface docking stalled after thrust release: ${JSON.stringify({ y: current.y, vy: current.vy, depth: current.depth, fuel: current.fuel, docked: current.docked })}; ${error}`);
  }
  const farDock = await page.evaluate(() => window.__mars);
  if (!farDock.farHemisphere || farDock.overlaps || farDock.hull < 99.9 || farDock.fuel <= 0)
    throw Error(`Core crossing should lead to a safe far-side surface dock: ${JSON.stringify(farDock)}`);
  await page.screenshot({ path: 'output/playwright/polar-core-far-side-docked.png' });
  await page.keyboard.down('s');
  try { await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars.depth >= 1500 && window.__mars.depth < 1700,
    null, { timeout: 30000 }); }
  finally { await page.keyboard.up('s'); }
  await page.keyboard.down('x');
  try {
    const farCheckpoint = await page.evaluate(() => window.__mars);
    await page.waitForFunction(y => {
      const data = JSON.parse(localStorage.getItem('mars-miner.v1'));
      return data?.maps?.['cryo-shelf'] && Math.abs(data.maps['cryo-shelf'].y - y) < 30;
    }, farCheckpoint.y, { timeout: 11000 });
  } finally { await page.keyboard.up('x'); }
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const restoredFar = await page.evaluate(() => window.__mars);
  if (!restoredFar.farHemisphere || restoredFar.depth < 1500 || restoredFar.depth >= 1700 || restoredFar.money !== crossed.state.money)
    throw Error(`Reload should preserve the far hemisphere and earned claims: ${JSON.stringify(restoredFar)}`);
  try { await page.waitForFunction(() => window.__mars && !window.__mars.farHemisphere && window.__mars.y < 5800,
    null, { timeout: 30000 }); }
  catch (error) {
    const current = await page.evaluate(() => window.__mars);
    await page.screenshot({ path: 'output/playwright/polar-core-second-crossing-stalled.png' });
    throw Error(`Coasting return crossing stalled: ${JSON.stringify({ y: current.y, vy: current.vy, depth: current.depth, far: current.farHemisphere, gravity: current.gravitySign, fuel: current.fuel, hull: current.hull, overlaps: current.overlaps })}; ${error}`);
  }
  const returnedHomeSide = await page.evaluate(() => window.__mars);
  if (returnedHomeSide.cameraTurnLabelRemaining <= 0)
    throw Error(`The return crossing should trigger the center-turn cue: ${JSON.stringify(returnedHomeSide)}`);
  await page.waitForFunction(() => window.__mars?.cameraTurnLabelRemaining <= 0, null, { timeout: 5000 });
  const returnedHome = await page.evaluate(() => ({ state: window.__mars, save: JSON.parse(localStorage.getItem('mars-miner.v1')) }));
  if (returnedHome.state.farHemisphere || returnedHome.state.y >= 5800 || returnedHome.state.money !== crossed.state.money || returnedHome.state.overlaps)
    throw Error(`Return crossing should restore the home-side gravity state without paying twice: ${JSON.stringify(returnedHome.state)}`);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const returnedReload = await page.evaluate(() => window.__mars);
  if (returnedReload.farHemisphere || returnedReload.money !== crossed.state.money || returnedReload.overlaps)
    throw Error(`Reload after the return crossing should retain home-side state and one-time claims: ${JSON.stringify(returnedReload)}`);
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars && !window.__mars.farHemisphere && window.__mars.y <= -200,
      null, { timeout: 45000 });
  } finally { await page.keyboard.up('w'); }
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__mars && !window.__mars.farHemisphere && window.__mars.y >= -60,
      null, { timeout: 20000 });
  } finally { await page.keyboard.up('s'); }
  try {
    await page.waitForFunction(() => window.__mars && !window.__mars.farHemisphere && window.__mars.depth === 0 && window.__mars.docked,
      null, { timeout: 15000 });
  } finally { await page.keyboard.up('w'); }
  const homeDock = await page.evaluate(() => window.__mars);
  if (homeDock.farHemisphere || homeDock.overlaps || homeDock.hull < 99.9 || homeDock.money !== crossed.state.money)
    throw Error(`The home-side return should dock safely without repeating the core claim: ${JSON.stringify(homeDock)}`);
  await page.waitForTimeout(8500);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const dockReload = await page.evaluate(() => window.__mars);
  if (dockReload.farHemisphere || !dockReload.docked || dockReload.depth !== 0 || dockReload.money !== crossed.state.money || dockReload.overlaps)
    throw Error(`A saved home-side surface dock should reload with the one-time claims intact: ${JSON.stringify(dockReload)}`);
  await page.screenshot({ path: 'output/playwright/polar-core-roundtrip-home-side.png' });
  return {
    startDepth: start.depth, startOverlaps: start.overlaps,
    crossed: crossed.state.farHemisphere, depthAfterCrossing: crossed.state.depth,
    hull: dockReload.hull, fuel: dockReload.fuel, returnedAcrossCore: !dockReload.farHemisphere,
    farSideDocked: farDock.docked, homeSideDocked: dockReload.docked,
    homeStateSurvivedReload: dockReload.docked, oneTimeClaim: dockReload.money,
    newExcavation: crossed.state.destroyed.length - destroyed.length,
    saveVersion: crossed.save.version,
  };
}
