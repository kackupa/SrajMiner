async (page) => {
  // Save fixtures isolate rare failure paths; the first roundtrip used only real controls.
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const fixture = {
    ...base,
    x: 980,
    y: 24,
    fuel: 0.02,
    hull: 100,
    cargo: { copper: 2, iron: 0, silver: 0, gold: 0, diamond: 0 },
  };
  await page.evaluate((s) => localStorage.setItem('mars-miner.v1', JSON.stringify(s)), fixture);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.keyboard.down('s');
  await page.waitForTimeout(600);
  await page.keyboard.up('s');
  const fuelFailure = await page.evaluate(() => window.__mars);
  if (
    !fuelFailure.paused ||
    fuelFailure.depth !== 0 ||
    Object.values(fuelFailure.cargo).some(Boolean) ||
    fuelFailure.money !== base.money ||
    fuelFailure.levels.drill !== 2
  )
    throw Error('Fuel recovery regression');
  await page.screenshot({ path: 'output/playwright/08-fuel-recovery.png' });
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).waitFor();
  const hullFixture = {
    ...base,
    x: 860,
    y: -170,
    fuel: 190,
    hull: 1,
    cargo: { copper: 0, iron: 2, silver: 0, gold: 0, diamond: 0 },
  };
  await page.evaluate((s) => localStorage.setItem('mars-miner.v1', JSON.stringify(s)), hullFixture);
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION ↗' }).click();
  await page.waitForTimeout(1500);
  const hullFailure = await page.evaluate(() => window.__mars);
  if (
    !hullFailure.paused ||
    hullFailure.depth !== 0 ||
    hullFailure.hull !== 100 ||
    Object.values(hullFailure.cargo).some(Boolean) ||
    hullFailure.money !== base.money
  )
    throw Error('Hull recovery regression');
  return { fuelFailure, hullFailure };
}
