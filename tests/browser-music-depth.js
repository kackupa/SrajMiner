// Run with Playwright CLI against a local dev URL. Uses a disposable context.
async (sourcePage) => {
  const target = new URL(sourcePage.url());
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname))
    throw Error(`Music QA must target a local game server, got ${target.origin}`);
  const browser = sourcePage.context().browser();
  if (!browser) throw Error('Music QA requires an isolated browser context');
  let context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await context.newPage();
  const errors = [];
  let stage = 'open';
  page.on('pageerror', error => errors.push(error.message));
  const state = () => page.evaluate(() => window.__mars.audio);
  const begin = async () => {
    await page.waitForFunction(() => !!window.__mars);
    await page.getByRole('button', { name: /BEGIN EXPEDITION|CONTINUE EXPEDITION/ }).click();
  };
  const saveAt = async (depth) => {
    const row = Math.ceil(depth / 12) + 3;
    const destroyed = [];
    for (let y = 0; y <= row; y++)
      for (let x = 22; x <= 26; x++) destroyed.push(`${x},${y}`);
    const seed = 78423;
    const data = {
      version: 10, campaignSeed: seed, activeMap: 'cryo-shelf',
      maps: { 'cryo-shelf': { seed, x: 980, y: depth / 12 * 40,
        maxDepth: depth, destroyed, discovered: destroyed, drops: [], activeCharge: null } },
      money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
      fuel: 140, hull: 100, cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
      maxDepth: depth, artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
      ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
      ownedSuits: ['hab'], selectedSuit: 'hab', ownedDecals: ['standard'], selectedDecal: 'standard',
      ownedProfiles: ['standard'], selectedProfile: 'standard',
    };
    await context.close();
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), data);
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(target.origin);
    await begin();
  };
  try {
    await page.goto(target.origin);
    await page.waitForFunction(() => !!window.__mars);
    await page.evaluate(() => localStorage.removeItem('mars-miner.v1'));
    await page.reload();
    stage = 'surface begin';
    await begin();
    stage = 'surface playback';
    await page.waitForFunction(() => window.__mars.audio.soundtrack?.signal.readyState >= 2 &&
      window.__mars.audio.soundtrack.signal.time > 0.1);
    const surface = await state();
    if (surface.phase !== 'signal' || surface.soundtrack.signal.paused)
      throw Error(`Signal Run did not start: ${JSON.stringify(surface)}`);
    stage = 'pause';
    await page.locator('#pause').click();
    await page.waitForFunction(() => window.__mars.audio.soundtrack?.signal.paused);
    const paused = await state();
    stage = 'resume';
    await page.getByRole('button', { name: /Resume expedition/i }).click();
    await page.waitForFunction(() => !window.__mars.audio.soundtrack?.signal.paused);
    stage = 'mute';
    await page.locator('#audio').click();
    await page.waitForFunction(() => window.__mars.audio.muted);
    const muted = await state();
    stage = 'unmute';
    await page.locator('#audio').click();
    await page.waitForFunction(() => !window.__mars.audio.muted);
    stage = 'mid-depth load';
    await saveAt(700);
    stage = 'mid-depth playback';
    await page.waitForFunction(() => window.__mars.audio.soundtrack?.transition.readyState >= 2 &&
      window.__mars.audio.soundtrack.transition.time > 0.1, null, { timeout: 5000 });
    const transition = await state();
    if (transition.phase !== 'transition' || transition.soundtrack.transition.paused)
      throw Error(`Descent transition did not start from mid-depth save: ${JSON.stringify(transition)}`);
    stage = 'transition completion';
    await page.waitForFunction(() => window.__mars.audio.phase === 'deep' &&
      window.__mars.audio.soundtrack?.deep.time > 0.1, null, { timeout: 75000 });
    const completed = await state();
    stage = 'deep load';
    await saveAt(1450);
    stage = 'deep playback';
    await page.waitForFunction(() => window.__mars.audio.soundtrack?.deep.readyState >= 2 &&
      window.__mars.audio.soundtrack.deep.time > 0.1);
    const deep = await state();
    if (deep.phase !== 'deep' || deep.soundtrack.deep.paused)
      throw Error(`Deep Pressure did not start from deep save: ${JSON.stringify(deep)}`);
    if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
    await page.screenshot({ path: 'output/playwright/music-depth-deep.png' });
    return { surface: surface.phase, paused: paused.soundtrack.signal.paused,
      muted: muted.muted, transition: transition.phase, completed: completed.phase, deep: deep.phase,
      readyStates: [surface.soundtrack.signal.readyState, transition.soundtrack.transition.readyState,
        deep.soundtrack.deep.readyState], errors };
  } catch (error) {
    throw Error(`${stage}: ${error.message}; game=${JSON.stringify(await page.evaluate(() => ({ depth: window.__mars.depth, x: window.__mars.x, y: window.__mars.y, audio: window.__mars.audio })).catch(() => null))}`);
  } finally {
    await context.close();
  }
}
