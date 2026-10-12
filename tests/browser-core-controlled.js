// Actual browser controls with fixed frame advancement. No inventory/terrain grants.
// This isolates input transport latency; it does not establish human playability.
async page => {
  const origin = new URL(page.url()).origin, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.addInitScript(({origin, key}) => {
    if (location.origin !== origin || sessionStorage.getItem(key)) return;
    localStorage.removeItem('mars-miner.v1'); sessionStorage.setItem(key, '1');
  }, {origin, key:`controlled-core-${Date.now()}`});
  await page.goto(origin);
  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars && !document.querySelector('.intro'));
  await page.waitForTimeout(1000);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const canvas = await page.locator('#game canvas').boundingBox();
  const read = () => page.evaluate(() => {
    const s = window.__mars;
    return {x:s.x,y:s.y,depth:s.depth,speed:s.descentSpeed,fuel:s.fuel,hull:s.hull,core:s.coreFuel,
      target:s.coreTargetScreen,aim:s.aimTile,drill:s.drillProgress,docked:s.docked,overlaps:s.overlaps,
      destroyed:s.destroyed.length,seed:s.seed,money:s.money,ship:s.shipComplete};
  });
  let state = await read(), up = false, down = false, aiming = false, maxDrill = 0;
  if (state.core || state.money || state.destroyed) throw Error('Expected a fresh unmodified expedition');
  const initial = state;
  const controls = async (nextUp, nextDown) => {
    if (up !== nextUp) { await page.keyboard[nextUp ? 'down' : 'up']('w'); up = nextUp; }
    if (down !== nextDown) { await page.keyboard[nextDown ? 'down' : 'up']('s'); down = nextDown; }
  };
  try {
    for (let elapsed=0; elapsed<180000 && !state.core; elapsed+=100) {
      if (state.fuel <= 0 || state.hull <= 0) throw Error(`Lost expedition: ${JSON.stringify({state,maxDrill})}`);
      if (state.depth >= 440 || aiming) {
        if (!aiming) { await page.mouse.down(); aiming = true; }
        await page.mouse.move(canvas.x + state.target.x, canvas.y + state.target.y);
        const targetSpeed = Math.max(-60, Math.min(60, (444-state.depth)*12));
        await controls(state.speed > targetSpeed + (up ? -10 : 10), false);
      } else {
        const limit = state.depth > 410 ? 60 : 160;
        const brake = state.speed > limit + (up ? -30 : 20);
        await controls(brake, !brake);
      }
      await page.clock.runFor(100);
      state = await read(); maxDrill = Math.max(maxDrill, state.drill);
    }
    await controls(false,false); await page.mouse.up();
    if (state.core !== 4 || !state.ship) throw Error(`Core not recovered: ${JSON.stringify({state,maxDrill})}`);
    const core = state;
    await page.screenshot({path:'output/playwright/controlled-core-recovered.png'});
    await controls(true,false);
    for (let elapsed=0; elapsed<30000 && state.depth>0; elapsed+=100) {
      await page.clock.runFor(100); state=await read();
      if (state.fuel<=0 || state.hull<=0) throw Error(`Return failed: ${JSON.stringify(state)}`);
    }
    await controls(false,false);
    for (let elapsed=0; elapsed<5000 && !state.docked; elapsed+=100) {
      await page.clock.runFor(100); state=await read();
    }
    if (!state.docked || state.depth || state.overlaps || state.core!==4) throw Error(`Return did not dock: ${JSON.stringify(state)}`);
    await page.keyboard.press('e'); await page.clock.runFor(1500);
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
    if (save.coreFuel!==4 || !save.milestones.includes('core-cryo')) throw Error('Earned core did not persist');
    await page.screenshot({path:'output/playwright/controlled-core-return.png'});
    if (errors.length) throw Error(errors.join('\n'));
    return {seed:initial.seed,core,home:state,maxDrill,errors};
  } finally {
    await controls(false,false); await page.mouse.up(); await page.clock.resume();
  }
}
