// Fresh-start UI: deployment, first-core goal, and pre-core travel lock.
async (page) => {
  const intro = page.locator('.intro');
  await intro.waitFor();
  const opening = await intro.innerText();
  if (!opening.includes('THE MOTHERSHIP') || !opening.includes('Drive out') || !opening.includes('planetary core'))
    throw Error(`Fresh start should introduce the mothership and core-fuel goal: ${opening}`);

  await page.locator('#intro-atlas').click();
  const atlas = page.getByRole('region', { name: 'Vesper system route map' });
  if (await atlas.getByRole('button').count() !== 6) throw Error('The system atlas should show five known worlds and the hidden chapter');
  const atlasText = await atlas.innerText();
  if (!atlasText.includes('CRYO SHELF') || !atlasText.includes('RECOMMENDED · 480 M DEEP') || !atlasText.includes('5 CORE RECORDS REQUIRED'))
    throw Error(`The start atlas should recommend the compact first world and explain the chapter gate: ${atlasText}`);
  await page.screenshot({ path: 'output/playwright/core-fuel-start-atlas.png' });
  await page.locator('#intro-back').click();

  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'), {}, { timeout: 10000 });
  const fresh = await page.evaluate(() => window.__mars);
  if (fresh.mapId !== 'cryo-shelf' || fresh.money !== 80 || fresh.shipComplete || fresh.coreFuel !== 0 || fresh.mothershipBoarded)
    throw Error(`A clean Cryo deployment should begin before core recovery: ${JSON.stringify(fresh)}`);

  await page.locator('#open-shipyard').click();
  const drive = await page.locator('#modal-layer').innerText();
  if (!drive.includes('Mine this planet’s core') || !drive.includes('separate from the miner'))
    throw Error(`Core drive panel should explain the first core and separate fuel pools: ${drive}`);
  await page.locator('#close').click();
  await page.locator('#open-destinations').click();
  if (await page.locator('#map-mars-frontier').isEnabled() || await page.locator('#map-hull-graveyard').isEnabled() ||
      await page.locator('#map-vesper-9').isEnabled())
    throw Error('Interplanetary destinations must remain locked before the first core');
  const board = await page.locator('#modal-layer').innerText();
  if (!board.includes('5 CORES REQUIRED') || !board.includes('CORE FUEL'))
    throw Error(`Destination board should explain jump fuel and the hidden-world gate: ${board}`);
  await page.screenshot({ path: 'output/playwright/core-fuel-destination-gate.png' });
  return { mapId: fresh.mapId, firstGoal: 'mine the Cryo core', coreFuel: fresh.coreFuel, interplanetaryTravelLocked: true };
};
