# QA report — 2026-10-07

## Underground construction — 2026-10-07

Underground construction adds gravity-aware five-tile decks, a service beacon, automatic defense turrets, and a one-use pilot escape suit. The existing rock swimmers now pursue the miner; turrets intercept them within range and use a reload between shots. System coverage verifies build costs/site limits, one-way catching on both hemispheres, turret intercepts, fuel-independent escape-pack flight without drilling, zero-hull escape-save validation, and migration from earlier saves. All 82 system tests pass and the production build succeeds. An isolated browser could not connect to the local test server in this turn, so the construction modal, escape-suit purchase, crash ejection, and live return route remain unverified in-browser.



## Vertical mining town — 2026-10-07

Hab 07 now grows from a starter camp into a skyline tied to Faraday ship components and the four core-record milestones. The skyline adds procedural elevator frames, gravity-mirrored one-way decks, lit work cabins, tram, archive antenna, beacon, and moving crew figures; the camera includes the unlocked height and the service zone covers the tower. Down drops through a deck, and the footer labels this control. This reuses existing milestones and does not alter durable save data. System tests cover stage unlocks, landing on the highest deck, drop-through, far-side inverted-gravity landing, and collision-free landings. `npm install`, all 80 system tests, and the production build pass. An isolated fresh-save browser render at 1280×720 confirms the starter skyline, outpost and docked miner fit together; the keyboard attempt did not produce a reliable flight input, so upper-tier browsing and live landing/drop controls remain unverified. A player session should judge the progression, navigation, and visual scale.

## Planet-specific core objectives — 2026-10-07

Each of the four destinations now generates a deterministic, map-specific sealed sample in the core crossing tile. Drilling records that sample once, grants its $600 salvage claim, and persists both the milestone and excavated tile using the existing version-14 save fields. The Archive and destination board name each core objective, show its recovered state, and track the four-sample ledger. System coverage mines a sample through `MiningSystem`, checks no duplicate claim after repeat collection or reconstruction, checks distinct guaranteed samples across every map, and verifies save validation accepts known IDs while rejecting unknown ones. All 78 system tests pass; the TypeScript/Vite production build succeeds. Browser rendering, the new archive and board copy, and a full cross-core campaign remain unplayed in this turn.

## Two-hemisphere core route and flight drilling

Every map now has a traversable core at 3,600 m, gravity-aware mirrored view, second mineable hemisphere, and a serviceable far-crust outpost. Mouse aim works through 360 degrees while flying; radial drill cuts preserve the pod's collision space. Physical ore, charges, grapple, impact checks, local depth/fuel estimates, surface catch, and saved position use the hemisphere. The first crossing gives a single durable $2,200 campaign reward without adding save fields or requiring a migration. Tests verify mirror projection round-trips, far-side charge/drop gravity, saved position restoring its hemisphere, local depth and return estimates, and a simulated far-crust arrival with intact hull. `npm install`, all 77 system tests, `npm run build`, and `git diff --check` pass. Browser-rendered input, surface service, reload, and second crossing have not been exercised this turn: Playwright is not a project dependency and no local Playwright package is installed. Do not treat the deterministic flight simulation as a human pacing/readability playtest.

## Toast placement and regional visibility follow-up

The browser region-signature fixture now begins at the actual depth of each generated deposit, so its first-core-sample milestone appears during visual QA instead of being skipped. The milestone alert stays inside the top 100 px of the gameplay canvas, below the fixed HUD and clear of the pod, at 1280×800, 960×720, and 1440×960. All three regional signature targets remain visible, with zero pod/terrain overlaps and no horizontal page overflow. Screenshots are `region-prism-geode*.png`, `region-mars-seam*.png`, and `region-hull-salvage*.png` under ignored `output/playwright/`. The current suite passes 63 system tests and `npm run build` succeeds. Simulated full four-signal campaigns on seeds 9090, 1, and 2026 survived 200 and 400 ms response delays after the descent cue, returned with full hull, and funded all four ship systems under this braking model. This does not replace human review of alert readability, terrain-specific handling, or ore contrast.

Pilot specializations are available in the docked workshop. Seam Cutter improves hard-rock cutting, Surveyor extends scanner reveal, and Hauler adds cargo capacity; switching paths is free but cannot strand a haul over a smaller capacity. System tests cover each bonus, cargo rounding, and switching constraint. An isolated Chromium run verified version-10 saves migrate to version 11 as Balanced, each selection takes effect, Surveyor reveals additional cells, Hauler reaches 20 slots, and the smaller-hold action is disabled with an exact sell-first message when carrying 17 units. The workshop fits at 960×560; screenshot `pilot-specialization-capacity-guard.png` is under ignored `output/playwright/`. Subjective value of these choices still needs the human campaign session.

Each of the four existing no-value regional hashes now unlocks a distinct named Faraday crew voice log in the archive, extending the signal mystery across the maps without adding save fields. System coverage checks all four logs are named, substantial, and distinct. An isolated Chromium v10-save fixture verified all four recovered logs and checksum records, no exchange value, and access to the final log by scrolling within the 960×560 archive panel with no horizontal overflow. Screenshot `navigation-hash-archive.png` is under ignored `output/playwright/`.

Recovering all four hashes now unlocks the crew archive's final message. Before completion, the archive shows a spoiler-free regional count and goal; afterward it reveals Asha Vale's concluding log and mining the last hash announces that the crew archive is restored. This derives from existing hash milestone IDs and needs no migration or monetary reward. Unit coverage checks partial versus complete states, and isolated Chromium verifies the incomplete and complete archive views plus the live final-hash toast. Screenshot `crew-archive-conclusion.png` is under ignored `output/playwright/`.

Hab 07 now shows the visible Faraday assembly state beside the scaffold: `0 / 4 SYSTEMS` becomes `FLIGHT READY` after the four ship components are installed. The shipyard-to-travel Chromium flow asserts both states and captures `faraday-hub-unbuilt.png` and `faraday-hub-flight-ready.png`; a 960×560 check confirms the status stays visible outside the telemetry panel. Screenshots are under ignored `output/playwright/`.

The explored-tunnel map now marks ore only inside the scanner's already-surveyed cells. Normal ores use their ore color; geodes and regional signature deposits use brighter special markers. A compact legend identifies all five ores and regional finds. `tests/browser-map-ore-markers.js` passed in isolated Chromium: surveyed starter copper was visible, the legend and scanner rule were present, the pod had zero overlaps, and the panel fit at 960×560 with no horizontal page overflow. Screenshots are `map-surveyed-ore*.png` under ignored `output/playwright/`.

The surface archive now derives a four-region survey ledger from each map's existing saved depth, the durable route-fragment list, and the existing archive hashes. It distinguishes an unvisited region from a visited region with a zero-depth record and adds no save fields. `tests/browser-archive-map-records.js` verifies all four rows and compact 960×560 panel bounds; the system test covers record derivation and avoids counting unvisited regions as surveyed. Screenshots are `archive-map-records*.png` under ignored `output/playwright/`.

Recovering a Cryo route fragment now plays a four-note melodic hook; recovering a navigation hash plays a different descending hook. Both begin on the next 120 BPM score beat and route through the music bus, so mute and the saved music mix apply. The system check verifies each note sequence, quarter-second beat spacing, distinction, and mute behavior. An isolated keyboard-driven Chrome run physically mined the first route signal at 96 m and observed the four scheduled pitches at exactly 0.25-second intervals; its screenshot is `landmark-music-route-signal.png` under ignored `output/playwright/`. Subjective listening and mix balance remain part of the human playtest.

The [15-minute campaign playtest sheet](PLAYTEST.md) is ready for the remaining human checks: ordinary trip pace, return pressure, tools and finds, cosmetic/map visibility, and subjective audio mix. It is designed for the current save so the player can report a few natural trips without resetting campaign progress. Automated route completion and synthetic fixtures remain separate evidence and must not be treated as player-feel results.

Each region now has one optional, signal-hash collectible with a short archive entry. These fictional checksums are offline-only and pay no credits. Hash discovery reuses the existing durable milestone list, so version-10 saves and older migrations remain unchanged. The four-site system check verifies map-specific guaranteed tiles, drill recovery once, and no hash respawn after excavation. `tests/browser-navigation-hashes.js` mined every hash in isolated Chromium, confirmed the drill target labels it as optional with no cash value, and verified one archive record and unchanged credits per collectible. `tests/browser-navigation-hash-archive.js` separately loaded all four records and confirmed the archive reports them as recovered offline collectibles with no exchange value.

## Verification environment

Windows, Node 24.19, TypeScript, Vite 6.4.3, Phaser 3.90. Chromium was driven through Playwright CLI. Screenshots are under ignored `output/playwright/`. Tests include an actual keyboard-driven expedition and explicitly isolated save fixtures for rare conditions. No test fixture is shipped as a player save.

## Actual expedition

The opening physical expedition now has multi-seed system coverage. Seeds 1, 17, 2026, and 78235 each drilled the first guaranteed signal, received exactly one $420 claim, returned to the Hab 07 dock with fuel remaining and hull above zero, and showed no terrain overlap throughout descent or ascent. The complete four-signal campaign simulation also runs on seeds 9090, 1, and 2026, braking with W when descent reaches the HUD's warning threshold; each sortie is serviced at Hab 07, survives, funds the four ship components, and completes region unlock. The recorded 120 Hz simulation trips lasted about 8.7–87.6 active seconds each, carried 3–15 ore units, sold for $54–$967 per sortie, and cost $3–$38 to service. The deepest return retained 14.9–18.5 L; hull stayed full with warning-guided braking. After the $2,800 ship purchase, balances ranged from $969.50 to $2,100. These estimates exclude time spent in menus and do not model optional upgrades. Without braking, one deep-seed simulation reached zero hull before the fourth signal, confirming the warning matters rather than proving deep trips are safe without player input. A delayed-response sweep now completes all four signals and buys all four ship systems on seeds 9090, 1, and 2026 with 200 ms and 400 ms reaction delays after the warning, returning with full hull under the tested control model. These system simulations check route reliability under modeled warning response, not human pacing or warning noticeability. The suite now passes 63 system tests.

Seed 1410513364: held S to excavate, reached approximately 288 m, filled all 16 slots with 5 copper, 7 iron, and 4 silver, flew back up using W, and moved onto solid ground. Sold the haul for exactly $506: bank increased from $80 to $586, cargo became empty. Refuel cost $11 and repair cost $9, restoring both meters. Bought drill level 2 for $140 and fuel level 2 for $120, leaving $306 and 190 L capacity.

Reload preserved the seed, credits, levels, and every destroyed tile. A second expedition collected another full load and reached a greater depth. The off-center start initially widened the shaft; this informed the centering fix and dedicated regression test. The final reproducible smoke test then reached 348 m on the upgraded second expedition, with zero tile overlaps and a correctly centered single-column shaft.

Earlier seed 1277926616 reached 360 m and exposed overly harsh landing damage; balance was adjusted. The revised initial expedition retained roughly 82 hull after landing instead of roughly 26 in that earlier run.

## Coverage against the requested checklist

| Checks                                                   | Evidence                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4 launch, surface spawn, movement, descent             | Actual Chromium launch, WASD, HUD and screenshot inspection                                                                                             |
| 5–9 drill, destruction, pickups, cargo cap, fuel         | Actual 16-slot haul; deterministic system tests; no overlapping tiles                                                                                   |
| 10–13 ascent, return, sell, money                        | Real keyboard return and exact $506 transaction                                                                                                         |
| 14–17 refuel, repair, upgrade menu and effects           | Browser transactions, 190 L capacity, reload, drill-duration regression                                                                                 |
| 18–19 harder terrain and deeper resources                | Band/ore system tests; browser fixtures mined gold at 372 m and diamond at 684 m                                                                        |
| 20 hard-fall damage                                      | Real expedition landings and long/short drop simulation tests                                                                                           |
| 21–24 failure, respawn, cargo loss, progression retained | Separate low-fuel and 1-hull browser fixtures both recovered to the surface with empty cargo, full stats, and unchanged money/levels                    |
| 25 excavation persists                                   | Browser reload compared complete destroyed-coordinate arrays; chunk eviction/reconstruction unit test                                                   |
| 26 seeded determinism                                    | 6,768 coordinate comparisons independent of chunk loading order; different-seed variation checked                                                       |
| 27 streaming                                             | Actual trips crossed chunk rows; 3–9 resident chunks observed; eviction tested through 1,000 rows                                                       |
| 28 collision / stuck cases                               | 120 Hz drilling, sideways reverse travel, upward ceiling, maximum-engine 50 ms frames, off-center cuts, and actual return journeys; no terrain overlaps |
| 29 production build                                      | `npm run build` passed; production preview browser smoke tested separately                                                                              |

## Automated checks

`npm test` passes 61 pure TypeScript system tests. Browser scripts are CLI functions, not an additional test framework:

```sh
# Start npm run dev in another terminal; substitute the actual Vite port.
npx --yes --package @playwright/cli playwright-cli -s=mars-regression open http://127.0.0.1:5174/
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-smoke.js
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-failures.js
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-deep-resources.js
npm run dev -- --port 5180 --strictPort
npx --yes --package @playwright/cli playwright-cli -s=mars-campaign open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-campaign run-code --filename=tests/browser-campaign-travel.js
npx --yes --package @playwright/cli playwright-cli -s=mars-route-run open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-route-run run-code --filename=tests/browser-campaign-route-run.js
npx --yes --package @playwright/cli playwright-cli -s=mars-audio open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-audio run-code --filename=tests/browser-audio-settings.js
npx --yes --package @playwright/cli playwright-cli -s=mars-onboarding open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-onboarding run-code --filename=tests/browser-onboarding.js
npx --yes --package @playwright/cli playwright-cli -s=mars-growth open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-growth run-code --filename=tests/browser-pod-growth.js
npx --yes --package @playwright/cli playwright-cli -s=mars-accessibility open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-accessibility run-code --filename=tests/browser-accessibility.js
npx --yes --package @playwright/cli playwright-cli -s=mars-shipyard open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-shipyard run-code --filename=tests/browser-shipyard-build-travel.js
npx --yes --package @playwright/cli playwright-cli -s=mars-regions open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-regions run-code --filename=tests/browser-region-signatures.js
npx --yes --package @playwright/cli playwright-cli -s=mars-tools open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-tools run-code --filename=tests/browser-charge-drops.js
npx --yes --package @playwright/cli playwright-cli -s=mars-magnet open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-magnet run-code --filename=tests/browser-magnet-pickup.js
npx --yes --package @playwright/cli playwright-cli -s=mars-archive open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-archive run-code --filename=tests/browser-archive-signal.js
npx --yes --package @playwright/cli playwright-cli -s=mars-cosmetics open http://127.0.0.1:5180/
npx --yes --package @playwright/cli playwright-cli -s=mars-cosmetics run-code --filename=tests/browser-cosmetics.js
```

Create `output/playwright/` before running the browser scripts on a fresh clone. Use a dedicated session: these scripts replace that browser session's local save with controlled fixtures. The smoke script establishes a known initial seed and then uses real controls and transactions. The edge scripts expect that completed smoke test's save and use the read-only development telemetry; they are not intended for the production build.

Screenshots at 1440×960 and 960×720 were reviewed. The smaller layout has no horizontal overflow. Production omits development telemetry. No application console errors were observed.

## Practical limits

This is not exhaustive human playtesting. Long-session economy, thousands of excavations in browser storage, every possible tunnel geometry, cross-browser behavior, and subjective sound mix still need broader coverage. Generated caves and impact damage can punish uncontrolled descents; use thrust to brake. The monolithic Phaser dependency triggers Vite's large-chunk advisory (~353 KB gzip for game JavaScript); it is not a build failure.

## UX improvement build

The priority review fixes are implemented: magnetic surface docking, native keyboard activation in menus, a Pause/Resume toggle, and a surface camera layout that keeps labels below the HUD. Existing version-1 saves continue to work; docking is inferred for near-surface positions rather than changing the save format. No excavated tiles are restored.

Outpost panels now have Sell / Service / Upgrades navigation and an atomic, itemized-price Refuel + Repair option. The exchange retains the last receipt during the visit. Upgrade cards show percentage improvements and the remaining credits required.

Drilling shows the target resource, value per slot, cutting time, and progress. Full cargo adds a 0.9-second pre-cut warning: release the direction to cancel, or continue holding to discard the ore and clear the route. Resource silhouettes are distinct, the working drill can point sideways, fuel shows liters, low hull has a visible warning, and the first hard landing explains braking with W. Reduced-motion preferences suppress camera shake.

Validation for this build: 22 system tests pass; the full keyboard-driven mining/sale/service/upgrade/reload regression passes; production build succeeds. `tests/browser-ux.js` additionally verifies ten seconds of idle docking above an entirely excavated outpost, Space-based sale, tab navigation, retained receipts, combined service ($60 for 110 missing liters and 60 missing hull), cancellation before ore loss, and deliberate discard without exceeding cargo capacity. Both fuel and hull recovery fixtures pass after moving the hull-impact fixture outside the safe outpost landing field.

Reviewed screenshots: `ux-surface-960.png`, `ux-workshop-960.png`, `ux-short-workshop.png`, and `ux-cargo-warning.png` in `output/playwright/`. Tested layouts include 1440×960, 960×720, and a scrollable workshop at 960×560. No application errors appeared in the final isolated browser session.

Run the new test in a dedicated development-browser session using `playwright-cli -s=mars-regression run-code --filename=tests/browser-ux.js`. It creates controlled fixtures in that session's storage, never a shared player save.

The improvement pass also fixes New Expedition being overwritten by pagehide autosave. `tests/browser-new-expedition.js` verifies that the confirmed reset yields a fresh seed, $80, base upgrades, and zero destroyed tiles; run it after a saved test expedition in an isolated session.

## Campaign, map, and multi-cut update — 2026-10-06

Validation on this pass: `npm install`, `npm test` (28 system tests), `npm run build`, and `git diff --check`. Chromium on isolated local origins verified the new Cryo Shelf briefing, shipyard/archive/destination board, explored-map open/close and hidden-ore note, save reload, and a legacy v2 save migrating to Mars Frontier. The browser console had no errors or warnings. The wider-cut regression verifies level 3/4/5 affects two/three/four tiles and cargo stays at or below capacity. Route-fuel estimate and per-map seeded geology have system coverage.

The ore-funded ship build and destination travel have now been browser-played end to end; see the campaign route run below. A sustained human mining trip across regions, subjective listening test for generated music, long-session economy, and multi-cut gameplay feel still need human playtesting. See [campaign design](GAME_DESIGN.md) for shipped systems and remaining chapter work.

The audio mixer adds separately persisted music/effects levels and keeps the existing quick-mute preference. Visual slider operation and mute synchronization were later verified in isolated Chromium; subjective audible balance remains a human check.

## Campaign simulation and large-save round trip — 2026-10-06

A deterministic `PlayerPod` + `MiningSystem` simulation now performs four separate Cryo Shelf sorties: it mines each real route-fragment tile, returns to the Hab 07 dock between trips without clipping, keeps fuel and hull above zero, sells cargo, services when affordable, and buys all four ship components. The route contracts plus mined ore leave at least $2,800 after services. Later isolated Chromium runs verified the shipyard UI, component purchases, travel among all four regions, and campaign reload persistence (see browser verification below). A second system test serializes and imports a save containing 10,000 excavated/discovered coordinates and 1,000 physical ore drops, then verifies the records survive reconstruction. Charge-freed ore has simulated fall, bounce, and settle coverage against real map terrain. The current suite passes 55 tests; the production build succeeds.

## Regional signature mechanic — 2026-10-06

Prism Fault now rolls deterministic, rare geodes on ore-bearing tiles. Each geode is a guaranteed three-unit deposit, with a bright pulsing outline in the world and an explicit three-unit callout in the drill target. System tests verify repeatability across reload generation and absence from other maps. Later live Chromium target checks verify the regional signature callout and zero collision overlap; see the browser verification follow-up below.

## Authored Cryo landmarks — 2026-10-06

The four guaranteed route seams now sit inside deterministic oval chambers with increasingly wide rooms. Distinct, soft chamber rims and survey labels make the archive's landmark names correspond to real places in the mine. System coverage verifies every center seam, open chamber edge, outside boundary, determinism, and Cryo-only placement. Chromium confirmed the visible room/rim/label, and the later full keyboard campaign run physically recovered all four seams at their authored depths.

## Mining charge and persistent ore pickups — 2026-10-06

Mining charge packs cost $180 for three charges. Press Q underground to arm a 1.2-second fuse; its diamond-shaped radius clears up to 13 tiles. Ore becomes physical pickups with small toss-and-settle motion; touching them adds only what fits, and leftovers remain available after cargo is sold. Save v5 stores charges, drops, and armed fuse state per map, and migrates v1–v4 saves. System tests cover blast bounds, partial pickups, duplicate pickup rejection, schema validation, and old-save migration. Chromium loaded a one-charge test save, confirmed Q arms the fuse and the blast automatically collected 1.5 copper units, then reloaded and confirmed the 1.5-unit cargo persisted with the same depth and hull. The console had no errors or warnings. Staying still let the blast open the floor and the resulting hard landing cost 8% hull; the shop and fuse warning tell players to move clear or hold W to brake. Multi-map persistence is covered by the later travel fixture; long-session tool balance still needs playtesting.

The Hab 07 paint bay offers Polar Signal ($180), Ark Salvage ($360), and Prism Bloom ($600) alongside the free Hab Standard. The selected finish changes hull, trim, and beacon-light colors only. The version-6 save migration preserves earlier charges, pickups, and map state. Later Chromium checks purchased/equipped paint, suit, decal, and profile and confirmed the altered pod artwork in-world after reload (see browser verification below). Mobile layout and subjective price/readability remain human checks.

Each first-time Cryo route-fragment recovery pays a Faraday salvage claim matching one ship component: $420, $720, $980, and $680. Together these guaranteed claims cover the $2,800 ship price; collected fragment IDs prevent duplicate payouts and migrate in existing saves as already claimed. System coverage verifies the full claim-to-component sequence. The later keyboard campaign run physically mined all four seams, returned for service, purchased the ship, and traveled to Hull Graveyard.

The optional salvage magnet costs $420 and automatically pulls physical ore drops from mining charges within 190 px, provided no solid block blocks line of sight. Pull speed is capped, cargo capacity is unchanged, and ownership persists. The version-7 migration defaults earlier saves to no magnet. System tests cover range, line-of-sight blockage, bounded pull velocity, one-time purchase, and earlier migrations. `tests/browser-magnet-pickup.js` later verified purchase, visible pull and pickup collection through an open tunnel, and exhausted-drop persistence after reload.

The style bay includes four pilot suit palettes, shown as a helmeted figure in the preview and recolored in the pod cockpit. The free Hab Issue suit is joined by Polar Survey ($160), Ark Salvage ($320), and Prism Runner ($520). Buying/equipping is visual-only. Save v8 preserves ownership and selection, and older saves migrate with the default suit equipped. System tests cover purchase affordability, duplicate rejection, selection ownership, unchanged gameplay stats, restoration, and v7 migration. Later isolated Chromium purchase/equip and in-world rendering checks cover the paint, suit, decal, and profile; see browser verification follow-up below.

Mars Frontier contains orange thermal seams and Hull Graveyard contains mint-lit alloy caches; both provide at least two units and appear with a map-specific highlight in the drill target. Their generation is deterministic and uses no save fields, so excavated finds stay gone through the existing destroyed-tile state. The style bay adds four hull decals and four silhouette profiles, with original procedural markings and frame shapes; each profile also recolors the cabin glow. Save v10 migrates v1–v9 and adds default cosmetics for older campaigns. At this stage, offline `npm install` could not complete because the cache lacked registry metadata for `@fontsource/barlow-condensed`; installed workspace dependencies still supported tests/build. The initial Playwright CLI attempt stalled, but later browser verification used the bundled runtime successfully (see below), including mixer, regional highlights, and equipped cosmetics.

## Guaranteed route fragment update — 2026-10-06

Four non-random route-data seams sit at authored Cryo Shelf depths. Their tiles are guaranteed for every Cryo seed, glow in the mine, can be mined into a persistent archive record, and disappear permanently after collection. Version 4 adds their IDs to campaign saves; v1–v3 migration keeps old Mars expeditions on Mars. System tests cover mining, no respawn after excavation, and migration. A Chromium archive check confirms the four depth goals and 0/4 count; a later fresh-save keyboard campaign physically recovered all four seams and traveled to Hull Graveyard (see the campaign route run below).

## Save portability update — 2026-10-06

The pause menu now prepares a JSON Blob download link. Import accepts JSON after size/schema checks, migrates v1–v3, previews destination/depth/credits/route fragments, and replaces local state only after a second confirmation. Thirty system tests passed at this stage, including parser rejection for malformed and invalid save data. Chromium verified file selection, preview, confirmed replacement, reload, and the imported $420 / 96 m campaign record. That original embedded-browser run did not emit a download event; the later Chromium verification below reads and parses the completed download. The pause menu was visually checked and fits without scrolling at the test viewport.

## Reduced-motion follow-up — 2026-10-06

The game subscribes to live `prefers-reduced-motion` changes and removes that listener when the Phaser scene shuts down. Reduced-motion mode clears camera shake and debris, skips drilling particles, and makes landmark, regional-find, magnet, charge, and surface beacon animations static. Core world simulation and text feedback continue. System tests and the production build pass. The subsequent isolated Chromium accessibility fixture verified live reduced-motion changes, keyboard navigation, and save-preview rendering; the user's existing game tab was left untouched.

## Keyboard dialog navigation follow-up — 2026-10-06

The modal focus loop wraps across all enabled, visible controls (including audio sliders and links), not buttons alone. Visibility, blur, page-hide, dialog-key, and reduced-motion listeners are removed on Phaser scene shutdown so a scene restart cannot stack handlers. System coverage verifies focusable filtering. Forward/reverse tabbing, dialog launch/pause behavior, and live reduced-motion changes were subsequently verified in isolated Chromium in `tests/browser-accessibility.js`.

The focusable-element filter has a unit regression for ordinary controls, sliders, hidden controls, and `aria-hidden` content. An early isolated Vite attempt did not produce a screenshot in the then-used browser setup; this limitation was resolved by the bundled Playwright Chromium runtime and later browser fixtures below. Cross-region travel, keyboard traversal, live reduced-motion changes, and rendered layouts now have isolated browser evidence.

`tests/browser-campaign-travel.js` is a dedicated Playwright scenario for travel. It creates a fixture only in a dedicated isolated browser session and verifies the assembled ship can visit all three other regions and return to Cryo while preserving fuel/hull/cargo/credits, region records, and excavation. It passed in the cached Chromium runtime on 2026-10-06.

Mixer review found that muting inside the mixer left the top quick-mute button stale until reload. The top control now stays in sync and exposes its state with `aria-pressed`. `tests/browser-audio-settings.js` passed in isolated Chromium, verifying slider feedback, mute synchronization, and saved music/effects settings after reload. Subjective volume balance and audible sound remain human-playtest items.

The expedition briefing now spells out the primary keys, sale/map/pause actions, cargo pressure, and return-fuel estimate. `tests/browser-onboarding.js` passed in isolated Chromium at 1440×960, 960×720, and 960×560, scrolling the panel as needed on the short viewport.

The pod artwork now scales from 1.0× to 1.38× with drill and cargo tiers; the 26 px collision width remains fixed and the maximum rendered body stays below one 40 px tile. A system regression covers monotonic growth and the collision dimensions. `tests/browser-pod-growth.js` passed in isolated Chromium, purchasing all drill/cargo tiers and verifying the 1.38× artwork scale with zero terrain overlaps.

Region snapshot/restore is now a shared campaign helper used by scene initialization, travel, and durable map remembering. A deterministic transition regression visits a new region and restores the original with its seed, mined tiles, explored map, loose ore, armed charge, coordinates, and maximum depth intact; it also verifies restored drops do not alias save data. The current suite passes 50 system tests and `npm run build` succeeds. Browser shop/travel verification and the later ore-funded campaign route run are documented below; human multi-region feel testing remains outstanding.

Ore silhouettes have an explicit one-to-one shape mapping (copper chips, iron bars, silver spires, gold nuggets, diamond facets); a system test prevents duplicates. Known ore shapes and regional halos render over the terrain fog with distance-scaled brightness, while undiscovered tiles stay occluded. Later entries in this report add compact-layout and grayscale visual checks; player accessibility feedback remains outstanding.

## Browser verification follow-up — 2026-10-06

An isolated in-app browser tab on port 5180 verified the fresh expedition briefing, destination-board locked states, mixer dialog labels, explored-tunnels privacy note, outpost upgrade requirements, and all four customization tabs. The tab used a separate origin from the user's open game. Inspection found the top pause button incorrectly announced "Resume game" while a service panel was open. It now announces "Close panel and resume game", shows the pause symbol, and the updated label was verified live in the customization panel. The Vite hot reload reset only the isolated tab to a fresh briefing, not the existing player tab. See the following Playwright run for fixture-based integration results.

The cached Chromium/Playwright runtime was subsequently located and used directly against the isolated Vite origin without adding project dependencies. All four authored browser fixtures passed: assembled-ship travel to all four regions preserved credits, ship, cargo, fuel, hull, and the excavated Cryo tile while saving four independent maps; mixer values (music 35%, effects 55%) and mute state restored after reload; the expedition briefing fit 1440×960, 960×720, and 960×560; and max drill/cargo upgrades grew pod art from 1.0× to 1.38× with zero collision overlaps. Screenshots are `campaign-travel.png`, `audio-mixer.png`, `onboarding-*.png`, and `pod-growth-*.png` under ignored `output/playwright/`. No page errors were observed in these fixture runs. They use synthetic saves and do not replace a human campaign or subjective play session.

Further isolated Chromium checks confirmed the briefing focuses its launch button and Space activates it, pause-dialog Tab/Shift+Tab wrap through controls, Escape pauses and resumes, reduced-motion preference changes update the live scene telemetry, and save export/import previews render. Chromium reported a running AudioContext and expected mixer gain values after launch; subjective listening and mix balance remain human checks. No page errors appeared in these runs. `tests/browser-accessibility.js` captures the repeatable keyboard, media-preference, and save-preview checks.

The export check now waits for Chromium's actual `download` event, reads the downloaded stream, and parses it as JSON. `tests/browser-accessibility.js` confirmed the suggested `cold-signal-<seed>.json` filename and a version-10 Cryo campaign with its map data; import preview still passes after that download. This resolves the earlier embedded-browser limitation recorded above for Chromium. Cross-browser download behavior remains untested.

`tests/browser-outpost-continuous.js` completed the sale → combined service → drill upgrade sequence through the persistent outpost tabs without closing the dialog. It verified the $64 itemized payout, full fuel/hull restoration, drill level 2 at the expected $140 cost, the retained $64 sale receipt on returning to Sell, the +50% benefit and shortfall text for unaffordable upgrades, and focus remaining inside the active dialog. The final screen remained the open exchange; screenshot: `outpost-continuous-receipt.png` in ignored `output/playwright/`.

The 2026-10-06 graphics pass added seeded material marks to dirt, basalt, and hard rock, connected scanner-known same-ore deposits into irregular visible veins, aimed side-cut debris toward its contacted block, and gave hard-rock breaks a lower, heavier synthesized impact. The Chromium ore visibility suite passed all five ores at near/mid/outer lamp distances, and the regional-signature suite passed Prism, Mars, and Hull target/collision/layout checks after the render changes. These verify rendered contrast and stable geometry; they do not replace human judgment of vein readability, hard-rock sound, or visual comfort.

Microsoft Edge also passed the continuous outpost transaction fixture and scanner-ore map fixture. Edge completed the $64 sale → combined service → drill purchase, kept the receipt and focus in the dialog, and rendered surveyed-ore markers plus all map legend entries at 960×560 with no overlap or horizontal overflow. These checks cover the browser shell's download/UI/render path; audio quality and long-session balance remain human checks.

`tests/browser-shipyard-build-travel.js` now covers the actual component-purchase sequence: a dedicated campaign fixture starts with exactly $2,800, buys all four components through the shipyard UI, confirms all three new destinations unlock, travels to Hull Graveyard, reloads, and verifies the purchased ship and destination persist with no remaining credits. It passed in cached Chromium; its screenshot is `shipyard-build-travel.png` in ignored `output/playwright/`.

`tests/browser-region-signatures.js` finds deterministic ore-bearing examples for Prism Fault, Mars Frontier, and Hull Graveyard, then checks the live drill-target label and renders each on its real map. Chromium verified the geode's guaranteed 3-unit callout, and the thermal seam and ark-salvage cache's 2-unit callouts; all three appeared as distinct highlighted deposits with zero pod/terrain overlaps. Screenshots are `region-prism-geode.png`, `region-mars-seam.png`, and `region-hull-salvage.png` in ignored `output/playwright/`. This confirms presentation and target text, not subjective discoverability or rarity balance.

`tests/browser-campaign-route-run.js` completed a keyboard-driven campaign from a fresh save. It physically drilled to all four Cryo route fragments at 96, 324, 624, and 1,080 m, returned to Hab 07, sold ore, and serviced between trips; the player then assembled the ship from the campaign balance, traveled to Hull Graveyard, and reloaded with the ship, destination, fragments, and deep transmission intact. The pod survived each run, but hull at the finds fell to 30.8, 1.5, and 15.2 on the last three descents before surface service. That is a high-risk balance signal from one synthetic keyboard style, not sufficient evidence to change impact damage without the planned human session. The completion screenshot is `campaign-route-run.png` under ignored `output/playwright/`.

`tests/browser-charge-drops.js` passed the live Q deployment/fuse/blast loop in Chromium: the blast cleared 14 terrain tiles, made six persistent physical ore drops, and the pod finished without overlap or hull loss after thrusting clear. `tests/browser-magnet-pickup.js` bought the $420 salvage magnet through the workshop, then verified it pulled and collected a 1.5-unit copper drop through an opened tunnel and removed the exhausted pickup from the saved map. Screenshots are `charge-and-drops.png` and `magnet-pickup.png` in ignored `output/playwright/`. Human assessment of fuse tension, pickup feel, and whether the magnet is worth its price remains open.

The outpost archive now also records the deep signal using the existing `artifact` save flag: a depth lead is shown as unrecovered until the transmission is found, then the archive reports the recovered signal and paid $500 bounty. `tests/browser-archive-signal.js` passed for both states; screenshots are `archive-signal-pending.png` and `archive-signal-recovered.png`. No save migration was needed.

Microsoft Edge 154 passed a separate fresh-session check at 960×560: launch receives initial focus, Space starts the expedition, Escape opens pause, no horizontal overflow occurs, and no page errors are reported. This is a second-engine smoke check, not exhaustive platform coverage.

`tests/browser-cosmetics.js` bought and equipped Polar Signal paint, Polar Survey suit, Descent Arrow decal, and Signal Scout profile from a $700 test balance. It verified ownership, exact credit spend, equipped selections after reload, and visible in-world pod paint plus antenna mast. `cosmetics-before.png` and `cosmetics-equipped.png` are saved in ignored `output/playwright/`. Price fairness and the subtlety/readability of every suit and decal remain subjective playtest questions.

The legacy-save keyboard expedition in `tests/browser-smoke.js` now passes as a complete loop: 35 seconds of drilling reached 291 m with a full 16-unit cargo bay, 111 L fuel, 96.6 hull, and zero overlaps; ascent/docking succeeded, the haul sold for exactly $506, service restored fuel/hull, a drill upgrade persisted after reload, and a second descent reached 216 m with zero overlaps. The second descent ended with 75 hull after its landing, a balance observation for human play rather than grounds for a change from one run. The test now requires at least 10 units rather than assuming browser timing always fills the hold in a fixed interval; exact payout and service/reload assertions remain.

`tests/browser-ore-visibility.js` checked Chromium's Phaser-rendered frame at 960×560 for all five ore types at 2, 5, and 7 tiles from the pod. Each case used deterministic geology at a valid ore depth, a cleared test shaft, and known explored tiles; the sampled ore-colored pixels remained present at the outer lamp edge. This verifies small-layout rendering and distance fade, but not color-blind accessibility, cross-device color calibration, or subjective discoverability. The 15 screenshots are `ore-<type>-<near|mid|outer>-960x560.png` under ignored `output/playwright/`.

As a grayscale fallback inspection, near-range Chromium captures were converted to monochrome: copper chips, iron bars, silver spires, gold nuggets, and diamond facets remain visually distinct by shape. Those postprocessed views are `ore-<type>-near-gray.png`. This confirms shape separation in the art; it is not a color-vision simulation or user accessibility study.

On this pass, `npm test` passed all 52 system tests, `npm run build` succeeded, and `git diff --check` passed. The build still emits Vite's large-chunk advisory. `npm install --ignore-scripts --offline --package-lock=false --no-audit --no-fund` was attempted again but npm has no cached registry metadata for `@fontsource/barlow-condensed`; the existing installed dependencies supported the passing suite and build.

## Cargo-loss warning follow-up — 2026-10-06

Superseded by the full-cargo spill behavior recorded below: drilling now proceeds immediately, fits what it can in the hold, and saves excess ore as a physical return-trip pickup.

## Braking cue before impact — 2026-10-06

The synthetic campaign route exposed survivable but severe hull loss after long continuous drilling descents. The low-hull cue appeared only after damage. The HUD now adds “FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT” at 168 px/s, 112 px/s below the 280 px/s damage threshold, while fuel and critical-hull warnings retain priority. System regressions verify its threshold, clearance, and warning priority. `tests/browser-fast-descent-warning.js` passed in isolated headless Chrome using the bundled Playwright runtime: the cue appeared at 197.5 px/s with 100 hull, then W braking cleared it at −27.5 px/s with 100 hull. Screenshots `fast-descent-warning.png` and `fast-descent-braked.png` are under ignored `output/playwright/`. The isolated origin was port 5188; the user's port-5174 save was untouched. `npm test` passes 56 tests, `npm run build` succeeds, and `git diff --check` passes. Subjective campaign balance and sound/accessibility review remain human items.

## Color-independent map ore markers — 2026-10-06

The explored-tunnel map previously represented all five ore types with identical circles, forcing the legend and map locations to rely on color. Markers now use the same distinct chip, bar, spire, nugget, and facet silhouettes as the in-world crystals; the legend repeats those shapes and labels each ore. Special-find outlines and archive-hash squares remain distinct. A system test checks unique drawing geometry for all five map symbols. An isolated Chrome run confirms the surveyed copper marker and all five unique legend shapes; at 960×560 the full map panel stays inside the gameplay viewport and page width. Screenshots `map-ore-shapes.png` and `map-ore-shapes-960x560.png` are under ignored `output/playwright/`. This improves color-independent identification but does not replace feedback from color-blind players or contrast checks on varied displays.

## Rock-swimmer hazard — 2026-10-06

The first cavern creature arrives below 240 m, moves through solid tiles without changing excavation, becomes visible only inside scanner range, and turns amber with a proximity line inside 190 px. It steers away from the pod, causes 8 hull damage on contact, then withdraws for a cooldown. This reuses existing hull and has no combat controls or save-schema change. At the time, `npm test` passed 66 system tests, including depth gating, motion, single-hit withdrawal, and cooldown; `npm run build` succeeded. The encounter has not yet had a human playtest in a real descent, so collision likelihood and warning readability still need feedback.

## Full-cargo route clearing — 2026-10-06

Full cargo no longer imposes a warning delay on drilling. Available hold space is used first; overflow is made into a physical ore pickup with the stable map-seed/tile ID and saved immediately. The HUD tells the player the spill is recoverable after selling the haul, so they can clear a route to evade a threat and return for the ore. System tests verify full, partial, and two-block spill amounts and simulate collecting a saved spill on the next trip. `tests/browser-ux.js` was updated to confirm the route clears and the overflow pickup persists through reload, but the browser fixture could not be run in this environment; `npm test` and `npm run build` are the executed checks.

## Mouse-directed drilling — 2026-10-06

Underground, hold left-click to drill the nearest rock along the cursor direction within 1.8 tiles. A highlighted target and guide line preview the selected block. Drill upgrades cut perpendicular to the aim direction, making wide cuts selectable without changing keyboard flight. The torch beam now follows the mouse preview or active keyboard cut direction, and its spread grows with drill width. Upward aim is rejected and cannot drill through empty tunnels to distant rock. `npm test` passes 67 system tests and `npm run build` succeeds. The open game tab hot-reloaded and showed the updated control hint, but interactive browser playtesting remains unverified: the available Playwright wrapper requires `bash`, which is unavailable in this Windows shell, and the in-app browser interface exposes tab inspection without pointer controls. The open playthrough was left untouched.

## Gravity for mining charges — 2026-10-06

Newly deployed and saved charges now carry vertical velocity, accelerate downward, and settle on the first solid tile beneath them while the fuse continues. Velocity is optional in the saved data so existing active-charge saves load without a version migration. System coverage verifies falling through a cleared shaft and resting without clipping. Browser interaction is unverified here; `npm test` and `npm run build` are the executed checks.

## Surface winch return tool — 2026-10-06

The workshop offers a one-time $880 Surface Winch. Holding R underground applies a 1.7× upward pull and 1.5× thrust-fuel use; solid rock still blocks the pod, and reaching Hab 07 through an open shaft docks it automatically. The purchase persists in save version 13; version 1–12 campaigns migrate with the module unowned. A system simulation covers the purchase, fuel trade-off, faster climb, open-shaft docking, and locked input before purchase. All 69 system tests pass and `npm run build` succeeds. The live tab showed the updated R control; interactive browser playtesting was not performed.

The automatic recovery grapple now catches a dangerous fall when a higher rock anchor is reachable through a clear path. It hangs the pod briefly, and W releases it for thrust. Five upgrade levels extend reach and shorten the cooldown. The grapple level is durable in save version 14; version 13 and earlier campaigns migrate with the starter hook available. Added system checks cover range, obstruction, safe catch, and thrust release. Interactive browser playtesting and balance feedback are pending.

Upgrade tracks now continue after level 5 with linear price increases per purchase and square-root stat gains. Scanner tiers beyond full horizontal width extend vertical survey range. The workshop displays the next level and next price instead of MAX; save validation accepts positive safe-integer levels. System tests buy through level 9 on every track and verify higher levels persist. The live workshop accessibility tree confirms LV 5 → 6 and next-step values/prices; no purchase was made during this check. Mouse mining now targets overhead blocks, and upgraded radial cuts follow aim while excluding cells overlapped by the miner. System tests cover all-direction target acquisition and a protected diagonal swath. A full interactive radial-drilling expedition and long-term human balance session remain pending. The complete suite passes 72 tests and `npm run build` succeeds.
## Flight drilling

Mouse aiming and drilling remain active while W/upward thrust is held, so the player can cut rock and steer through the same flight. A focused system regression verifies concurrent thrust and mining, both fuel costs, ore recovery, and no pod/terrain overlap. The briefing and HUD now state that drilling works in flight. An isolated game tab loaded at port 5179, but interactive browser input verification remains outstanding: `@playwright/cli` was not in the local npm cache and registry access was unavailable. The user's active game tab/save was left untouched.
