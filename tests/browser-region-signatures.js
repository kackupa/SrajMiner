// Run on a dedicated development origin; only synthetic regional fixtures are written.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank'); await page.goto(baseURL); await page.waitForFunction(() => !!window.__mars);
  const cases = [
    { id: 'prism-fault', field: 'geode', target: 'PRISM GEODE', file: 'region-prism-geode.png' },
    { id: 'mars-frontier', field: 'regionFind', target: 'THERMAL SEAM', file: 'region-mars-seam.png' },
    { id: 'hull-graveyard', field: 'regionFind', target: 'HULL SALVAGE', file: 'region-hull-salvage.png' },
  ];
  const results=[];
  for (const item of cases) {
    await page.goto('about:blank'); await page.goto(baseURL); await page.waitForFunction(() => !!window.__mars);
    const fixture=await page.evaluate(async ({id,field})=>{
      const {TileWorld}=await import('/src/game/world/TileWorld.ts');let found;
      for(let seed=1;seed<80&&!found;seed++){
        const world=new TileWorld(seed,[],[],id);
        for(let y=10;y<130&&!found;y++)for(let x=12;x<36;x++){const tile=world.get(x,y);if(tile.ore&&tile[field]){found={seed,x,y};break;}}
      }
      if(!found)throw Error(`No ${field} test seam found for ${id}`);
      const destroyed=Array.from({length:found.y},(_,row)=>`${found.x},${row}`);
      const depth=found.y*12;
      return {version:10,campaignSeed:found.seed,activeMap:id,maps:{[id]:{seed:found.seed,x:found.x*40+20,y:found.y*40-16,maxDepth:depth,destroyed,discovered:[],drops:[],activeCharge:null}},money:80,levels:{drill:1,fuel:1,cargo:1,hull:1,engine:1},fuel:190,hull:100,cargo:{copper:0,iron:0,silver:0,gold:0,diamond:0},maxDepth:depth,artifact:false,milestones:[],shipComponents:[],routeFragments:[],charges:0,ownedPaints:['hab'],selectedPaint:'hab',salvageMagnet:false,ownedSuits:['hab'],selectedSuit:'hab',ownedDecals:['standard'],selectedDecal:'standard',ownedProfiles:['standard'],selectedProfile:'standard'};
    },item);
    await page.evaluate(data=>localStorage.setItem('mars-miner.v1',JSON.stringify(data)),fixture);await page.reload();await page.setViewportSize({width:1280,height:800});await page.getByRole('button',{name:/CONTINUE EXPEDITION/}).click();
    await page.keyboard.down('s');
    try { await page.waitForFunction(()=>!document.querySelector('#drill-target')?.classList.contains('hidden')); }
    catch { await page.keyboard.up('s'); throw Error(`${item.id}: target did not appear. ${JSON.stringify({state:await page.evaluate(()=>window.__mars),target:await page.locator('#drill-target').getAttribute('class'),fixture:fixture.maps[item.id]})}`); }
    const text=await page.locator('#drill-target').innerText();if(!text.includes(item.target))throw Error(`${item.id}: expected ${item.target}, got ${text}`);
    const state=await page.evaluate(()=>window.__mars);if(state.overlaps)throw Error(`${item.id}: pod overlaps terrain`);
    const canvasBox=await page.locator('#game canvas').evaluate(canvas=>canvas.getBoundingClientRect().toJSON());
    const toast=page.locator('#toast');
    if(!(await toast.evaluate(element=>element.classList.contains('visible'))))throw Error(`${item.id}: fixture should activate a depth milestone toast`);
    const toastBox=await toast.evaluate(element=>element.getBoundingClientRect().toJSON());
    if(toastBox.top<canvasBox.top||toastBox.bottom>canvasBox.top+100)throw Error(`${item.id}: milestone toast is not in the reserved top strip: ${JSON.stringify({toastBox,canvasBox})}`);
    const pod=await page.evaluate(()=>window.__mars);
    const podScreenY=canvasBox.top+pod.y;
    if(toastBox.bottom>=podScreenY-60)throw Error(`${item.id}: milestone toast overlaps the central play area: ${JSON.stringify({toastBox,podScreenY})}`);
    const orphanLabels=state.stationLabels.filter(label=>label.visible&&(label.x<0||label.x>canvasBox.width||label.y<0||label.y>canvasBox.height));
    if(orphanLabels.length)throw Error(`${item.id}: offscreen surface labels remain visible: ${JSON.stringify(orphanLabels)}`);
    await page.keyboard.up('s');await page.screenshot({path:`output/playwright/${item.file}`});
    for (const viewport of [{width:960,height:720},{width:1440,height:960}]) {
      await page.setViewportSize(viewport);await page.waitForTimeout(120);
      const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      if(layout.scrollWidth>layout.width)throw Error(`${item.id}: horizontal overflow at ${viewport.width}x${viewport.height}`);
      await page.screenshot({path:`output/playwright/${item.file.replace('.png',`-${viewport.width}x${viewport.height}.png`)}`});
    }
    results.push({map:item.id,seed:fixture.campaignSeed,target:text,depth:state.depth,overlaps:state.overlaps,stationLabels:state.stationLabels,layouts:['1280x800','960x720','1440x960']});
  }
  return results;
}
