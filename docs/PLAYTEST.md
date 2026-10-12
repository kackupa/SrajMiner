# 15-minute campaign playtest

## Earned opening progression and shipment entry — 2026-10-12

A fresh campaign with controlled browser frame timing recovered the Cryo core and returned at 100% hull, then mined additional materials to build a camp and Market uplink for the exact combined cost of 10 copper, 8 iron and 2 silver. Earned sales yielded $251.50; the first drill upgrade cost $140 and left $111.50. Reload preserved the upgrade, both buildings and four ship-fuel units. No resources or excavation were granted. The continuation checkpoint is `output/playwright/earned-first-upgrade-storage.json`.

Fixed shipment quantity editing replacing the form on blur and losing a subsequent edit. Chromium verified decimal typing, retained focus/selection, an exact $27.50 half-unit sale and reload. Raids damaged the starter camp and destroyed it during a separate unpaused test delay; early defense affordability still needs player review. A real-time aim-through-core run recovered the relic but failed its W-only return after crossing the center. Controlled timing proves a viable route, not comfortable real-time play or completion of all six worlds. See QA.md.

## Fresh Cryo core and return — 2026-10-12

Descent-warning follow-up: real-time Chromium verified the warning during a 138.46 px/s fall, its removal after braking to -72.51 px/s, and a short surface return with 100% hull, 135.84 battery and zero overlaps. Full-depth retests reached 446 m with full hull but could not sustain core mouse targeting while hovering and ran out of battery; repeatable core extraction/return remains open.

A fresh $0 expedition recovered its first core through actual drilling and mouse aiming, then returned and docked with 65.41 battery, 55.51% hull and four ship-fuel units. Reload retained the core, cargo and excavation. No funded inventory or prepared shaft was used. A later repeat crossed the center and exhausted its battery against rock on return, so repeatable return navigation remains open. Investigation also corrected reversed and mis-scaled HUD descent speed; the corrected browser descent reached 387 m at full hull, but its hover/return retest is unfinished. Fixed a sub-pixel core-targeting defect and canvas/input alignment after the full-screen intro. See QA.md for measured runs and failed attempts. The earned six-world campaign and player assessment of damage/braking remain open.

## Automated mining and persistence — 2026-10-12

Chromium passed a funded Cryo → Mars → Cryo trip with extractor construction, two ore produced during a simulated hour, Industrial Drill purchase and unchanged stock/tier after reload. Fixed the upgrade UI showing the wrong tier's cost and materials. Separate browser checks passed full-store pause, withdrawal/reload without extra ore, the 12-hour offline cap, and v28 → v30 migration preserving stock and excavation. See QA.md for measured costs and quantities. This does not close the fresh earned-resource campaign or human balance checks.

## Placement camera check — 2026-10-11

- Desktop Chromium: edge-scrolled the placement camera from x=680 to x=1601, then dragged another 220 world units. The miner remained at (680, -22), with unchanged cargo and no structure created during the drag.
- Clicked the previewed habitat site at x=1820, beyond the original viewport. Exactly 6 copper and 4 iron were deducted once; the remote camp and remaining materials survived reload. Cancelling a second panned placement cost nothing and reset the placement camera.
- Pixel 7 touch emulation at 844×390: dragging advanced the camera without building. Tapping a site followed by PLACE built the habitat at x=980 and charged exactly one construction cost. Movement pads are hidden during placement to leave the map available for dragging.
- Screenshots: `output/playwright/placement-pan-preview.png` and `output/playwright/placement-touch-preview.png`. Repeatable desktop regression: `tests/browser-placement-pan.js` (start with a funded habitat preview in an isolated save).
- Real mobile hardware and a complete circumnavigation during placement remain untested.
- `npm install` completed. The system suite passed the placement, collision and return checks, then stopped at the unrelated `geodes should remain a special find` assertion (`tests/systems.test.ts:2073`). This placement change does not modify geology or its balance data.

## Mobile implementation check — 2026-10-11

- Chromium with Pixel 7 touch emulation: landscape 844×390 and portrait 390×844 fit without horizontal document overflow. Screenshots are in ignored `output/playwright/mobile-*.png`.
- Real emulated touch contacts drilled seven cells, collected 3 copper and 3 iron, and returned to the mothership with 100 hull and no overlap. Simultaneous thrust/drill contacts registered independently; cancelling cleared both.
- Board opened the full-screen warehouse. A prebuilt Market uplink fixture enabled transaction testing without grinding the camp prerequisite. The genuine mined haul sold for 156 credits across two shipments. Reload preserved credits, empty cargo and all seven destroyed cells.
- Rotation cleared held input. Pause hid the touch controls. A browser blur event paused the expedition and cleared held input; Resume restored controls.
- Desktop Chromium at 1440×900 kept touch controls hidden; keyboard descent/mining and upward return passed with zero overlaps. The touch-specific How to play page also rendered without portrait overflow.
- An initial test used an ambiguous CDP partial touch release and timed out during return. The corrected test explicitly cancels contacts before starting a new thrust gesture. Shipment fields require blur to commit their quantities before checkout.
- `npm install` succeeded. Production build passed with the existing large-bundle warning. `npm test` stopped at the ore-generation test expecting five types but finding eight (`tests/systems.test.ts:2010`); mobile changes do not alter geology. Atmosphere, solar and expedition suites passed separately.
- Not tested on physical iPhone/Android devices. Safari behavior, browser-bar/notch behavior on hardware, sustained performance, advanced equipment, all building-placement flows and extended interplanetary play remain unverified.

Use this with the campaign already in your browser. Keep your current save; do not start a new expedition just for the test. Play normally for about 15 minutes and note anything that interrupts the mining loop. Rough estimates are useful: there is no need to measure with a stopwatch or open developer tools.

## During play

At each return to the mothership, jot down the trip length, deepest depth, cargo near return, battery charge and hull on landing, and whether you chose to return or were forced to. If you lose cargo or recover the pod, note what led to it and whether the warning gave you a fair chance to react.

Notice when a valuable vein or regional find appears: did you recognize what it was, understand its extra value, and feel glad you found it? If you use a charge or the salvage magnet, note whether it saved time or ore and whether the cost, fuse, and pickup behavior felt fair. Visit another region only if travel is already available; do not grind solely to reach it for this test.

Listen with your usual volume and equipment. Note whether drilling and movement make a coherent groove, whether effects mask the music or vice versa, and whether anything becomes repetitive or irritating. Check whether the pod's equipped cosmetic is visible during ordinary play and whether the map helps you choose a route.

If you have the Laser Miner, hold the drill through a few blocks, then release it to cool. Notice whether the heat meter is easy to spot, the vent pause feels fair, and the cut resumes cleanly afterward.

If convenient, try a different pilot path while docked. Note whether its benefit is clear, whether it changes the next trip's decisions, and whether the workshop explains any cargo restriction before you select it.

If you reach the core, note whether you can coast through in both directions, understand when gravity has reversed, and return to the mothership after crossing. The automated round-trip uses a prepared shaft; your normal route will also tell us how the drilling and battery use feel.

Check three grapple situations without changing your save: drop onto a safe ledge, fall through a long open shaft with a reachable anchor, then approach a hard floor fast enough to risk impact. The hook should stay off for the first two and catch before the damaging impact in the third, leaving time to brake. If an obstructed anchor is nearby, note whether it is ignored. The hook is a paid upgrade, so install it only if you already own it or want to spend the credits.

## Share these notes

Copy this small form into chat and fill only what you noticed:

```text
Time played / region(s):
Trips (approximate):
Deepest depth / best haul:
Battery charge and hull on landing:
Returned by choice, or forced back? Why?
Any damage, lost cargo, or confusing warning?
Most exciting find or moment:
Most frustrating or slow moment:
Charge / magnet feel (if used):
Laser Miner heat / vent feel (if installed):
Map, ore markers, and cosmetics:
Pilot path used; did it change your route or haul?
Music/effects: too quiet, balanced, or too loud? Repetitive?
Landing-gated grapple (only if installed): safe ledge / open shaft / hard impact results; enough time to brake?
One change that would make another trip more fun:
Anything else:
```

The most useful balance evidence is a few ordinary trips and the reason behind one early return, one greedy extra descent, or one recovery. Do not change economy or damage numbers from a single unusually lucky or unlucky run; compare the notes with the existing automated campaign runs first.

## 2026-10-11 — Mothership-first start

Fresh campaigns land and deploy before play, with no automatic camp buildings or invisible town platforms. Browser-verified a real 47 m mining descent and safe return to the mothership. Verified boarding, the 24-unit starter hold, selective storage and withdrawal, sale of carried surplus without touching stored copper, and a zero-core-fuel takeoff attempt remaining grounded. A warehouse purchase consumed iron/silver and persisted alongside stored ore through reload. Separate funded fixtures placed a habitat and trading post and verified their exact combined $2,000 and ore costs. No browser page errors in the storage/build test. Screenshots are under `output/playwright/mothership-*.png`.

`npm install`, 173 system tests, atmosphere tests and solar-route tests passed. Production build passed with the existing bundle-size advisory. Fixtures funded construction to avoid a long grind; a full earn-every-building campaign, core recovery, and multi-world completion were not replayed. Older saves retain established camp progression; new starts use the existing milestone field without a schema change.

## Current progression check — Interplanetary Miner

For a fresh expedition, check that the $0 start is understandable: mine 6 copper and 4 iron for the Mining camp, then 4 copper, 4 iron and 2 silver for the Market uplink. Both use materials only. Check that the uplink unlocks sales and upgrades, the mothership recharges the rig free, and camp repair stations cannot recharge. Cores and core crossings give no cash; cores supply ship fuel. Compare the rig battery and ship fuel labels for clarity. The earlier dated results above describe the previous economy.
# 2026-10-11 — Trade, worlds and technology reading

Final automated verification passed: 174 system tests plus atmosphere, route and expedition suites, production build and whitespace checks. The final route-label browser check passed with an explicit recovered-core fixture; selecting Mars leaves Cryo correctly labelled as the current world.

Verified the new browser flow through a $583 selected copper shipment, preserved warehouse reserves, project progression after reload, Codex search/cross-links, physical mothership ascent and fuel-priced travel to Mars. The browser test uses funded/core-recovered fixtures; it does not replace a full fresh-campaign balance run. Check civilian stories from the buyer panel and technology explanations from the Workshop or pause menu. Screenshots are under `output/playwright/expedition-*.png`; detailed quantities and limitations are in QA.md.

## 2026-10-11 — Wall stacking

Browser-tested funded fixtures on desktop Chromium and emulated mobile touch. Three repeated canvas clicks built one column at y=0,-40,-80. The toolbar built five blocks, charged exactly $400 and 5 copper, blocked unsupported layers and further building at zero credits, and preserved all blocks and balances through reload. Touch Build block built three layers, charged $240, and Done closed placement. Screenshots: output/playwright/wall-stack-desktop.png and wall-stack-mobile.png. Physical phone hardware and a complete earned-resource campaign were not tested.

The focused wall rules test covers both hemispheres, overlap prevention, neighboring foundations, legacy-column snapping, missing-support rebuilding and affordability. npm install, the full existing npm test suite and production build passed; the build retains its bundle-size advisory. The focused test is now included in npm test.
