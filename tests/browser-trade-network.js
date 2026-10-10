async (page) => {
  const fixture = {
    version: 23, planetChart: { radiusRows: 110, columns: Math.round(Math.PI * 110) }, campaignSeed: 71201,
    activeMap: 'cryo-shelf',
    maps: {
      'cryo-shelf': { seed: 71201, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], planetChart: { radiusRows: 110, columns: Math.round(Math.PI * 110) } },
      'mars-frontier': { seed: 71202, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [{ id: 'trade-post:1500:0', kind: 'trade-post', x: 1500, y: 0 }], planetChart: { radiusRows: 150, columns: Math.round(Math.PI * 150) } },
    },
    money: 5000, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 }, fuel: 100, hull: 70,
    cargo: { copper: 12, iron: 8, silver: 3, gold: 3, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: [], shipComponents: ['frame', 'propulsion', 'navigation', 'life-support'], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard', ownedProfiles: ['standard'], selectedProfile: 'standard',
    specialization: 'balanced', stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
  };
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), fixture);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('b');
  const habitatButton = page.locator('#build-habitat');
  await habitatButton.waitFor();
  if (await habitatButton.isDisabled()) throw Error('The seeded resources should fund a colony Habitat');
  await habitatButton.click();
  let placement = await page.evaluate(() => window.__mars.placement);
  if (!placement?.valid) throw Error(`Habitat should enter valid placement mode: ${JSON.stringify(placement)}`);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (saved.money !== 5000 || saved.maps['cryo-shelf'].structures.length)
    throw Error('Entering placement mode must not spend credits or build before confirmation');
  await page.keyboard.press('Enter');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const habitats = saved.maps['cryo-shelf'].structures.filter((item) => item.kind === 'habitat');
  if (habitats.length !== 1 || saved.money !== 4100 || saved.version !== 24)
    throw Error(`Building should spend once and persist a habitat: ${JSON.stringify({ habitats, version: saved.version, money: saved.money })}`);
  saved.maps['cryo-shelf'].x = habitats[0].x - 140;
  habitats[0].integrity = 1;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), saved);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('b');
  const repairedHabitatId = encodeURIComponent(habitats[0].id);
  const repairButton = page.locator(`[id="repair-${repairedHabitatId}"]`);
  await repairButton.waitFor();
  if (await repairButton.isDisabled()) throw Error('A damaged habitat with enough credits should be repairable');
  await repairButton.click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (saved.money !== 3920 || saved.maps['cryo-shelf'].structures.find(item => item.kind === 'habitat').integrity !== 2)
    throw Error(`Habitat repair should cost $180 and restore full integrity: ${JSON.stringify({ money: saved.money, habitats: saved.maps['cryo-shelf'].structures })}`);
  habitats[0] = saved.maps['cryo-shelf'].structures.find(item => item.kind === 'habitat');
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const habitatService = page.locator('#modal-layer');
  await habitatService.waitFor();
  if (!(await habitatService.innerText()).includes('REFUEL TANK')) throw Error('E beside a habitat should open its local service bay');
  await page.locator('#close').click();
  await page.locator('#game').click();
  await page.keyboard.press('b');
  const buildButton = page.locator('#build-trade-post');
  await buildButton.waitFor();
  if (await buildButton.isDisabled()) throw Error('The seeded post materials and credits should fund a surface Trading Post');
  if (!(await page.locator('#modal-layer').innerText()).includes('1,100')) throw Error('The build panel should show its ore and credit cost');
  await buildButton.click();
  placement = await page.evaluate(() => window.__mars.placement);
  if (!placement) throw Error('Trading Post should enter placement mode');
  await page.keyboard.press('Escape');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (saved.money !== 3920 || saved.maps['cryo-shelf'].structures.filter((item) => item.kind === 'trade-post').length)
    throw Error('Cancelling placement must preserve the wallet and structure list');
  await page.keyboard.press('b');
  await page.locator('#build-trade-post').click();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  placement = await page.evaluate(() => window.__mars.placement);
  if (!placement?.valid) throw Error(`Nudging should find an open Trading Post site: ${JSON.stringify(placement)}`);
  await page.keyboard.press('Enter');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const localPosts = saved.maps['cryo-shelf'].structures.filter((item) => item.kind === 'trade-post');
  if (localPosts.length !== 1 || saved.version !== 24 || saved.money !== 2820)
    throw Error(`Building should spend once and persist a local post: ${JSON.stringify({ localPosts, version: saved.version, money: saved.money })}`);
  saved.maps['cryo-shelf'].x = localPosts[0].x + 100;
  saved.maps['cryo-shelf'].y = -22;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), saved);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const salePanel = page.locator('#modal-layer');
  await salePanel.waitFor();
  if (!(await salePanel.innerText()).includes('LINKED-WORLD PREMIUM'))
    throw Error('A local member exchange with another planetary post should preview its sale premium');
  await page.screenshot({ path: 'output/playwright/interplanetary-trade-post.png' });
  await page.locator('#close').click();
  await page.locator('#game').click();
  await page.keyboard.press('b');
  const defenseButton = page.locator('#build-turret');
  await defenseButton.waitFor();
  if (await defenseButton.isDisabled()) throw Error('The remaining seeded ore should fund a surface defense pylon');
  await defenseButton.click();
  placement = await page.evaluate(() => window.__mars.placement);
  if (!placement) throw Error('Defense pylon should enter placement mode');
  for (let i = 0; i < 6 && !placement.valid; i += 1) {
    await page.keyboard.press('Shift+ArrowRight');
    placement = await page.evaluate(() => window.__mars.placement);
  }
  if (!placement?.valid) throw Error(`Could not nudge the pylon onto a free site: ${JSON.stringify(placement)}`);
  await page.keyboard.press('Enter');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const surfaceTurrets = saved.maps['cryo-shelf'].structures.filter((item) => item.kind === 'turret');
  if (surfaceTurrets.length !== 1 || saved.money !== 2260) throw Error(`Surface pylon should spend once and persist: ${JSON.stringify({ surfaceTurrets, money: saved.money })}`);
  await page.screenshot({ path: 'output/playwright/interplanetary-colony-defense.png' });
  saved.maps['cryo-shelf'].x = 980;
  saved.maps['cryo-shelf'].y = -22;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), saved);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.locator('#open-destinations').click();
  const routePanel = await page.locator('#modal-layer').innerText();
  if (!routePanel.includes('VESPER EXCHANGE · 2/6 COLONIES LINKED') || await page.locator('.trade-route-lines line').count() !== 1)
    throw Error(`Two linked Trading Posts should draw a visible route on the destination board: ${routePanel}`);
  await page.screenshot({ path: 'output/playwright/interplanetary-route-map.png' });
  await page.locator('#close').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  saved.maps['cryo-shelf'].x = localPosts[0].x + 100;
  saved.maps['cryo-shelf'].y = -22;
  saved.cargo = { copper: 3, iron: 0, silver: 0, gold: 0, diamond: 0 };
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), saved);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const orderPanel = page.locator('#modal-layer');
  await orderPanel.waitFor();
  const orderPreview = await orderPanel.innerText();
  if (!orderPreview.includes('3 COPPER') || !orderPreview.includes('+$120') || !orderPreview.includes('ESTIMATED PAYOUT'))
    throw Error(`Local Trading Post should preview its ore order and delivery bonus: ${orderPreview}`);
  const buyerPicker = page.locator('#sale-buyer');
  await buyerPicker.waitFor();
  await buyerPicker.selectOption('mars-frontier');
  const remotePreview = await orderPanel.innerText();
  if (!remotePreview.includes('MARS FRONTIER DEMAND') || !remotePreview.includes('LOCAL ORDER 1/3 · NOT INCLUDED'))
    throw Error(`A linked remote market should show its own demand and clearly waive the local order: ${remotePreview}`);
  await buyerPicker.selectOption('cryo-shelf');
  if (!(await orderPanel.innerText()).includes('LOCAL BUY ORDER 1/3'))
    throw Error('Selecting the local market should restore the local buy-order preview');
  await page.locator('#sell').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (!saved.milestones.includes('contract-cryo') || saved.cargo.copper !== 0)
    throw Error(`Delivering the requested ore should pay and persist the order once: ${JSON.stringify({ milestones: saved.milestones, cargo: saved.cargo })}`);
  if (!(await page.locator('#modal-layer').innerText()).includes('SETTLEMENT RECEIPT / CRYO SHELF → CRYO SHELF'))
    throw Error('A completed sale should remain visible as a settlement receipt');
  const paidMoney = saved.money;
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const fulfilledPanel = await page.locator('#modal-layer').innerText();
  if (!fulfilledPanel.includes('LOCAL BUY ORDER 2/3') || !fulfilledPanel.includes(`$${paidMoney}`) || fulfilledPanel.includes('3 COPPER'))
    throw Error(`The first local delivery should remain paid and advance to the next ore order after reload: ${fulfilledPanel}`);
  await page.locator('#close').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  saved.maps['cryo-shelf'].x = 3200;
  saved.maps['cryo-shelf'].y = -22;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), saved);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('b');
  const remoteBuildPanel = await page.locator('#modal-layer').innerText();
  if (!remoteBuildPanel.includes('PLANETARY BUILD YARD') || !remoteBuildPanel.includes('COLONY HABITAT'))
    throw Error(`B should open globe construction away from Hab 07: ${remoteBuildPanel}`);
  if (remoteBuildPanel.includes('REPAIR COLONY HABITAT')) throw Error('Remote surface construction must not offer Hab 07 yard-only repairs');
  await page.locator('#close').click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  if ((await page.locator('#modal-layer').innerText()).trim()) throw Error('Remote surface without a habitat or Trading Post should not open unrelated services');
  const relaySave = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  relaySave.activeMap = 'cryo-shelf';
  relaySave.maps['cryo-shelf'].x = 980;
  relaySave.maps['cryo-shelf'].y = -22;
  relaySave.maps['prism-fault'] = {
    seed: 71204, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null,
    structures: [{ id: 'warehouse:1120:0', kind: 'warehouse', x: 1120, y: 0 }],
    warehouse: { copper: 0, iron: 0, silver: 2, gold: 0, diamond: 0 },
    planetChart: { radiusRows: 150, columns: Math.round(Math.PI * 150) },
  };
  relaySave.milestones = [...new Set([...relaySave.milestones, 'project-relay-cryo', 'project-relay-hull'])];
  const relayStartMoney = relaySave.money;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), relaySave);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.locator('#open-destinations').click();
  await page.locator('#map-prism-fault').click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const projectPanel = page.locator('#modal-layer');
  await projectPanel.waitFor();
  const projectCopy = await projectPanel.innerText();
  if (!projectCopy.includes('VESPER RELAY · 2/3 STAGES') || !projectCopy.includes('CONTRIBUTE 2 SILVER'))
    throw Error(`The destination warehouse should explain the active relay project contribution: ${projectCopy}`);
  await page.locator('#fund-relay').click();
  const funded = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (!funded.milestones.includes('project-vesper-relay-online') || funded.maps['prism-fault'].warehouse.silver !== 0 || funded.money !== relayStartMoney + 1200)
    throw Error(`The final relay donation should consume stored ore and award the completion payout once: ${JSON.stringify({ money: funded.money, warehouse: funded.maps['prism-fault'].warehouse, milestones: funded.milestones })}`);
  await page.locator('#close').click();
  await page.locator('#open-destinations').click();
  const restoredRoutes = page.locator('#modal-layer');
  if (await page.locator('.trade-route-node.relay').count() !== 1 || await page.locator('.trade-route-lines line.relay-link').count() !== 2)
    throw Error(`The funded relay should appear as a visible star-map hub connected to posted colonies: ${await restoredRoutes.innerText()}`);
  await page.screenshot({ path: 'output/playwright/interplanetary-relay-project.png' });
  await page.locator('#close').click();
  const logisticsSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  logisticsSave.milestones = [...new Set([...logisticsSave.milestones, 'project-tug-cryo', 'project-tug-hull', 'project-tug-vesper', 'project-cargo-tug-online'])];
  logisticsSave.maps['cryo-shelf'].structures.push({ id: 'warehouse:1250:0', kind: 'warehouse', x: 1250, y: 0 });
  logisticsSave.maps['cryo-shelf'].warehouse = { copper: 2, iron: 0, silver: 0, gold: 0, diamond: 0 };
  logisticsSave.maps['hull-graveyard'] = {
    seed: 71203, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null,
    structures: [{ id: 'warehouse:1120:0', kind: 'warehouse', x: 1120, y: 0 }],
    warehouse: { copper: 0, iron: 0, silver: 2, gold: 0, diamond: 0 },
    planetChart: { radiusRows: 150, columns: Math.round(Math.PI * 150) },
  };
  logisticsSave.maps['prism-fault'].x = 980;
  logisticsSave.maps['prism-fault'].y = -22;
  await page.evaluate((save) => localStorage.setItem('mars-miner.v1', JSON.stringify(save)), logisticsSave);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const warehousePanel = page.locator('#modal-layer');
  await warehousePanel.waitFor();
  if (!(await warehousePanel.innerText()).includes('CARGO TUG · 3/3 STAGES'))
    throw Error('Cargo Tug completion should unlock the colony warehouse network');
  await page.locator('#warehouse-source').selectOption('hull-graveyard');
  await page.locator('#warehouse-ore').selectOption('silver');
  await page.locator('#warehouse-units').fill('1');
  if (!(await warehousePanel.innerText()).includes('STORED × 2')) throw Error('Remote source selection should show the remote planet’s inventory');
  await page.screenshot({ path: 'output/playwright/cargo-tug-remote-warehouse.png' });
  await page.locator('#warehouse-withdraw').click();
  const remoteTransfer = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  if (remoteTransfer.maps['hull-graveyard'].warehouse.silver !== 1 || remoteTransfer.cargo.silver !== 1)
    throw Error(`Remote withdrawal must debit its source and credit the miner once: ${JSON.stringify({ remote: remoteTransfer.maps['hull-graveyard'].warehouse, cargo: remoteTransfer.cargo })}`);
  return { version: funded.version, habitat: habitats[0], localPost: localPosts[0], surfaceTurret: surfaceTurrets[0], moneyAfterBuilds: paidMoney, habitatServiceVisible: true, salePremiumVisible: true, localBuyOrderPaid: true, relayProjectPersisted: true };
}
