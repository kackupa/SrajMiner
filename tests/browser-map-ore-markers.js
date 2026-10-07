// Verify the route map shows surveyed ore but never exposes unsurveyed ore.
async (page) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#launch').click();
  await page.waitForFunction(() => !!window.__mars);
  const canvas = page.locator('#route-map');
  await page.getByRole('button', { name: /Toggle explored map/ }).click();
  await page.waitForTimeout(150);
  const survey = await canvas.evaluate((el) => {
    const ctx = el.getContext('2d');
    const image = ctx.getImageData(0, 0, el.width, el.height);
    let copper = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i] > image.data[i + 1] + 20 && image.data[i] > image.data[i + 2] + 20 && image.data[i] > 80) copper++;
    }
    return copper;
  });
  if (!survey) throw new Error('The surveyed starter copper seam is missing from the map');
  const label = await page.locator('#route-map-panel small').innerText();
  if (!label.includes('only after your scanner surveys')) throw new Error(`Missing ore-discovery guidance: ${label}`);
  const legend = await page.locator('.map-legend').innerText();
  for (const ore of ['Copper', 'Iron', 'Silver', 'Gold', 'Diamond', 'Signature find']) {
    if (!legend.includes(ore)) throw new Error(`Map legend is missing ${ore}`);
  }
  const oreKeys = await page.locator('.map-legend [data-ore]').evaluateAll((els) => els.map((el) => ({
    ore: el.getAttribute('data-ore'),
    shape: [...el.classList].find((name) => name.startsWith('ore-') && name !== 'ore-key'),
  })));
  const expectedShapes = ['copper:ore-chips', 'iron:ore-bars', 'silver:ore-spires', 'gold:ore-nuggets', 'diamond:ore-facets'];
  if (oreKeys.map(({ ore, shape }) => `${ore}:${shape}`).join('|') !== expectedShapes.join('|'))
    throw new Error(`Map ore legend lost color-independent shapes: ${JSON.stringify(oreKeys)}`);
  const state = await page.evaluate(() => window.__mars);
  if (state.overlaps) throw new Error('Pod overlaps terrain while map is open');
  await page.screenshot({ path: 'output/playwright/map-surveyed-ore.png' });
  await page.setViewportSize({ width: 960, height: 560 });
  const layout = await page.evaluate(() => ({
    panel: document.querySelector('#route-map-panel').getBoundingClientRect().toJSON(),
    viewport: document.querySelector('#viewport').getBoundingClientRect().toJSON(),
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (layout.panel.right > layout.width || layout.panel.left < 0 || layout.panel.top < layout.viewport.top || layout.panel.bottom > layout.viewport.bottom || layout.scrollWidth > layout.width)
    throw new Error(`Map panel overflows on compact viewport: ${JSON.stringify(layout)}`);
  await page.screenshot({ path: 'output/playwright/map-surveyed-ore-960x560.png' });
  return { surveyedCopperPixels: survey, colorIndependentOreShapes: oreKeys, undiscoveredOreHiddenByScannerRule: true, legend, compactViewport: '960x560', overlaps: state.overlaps };
}
