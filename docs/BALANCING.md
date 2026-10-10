# Balance sheet

All tunable values live in `src/game/config.ts`.

## Ore

| Resource | Sale / slot | First depth | Upper distribution limit |
| -------- | ----------: | ----------: | -----------------------: |
| Copper   |         $18 |         0 m |                    230 m |
| Iron     |         $28 |        24 m |                    480 m |
| Silver   |         $55 |       120 m |                    850 m |
| Gold     |        $105 |       312 m |                  2,000 m |
| Diamond  |        $260 |       612 m |                     None |

The first 3×3 copper seam is guaranteed. Other geology varies by seed. Ore tests use 3×3 coarse cells (2×2 for diamond), followed by irregular thinning. Valuable resources win overlap checks, so marginal probabilities are not the final ore percentages.

## Campaign contracts

Each of the four guaranteed Cryo Shelf route fragments pays one salvage claim matching a ship component: $420 frame, $720 propulsion, $980 navigation, and $680 habitat core. The $2,800 total exactly covers the ship; ordinary ore income can fund upgrades and services. Each claim is issued only when its fragment is first recovered, and the saved fragment record prevents repeat payouts.

## Planetary core rewards

Crossing through a planet's core and reaching its far hemisphere for the first time pays a one-time $2,200 claim. Mining the world-specific core record pays a second one-time archive claim: $3,000 on Cryo Shelf, Mars Frontier, Hull Graveyard, and Prism Fault; $4,500 on Cinder Vale; and $6,000 on Vesper-9. The core record also advances the six-world archive ledger and unlocks the final upgrade band after all records are recovered. Crossing and record claims use saved milestone IDs, so repeat crossings and reloading a save do not pay again. These deliberate payouts make a successful core expedition a major return, in addition to any ore hauled back.

## Upgrade levels

| Category | Starter values, levels 1 → 5         | Purchase costs, levels 2 → 5 |
| -------- | ------------------------------------- | ---------------------------- |
| Drill    | 1 / 1.5 / 2.2 / 3.1 / 4.3 × speed     | $140 / $360 / $850 / $1,800  |
| Fuel     | 140 / 190 / 260 / 350 / 480 L         | $120 / $320 / $750 / $1,600  |
| Cargo    | 16 / 24 / 34 / 48 / 64 slots          | $150 / $380 / $900 / $1,900  |
| Hull     | 100 / 140 / 195 / 270 / 380 integrity | $130 / $340 / $800 / $1,700  |
| Engine   | 1 / 1.18 / 1.4 / 1.65 / 1.95 × output | $160 / $400 / $950 / $2,000  |

Tracks continue beyond level 5. Their level-6+ purchase price grows linearly from the final authored tier cost, so cumulative spending grows quadratically, and base-stat gains use a square-root curve to avoid explosive balance changes. The scanner continues from full horizontal map coverage into greater vertical survey depth. These formulas are in `src/game/config.ts`; the table above remains the authored starter curve. Human economy testing for post-five progression remains open.

## Pilot specializations

Specializations are free to change while docked at Hab 07. Balanced is the no-modifier migration default. Seam Cutter raises hard-rock cutting speed by 20%; Surveyor expands the scanner reveal radius by two tiles while leaving geology and hidden deposits unchanged; Hauler raises cargo capacity by 25%, rounded to the nearest half unit. Switching to a smaller hold is disabled until the unsold cargo fits, so a loadout swap cannot create or retain over-capacity ore. These are playstyle choices rather than additional survival meters. Their relative value still needs human playtesting.

Fuel and hull purchases also fill the newly added capacity. An early full copper load earns $288, enough to service the pod and afford its first upgrade. Starting bank balance is $80.

## Consumption and service

Movement/descent input: 0.55 L/s. Thrust: 1.25 L/s. Active drilling: an additional 1.4 L/s. No idle drain. Fuel service costs $0.30 per missing liter; hull repair costs $0.45 per missing integrity, each rounded up to whole credits.
Underground platforms cost $140 plus 2 copper and 1 iron; service beacons cost $420 plus 3 iron and 2 silver. Construction is available from 180–3,400 m; a map supports at most 12 platforms and one service beacon, within the shared 16-structure cap. Sentry turrets cost $560 plus 2 iron, 2 silver, and 1 gold; up to three can be built per map, each intercepting swimmers within 440 px and reloading in 1.4 seconds. The emergency escape suit costs $780 for one use; it provides jetpack flight independent of miner fuel after hull failure, but preserves neither the miner nor carried cargo and can still be lost to a swimmer strike. The optional salvage magnet costs $420 once, reaches 190 px through clear tunnels, applies 620 px/s² pull, and caps ore pickup speed at 260 px/s.

Pilot suit palettes are optional visual rewards priced at $160 / $320 / $520 after the free Hab Issue suit. They change only the pilot's cockpit colors.

Base drilling times are 0.30 s for dirt, 0.60 s for basalt, 1.05 s below 300 m, 1.50 s below 600 m, and 1.90 s below 1,000 m. Divide by drill output. Traversal between tiles adds time. Level 2 drill is intentionally conspicuous.

Drill, cargo, fuel, hull, engine, scanner, and grapple levels each grow the rendered pod, capped at 1.72× when all seven tracks reach level 5. This is visual progression only; the 26×32 px collision body is unchanged. The enlarged art may extend beyond one tile, while collision remains compact for tunnels.

## Damage tuning from playtesting

Initial testing showed a 360 m run and return could consume around three quarters of the hull through cave drops and landing. Raised the safe impact threshold from 245 to 280 pixels/s and reduced damage from 0.25 to 0.20 per excess pixel/s. Terminal fall speed remains 430: a maximum-speed landing costs 30 hull. One-tile drops remain safe. Hull upgrades raise the margin for error, while engine upgrades make ascent and braking stronger.

The HUD now warns “FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT” at 112 pixels/s (40% of the damage threshold), giving a wider response window before a damaging landing. A three-seed campaign sweep now survives a modeled 600 ms response delay after the cue; at 800 ms one deep run still loses the pod. Low fuel and critical hull cues override the descent warning. Live human timing and noticeability review remains open.

Fuel is deliberately forgiving on the first expedition. Longer excursions and chasing high-value seams introduce the return decision. Long-session late-game economics still need wider human playtesting.
