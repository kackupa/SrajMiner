// Physical first-core expedition: drill the recommended globe, collect its record, and return safely.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.locator('.intro').waitFor();
  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'), {}, { timeout: 10000 });

  const initial = await page.evaluate(() => window.__mars);
  if (initial.mapId !== 'cryo-shelf' || initial.coreFuel !== 0 || initial.shipComplete)
    throw Error(`Fresh campaign should require its first core: ${JSON.stringify(initial)}`);

  const miningDeadline = Date.now() + 180000;
  await page.keyboard.down('s');
  try {
    while (Date.now() < miningDeadline) {
      const state = await page.evaluate(() => window.__mars);
      if (state.milestones.includes('core-cryo')) break;
      if (state.hull <= 0 || state.fuel <= 0) throw Error(`The starter expedition failed before reaching its core: ${JSON.stringify(state)}`);
      if (state.descentSpeed > 150) {
        await page.keyboard.up('s');
        await page.keyboard.down('w');
        try {
          await page.waitForFunction(() => window.__mars && window.__mars.descentSpeed < 95, {}, { timeout: 6000 });
        } finally { await page.keyboard.up('w'); }
        await page.keyboard.down('s');
      } else await page.waitForTimeout(60);
    }
  } finally { await page.keyboard.up('s'); await page.keyboard.up('w'); }

  const core = await page.evaluate(() => window.__mars);
  if (!core.milestones.includes('core-cryo') || core.coreFuel !== 4 || !core.shipComplete)
    throw Error(`Drilling the Cryo core should grant its record and four separate travel units: ${JSON.stringify(core)}`);
  await page.screenshot({ path: 'output/playwright/cryo-core-recovered.png' });

  const returnDeadline = Date.now() + 120000;
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.docked && window.__mars?.depth === 0, {}, { timeout: returnDeadline - Date.now() });
  } finally { await page.keyboard.up('w'); }
  const home = await page.evaluate(() => window.__mars);
  if (home.hull <= 0 || home.fuel <= 0 || home.overlaps || !home.docked || home.coreFuel !== 4)
    throw Error(`Returning from the starter core should preserve the miner and core fuel: ${JSON.stringify(home)}`);
  await page.locator('#open-shipyard').click();
  const drive = await page.locator('#modal-layer').innerText();
  if (!drive.includes('4 JUMPS AVAILABLE') || !drive.includes('separate from the miner'))
    throw Error(`Core-fuel reserve and local miner fuel should remain clearly distinct: ${drive}`);
  await page.screenshot({ path: 'output/playwright/cryo-core-return.png' });
  return { depthAtCore: core.depth, fuelAtCore: core.fuel, returnFuel: home.fuel, hull: home.hull, coreFuel: home.coreFuel };
};
