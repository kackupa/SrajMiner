# QA report — 2026-10-05

## Verification environment

Windows, Node 24.19, TypeScript, Vite 6.4.3, Phaser 3.90. Chromium was driven through Playwright CLI. Screenshots are under ignored `output/playwright/`. Tests include an actual keyboard-driven expedition and explicitly isolated save fixtures for rare conditions. No test fixture is shipped as a player save.

## Actual expedition

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

`npm test` passes 18 pure TypeScript system tests. Browser scripts are CLI functions, not an additional test framework:

```sh
# Start npm run dev in another terminal; substitute the actual Vite port.
npx --yes --package @playwright/cli playwright-cli -s=mars-regression open http://127.0.0.1:5174/
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-smoke.js
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-failures.js
npx --yes --package @playwright/cli playwright-cli -s=mars-regression run-code --filename=tests/browser-deep-resources.js
```

Create `output/playwright/` before running the browser scripts on a fresh clone. Use a dedicated session: these scripts replace that browser session's local save with controlled fixtures. The smoke script establishes a known initial seed and then uses real controls and transactions. The edge scripts expect that completed smoke test's save and use the read-only development telemetry; they are not intended for the production build.

Screenshots at 1440×960 and 960×720 were reviewed. The smaller layout has no horizontal overflow. Production omits development telemetry. No application console errors were observed.

## Practical limits

This is not exhaustive human playtesting. Long-session economy, thousands of excavations in browser storage, every possible tunnel geometry, cross-browser behavior, and subjective sound mix still need broader coverage. Generated caves and impact damage can punish uncontrolled descents; use thrust to brake. The monolithic Phaser dependency triggers Vite's large-chunk advisory (~353 KB gzip for game JavaScript); it is not a build failure.
