// Run on a dedicated development origin with an isolated campaign save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const seed = 77125;
  const worldState = (mapSeed, maxDepth) => ({
    seed: mapSeed,
    x: 980,
    y: -22,
    maxDepth,
    destroyed: [],
    discovered: [],
    drops: [],
    activeCharge: null,
  });
  const save = {
    version: 10,
    campaignSeed: seed,
    activeMap: 'cryo-shelf',
    maps: {
      'cryo-shelf': worldState(seed, 327.9),
      'hull-graveyard': worldState(207, 0),
      'prism-fault': worldState(310, 142),
    },
    money: 80,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
    fuel: 140,
    hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 327.9,
    artifact: false,
    milestones: ['hash-hull'],
    shipComponents: [],
    routeFragments: ['fragment-1', 'fragment-4'],
    charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };

  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#open-archive').click();
  const crewGoal = await page.locator('#crew-archive-conclusion').innerText();
  if (!crewGoal.includes('CREW ARCHIVE INCOMPLETE') || !crewGoal.includes('1 / 4'))
    throw Error(`Archive should show the remaining regional-log goal without spoiling the ending: ${crewGoal}`);

  const records = await page.locator('[data-map-record]').evaluateAll((items) =>
    items.map((item) => ({ id: item.getAttribute('data-map-record'), text: item.innerText })),
  );
  const record = (id) => records.find((item) => item.id === id)?.text ?? '';
  if (records.length !== 4) throw Error(`Expected one record per region: ${JSON.stringify(records)}`);
  if (!record('cryo-shelf').includes('Deepest scan: 327 m') || !record('cryo-shelf').includes('2 / 4 route signals'))
    throw Error(`Cryo record omitted its best depth or recovered route seams: ${record('cryo-shelf')}`);
  if (!record('hull-graveyard').includes('Deepest scan: 0 m') || !record('hull-graveyard').includes('1 / 1 archive hash'))
    throw Error(`Zero-depth visited map or recovered hash was not reported: ${record('hull-graveyard')}`);
  if (!record('mars-frontier').includes('NOT VISITED') || !record('mars-frontier').includes('No depth record yet'))
    throw Error(`Unvisited region was presented as surveyed: ${record('mars-frontier')}`);
  await page.screenshot({ path: 'output/playwright/archive-map-records.png' });
  await page.setViewportSize({ width: 960, height: 560 });
  const panel = await page.locator('.modal').boundingBox();
  if (!panel || panel.x < 0 || panel.y < 0 || panel.x + panel.width > 960 || panel.y + panel.height > 560)
    throw Error(`Archive panel is clipped at 960×560: ${JSON.stringify(panel)}`);
  if (await page.locator('[data-map-record]').count() !== 4)
    throw Error('Regional records disappeared at the compact viewport');
  await page.screenshot({ path: 'output/playwright/archive-map-records-960x560.png' });
  return { records, compactPanel: panel };
}
