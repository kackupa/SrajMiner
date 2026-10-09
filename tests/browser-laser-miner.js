// Laser Miner hardware should render a bright, palette-safe cutting channel in real gameplay.
async (page) => {
  const baseURL = new URL(page.url()).origin,
    chart = { columns: 471, radiusRows: 150 },
    cleared = [];
  for (let row = 0; row < 5; row++)
    for (let x = 20; x <= 28; x++) cleared.push(`${x},${row}`);
  const save = {
    version: 20, planetChart: chart, campaignSeed: 77124, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 77124, x: 980, y: 180, maxDepth: 54, destroyed: cleared, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
    money: 0, levels: { drill: 5, fuel: 5, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 480, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 54,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.goto('about:blank'); await page.goto(baseURL); await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload(); await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  const before = await page.evaluate(() => window.__mars), count = before.destroyed.length;
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__mars?.drillTarget && window.__mars.drillProgress > 0.25, null, { timeout: 12000 });
    const cutting = await page.evaluate(() => window.__mars);
    if (cutting.overlaps || cutting.fuel >= before.fuel) throw Error(`Laser Miner cut did not remain safe or consume fuel: ${JSON.stringify(cutting)}`);
    await page.waitForFunction(() => !document.querySelector('#laser-thermal')?.classList.contains('hidden'), null, { timeout: 2000 });
    await page.waitForTimeout(40);
    await page.screenshot({ path: 'output/playwright/laser-miner-cutting.png' });
    await page.waitForFunction(previous => window.__mars?.destroyed.length > previous, count, { timeout: 8000 });
    const broken = await page.evaluate(() => window.__mars);
    await page.screenshot({ path: 'output/playwright/laser-miner-break.png' });
    return { drillLevel: cutting.levels.drill, drillTarget: cutting.drillTarget, drillProgress: cutting.drillProgress, laserHeat: cutting.laserHeat, destroyedBefore: count, destroyedAfter: broken.destroyed.length, fuel: broken.fuel, overlaps: broken.overlaps };
  } finally { await page.keyboard.up('s'); }
}
