// Isolated browser check: actual landing and movement, then funded camp placement.
async (page) => {
  await page.goto('http://127.0.0.1:5180');
  const key='fresh-'+Date.now();
  await page.addInitScript(key=>{if(!sessionStorage.getItem(key)){localStorage.removeItem('mars-miner.v1');sessionStorage.setItem(key,'1')}},key);
  await page.reload();await page.locator('#launch').click();
  await page.waitForTimeout(1400);await page.screenshot({path:'output/playwright/mothership-touchdown.png'});
  await page.waitForFunction(()=>!document.querySelector('.intro'));
  if((await page.evaluate(()=>window.__mars.structures)).length)throw Error('Camp exists before construction');
  await page.keyboard.down('s');await page.waitForTimeout(3500);await page.keyboard.up('s');
  const underground=await page.evaluate(()=>window.__mars.depth);
  if(underground<=0)throw Error('Miner did not descend');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__mars.y < -15,{},{timeout:15000});await page.keyboard.up('w');
  await page.waitForTimeout(500);
  const returned=await page.evaluate(()=>window.__mars);
  if(returned.overlaps || returned.hull<=0)throw Error('Mining return collision');
  await page.keyboard.press('e');await page.waitForTimeout(250);await page.screenshot({path:'output/playwright/mothership-boarding.png'});
  let save=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
  save.cargo={copper:8,iron:6,silver:1,gold:2,diamond:0};save.levels.cargo=2;save.money=3000;
  save.maps[save.activeMap].x=680;save.maps[save.activeMap].y=-22;save.mothershipBoarded=false;
  await page.addInitScript(({save,key})=>{if(!sessionStorage.getItem(key)){localStorage.setItem('mars-miner.v1',JSON.stringify(save));sessionStorage.setItem(key,'1')}},{save,key:'camp-'+Date.now()});
  await page.reload();await page.locator('#launch').click();
  for(const kind of ['habitat','trade-post']){
    await page.keyboard.press('b');await page.locator('#build-'+kind).click();await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
  const kinds=final.maps[final.activeMap].structures.map(s=>s.kind);
  if(!kinds.includes('habitat')||!kinds.includes('trade-post'))throw Error('Camp buildings missing: '+kinds);
  if(final.money!==1000 || final.cargo.copper!==0 || final.cargo.iron!==0 || final.cargo.silver!==0 || final.cargo.gold!==0)throw Error('Incorrect camp costs');
  await page.screenshot({path:'output/playwright/mothership-built-camp.png'});
  return {landing:true,minedDepth:underground,returned:true,buildings:kinds,credits:final.money};
}
