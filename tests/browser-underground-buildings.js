// Run in an isolated browser context; this fixture replaces only that context's save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const chart = { columns: 471, radiusRows: 150 };
  const destroyed = [];
  // Screen-right follows the curved chart and rises radially from this site;
  // clear overhead too so the test exercises travel, not a fixture ceiling.
  for (let x = 22; x <= 35; x++) for (let y = 10; y <= 31; y++) destroyed.push(`${x},${y}`);
  const map = { seed: 45291, x: 980, y: 1050, maxDepth: 315, destroyed, discovered: [], drops: [], activeCharge: null, structures: [], planetChart: chart };
  const save = {
    version: 20, planetChart: chart, campaignSeed: 45291, activeMap: 'cryo-shelf', maps: { 'cryo-shelf': map },
    money: 3000, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    fuel: 30, hull: 40, cargo: { copper: 1, iron: 6, silver: 4, gold: 1, diamond: 0 }, maxDepth: 315,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced',
    stasisModule: true, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.waitForFunction(() => window.__mars?.depth >= 300);
  await page.keyboard.press('b');
  await page.locator('#build-service').click();
  let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const beacon = persisted.maps['cryo-shelf'].structures.find(item => item.kind === 'service');
  if (!beacon) throw Error('Service beacon was not saved after construction');
  await page.locator('#close').click();
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const servicePanel = await page.locator('#modal-layer').innerText();
  if (!servicePanel.includes('LOCAL PIT STOP')) {
    const position = await page.evaluate(() => window.__mars);
    throw Error(`Nearby beacon service was not opened: ${JSON.stringify({ position: { x: position.x, y: position.y }, beacon, modal: servicePanel })}`);
  }
  if (await page.locator('.outpost-tabs').count()) throw Error('Underground beacon incorrectly exposed surface-only sale and upgrade tabs');
  if (!(await page.locator('#service-fuel').isVisible()) || !(await page.locator('#service-hull').isVisible()))
    throw Error('Nearby beacon did not expose refuel and repair');
  await page.locator('#service-fuel').click();
  await page.locator('#service-hull').click();
  const serviced = await page.evaluate(() => window.__mars);
  if (serviced.fuel <= 30 || serviced.hull <= 40) throw Error('Beacon service did not restore fuel and hull');
  await page.locator('#close').click();
  await page.keyboard.down('x');
  await page.keyboard.down('d');
  try {
    await page.waitForFunction(() => window.__mars?.x >= 1210, null, { timeout: 20000 });
  } catch (error) {
    const position = await page.evaluate(() => ({ x: window.__mars?.x, y: window.__mars?.y, stasis: window.__mars?.stasisActive }));
    await page.screenshot({ path: 'output/playwright/underground-buildings-traversal-stalled.png' });
    throw Error(`Miner did not reach the turret site: ${JSON.stringify(position)}; ${error}`);
  } finally {
    await page.keyboard.up('d');
    await page.keyboard.up('x');
  }
  await page.keyboard.press('b');
  await page.locator('#build-turret').click();
  persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const kinds = persisted.maps['cryo-shelf'].structures.map(item => item.kind);
  if (!kinds.includes('service') || !kinds.includes('turret')) {
    const state = await page.evaluate(() => ({ ...window.__mars, turretDisabled: document.querySelector('#build-turret')?.disabled, turretText: document.querySelector('#build-turret')?.textContent }));
    throw Error(`Unexpected saved structures: ${JSON.stringify({ kinds, state })}`);
  }
  await page.screenshot({ path: 'output/playwright/underground-buildings.png' });
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')).maps['cryo-shelf'].structures);
  if (restored.length !== 2 || !restored.some(item => item.kind === 'service') || !restored.some(item => item.kind === 'turret'))
    throw Error('Built service and turret did not persist through reload');
  return { beacon, serviced: { fuel: serviced.fuel, hull: serviced.hull }, structures: restored };
}
