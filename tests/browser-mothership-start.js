// Run through Playwright CLI in its isolated landing session.
async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5180'); await page.locator('#launch').click();
  await page.keyboard.press('e');
  // Seed a small earned haul to exercise transactions without a long mining grind.
  let save=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
  save.cargo={copper:6,iron:3,silver:1,gold:0,diamond:0}; save.money=500;
  save.mothershipBoarded=false;save.maps[save.activeMap].x=680;save.maps[save.activeMap].y=-22;
  save.maps[save.activeMap].warehouse={copper:0,iron:0,silver:0,gold:0,diamond:0};
  save.maps[save.activeMap].structures=[];
  await page.addInitScript(({save,key})=>{ if(!sessionStorage.getItem(key)){localStorage.setItem('mars-miner.v1',JSON.stringify(save));sessionStorage.setItem(key,'1');} },{save,key:'fixture-'+Date.now()});
  await page.reload();await page.locator('#launch').click();await page.keyboard.press('e');
  await page.locator('#warehouse-units').fill('4');await page.locator('#warehouse-store').click();
  await page.locator('#warehouse-ore').selectOption('iron');await page.locator('#warehouse-store-all').click();
  await page.locator('#warehouse-ore').selectOption('silver');await page.locator('#warehouse-store-all').click();
  await page.locator('#camp-nav-sell').click();await page.locator('#sell').click();
  const sold=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
  if(sold.cargo.copper!==0 || sold.maps[sold.activeMap].warehouse.copper!==4)throw Error('Sale consumed stored ore');
  await page.locator('#close').click();await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  const blocked=await page.evaluate(()=>window.__mars);
  if(blocked.inOrbit || blocked.y < -35)throw Error('Zero-core ship lifted off');
  await page.reload();await page.locator('#launch').click();
  await page.locator('#open-full-services').click();await page.locator('#camp-nav-warehouse').click();
  const stock=await page.locator('.warehouse-stock').innerText();
  if(!stock.includes('STORED × 4'))throw Error('Storage lost after reload');
  await page.locator('#warehouse-ore').selectOption('iron');await page.locator('#warehouse-withdraw-all').click();
  await page.locator('#warehouse-ore').selectOption('silver');await page.locator('#warehouse-withdraw-all').click();
  await page.locator('#camp-nav-construction').click();await page.locator('#build-warehouse').click();
  await page.keyboard.press('Enter');
  const built=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
  if(!built.maps[built.activeMap].structures.some(s=>s.kind==='warehouse'))throw Error('Warehouse placement failed');
  if(built.money!==sold.money-360 || built.cargo.iron!==0 || built.cargo.silver!==0 || built.maps[built.activeMap].warehouse.copper!==4)throw Error('Construction materials incorrect');
  if(await page.locator('.camp-screen').count())throw Error('Enter reopened a service panel after placement');
  await page.screenshot({path:'output/playwright/mothership-first-warehouse.png'});
  await page.reload();await page.locator('#launch').click();
  const loaded=await page.evaluate(()=>window.__mars);
  if(!loaded.structures.some(s=>s.kind==='warehouse'))throw Error('Built warehouse lost on reload');
  if(errors.length)throw Error(errors.join('\n'));
  return {storedCopper:4,zeroCoreFlightBlocked:true,warehouseBuilt:true,reload:true,errors};
}
