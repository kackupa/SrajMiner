// Verify collected navigation hashes render as offline no-value entries in the archive.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const ids = ['hash-cryo', 'hash-hull', 'hash-prism', 'hash-mars'];
  const save = {
    version: 10, campaignSeed: 721, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed: 721, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 }, fuel: 140, hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: ids, shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.locator('#launch').click();
  await page.locator('#open-archive').click();
  const entries = await page.locator('.archive-entry[id^="hash-"]').allInnerTexts();
  if (entries.length !== 4) throw new Error(`Expected four navigation hash records, received ${entries.length}`);
  for (const entry of entries) {
    if (!entry.includes('RECOVERED · OFFLINE COLLECTIBLE') || !entry.includes('No exchange value'))
      throw new Error(`Hash record does not explain its status/value: ${entry}`);
  }
  const crewLogs = await page.locator('.archive-entry[id^="hash-"] .crew-log').allInnerTexts();
  if (crewLogs.length !== 4 || new Set(crewLogs.map((log) => log.split(' · ')[0])).size !== 4)
    throw new Error(`Expected four distinct recovered crew voices: ${JSON.stringify(crewLogs)}`);
  const conclusion = await page.locator('#crew-archive-conclusion').innerText();
  if (!conclusion.includes('THE SIGNAL WAS A HANDSHAKE') || !conclusion.includes('return handshake'))
    throw new Error(`Four recovered regional logs should unlock the final story beat: ${conclusion}`);
  const summary = await page.locator('.modal').innerText();
  if (!summary.includes('4 / 4') || !summary.includes('no cash value')) throw new Error(`Archive summary is unclear: ${summary}`);
  await page.setViewportSize({ width: 960, height: 560 });
  const lastLog = page.locator('#crew-archive-conclusion');
  await lastLog.scrollIntoViewIfNeeded();
  const panel = await page.locator('.modal').boundingBox();
  const logBox = await lastLog.boundingBox();
  if (!panel || !logBox || logBox.y < panel.y || logBox.y + logBox.height > panel.y + panel.height)
    throw new Error(`The last crew log cannot be read inside the compact archive panel: ${JSON.stringify({ panel, logBox })}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    throw new Error('The compact archive introduced horizontal page overflow');
  await page.screenshot({ path: 'output/playwright/navigation-hash-archive.png' });
  return { entries, crewLogs, noCashValue: true, legacySaveSchema: 10, compactPanel: panel, lastLog: logBox };
}
