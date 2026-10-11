// Playwright CLI run-code; start in a funded habitat placement in an isolated save.
async page => {
  const box = await page.locator('#game').boundingBox();
  const state = () => page.evaluate(() => ({ x: window.__mars.x, y: window.__mars.y,
    camera: window.__mars.placementCamera, placement: window.__mars.placement,
    cargo: window.__mars.cargo, structures: window.__mars.structures }));
  const initial = await state();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await page.waitForFunction(x => window.__mars.placementCamera.x > x + 900, initial.camera.x);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scrolled = await state();
  if (scrolled.x !== initial.x || scrolled.y !== initial.y) throw Error('Panning moved the miner');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  const dragged = await state();
  if (!dragged.placement || dragged.structures.length !== initial.structures.length || JSON.stringify(dragged.cargo) !== JSON.stringify(initial.cargo))
    throw Error('Dragging placed or purchased a building');
  if (dragged.camera.x < scrolled.camera.x + 150) throw Error('Drag did not pan');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(600);
  const preview = await state();
  if (!preview.placement.valid) throw Error('Expected clear remote site');
  await page.screenshot({ path: 'output/playwright/placement-pan-preview.png' });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  const built = await state();
  if (built.placement || built.camera || built.structures.length !== initial.structures.length + 1) throw Error('Placement did not complete/reset camera');
  const structure = built.structures.at(-1);
  if (structure.x < initial.x + 900 || structure.x !== preview.placement.x) throw Error('Built at the wrong remote site');
  if (initial.cargo.copper - built.cargo.copper !== 6 || initial.cargo.iron - built.cargo.iron !== 4) throw Error('Wrong or duplicate cost');
  await page.reload(); await page.locator('#launch').click();
  const restored = await state();
  if (!restored.structures.some(s => s.id === structure.id) || JSON.stringify(restored.cargo) !== JSON.stringify(built.cargo)) throw Error('Remote build did not persist');
  await page.keyboard.press('b'); await page.locator('#build-habitat').click();
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  const cancelled = await state();
  if (cancelled.placement || cancelled.camera || JSON.stringify(cancelled.cargo) !== JSON.stringify(restored.cargo)) throw Error('Cancel failed');
  return { initial, scrolled, dragged, structure, saved: true, cancelledWithoutCost: true };
}
