// Physical first-core expedition: drill the recommended globe, collect its record, and return safely.
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const baseURL = new URL(page.url()).origin;
  await page.addInitScript(({origin, key}) => {
    if (location.origin !== origin || sessionStorage.getItem(key)) return;
    localStorage.removeItem('mars-miner.v1');
    sessionStorage.setItem(key, '1');
  }, {origin:baseURL, key:`fresh-core-${Date.now()}`});
  await page.goto(baseURL);
  await page.locator('.intro').waitFor();
  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'), {}, { timeout: 10000 });
  await page.waitForTimeout(1000);

  const initial = await page.evaluate(() => window.__mars);
  if (initial.mapId !== 'cryo-shelf' || initial.coreFuel !== 0 || initial.shipComplete || initial.money !== 0 || initial.destroyed.length)
    throw Error(`Fresh campaign should require its first core: ${JSON.stringify(initial)}`);

  const miningDeadline = Date.now() + 180000;
  const canvas = await page.locator('#game canvas').boundingBox();
  let aimingCore = false;
  let braking = false;
  await page.keyboard.down('s');
  try {
    while (Date.now() < miningDeadline) {
      const state = await page.evaluate(() => window.__mars);
      if (state.milestones.includes('core-cryo')) break;
      if (state.hull <= 0 || state.fuel <= 0) throw Error(`The starter expedition failed before reaching its core: ${JSON.stringify(state)}`);
      if (state.depth >= 440 || aimingCore) {
        await page.keyboard.up('s');
        // Aim through the marker, not at a moving ray endpoint. The game's
        // normal reach/foreground checks still decide which tile is cut.
        const dx = state.coreTargetScreen.x - canvas.width / 2,
          dy = state.coreTargetScreen.y - canvas.height / 2,
          length = Math.hypot(dx,dy) || 1;
        await page.mouse.move(canvas.x + state.coreTargetScreen.x + dx / length * 80,
          canvas.y + state.coreTargetScreen.y + dy / length * 80);
        if (!aimingCore) { await page.mouse.down(); aimingCore = true; }
      }
      if (aimingCore) {
        // Hover on the approach side while cutting the relic. Falling through
        // the center changes the return direction; W alone is then not a route.
        const targetSpeed = Math.max(-60, Math.min(60, (442 - state.depth) * 12));
        const shouldBrake = state.descentSpeed > targetSpeed + (braking ? -10 : 10);
        if (shouldBrake && !braking) { await page.keyboard.down('w'); braking = true; }
        if (!shouldBrake && braking) { await page.keyboard.up('w'); braking = false; }
        await page.waitForTimeout(60);
      } else if (state.descentSpeed > (state.depth > 410 ? 65 : 150)) {
        await page.keyboard.up('s');
        await page.keyboard.down('w');
        try {
          await page.waitForFunction((limit) => window.__mars && window.__mars.descentSpeed < limit,
            state.depth > 410 ? 15 : 95, { timeout: 6000 });
        } finally { await page.keyboard.up('w'); }
        if (!aimingCore) await page.keyboard.down('s');
      } else await page.waitForTimeout(60);
    }
  } finally { await page.keyboard.up('s'); await page.keyboard.up('w'); await page.mouse.up(); }

  const core = await page.evaluate(() => window.__mars);
  if (!core.milestones.includes('core-cryo') || core.coreFuel !== 4 || !core.shipComplete)
    throw Error(`Drilling the Cryo core should grant its record and four separate travel units: ${JSON.stringify(core)}`);
  await page.screenshot({ path: 'output/playwright/cryo-core-recovered.png' });

  const returnDeadline = Date.now() + 120000;
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__mars?.depth === 0, {}, { timeout: returnDeadline - Date.now() });
  } finally { await page.keyboard.up('w'); }
  await page.waitForFunction(() => window.__mars?.docked && window.__mars?.depth === 0, {}, { timeout: 20000 });
  const home = await page.evaluate(() => window.__mars);
  if (home.hull <= 0 || home.fuel <= 0 || home.overlaps || !home.docked || home.coreFuel !== 4)
    throw Error(`Returning from the starter core should preserve the miner and core fuel: ${JSON.stringify(home)}`);
  await page.keyboard.press('e');
  await page.locator('.boarding-arrival').waitFor({ state: 'detached' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (saved.coreFuel !== 4 || !saved.milestones.includes('core-cryo'))
    throw Error('Recovered core and ship fuel did not persist on return');
  await page.screenshot({ path: 'output/playwright/cryo-core-return.png' });
  if (errors.length) throw Error(errors.join('\n'));
  return { seed: initial.seed, depthAtCore: core.depth, fuelAtCore: core.fuel, hullAtCore: core.hull,
    returnFuel: home.fuel, hull: home.hull, coreFuel: home.coreFuel, overlaps: home.overlaps, errors };
}
