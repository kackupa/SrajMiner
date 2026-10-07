// Run via Playwright CLI in a dedicated development-browser session; it replaces that session's save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);

  const seed = 77123;
  const worldState = (mapSeed, destroyed = [], discovered = []) => ({
    seed: mapSeed,
    x: 980,
    y: -22,
    maxDepth: 0,
    destroyed,
    discovered,
    drops: [],
    activeCharge: null,
  });
  const cryo = worldState(seed, ['24,0'], ['24,0', '24,1']);
  const save = {
    version: 10,
    campaignSeed: seed,
    activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': cryo },
    money: 5000,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
    fuel: 43,
    hull: 74,
    cargo: { copper: 1.5, iron: 1, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0,
    artifact: false,
    milestones: [],
    shipComponents: ['frame', 'propulsion', 'navigation', 'life-support'],
    routeFragments: [],
    charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();

  const baseline = await page.evaluate(() => window.__mars);
  if (baseline.mapId !== 'cryo-shelf' || baseline.fuel !== 43 || baseline.hull !== 74)
    throw Error('Campaign fixture did not load');
  const expectedCargo = JSON.stringify(baseline.cargo);
  const visited = [];
  for (const id of ['mars-frontier', 'hull-graveyard', 'prism-fault', 'cryo-shelf']) {
    await page.locator('#open-destinations').click();
    await page.locator(`#map-${id}`).click();
    const state = await page.evaluate(() => window.__mars);
    if (state.mapId !== id) throw Error(`Travel failed: expected ${id}, got ${state.mapId}`);
    if (state.fuel !== 43 || state.hull !== 74 || JSON.stringify(state.cargo) !== expectedCargo)
      throw Error(`Travel changed expedition resources at ${id}`);
    if (state.money !== 5000 || state.shipComponents.length !== 4)
      throw Error(`Travel changed campaign progression at ${id}`);
    visited.push({ id, seed: state.seed, destroyed: state.destroyed.length });
  }

  const final = await page.evaluate(() => ({
    state: window.__mars,
    save: JSON.parse(localStorage.getItem('mars-miner.v1')),
  }));
  if (final.save.activeMap !== 'cryo-shelf') throw Error('Active destination was not saved');
  if (final.save.maps['cryo-shelf'].destroyed.includes('24,0') !== true)
    throw Error('Excavated tile did not persist through travel');
  if (Object.keys(final.save.maps).length !== 4) throw Error('Visited region records were not saved');
  await page.screenshot({ path: 'output/playwright/campaign-travel.png' });
  return { visited, savedMaps: Object.keys(final.save.maps), final: final.state };
}
