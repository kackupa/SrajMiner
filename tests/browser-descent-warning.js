// Isolated fresh campaign: verify the visible warning against live motion.
async page => {
  const origin = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({origin, key}) => {
    if (location.origin !== origin || sessionStorage.getItem(key)) return;
    localStorage.removeItem('mars-miner.v1');
    sessionStorage.setItem(key, '1');
  }, {origin, key:`descent-warning-${Date.now()}`});
  await page.goto(origin);
  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));
  await page.waitForTimeout(1000);
  let falling, climbing;
  try {
    await page.keyboard.down('s');
    await page.waitForFunction(() => {
      const state = window.__mars;
      return state?.depth > 24 && state.vy > 120 && state.descentSpeed > 120 &&
        document.querySelector('#low-warning')?.textContent.includes('FAST DESCENT');
    }, {}, {timeout:20000});
    falling = await page.evaluate(() => ({depth:window.__mars.depth, vy:window.__mars.vy,
      speed:window.__mars.descentSpeed, warning:document.querySelector('#low-warning').textContent}));
    await page.keyboard.up('s');
    await page.keyboard.down('w');
    await page.waitForFunction(() => window.__mars.vy < -40 && window.__mars.descentSpeed < -40 &&
      !document.querySelector('#low-warning')?.textContent.includes('FAST DESCENT'), {}, {timeout:10000});
    climbing = await page.evaluate(() => ({depth:window.__mars.depth, vy:window.__mars.vy,
      speed:window.__mars.descentSpeed, warning:document.querySelector('#low-warning').textContent}));
    await page.waitForFunction(() => window.__mars.depth === 0, {}, {timeout:15000});
    await page.keyboard.up('w');
    await page.waitForFunction(() => window.__mars.docked, {}, {timeout:15000});
    const home = await page.evaluate(() => ({hull:window.__mars.hull, fuel:window.__mars.fuel, overlaps:window.__mars.overlaps}));
    if (home.overlaps || home.hull <= 0 || home.fuel <= 0 || errors.length) throw Error(JSON.stringify({home,errors}));
    await page.screenshot({path:'output/playwright/descent-warning-return.png'});
    return {falling, climbing, home, errors};
  } finally {
    await page.keyboard.up('s');
    await page.keyboard.up('w');
  }
}
