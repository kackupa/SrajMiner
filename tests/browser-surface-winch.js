// Isolated browser check for the installed surface winch cable and extraction return.
async (page) => {
  const baseURL = new URL(page.url()).origin,
    chart = { columns: 471, radiusRows: 150 },
    destroyed = [];
  for (let x = 22; x <= 26; x++) for (let y = 0; y <= 22; y++) destroyed.push(`${x},${y}`);
  const map = { seed: 62490, x: 980, y: 500, maxDepth: 150, destroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart };
  const save = {
    version: 20, planetChart: chart, campaignSeed: 62490, activeMap: 'cryo-shelf', maps: { 'cryo-shelf': map },
    money: 0, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 140, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 150,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: false, returnWinch: true, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.waitForFunction(() => window.__mars?.depth >= 140);
  const descending = await page.evaluate(() => window.__mars);
  const estimateText = await page.locator('#return-estimate').textContent();
  if (!descending.winchCableConnected) throw Error(`Installed winch did not attach through its cleared shaft: ${JSON.stringify(descending)}`);
  if (!/WINCH · ~\d+ L · HOLD R/.test(estimateText || '')) throw Error(`Winch fuel estimate was not shown before reeling: ${estimateText}`);
  await page.screenshot({ path: 'output/playwright/winch-cable-descending.png' });

  await page.keyboard.down('r');
  try {
    await page.waitForFunction(() => window.__mars?.reeling && window.__mars?.winchCableConnected, null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#return-estimate')?.textContent?.includes('REELING'), null, { timeout: 5000 });
    const activeEstimate = await page.locator('#return-estimate').textContent();
    if (!/WINCH · ~\d+ L · REELING/.test(activeEstimate || '')) throw Error(`Active winching state was not reflected in the HUD: ${activeEstimate}`);
    await page.screenshot({ path: 'output/playwright/winch-cable-reeling.png' });
    await page.waitForFunction(() => window.__mars?.docked && window.__mars?.depth === 0, null, { timeout: 15000 });
  } finally { await page.keyboard.up('r'); }
  const returned = await page.evaluate(() => window.__mars);
  const arrival = await page.locator('#toast').textContent();
  if (returned.hull < 100 || returned.fuel >= descending.fuel || returned.reeling)
    throw Error(`Winch return failed to extract cleanly or spend thrust fuel: ${JSON.stringify(returned)}`);
  if (returned.winchCableConnected) throw Error('Winch cable should retract when the miner docks');
  if (!arrival?.includes('DOCKING CLAMP ENGAGED')) throw Error(`Winch arrival cue was missing: ${arrival}`);
  const farDestroyed = [];
  for (let x = 22; x <= 26; x++) for (let y = 278; y <= 300; y++) farDestroyed.push(`${x},${y}`);
  const farSave = {
    ...save,
    fuel: 140,
    maps: { 'cryo-shelf': { ...map, x: 980, y: 11500, maxDepth: 150, destroyed: farDestroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), farSave);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.waitForFunction(() => window.__mars?.farHemisphere && window.__mars?.depth >= 140);
  const farSide = await page.evaluate(() => window.__mars),
    farEstimate = await page.locator('#return-estimate').textContent();
  if (!farSide.winchCableConnected || !/WINCH · ~\d+ L · HOLD R/.test(farEstimate || ''))
    throw Error(`Far-side winch did not connect or show its estimate: ${JSON.stringify({ farSide, farEstimate })}`);
  await page.screenshot({ path: 'output/playwright/winch-cable-far-hemisphere.png' });
  await page.keyboard.down('r');
  try {
    await page.waitForFunction(() => window.__mars?.reeling && window.__mars?.winchCableConnected, null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#return-estimate')?.textContent?.includes('REELING'), null, { timeout: 5000 });
    await page.waitForFunction(() => window.__mars?.docked && window.__mars?.depth === 0, null, { timeout: 15000 });
  } finally { await page.keyboard.up('r'); }
  const farReturned = await page.evaluate(() => window.__mars), farArrival = await page.locator('#toast').textContent();
  if (!farReturned.docked || farReturned.hull < 100 || farReturned.fuel >= farSide.fuel || !farArrival?.includes('DOCKING CLAMP ENGAGED'))
    throw Error(`Far-side winch return failed: ${JSON.stringify({ farReturned, farArrival })}`);
  const curvedReturns = [];
  for (const far of [false, true]) for (const obstacle of ['rock', 'service']) {
    const bent = [];
    const row = y => far ? 299 - y : y;
    for (let y = 0; y <= 22; y++) if (obstacle === 'service' || y !== 10) bent.push(`27,${row(y)}`);
    for (let y = 6; y <= 14; y++) for (let x = 24; x <= 26; x++) bent.push(`${x},${row(y)}`);
    const fixture = { ...save, maps: { 'cryo-shelf': { ...map,
      x: 1100, y: far ? 11400 : 600, destroyed: bent, maxDepth: 180,
      structures: obstacle === 'service' ? [{ id: 'service:1100:400', kind: 'service', x: 1100, y: far ? 11600 : 400 }] : [],
    } } };
    await page.goto('about:blank');
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__mars);
    await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), fixture);
    await page.reload();
    await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
    await page.waitForFunction(() => window.__mars?.winchCableConnected);
    const start = await page.evaluate(() => window.__mars);
    await page.keyboard.down('r');
    try {
      await page.waitForFunction(() => window.__mars?.x < 1080, null, { timeout: 10000 });
      await page.screenshot({ path: `output/playwright/winch-bend-${obstacle}-${far ? 'far' : 'home'}-cable.png` });
      await page.waitForFunction(() => window.__mars?.docked, null, { timeout: 20000 });
    } finally { await page.keyboard.up('r'); }
    const end = await page.evaluate(() => window.__mars);
    if (end.hull !== 100 || end.overlaps !== 0 || end.fuel >= start.fuel || end.farHemisphere !== far)
      throw Error(`Unsafe curved winch return: ${JSON.stringify(end)}`);
    await page.screenshot({ path: `output/playwright/winch-bend-${obstacle}-${far ? 'far' : 'home'}.png` });
    curvedReturns.push({ far, obstacle, fuelSpent: start.fuel - end.fuel, hull: end.hull, docked: end.docked });
  }
  const pocketDestroyed = [];
  for (let x = 22; x <= 26; x++) pocketDestroyed.push(`${x},12`);
  const blockedSave = {
    ...save,
    maps: { 'cryo-shelf': { ...map, y: 500, maxDepth: 150, destroyed: pocketDestroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart } },
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), blockedSave);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.waitForFunction(() => window.__mars?.depth >= 140);
  await page.waitForFunction(() => document.querySelector('#return-estimate')?.textContent?.includes('BLOCKED'));
  const blocked = await page.evaluate(() => window.__mars), blockedText = await page.locator('#return-estimate').textContent();
  if (blocked.winchCableConnected || blockedText !== 'WINCH BLOCKED · CLEAR TUNNEL ROUTE')
    throw Error(`Blocked shaft did not hide the cable and warn the player: ${JSON.stringify({ blocked, blockedText })}`);
  await page.screenshot({ path: 'output/playwright/winch-cable-blocked.png' });
  return {
    curvedReturns,
    descending: { depth: descending.depth, cableConnected: descending.winchCableConnected, estimate: estimateText },
    returned: { depth: returned.depth, hull: returned.hull, fuelSpent: descending.fuel - returned.fuel, docked: returned.docked, arrival },
    farSide: { depth: farSide.depth, cableConnected: farSide.winchCableConnected, estimate: farEstimate,
      returned: farReturned.docked, hull: farReturned.hull, fuelSpent: farSide.fuel - farReturned.fuel, arrival: farArrival },
    blocked: { cableConnected: blocked.winchCableConnected, hud: blockedText },
  };
}
