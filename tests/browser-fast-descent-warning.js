// Verify the pre-impact warning with real held-key input; run only in a dedicated dev browser session.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).click();

  let warningState;
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(
      () => document.querySelector('#low-warning')?.textContent === 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT' && window.__mars?.vy >= 168,
      null,
      { timeout: 5000 },
    );
    warningState = await page.evaluate(() => ({
      warning: document.querySelector('#low-warning')?.textContent,
      vy: window.__mars?.vy,
      fallCue: window.__mars?.fallCue,
      hull: window.__mars?.hull,
      fuel: window.__mars?.fuel,
    }));
    await page.screenshot({ path: 'output/playwright/fast-descent-warning.png' });
  } finally {
    await page.keyboard.up('s');
  }
  if (warningState.warning !== 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT' || warningState.vy < 168 || warningState.fallCue <= 0)
    throw Error(`Fast descent cue did not match the live speed: ${JSON.stringify(warningState)}`);

  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('#low-warning')?.textContent !== 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT',
      null,
      { timeout: 5000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  const brakedState = await page.evaluate(() => ({
    warning: document.querySelector('#low-warning')?.textContent,
    vy: window.__mars?.vy,
    fallCue: window.__mars?.fallCue,
    hull: window.__mars?.hull,
    fuel: window.__mars?.fuel,
  }));
  if (brakedState.warning === 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT' || brakedState.hull <= 0 || brakedState.fallCue !== 0)
    throw Error(`Braking did not clear the warning safely: ${JSON.stringify(brakedState)}`);
  await page.screenshot({ path: 'output/playwright/fast-descent-braked.png' });
  return { warningState, brakedState };
}
