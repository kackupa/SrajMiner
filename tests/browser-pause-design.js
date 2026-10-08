// Run with Playwright CLI against the local dev URL. QA runs in a disposable
// context and never reads, clears, or writes the source browser session's save.
async (sourcePage) => {
  const target = new URL(sourcePage.url());
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname))
    throw Error(`Pause design QA must target a local game server, got ${target.origin}`);
  const browser = sourcePage.context().browser();
  if (!browser) throw Error('Pause design QA requires a browser that can create a fresh isolated context');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  const origin = target.origin;
  await page.goto(origin);
  await page.waitForFunction(() => !!window.__mars);
  await page.evaluate(() => localStorage.removeItem('mars-miner.v1'));
  await page.reload();
  await page.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).click();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('dialog', { name: 'EXPEDITION PAUSED' }).waitFor();
  const layouts = [];
  for (const size of [{ width: 1920, height: 960 }, { width: 1280, height: 800 },
    { width: 960, height: 560 }, { width: 720, height: 580 }]) {
    await page.setViewportSize(size);
    const result = await page.evaluate(() => {
      const dialog = document.querySelector('.pause-screen');
      const menu = document.querySelector('.pause-menu');
      const credit = document.querySelector('.pause-credit');
      const controls = [...dialog.querySelectorAll('button, a')].filter(el => el.id !== 'close');
      const rect = dialog.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, rect: rect.toJSON(),
        scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight,
        maxControlBottom: Math.max(...controls.map(el => el.getBoundingClientRect().bottom)),
        creditBottom: credit.getBoundingClientRect().bottom,
        menuHeight: menu.getBoundingClientRect().height,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    if (result.horizontalOverflow || result.rect.left < 0 || result.rect.right > size.width ||
      (size.width > 800 && (result.maxControlBottom > size.height || result.creditBottom > size.height)))
      throw Error(`Pause layout overflow: ${JSON.stringify(result)}`);
    await page.screenshot({ path: `output/playwright/pause-redesign-${size.width}x${size.height}.png` });
    if (size.width <= 800) {
      await page.locator('#new').scrollIntoViewIfNeeded();
      await page.locator('.pause-credit').scrollIntoViewIfNeeded();
      const credit = await page.locator('.pause-credit').boundingBox();
      if (!credit || credit.y + credit.height > size.height) throw Error('Narrow pause screen cannot scroll to credits');
    }
    layouts.push(result);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'SAVE EXPEDITION' }).click();
  if (!(await page.locator('#pause-save-state').innerText()).includes('just now')) throw Error('Save state did not update');
  await page.getByRole('button', { name: 'EXPORT SAVE' }).click();
  if (!(await page.locator('#download-save').count())) throw Error('Download action missing');
  await page.getByRole('button', { name: 'Emergency recovery' }).click();
  await page.getByRole('dialog', { name: 'EMERGENCY RECOVERY' }).waitFor();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'New expedition' }).click();
  await page.getByRole('dialog', { name: 'REPLACE SAVED EXPEDITION' }).waitFor();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'RESUME EXPEDITION' }).click();
  if (await page.getByRole('dialog', { name: 'EXPEDITION PAUSED' }).count()) throw Error('Resume did not close pause menu');
  await page.locator('#game canvas').click({ position: { x: 600, y: 300 } });
  await page.keyboard.down('s');
  await page.waitForTimeout(2200);
  await page.keyboard.up('s');
  const flight = await page.evaluate(() => window.__mars);
  if (flight.depth < 12 || flight.overlaps) throw Error(`Mining controls after resume: ${JSON.stringify({ depth: flight.depth, overlaps: flight.overlaps })}`);
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__mars.y < -35, {}, { timeout: 15000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.__mars.docked, {}, { timeout: 15000 });
  if (errors.length) throw Error(errors.join('\n'));
  return { layouts, save: true, export: true, recoveryConfirmation: true, newExpeditionConfirmation: true,
    resume: true, flight: { depth: flight.depth, overlaps: flight.overlaps }, returnedHome: true, errors };
  } finally {
    await context.close();
  }
}
