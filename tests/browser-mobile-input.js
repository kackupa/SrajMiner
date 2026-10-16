// Run with Playwright CLI in an isolated --device="Pixel 7" QA browser.
async page => {
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION|BEGIN EXPEDITION/ }).click();
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  const at = async (label, id) => {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    if (!box) throw Error('Missing ' + label);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
  };
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const held = () => page.locator('.touch-controls .held').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.hold))].sort());
  const expectHeld = async keys => { const actual = await held(); if (actual.join() !== keys.sort().join()) throw Error('Held ' + actual + ', expected ' + keys); };
  const up = await at('Thrust upward', 1), drill = await at('Drill down', 2), right = await at('Move right', 1);
  await touch('touchStart', [up, drill]);
  await expectHeld(['W', 'S']);
  await touch('touchMove', [right, drill]);
  await expectHeld(['D', 'S']);
  await touch('touchEnd', [right]);
  await expectHeld(['S']);
  await touch('touchCancel', []);
  await expectHeld([]);
  await touch('touchStart', [up]);
  await page.setViewportSize({ width: 320, height: 740 });
  await expectHeld([]);
  await touch('touchCancel', []);
  const upPortrait = await at('Thrust upward', 3);
  await touch('touchStart', [upPortrait]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expectHeld([]);
  if (!await page.evaluate(() => window.__mars.paused)) throw Error('Blur failed to pause');
  await touch('touchCancel', []);
  await page.screenshot({ path: 'output/playwright/mobile-input-paused.png', scale: 'css' });
  return { multitouch: true, dragDirection: true, independentRelease: true, cancel: true, rotateClears: true, blurPauses: true };
}

