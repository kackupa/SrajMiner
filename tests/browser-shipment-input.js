// Continue an isolated earned campaign with at least half a unit of silver.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (await page.locator('#launch').count()) {
    await page.locator('#launch').click(); await page.waitForTimeout(1200);
  }
  if (!await page.locator('[role=dialog]').count()) await page.keyboard.press(
    await page.evaluate(() => window.__mars.mothershipBoarded) ? 'b' : 'e');
  await page.getByRole('button', {name:'Teletrade', exact:true}).click();
  const before = await page.evaluate(() => ({money:window.__mars.money, silver:window.__mars.cargo.silver,
    structures:window.__mars.structures}));
  if (before.silver < 0.5) throw Error('This continuation requires earned silver to sell');
  const silver = page.getByLabel('Silver shipment quantity', {exact:true});
  const element = await silver.elementHandle();
  await silver.fill('');
  await silver.pressSequentially('0.5', {delay:80});
  if (!await element.evaluate(node => node.isConnected && document.activeElement === node))
    throw Error('Typing replaced the shipment field or lost its focus');
  await page.getByLabel('Iron shipment quantity', {exact:true}).fill('0');
  if (await silver.inputValue() !== '0.5' || !await element.evaluate(node => node.isConnected))
    throw Error('Editing the second field lost the silver selection');
  const quote = await page.locator('.shipment-checkout strong').innerText();
  if (quote !== '$27.5') throw Error(`Unexpected half-unit quote: ${quote}`);
  await page.locator('#ship-selected').click();
  const after = await page.evaluate(() => ({money:window.__mars.money, silver:window.__mars.cargo.silver}));
  if (after.money !== before.money+27.5 || after.silver !== before.silver-0.5)
    throw Error(`Shipment differs from its live quote: ${JSON.stringify({before,after})}`);
  await page.reload(); await page.locator('#launch').click(); await page.waitForTimeout(1200);
  await page.keyboard.press('b');
  const loaded = await page.evaluate(() => ({money:window.__mars.money, silver:window.__mars.cargo.silver,
    core:window.__mars.coreFuel, structures:window.__mars.structures}));
  if (loaded.money!==after.money || loaded.silver!==after.silver || loaded.core!==4 ||
    JSON.stringify(loaded.structures)!==JSON.stringify(before.structures))
    throw Error(`Earned campaign did not survive reload: ${JSON.stringify(loaded)}`);
  await page.screenshot({path:'output/playwright/earned-first-sale.png'});
  if (errors.length) throw Error(errors.join('\n'));
  return {before,quote,after,loaded,errors};
}
