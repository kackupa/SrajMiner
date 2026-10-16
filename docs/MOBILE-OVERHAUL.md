# Mobile overhaul delivery checklist

Goal: complete all seven items in the mobile plan, including real-device verification. Do not mark complete from emulation alone.

## Current acceptance status

| Area | Current evidence | Status |
| --- | --- | --- |
| Touch controls | Multitouch, slide, independent release, cancellation, rotation and blur regression passes | Browser verified; physical thumb comfort pending |
| Full-screen menus | 21 screen/size combinations, no horizontal overflow, large targets | Browser verified; software keyboard/safe areas pending |
| Ore management | Full holds, discard cancellation, transfers, failed-save rollback and exact reload | Browser verified |
| Learning/progression | Context prompts and a complete earned camp → uplink → sale → upgrade → reload run | Browser verified; human clarity pending |
| Lifecycle | Input clears and game pauses on interruption; menu selections survive rotation | Browser verified; actual app switching/locking pending |
| Rendering/performance | Original art; projection/triangulation optimizations; throttled samples vary around50–67ms median | Not a sustained-device performance pass |
| Device acceptance | Android testing offered by user; no results received. No physical iPhone result | Outstanding |

Latest: all176 system tests, supplementary suites, production build and touch input regression pass. The full earned campaign now runs in one isolated harness. Latest stress rerun was66.6ms median/p95133.3ms, so do not present the earlier50ms sample as a guaranteed result or claim the touch DOM change improved speed. Tests below are historical records; this table summarizes the current acceptance gates.

## Implemented in first pass (2026-10-16)
- Larger directional pads; pointer movement can change direction within a pad while held.
- Primary context action and expandable equipment tray; removed broken Services DOM click in favour of direct game action.
- Phone ore list expands one selected ore, shows large actions, half-unit/1/5 presets, and explicit Discard from miner label. Existing Store all/Take all remain max actions.
- Landscape objective moved below status after screenshot revealed overlap.
- Existing blur/visibility pause, save and touch cancellation inspected in source.

## Verified
- npm install, 175 system tests + supplementary suites, build (existing bundle advisory).
- Playwright CLI session `mobilegoal`, Pixel 7 emulation, local Vite http://127.0.0.1:5174/.
- Real CDP touch drill to 48m with copper3/iron1, released touches left zero held controls.
- Touch upward return, Open ship, Warehouse, expand copper, preset0.5; one expanded row, no page-width overflow at390x844.
- Screenshots output/playwright/mobile-goal-{portrait,landscape}.png and mobile-storage-expanded.png. Landscape screenshot predates objective offset correction.

## Remaining (not complete)
- Verify drag-between-directions, simultaneous touches and independent release, pointercancel, rotation, blur/visibility pause and resume.
- Review menu navigation and page fitting across320/390/844 widths and short landscape; improve expanded cargo panel if actions are below fold. Ensure pagination updates when expanding rows (ResizeObserver currently watches camp-content).
- Test transfers preserve expanded row, amount, focus and position after render; add clear full-capacity guidance and ensure Max actions intuitive.
- Progressive first-expedition prompts and contextual next action beyond ship access; teach construction uses carried ore and remove completed guidance.
- Performance profile/tune effects and sustained-frame timing; verify lifecycle interruptions and orientations don't lose UI state.
- Full touch-only opening loop: earned camp materials, camp placement, recharge, uplink materials/placement, sale, upgrade, reload. Existing tests/browser-mobile.js is stale and uses a seeded market; do not count it as full earned loop.
- Full cargo/storage and discard regression, input edge cases, visual menu checks. Save compatibility, fast collisions, return and no duplicated ore remain blocking invariants.
- Physical iPhone Safari and Android Chrome tests required; no device connected/verified yet. Need actual user/device access evidence, not inferred success.

No backend, physics, balance or save schema changes. Discard remains miner-only, explicitly labelled. This file records progress and is not completion evidence for unchecked work.

## Second pass — 2026-10-16

Implemented priority guidance for cargo-full return, low battery, surface recharge and making space for building materials. First-camp affordability promotes Build camp to the main touch action row. Mobile warnings refer to ↑ rather than W. Hub copy advances after camp construction. Phone trading now uses a customer selector, collapsible building reserves, hides wholly empty inventory rows, and includes Max shipment buttons.

Verified `tests/browser-mobile-input.js`: actual CDP multitouch, slide direction, independent contact release, touch cancellation, rotation clearing, blur pausing. Initial independent-release harness used the remaining rather than released contact in CDP touchEnd; corrected harness passed. Tests and production build passed again.

Earned opening loop: fresh game, no resource injection. Four touch-controlled sorties collected camp and uplink ore; placed habitat at940 and trade-post at1220, recharged to140 free, sold ore, bought drill level2, reloaded with $780, both structures and empty cargo unchanged. Camp/uplink sorties returned at100% hull and zero overlap. Later sale-funding descent stalled in a background harness; after explicit browser focus and pause/resume, an unbraked descent reached299m with54.8% hull. Returned successfully and sold that haul. This is a functional progression pass, not a damage-free ease-of-play claim. Sale quantities used browser field fill (not a physical phone keyboard); gameplay used touch events, no WASD. Test `tests/browser-mobile-earned.js` covers the first two sorties; subsequent steps were run interactively. Screenshots: mobile-earned-camp-ready.png, mobile-earned-upgrade.png.

Mobile trade fixture in separate browser context: Max selected3 copper and quoted$72; customer switched toKepler. Screenshots mobile-trade-empty.png/mobile-trade-max.png. Real device checks, thermal testing, remaining menu layout sweep and full-inventory mobile regression are still pending. Do not mark goal complete.

Desktop-hosted Pixel 7 emulation frame-pacing sample: 601 animation frames over10s, median16.7ms, p9516.9ms, zero intervals above50ms, at the landed gameplay view. This is not a mobile hardware, mining stress or thermal result.

## Third pass — 2026-10-16

Full-inventory mobile regression `tests/browser-mobile-storage.js` passes discard cancellation/confirmation, exact transfer totals, expanded-row and amount retention through rotation, and reload with no duplicated ore. Sizes320×740,390×844,844×390; no page-width overflow or page errors. Native confirmation is stubbed for deterministic branching in this test.

Menu sweep `tests/browser-mobile-menus.js` covers hub, storage, construction, service, workshop, selling and optional tools at all three sizes. It found undersized paging buttons and preserved scroll position incorrectly carried between screens. Fixed44px paging,56px footer, compact landscape service selector, and focus without scrolling. All21 screen/size combinations now start at page1, have no page-width overflow and no rendered input/button/select below43px tall. Screenshot review led to compact service cards and a mobile component selector. Service fits a single page at320px. All7 miner components were selected successfully.

Local implementation and emulated opening progression are verified to the scope above. The outstanding acceptance gate is real iPhone Safari/Android Chrome interaction, keyboard/safe-area behaviour, sustained mining performance/thermal testing and human comfort. `MOBILE-DEVICE-TEST.md` contains the concrete run sheet. No device result has been supplied yet. Do not claim full completion.

## Additional compatibility and failure testing — 2026-10-16

`tests/browser-mobile-save-failure.js` injects QuotaExceededError only for campaign writes in an isolated fixture. Store/withdraw/discard restored exact inventories, but HUD overwrote transaction errors with a misleading capacity message. Fixed HUD to preserve save-failure feedback. Retest passed all three errors, storage restoration, one successful discard retry and exact reload totals.

Installed matching Playwright WebKit2368. `tests/browser-webkit-mobile.js` exposed missing AudioContext in Windows WebKit; audio unlock now supports the prefixed constructor and degrades safely when browser audio is unavailable. Added unavailable-audio regression. WebKit retest mined3 copper/2 iron to47m, returned at100% hull, stored0.5 copper, rotated, reloaded identical inventory and zero overlaps with zero page errors. Held controls used browser mouse pointer events on the phone control DOM; taps used touchscreen emulation. This is not physical iOS certification. Screenshot artifacts webkit-mobile-storage.png/webkit-mobile-service.png.

`tests/browser-mobile-performance.js` revealed an unresolved performance gap under4× Chromium CPU throttling:178 sampled frames, median100ms, p95166.6ms,167 frames above50ms. Mining and return retained100% hull/zero overlaps, but this frame pacing is not acceptable evidence of smooth phone play. A5-second CPU profile attributes most samples to GraphicsWebGLRenderer(519), triangulation sortLinked(205), batchFillPath(187), isEarHashed(164), earcutLinked(145), worldPointToLocal(134), scene draw(117), earcut(112), geology(71). Next step: reduce repeated polygon triangulation/render work while preserving ore readability and visuals; rerun the same throttled test. Do not mark performance complete from the earlier idle60fps sample.

All176 system tests plus supplementary suites and production build pass after audio fix. CSS cleanup and a unified full earned-campaign harness remain useful follow-through; full objective remains active with performance work and real-device checks outstanding.

## Rendering performance follow-up — 2026-10-16

Reduced circle tessellation to a radius-dependent segment count, used direct triangles for small convex filled polygons, culled offscreen terrain before detail generation, and cached static sky artwork per map/viewport. Portrait screenshot mobile-render-cached-sky.png inspected: sky, miner, terrain and touch controls render correctly. Same 4x CPU-throttled mining/return harness now reports 191 frames, median66.6ms, p95116.7ms and111 intervals above50ms, with100% hull,3 copper/2 iron andzero overlaps. Baseline median100ms/p95166.6ms; improvement is measurable but still not smooth-phone acceptance. Production build and all176 system tests plus supplementary suites pass. Physical Android performance and comfort remain pending.

The post-render-change WebKit rerun timed out waiting for a gameplay condition (20s). Its earlier compatibility pass predates these rendering edits; the new timeout needs diagnosis before claiming current WebKit progression passes.

## Current rendering verification — 2026-10-16

Removed the experimental sky RenderTexture cache: its measured improvement was negligible. Kept offscreen culling, radius-dependent circle tessellation and convex polygon triangles. Geology now reuses the cell corners already projected by the scene. Latest throttled sample:185 frames, median66.6ms/p95100ms,113 intervals over50ms,100% hull andzero overlaps. This remains too slow to claim smooth phone performance; host load also affects comparisons.

WebKit harness now uses a fresh context and explicit portrait viewport, avoiding accumulated session state. Mining/return/storage/rotation/reload passes repeatedly with exact ore totals andzero page errors. However, visual inspection of webkit-mobile-mining.png shows a blank game canvas despite the working HUD and simulation. Replacing RenderGraphics with stock Phaser Graphics reproduced the blank canvas; restored the optimized renderer afterward. A standalone WebGL red-canvas probe renders correctly. Thus WebKit game rendering remains unresolved, and the state-only pass is NOT visual acceptance. Current Chromium screenshot mobile-render-current.png provides separate rendering evidence. All176 system tests, supplementary suites and production build passed during this follow-up; no schema or gameplay balance changes.

## Camera projection and WebKit readback — 2026-10-16

Latest CPU profile moved the bottleneck from triangulation to repeated camera calculations. Cached camera focus/rotation within each scene draw, retaining identical world projection and gameplay rules. Convex polygons up to128 points now take the direct triangle path, including tessellated circles. Throttled mining/return:189 frames, median50ms, p95100.3ms,77 intervals over50ms;100% hull,3 copper/2 iron,zero overlaps. Performance is improved but not yet smooth-device acceptance. All176 system tests, supplementary suites and production build pass.

WebKit diagnosis: the actual game drawing buffer has hundreds of distinct opaque colours while ordinary page screenshots omit the canvas. Stock Phaser Graphics shows the same issue; explicit canvas compositing and preserveDrawingBuffer (test interception only) did not resolve the screenshot. The WebKit harness now checks actual drawing-buffer pixels and exports them separately as webkit-mobile-buffer.png;658 sampled colours in the latest run, with ore, terrain and miner visibly present. Mining/return/storage/rotation/reload pass with exact saved totals andzero page errors. This narrows the issue to presentation/capture rather than missing game drawing commands, but does not prove physical Safari composition is correct. No renderer fallback or browser-specific production workaround added without device evidence.

## Complete earned mobile progression — 2026-10-16

Expanded tests/browser-mobile-earned.js from two shafts to the complete fresh-campaign sequence in an isolated browser context: earn6 copper/4 iron, build camp at940, recharge free, earn uplink materials, build uplink at1220, mine a further silver haul, use Max shipment actions, sell, buy drill level2, reload. Gameplay uses CDP touch only; no resources/credits/buildings injected. Native selects use Playwright selection. A first unbraked run lost16 hull through a natural gap; the final harness applies taught thrust braking with a second contact, using read-only descent diagnostics to time pulses. It is a controlled regression, not evidence of human comfort or reflexes.

Final run:100% hull andzero overlaps at every checkpoint; sold2 copper/3 iron/2 silver for242 credits; bought140-credit drill; reloaded with102 credits,drill2,empty cargo andboth structures unchanged. Zero page errors. Screenshot mobile-earned-complete.png visually inspected. TouchControls now avoids repeated unchanged label/hidden writes each frame. Full physical-phone interaction and sustained performance remain outstanding.
