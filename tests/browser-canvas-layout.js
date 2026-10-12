// Run in an isolated development browser. Preserves the current campaign.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.locator('#launch').click();
  const checks = [];
  for (const [width, height] of [[1280,720], [960,720], [1440,900]]) {
    await page.setViewportSize({width, height});
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#game canvas').getBoundingClientRect();
      const viewport = document.querySelector('#viewport').getBoundingClientRect();
      return Math.abs(canvas.width - viewport.width) < 1 && Math.abs(canvas.height - viewport.height) < 1;
    });
    await page.waitForTimeout(150);
    const box = await page.locator('#game canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.65);
    const pointer = await page.evaluate(() => window.__mars.pointer);
    if (Math.abs(pointer.x - box.width * 0.55) > 1 || Math.abs(pointer.y - box.height * 0.65) > 1)
      throw Error(`Pointer/canvas mismatch: ${JSON.stringify({box, pointer})}`);
    if (box.y + box.height > height) throw Error('Canvas extends below the visible viewport');
    checks.push({width, height, canvasHeight:box.height});
  }
  await page.keyboard.press('Escape');
  await page.locator('#resume').click();
  await page.waitForTimeout(150);
  await page.screenshot({path:'output/playwright/canvas-layout-return.png'});
  if (errors.length) throw Error(errors.join('\n'));
  return {checks, errors};
}
