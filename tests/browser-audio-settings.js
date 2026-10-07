// Run via Playwright CLI in a dedicated development-browser session.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).click();

  await page.locator('#audio-mix').click();
  for (const [channel, value] of [['music', 35], ['effects', 55]]) {
    await page.locator(`#${channel}-volume`).evaluate((input, amount) => {
      input.value = String(amount);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    if ((await page.locator(`#${channel}-value`).textContent()) !== `${value}%`)
      throw Error(`${channel} slider feedback failed`);
  }
  await page.locator('#audio-mute').click();
  if ((await page.locator('#audio').textContent()) !== 'SOUND OFF' ||
      (await page.locator('#audio').getAttribute('aria-pressed')) !== 'true')
    throw Error('Quick-mute control did not update with mixer mute');
  const storedMuted = await page.evaluate(() => ({
    preference: localStorage.getItem('mars-miner.settings.v1'),
    mix: JSON.parse(localStorage.getItem('mars-miner.audio-mix.v1')),
  }));
  if (storedMuted.preference !== 'muted' || storedMuted.mix.music !== 35 || storedMuted.mix.effects !== 55)
    throw Error('Mixer settings were not persisted');

  await page.reload();
  await page.waitForFunction(() => !!window.__mars);
  const restored = await page.evaluate(() => window.__mars.audio);
  if (!restored.muted || restored.mix.music !== 35 || restored.mix.effects !== 55)
    throw Error('Saved audio settings were not restored');
  if ((await page.locator('#audio').textContent()) !== 'SOUND OFF')
    throw Error('Quick-mute control did not reflect restored state');
  await page.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).click();
  await page.locator('#audio-mix').click();
  if ((await page.locator('#music-volume').inputValue()) !== '35' ||
      (await page.locator('#effects-volume').inputValue()) !== '55')
    throw Error('Mixer controls did not reflect restored channel levels');
  await page.locator('#audio-mute').click();
  if (await page.evaluate(() => localStorage.getItem('mars-miner.settings.v1')) !== 'on')
    throw Error('Unmute preference was not persisted');
  if ((await page.locator('#audio').textContent()) !== 'SOUND ON' ||
      (await page.locator('#audio').getAttribute('aria-pressed')) !== 'false')
    throw Error('Quick-mute control did not update with mixer unmute');
  await page.screenshot({ path: 'output/playwright/audio-mixer.png' });
  return { storedMuted, restored: await page.evaluate(() => window.__mars.audio) };
}
