// Run via Playwright CLI in an isolated development-browser session; fixture save stays in that session.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const fixture = {
    version: 10,
    campaignSeed: 8441,
    activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 8441, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 10000,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
    fuel: 140,
    hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0,
    artifact: false,
    milestones: [],
    shipComponents: [],
    routeFragments: [],
    charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), fixture);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  const base = await page.evaluate(() => window.__mars);
  if (base.podScale !== 1) throw Error('Base pod should use scale 1');
  await page.screenshot({ path: 'output/playwright/pod-growth-before.png' });

  await page.locator('#open-upgrades').click();
  for (let i = 0; i < 4; i++) await page.locator('#buy-drill').click();
  for (let i = 0; i < 4; i++) await page.locator('#buy-cargo').click();
  const upgraded = await page.evaluate(() => window.__mars);
  if (upgraded.podScale !== 1.44 || upgraded.overlaps !== 0)
    throw Error(`Visual growth or collision regression: ${JSON.stringify(upgraded)}`);
  await page.locator('#close').click();
  await page.screenshot({ path: 'output/playwright/pod-growth-after.png' });
  return { before: base.podScale, after: upgraded.podScale, levels: upgraded.levels, overlaps: upgraded.overlaps };
}
