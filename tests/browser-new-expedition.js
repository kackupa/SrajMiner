async (page) => {
 await page.reload();await page.getByRole('button',{name:'CONTINUE EXPEDITION ↗'}).click();
 const seed=await page.evaluate(()=>window.__mars.seed);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'NEW EXPEDITION',exact:true}).click();
 await page.getByRole('button',{name:'START NEW EXPEDITION →',exact:true}).click();
 await page.getByRole('button',{name:'BEGIN EXPEDITION ↗'}).waitFor();
 const fresh=await page.evaluate(()=>window.__mars);
 if(fresh.seed===seed||fresh.money!==80||fresh.destroyed.length||fresh.levels.drill!==1)throw Error('New expedition autosave regression');
 return {seed:fresh.seed,money:fresh.money,docked:fresh.docked,tiles:fresh.destroyed.length};
}
