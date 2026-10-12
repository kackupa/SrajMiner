// Playwright CLI run-code --filename tests/browser-production-persistence.js.
// Run only in an isolated browser: installs disposable migration/capacity saves.
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const install = async (save) => {
    await page.addInitScript(({save, key, origin}) => {
      if (location.origin !== origin) return;
      if (sessionStorage.getItem(key)) return;
      localStorage.setItem('mars-miner.v1', JSON.stringify(save));
      sessionStorage.setItem(key, '1');
    }, {save, key: `production-fixture-${Date.now()}-${Math.random()}`, origin: new URL(page.url()).origin});
    await page.reload();
    await page.locator('#launch').click();
    await page.waitForFunction(() => window.__mars?.docked);
  };
  const sum = stock => Object.values(stock).reduce((a, b) => a + b, 0);
  const base = await read();
  if (!base) throw Error('Start a disposable expedition before running this fixture');
  base.activeMap = 'cryo-shelf';
  base.mothershipBoarded = false;
  base.cargo = Object.fromEntries(Object.keys(base.cargo).map(ore => [ore, 0]));
  base.maps = {'cryo-shelf': {...base.maps['cryo-shelf'], x: 700, y: -22,
    warehouse: {...base.cargo, copper: 39.5},
    structures: [
      {id:'warehouse:700:0', kind:'warehouse', x:700, y:0, level:1},
      {id:'extractor:900:0', kind:'extractor', x:900, y:0, level:1},
    ]}};
  base.productionUpdatedAt = Date.now() - 3_600_000;
  await install(base);
  await page.keyboard.press('e');
  let full = await read();
  if (sum(full.maps['cryo-shelf'].warehouse) !== 40 || full.maps['cryo-shelf'].structures[1].productionFraction !== 0)
    throw Error('Capacity catch-up must fill to 40 and discard blocked production');
  await page.locator('#warehouse-ore').selectOption('copper');
  await page.locator('#warehouse-units').fill('0.5');
  await page.locator('#warehouse-withdraw').click();
  const withdrawn = await read();
  if (sum(withdrawn.maps['cryo-shelf'].warehouse) !== 39.5 || withdrawn.cargo.copper !== 0.5)
    throw Error('Withdrawing from a full warehouse created ore');
  await page.reload(); await page.locator('#launch').click();
  const reloaded = await read();
  if (sum(reloaded.maps['cryo-shelf'].warehouse) !== 39.5 || reloaded.cargo.copper !== 0.5)
    throw Error('Reload duplicated ore after withdrawal');

  const offline = structuredClone(base);
  offline.maps['cryo-shelf'].warehouse = {...base.cargo};
  offline.productionUpdatedAt = Date.now() - 86_400_000;
  await install(offline);
  const capped = await read();
  if (sum(capped.maps['cryo-shelf'].warehouse) !== 24) throw Error('Offline catch-up exceeded its 12-hour cap');

  const legacy = structuredClone(base);
  legacy.version = 28;
  delete legacy.productionUpdatedAt;
  delete legacy.deliveries;
  legacy.maps['cryo-shelf'].warehouse = {copper:7.5, iron:2, silver:0, gold:0, diamond:0};
  const oldDestroyed = [...legacy.maps['cryo-shelf'].destroyed];
  await install(legacy);
  const migrated = await read();
  if (migrated.version !== 30 || sum(migrated.maps['cryo-shelf'].warehouse) !== 9.5 ||
      migrated.maps['cryo-shelf'].warehouse.copper !== 7.5 ||
      oldDestroyed.some(cell => !migrated.maps['cryo-shelf'].destroyed.includes(cell)) ||
      migrated.money !== legacy.money || migrated.coreFuel !== legacy.coreFuel)
    throw Error('v28 migration lost stock, excavation, credits, or core fuel');
  await page.keyboard.press('e');
  await page.locator('.boarding-arrival').waitFor({state:'detached'});
  await page.screenshot({path:'output/playwright/production-v28-migrated.png'});
  await page.reload(); await page.locator('#launch').click();
  if (sum((await read()).maps['cryo-shelf'].warehouse) !== 9.5) throw Error('Migrated stock duplicated on reload');
  if (errors.length) throw Error(errors.join('\n'));
  return {fullCapacity:40, afterWithdrawalAndReload:39.5, offlineCap:24, migratedVersion:30, legacyStock:9.5, errors};
}
