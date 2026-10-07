// Run on a dedicated development origin with a synthetic campaign save.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.addInitScript(() => {
    window.__cueSchedule = [];
    const schedule = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (value, time) {
      window.__cueSchedule.push({ value, time });
      return schedule.call(this, value, time);
    };
  });
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const seed = 78234;
  const save = {
    version: 10,
    campaignSeed: seed,
    activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': { seed, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 80,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 },
    fuel: 140,
    hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 },
    maxDepth: 0,
    artifact: false,
    milestones: [],
    shipComponents: [],
    routeFragments: [],
    charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false,
    ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard',
    ownedProfiles: ['standard'], selectedProfile: 'standard',
  };
  await page.evaluate((data) => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), save);
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__mars?.routeFragments.includes('fragment-1'), {}, { timeout: 90000 });
  } finally {
    await page.keyboard.up('s');
  }
  const schedule = await page.evaluate(() => window.__cueSchedule);
  const expected = [220, 329.63, 440, 659.25];
  const found = schedule.filter((event) => expected.includes(event.value));
  if (found.length !== expected.length || found.some((event, index) => event.value !== expected[index]))
    throw Error(`Route cue did not schedule the expected four notes: ${JSON.stringify(found)}`);
  const beatSpacing = found.slice(1).map((event, index) => +(event.time - found[index].time).toFixed(3));
  if (beatSpacing.some((spacing) => Math.abs(spacing - 0.25) > 0.015))
    throw Error(`Route cue drifted off the score beat grid: ${JSON.stringify(beatSpacing)}`);
  await page.screenshot({ path: 'output/playwright/landmark-music-route-signal.png' });
  return { fragment: 'fragment-1', notesHz: found.map((event) => event.value), beatSpacing };
}
