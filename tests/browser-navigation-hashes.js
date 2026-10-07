// Mine every optional archive hash in a disposable fixture and verify each is banked once.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const hashSites = [
    { id: 'hash-cryo', mapId: 'cryo-shelf', x: 12, row: 16, name: 'ICEBOUND ECHO' },
    { id: 'hash-hull', mapId: 'hull-graveyard', x: 12, row: 22, name: 'WRECK REGISTER' },
    { id: 'hash-prism', mapId: 'prism-fault', x: 36, row: 32, name: 'PRISM KEY' },
    { id: 'hash-mars', mapId: 'mars-frontier', x: 9, row: 20, name: 'RED DUST INDEX' },
  ];
  const results = [];
  for (const site of hashSites) {
    const seed = 54121 + site.row;
    const destroyed = Array.from({ length: site.row }, (_, row) => `${site.x},${row}`);
    const save = {
      version: 10, campaignSeed: seed, activeMap: site.mapId,
      maps: { [site.mapId]: { seed, x: site.x * 40 + 20, y: site.row * 40 - 18, maxDepth: site.row * 12, destroyed, discovered: destroyed, drops: [], activeCharge: null } },
      money: 5000, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 }, fuel: 190, hull: 100,
      cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: site.row * 12,
      artifact: false, milestones: site.id === 'hash-mars' ? hashSites.filter(hash => hash.id !== site.id).map(hash => hash.id) : [], shipComponents: ['frame', 'propulsion', 'navigation', 'life-support'],
      routeFragments: ['fragment-1', 'fragment-2', 'fragment-3', 'fragment-4'], charges: 0,
      ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
      ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
      ownedProfiles: ['standard'], selectedProfile: 'standard',
    };
    await page.goto('about:blank');
    await page.goto(baseURL);
    await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
    await page.reload();
    await page.locator('#launch').click();
    await page.keyboard.down('s');
    try {
      await page.waitForFunction((name) => document.querySelector('#drill-target')?.innerText.includes(name), site.name, { timeout: 10000 });
      const target = await page.locator('#drill-target').innerText();
      if (!target.includes('NO CASH VALUE')) throw new Error(`${site.id}: target must clarify the collectible has no monetary value`);
      await page.waitForFunction((id) => JSON.parse(localStorage.getItem('mars-miner.v1')).milestones.includes(id), site.id, { timeout: 15000 });
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
      if (stored.milestones.filter((id) => id === site.id).length !== 1) throw new Error(`${site.id}: collectible was not recorded exactly once`);
      if (stored.money !== save.money) throw new Error(`${site.id}: collecting the hash changed credits`);
      if (site.id === 'hash-mars') {
        await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('CREW ARCHIVE RESTORED'), {}, { timeout: 5000 });
      }
      results.push({ id: site.id, target: site.name, bankedOnce: true, moneyUnchanged: true });
    } finally {
      await page.keyboard.up('s');
    }
  }
  await page.screenshot({ path: 'output/playwright/navigation-hashes.png' });
  return results;
}
