// Run in a dedicated development browser session; do not use a player's save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  await page.setViewportSize({ width: 1280, height: 800 });
  const introFocus = await page.evaluate(() => document.activeElement?.id);
  if (introFocus !== 'launch') throw Error('Expedition briefing did not focus its launch action');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !document.querySelector('.modal.intro'));

  await page.getByRole('button', { name: 'Pause game' }).click();
  const dialog = page.getByRole('dialog', { name: 'EXPEDITION PAUSED' });
  const firstFocus = await page.evaluate(() => document.activeElement?.id);
  await page.locator('#close').focus();
  await page.keyboard.press('Shift+Tab');
  const wrappedBack = await page.evaluate(() => document.activeElement?.id);
  if (wrappedBack !== 'new') throw Error('Shift+Tab from the first popup control did not wrap to the last');
  await page.keyboard.press('Tab');
  const wrappedForward = await page.evaluate(() => document.activeElement?.id);
  if (wrappedForward !== 'close') throw Error('Tab from the last popup control did not wrap to the first');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  if ((await page.evaluate(() => document.activeElement?.id)) !== 'pause') throw Error('Closing the popup did not restore focus to its opener');
  await page.locator('#game').click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'EXPEDITION PAUSED' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'EXPEDITION PAUSED' }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('dialog', { name: 'EXPEDITION PAUSED' }).waitFor({ state: 'visible' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__mars.reducedMotion);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.__mars.reducedMotion);

  await page.getByRole('button', { name: 'EXPORT SAVE' }).click();
  const exported = await page.getByRole('dialog').innerText();
  if (!exported.includes('DOWNLOAD SAVE FILE')) throw Error('Save export link not rendered');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download-save').click(),
  ]);
  const filename = download.suggestedFilename();
  if (!/^cold-signal-\d+\.json$/.test(filename)) throw Error(`Unexpected save filename: ${filename}`);
  const stream = await download.createReadStream();
  if (!stream) throw Error('Browser did not create an export download stream');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exportedSave = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (exportedSave.version !== 12 || exportedSave.activeMap !== 'cryo-shelf' || !exportedSave.maps['cryo-shelf'])
    throw Error('Downloaded JSON does not contain a valid campaign save');
  await page.getByRole('button', { name: 'IMPORT SAVE' }).click();
  const saved = await page.evaluate(() => localStorage.getItem('mars-miner.v1'));
  await page.locator('#save-import-input').setInputFiles({
    name: 'qa-save.json', mimeType: 'application/json', buffer: Buffer.from(saved),
  });
  const importDialog = await page.getByRole('dialog', { name: 'IMPORT EXPEDITION SAVE' }).innerText();
  if (!importDialog.includes('IMPORT') || !importDialog.includes('CANCEL'))
    throw Error('Save import confirmation preview did not render');
  await page.screenshot({ path: 'output/playwright/import-preview.png' });
  return { introFocus, firstFocus, wrappedBack, wrappedForward, reducedMotion: 'live reduce/no-preference verified', export: { filename, version: exportedSave.version, map: exportedSave.activeMap }, importPreview: true };
}
