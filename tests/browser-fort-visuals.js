// Run after browser-fort.js in the isolated browser. Reviews planet and gravity variants.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  const source = await page.evaluate(() => JSON.parse(localStorage.getItem('mars-miner.v1')));
  const results = [];
  for (const mapId of ['cryo-shelf', 'mars-frontier', 'hull-graveyard', 'prism-fault', 'cinder-vale', 'vesper-9']) {
    const far = mapId !== 'cryo-shelf';
    const map = structuredClone(source.maps['cryo-shelf']);
    const surfaceY = far ? map.planetChart.radiusRows * 80 : 0;
    map.x = 2400; map.y = surfaceY + (far ? 22 : -22);
    map.structures = [
      { id: 'fort:2400', kind: 'fort', x: 2400, y: surfaceY, integrity: 4 },
      { id: 'wall:2240', kind: 'wall', x: 2240, y: surfaceY, integrity: 2 },
      { id: 'wall:2200', kind: 'wall', x: 2200, y: surfaceY, integrity: 2 },
      { id: 'turret:2640', kind: 'turret', x: 2640, y: surfaceY, integrity: 2, level: 3 },
    ];
    const fixture = { ...source, activeMap: mapId, maps: { [mapId]: map } };
    await page.goto('about:blank'); await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__mars);
    await page.evaluate(data => localStorage.setItem('mars-miner.v1', JSON.stringify(data)), fixture);
    await page.reload(); await page.setViewportSize({ width: mapId === 'cryo-shelf' ? 800 : 1280, height: mapId === 'cryo-shelf' ? 600 : 800 });
    await page.getByRole('button', { name: /CONTINUE EXPEDITION/ }).click();
    await page.waitForFunction(() => window.__mars?.docked && document.querySelector('#colony-alert')?.textContent?.includes('NEXT RAID'));
    const state = await page.evaluate(() => ({ mapId: window.__mars.mapId, far: window.__mars.farHemisphere, hull: window.__mars.hull, overlaps: window.__mars.overlaps }));
    if (state.mapId !== mapId || state.far !== far || state.hull !== 100 || state.overlaps !== 0) throw Error(`Bad fort gravity restore: ${JSON.stringify(state)}`);
    const visibleAlert = await page.locator('#colony-alert').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const dock = document.querySelector('#station-dock');
      const box = dock.getBoundingClientRect();
      const dockShown = getComputedStyle(dock).display !== 'none' && getComputedStyle(dock).visibility !== 'hidden';
      const covered = dockShown && box.width > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
      return rect.width > 0 && rect.bottom < innerHeight && getComputedStyle(el).visibility === 'visible' && !covered;
    });
    if (!visibleAlert) throw Error('Raid countdown is hidden or covered');
    await page.screenshot({ path: `output/playwright/fort-theme-${mapId}.png` });
    await page.keyboard.down('d');
    try { await page.waitForFunction(() => Math.abs(window.__mars.x - 2400) > 160, null, { timeout: 7000 }); }
    finally { await page.keyboard.up('d'); }
    if ((await page.evaluate(() => window.__mars)).overlaps) throw Error('Fort/wall traversal caused collision overlap');
    results.push(state);
  }
  return results;
}
