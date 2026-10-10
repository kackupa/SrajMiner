// Verify the emergency suit from its purchase through a real crash and surface rescue.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const chart = { columns: 471, radiusRows: 150 };
  const destroyed = [];
  for (let x = 28; x <= 30; x++) for (let y = 0; y <= 20; y++) destroyed.push(`${x},${y}`);
  const save = {
    version: 20, planetChart: chart, campaignSeed: 60291, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 60291, x: 1180, y: -22, maxDepth: 0, destroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
    money: 780, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 140, hull: 1, cargo: { copper: 2, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.locator('#open-upgrades').click();
  await page.locator('#buy-escape-suit').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (!saved.escapeSuit || saved.money !== 0) throw Error('Escape suit purchase did not persist or charge $780');
  await page.locator('#close').click();

  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__mars?.y >= 500, null, { timeout: 10000 });
  await page.keyboard.up('s');
  await page.waitForFunction(() => document.querySelector('#hull-label')?.textContent === 'EJECTED', null, { timeout: 10000 });
  const ejected = await page.evaluate(() => ({
    state: window.__mars,
    save: JSON.parse(localStorage.getItem('mars-miner.v1')),
    warning: document.querySelector('#low-warning')?.textContent,
    toast: document.querySelector('#toast')?.textContent,
  }));
  if (!ejected.save.pilotEscaping || ejected.save.escapeSuit || ejected.state.hull !== 0)
    throw Error(`Crash did not deploy the one-use suit: ${JSON.stringify({ state: ejected.state, save: { pilotEscaping: ejected.save.pilotEscaping, escapeSuit: ejected.save.escapeSuit } })}`);
  if (!ejected.warning.includes('ESCAPE SUIT ACTIVE') || !ejected.toast.includes('ESCAPE SUIT DEPLOYED'))
    throw Error(`Escape controls were not communicated: ${JSON.stringify({ warning: ejected.warning, toast: ejected.toast })}`);
  await page.screenshot({ path: 'output/playwright/escape-suit-ejected.png' });

  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__mars?.y < 25, null, { timeout: 15000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.__mars?.docked && window.__mars?.depth === 0 && window.__mars?.hull === 100, null, { timeout: 10000 });
  const rescued = await page.evaluate(() => ({
    state: window.__mars,
    save: JSON.parse(localStorage.getItem('mars-miner.v1')),
    toast: document.querySelector('#toast')?.textContent,
  }));
  if (Object.values(rescued.state.cargo).some(Boolean) || rescued.save.pilotEscaping || rescued.save.escapeSuit)
    throw Error('Surface rescue should consume the suit and forfeit unsold ore');
  if (!rescued.toast.includes('PILOT SAFE')) throw Error(`Surface rescue was not acknowledged: ${rescued.toast}`);
  if (Math.abs(rescued.state.x - ejected.state.x) > 1) throw Error(`Surface rescue snapped back to the landing pad instead of staying at the rescue longitude: ${rescued.state.x}`);
  await page.screenshot({ path: 'output/playwright/escape-suit-rescued.png' });
  return {
    purchase: { money: saved.money, packed: saved.escapeSuit },
    ejection: { depth: ejected.state.depth, hull: ejected.state.hull, warning: ejected.warning },
    rescue: { depth: rescued.state.depth, hull: rescued.state.hull, fuel: rescued.state.fuel, cargo: rescued.state.cargo, toast: rescued.toast },
  };
}
