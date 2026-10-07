// Verify sell → service → upgrade and return to the receipt without closing the outpost modal.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const save = {
    version: 10, campaignSeed: 88741, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 88741, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 100, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 }, fuel: 120, hull: 70,
    cargo: { copper: 2, iron: 1, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.locator('#launch').click();
  await page.locator('#open-sell').click();
  const beforeSale = await page.evaluate(() => window.__mars.money);
  await page.locator('#sell').click();
  await page.waitForFunction((expected) => window.__mars.money > expected, beforeSale);
  const saleTotal = 2 * 18 + 28;
  const afterSale = await page.evaluate(() => window.__mars);
  if (afterSale.money !== beforeSale + saleTotal || Object.values(afterSale.cargo).some(Boolean))
    throw new Error(`Unexpected ore exchange result: ${JSON.stringify(afterSale)}`);

  await page.locator('#tab-service').click();
  if (!(await page.getByRole('dialog').isVisible())) throw new Error('Switching to Service closed the outpost dialog');
  await page.locator('#service-all').click();
  const serviced = await page.evaluate(() => window.__mars);
  if (serviced.fuel !== 140 || serviced.hull !== 100) throw new Error(`Combined service failed: ${JSON.stringify(serviced)}`);
  const serviceFocus = await page.evaluate(() => !!document.activeElement?.closest('.modal'));
  if (!serviceFocus) throw new Error('Focus escaped the outpost dialog after service');

  await page.locator('#tab-upgrades').click();
  const upgradeText = await page.getByRole('dialog').innerText();
  if (!upgradeText.includes('+50%') || !upgradeText.includes('Need $'))
    throw new Error(`Upgrade benefit/affordability is unclear: ${upgradeText}`);
  await page.locator('#buy-drill').click();
  const upgraded = await page.evaluate(() => window.__mars);
  if (upgraded.levels.drill !== 2 || upgraded.money !== serviced.money - 140)
    throw new Error(`Drill purchase failed: ${JSON.stringify(upgraded)}`);
  const upgradeFocus = await page.evaluate(() => !!document.activeElement?.closest('.modal'));
  if (!upgradeFocus) throw new Error('Focus escaped the outpost dialog after upgrade purchase');

  await page.locator('#tab-sell').click();
  const receipt = await page.locator('.sale-total').innerText();
  if (!receipt.includes('CREDITS BANKED') || !receipt.includes(`$${saleTotal}`))
    throw new Error(`Sale receipt did not survive tab changes: ${receipt}`);
  const open = await page.evaluate(() => ({ dialog: !!document.querySelector('.modal'), modal: document.querySelector('.modal')?.getAttribute('aria-label') }));
  await page.screenshot({ path: 'output/playwright/outpost-continuous-receipt.png' });
  return { saleTotal, finalMoney: upgraded.money, fuel: serviced.fuel, hull: serviced.hull, drillLevel: upgraded.levels.drill, receipt, focusStayedInDialog: serviceFocus && upgradeFocus, open };
}
