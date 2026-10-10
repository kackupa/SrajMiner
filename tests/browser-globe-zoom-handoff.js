// Browser regression: finish local zoom before the short globe-view handoff, then reverse it cleanly.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const fixture = {
    version: 23,
    campaignSeed: 55109,
    activeMap: 'cryo-shelf',
    planetChart: { columns: 126, radiusRows: 40 },
    maps: {}, money: 0,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 140, hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
  };
  await page.evaluate(save => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), fixture);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const start = await page.evaluate(() => window.__mars);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForFunction(() => window.__mars?.orbitalTransition === 0 &&
    window.__mars.cameraZoomTarget === 0.62 && Math.abs(window.__mars.cameraZoom - 0.62) < 0.001);
  const fullyZoomedLocal = await page.evaluate(() => window.__mars);
  await page.waitForFunction(() => window.__mars?.orbitalTransition > 0);
  await page.screenshot({ path: 'output/playwright/globe-zoom-handoff.png' });
  await page.waitForFunction(() => window.__mars?.orbitalOverviewActive === true, null, { timeout: 5000 });
  const globe = await page.evaluate(() => window.__mars);
  if (globe.orbitalTransition !== 1 || globe.cameraZoom !== 0.62)
    throw Error(`Globe handoff should finish while local zoom stays at its handoff scale: ${JSON.stringify(globe)}`);
  await page.mouse.wheel(0, -3000);
  await page.waitForFunction(() => window.__mars?.orbitalTransition === 0, null, { timeout: 5000 });
  await page.waitForFunction((before) => window.__mars?.cameraZoom > before + 0.05,
    globe.cameraZoom, { timeout: 5000 });
  const localAgain = await page.evaluate(() => window.__mars);
  if (localAgain.cameraZoom <= globe.cameraZoom + 0.05)
    throw Error(`Local zoom should resume only after the globe handoff: ${JSON.stringify({ globe, localAgain })}`);
  await page.screenshot({ path: 'output/playwright/globe-zoom-return.png' });
  return { start: start.cameraZoom, fullyZoomedLocal: fullyZoomedLocal.cameraZoom,
    globe: globe.cameraZoom, returnedLocalZoom: localAgain.cameraZoom };
}
