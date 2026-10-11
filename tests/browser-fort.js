// Isolated colony fixture. Exercises purchases and real-time raids through game input.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const chart = { columns: 126, radiusRows: 40 };
  const cargo = { copper: 2, iron: 8, silver: 5, gold: 3, diamond: 0 };
  const fixture = {
    version: 27, planetChart: chart, campaignSeed: 8806, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 8806, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], warehouse: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, planetChart: chart } },
    money: 5000, levels: { drill: 1, fuel: 1, cargo: 2, hull: 1, engine: 1, scanner: 1, grapple: 1 }, fuel: 140, hull: 100,
    cargo, maxDepth: 0, artifact: false, milestones: [], shipComponents: [], routeFragments: [], coreFuel: 0, solarPosition: null, mothershipBoarded: false, charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard', ownedProfiles: ['standard'], selectedProfile: 'standard',
    specialization: 'balanced', stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto('about:blank'); await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), fixture);
  await page.reload(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.keyboard.press('b');
  await page.locator('#build-fort').click();
  await page.keyboard.press('Escape');
  const cancelled = await page.evaluate(() => ({ money: window.__mars.money, cargo: window.__mars.cargo, structures: window.__mars.structures }));
  if (cancelled.money !== 5000 || cancelled.structures.length || JSON.stringify(cancelled.cargo) !== JSON.stringify(cargo)) throw Error('Cancelled fort spent resources');
  await page.keyboard.press('b'); await page.locator('#build-fort').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__mars?.structures.some(s => s.kind === 'fort'));
  let save = await saved();
  const fort = save.maps['cryo-shelf'].structures.find(s => s.kind === 'fort');
  if (save.version !== 28 || save.money !== 3600 || fort.integrity !== 4 || save.cargo.iron !== 2 || save.cargo.silver !== 2 || save.cargo.gold !== 1) throw Error('Fort cost or save migration is wrong');
  await page.screenshot({ path: 'output/playwright/fort-built.png' });
  await page.waitForFunction(() => window.__mars?.surfaceRaid, null, { timeout: 30000 });
  const raider = await page.evaluate(() => window.__mars.surfaceRaid);
  await page.waitForFunction(x => window.__mars?.surfaceRaid && Math.abs(window.__mars.surfaceRaid.x - x) > 20, raider.x);
  await page.screenshot({ path: 'output/playwright/fort-raid-warning.png' });
  await page.waitForFunction(() => window.__mars?.structures.find(s => s.kind === 'fort')?.integrity === 3, null, { timeout: 15000 });
  await page.keyboard.press('b');
  await page.locator(`[id="repair-${encodeURIComponent(fort.id)}"]`).click();
  if ((await saved()).maps['cryo-shelf'].structures.find(s => s.kind === 'fort').integrity !== 4) throw Error('Fort repair did not save');
  await page.locator('#build-turret').click(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__mars?.structures.some(s => s.kind === 'turret'));
  const turret = (await saved()).maps['cryo-shelf'].structures.find(s => s.kind === 'turret');
  await page.keyboard.press('b');
  const upgrade = page.locator(`[id="upgrade-turret-${encodeURIComponent(turret.id)}"]`);
  await upgrade.click(); await upgrade.click();
  save = await saved();
  if (save.money !== 1720 || save.maps['cryo-shelf'].structures.find(s => s.kind === 'turret').level !== 3) throw Error('Pylon upgrades did not charge and persist exactly');
  if (!(await page.locator('#build-fort').isDisabled())) throw Error('A second fort was offered');
  await page.screenshot({ path: 'output/playwright/fort-upgraded-pylon-panel.png' });
  await page.locator('#close').click(); await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.waitForFunction(() => window.__mars?.structures.length === 2);
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('RAIDER REPELLED'), null, { timeout: 30000 });
  const final = await page.evaluate(() => ({ money: window.__mars.money, structures: window.__mars.structures, hull: window.__mars.hull }));
  if (final.structures.find(s => s.kind === 'fort').integrity !== 4 || final.structures.find(s => s.kind === 'turret').level !== 3 || final.hull !== 100) throw Error('Defended colony or miner was damaged');
  await page.screenshot({ path: 'output/playwright/fort-defended.png' });
  page.off('pageerror', onError);
  if (errors.length) throw Error(errors.join('\n'));
  return { fort, turret, cancelled, final, errors };
}
