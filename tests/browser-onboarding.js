// Run via Playwright CLI in a dedicated development-browser session. Does not alter saves.
async (page) => {
  const baseURL = new URL(page.url()).origin;
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__mars);
  const briefing = await page.locator('.modal.intro').innerText();
  for (const cue of ['STEER', 'DESCEND / DRILL', 'THRUST UP', 'SELL AT SURFACE', 'EXPLORED MAP', 'PAUSE', 'ORE FILLS CARGO', 'RETURN-FUEL ESTIMATE']) {
    if (!briefing.includes(cue)) throw Error(`Missing first-run instruction: ${cue}`);
  }

  for (const viewport of [{ width: 1440, height: 960 }, { width: 960, height: 720 }, { width: 960, height: 560 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#launch').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const modal = document.querySelector('.modal.intro').getBoundingClientRect();
      const controls = document.querySelector('.intro-controls').getBoundingClientRect();
      const launch = document.querySelector('#launch').getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        modal: { top: modal.top, bottom: modal.bottom, left: modal.left, right: modal.right },
        controls: { top: controls.top, bottom: controls.bottom },
        launch: { top: launch.top, bottom: launch.bottom },
      };
    });
    if (layout.modal.left < 0 || layout.modal.right > viewport.width || layout.modal.bottom > viewport.height)
      throw Error(`Briefing escapes the viewport at ${viewport.width}x${viewport.height}`);
    if (layout.launch.top < layout.modal.top || layout.launch.bottom > layout.modal.bottom)
      throw Error('Begin/continue action is outside the briefing panel');
    await page.screenshot({ path: `output/playwright/onboarding-${viewport.width}x${viewport.height}.png` });
  }
  return { controls: briefing.match(/STEER|DESCEND \/ DRILL|THRUST UP|SELL AT SURFACE|EXPLORED MAP|PAUSE/g), viewports: 3 };
}
