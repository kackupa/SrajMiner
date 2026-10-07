# UX/UI and gameplay review — 2026-10-05

Implementation status: items 1–8 are built and objectively verified where possible; item 9 still needs human economy sessions. Item 10's archive/save trust details, validated import preview, and actual Chromium save download are verified. Isolated browser checks also verify ore-map keys and the continuous outpost sale/service/upgrade flow. Human accessibility, sound quality, and long-term balance findings remain open. The following records the original review evidence and acceptance criteria. Evidence comes from source inspection, isolated Chromium sessions, screenshots, previous full-loop playtests, and targeted physics reproductions. The user's current browser save was not touched.

## Batch 1 — fix control and recovery problems first

### 1. Safe recovery and a stable surface dock — P1

**Confirmed:** `PlayerPod.reset()` always places the pod at x=980, y=-22, directly over the original mining shaft. `MiningScene.fail()` restores that position and pauses, but resuming applies gravity immediately. With the first 30 rows excavated, four seconds of zero-input simulation put the recovered pod back at **360 m with 70 hull**. Surface buildings are decorative and provide no physical foundation.

**Change:** create an explicit safe docking state or permanent landing pad, separate from the dig entrance. Recovery must remain stationary until the player deliberately departs. Keep a clear starter-shaft marker. Do not refill excavated tiles to manufacture a floor; that would violate mine persistence. Existing saves must benefit too.

**Acceptance:** excavate under every station, recover, dismiss the dialog, and wait ten seconds: stay at the surface with full hull and no fuel consumption. Leaving the dock must be obvious and use the existing controls. Returning and reloading at the dock must also remain stable.

**Files:** `src/game/player/PlayerPod.ts`, `src/game/MiningScene.ts`, `src/game/surface/SurfaceStation.ts`, save state if docking is persisted.

**Verified:** `tests/browser-ux.js` loaded a version-1 save above a shaft excavated through 31 rows, left it idle for 10 seconds, and confirmed the pod stayed docked at the surface with fuel, hull, and terrain unchanged. The same fixture services and sells successfully.

### 2. Menu keyboard activation and pause toggle — P1

**Confirmed in Chromium:** Space on the focused Begin Expedition button did nothing. Global Phaser key capture includes Space even while a DOM dialog is open. Clicking the top pause button twice left the game paused both times; its action only opens a pause panel.

**Change:** capture gameplay keys only during gameplay. Preserve native Space/Enter activation and dialog scrolling in menus. Toggle the top button between Pause and Resume, including its accessible name. Clear held flight/drill input across dialog transitions so dismissing a menu cannot trigger movement accidentally.

**Acceptance:** keyboard-only launch, pause, resume, sell, service, and upgrade; Space/Enter work on buttons; arrow keys can scroll a short-window panel; no thrust or fuel use while a menu is open; no stuck key after resuming.

**Files:** `src/game/MiningScene.ts`, `src/game/ui/HUD.ts`.

### 3. Surface camera/HUD safe areas and readable labels — P1

**Confirmed screenshot:** at 960×720 the Pod Workshop world label overlaps the depth panel's deepest-depth text. Essential labels are 9–10 px and secondary labels can be 7–8 px. The initial narrow-layout test covered the intro dialog, so its lack of overflow did not catch this world-label collision.

**Change:** give the surface camera a height-aware composition, and keep projected station labels out of HUD rectangles. Increase important menu and status text toward 12–14 px where space allows. Preserve the restrained industrial style; enlarging every decorative label is unnecessary.

**Acceptance:** inspect active surface gameplay, underground gameplay, and every service dialog at 1440×960, 960×720, and a short desktop viewport. No overlaps, cropped actions, or unreadable primary prices. A screenshot exists at `output/playwright/audit-surface-960.png`.

**Files:** `src/style.css`, `src/game/MiningScene.ts`, `src/game/ui/HUD.ts`.

## Batch 2 — improve decisions and shorten repetitive interactions

### 4. Explain ore value before the cut — P2

**Observed in the original build:** common ores shared similar rectangular markers and fog dimmed resource shapes along with terrain.

**Implemented:** copper chips, iron bars, silver spires, gold nuggets, and diamond facets have distinct silhouette mappings. Discovered ore markers now render above terrain fog with distance-scaled brightness; unrevealed tiles remain hidden. The drill target identifies resource, value per unit, yield, cut width, hardness time, and progress.

**Acceptance:** system coverage asserts all five silhouettes remain unique. The explored map now has a five-ore legend and scanner-limited deposit markers; Chromium verifies the map at 960×560, and a grayscale screenshot review confirms distinct shapes. Actual color-blind and varied-display readability remain to be assessed with people.

### 5. Preserve ore when drilling at capacity — P2

**Resolved:** full cargo no longer delays or blocks drilling. The target warns that overflow drops at the cut site, and any room left in the hold is filled before excess ore becomes a physical pickup. That lets the player clear an escape route and come back for the spill after selling the haul.

**Change:** on a completed cut, save overflow drops immediately under the stable map-seed/tile identifier. Keep the pickup subject to normal cargo capacity when collected, so partial holds recover only what fits.

**Acceptance:** a full-bay player can keep drilling, the spill persists and can be collected after selling, partial holds retain the remainder, and reload cannot duplicate a pickup. No new inventory system.

**Verified:** system coverage checks full, partial, and multi-cut overflow amounts. `tests/browser-ux.js` checks that a full-cargo cut clears the route and its physical ore drop survives reload; this browser fixture has not been rerun for the revised behavior yet.

### 6. One continuous outpost visit — P2

**Observed:** selling, refueling, repairing, and upgrading require closing and reopening separate panels. Upgrades clearly show the next numeric level, but not percentage improvement or how much money is still needed. The sale clears the itemized rows immediately, leaving only the payout visible.

**Change:** retain Sell / Service / Upgrades tabs within one outpost panel. Add a clearly priced “Refuel + repair” action while retaining individual services. Preserve the last sale receipt until leaving the exchange. Explain unaffordable purchases with “Need $X more” and benefits such as “50% faster cutting.” Never auto-spend on an upgrade.

**Acceptance:** complete sell → service → upgrade without repeatedly exiting the panel; all totals match the existing economy; disabled actions explain why; focus remains predictable after transactions.

**Verified:** `tests/browser-outpost-continuous.js` passes the sequence in Chromium, checks the $64 receipt survives all tab changes, combined service, exact drill charge, percentage benefit, unaffordable shortfall, and focus remaining in the dialog. The synthetic fixture verifies the UI and transaction wiring; human assessment of whether service prices and upgrade choices feel right remains open.

### 7. Better return and damage cues — P2

**Implemented:** low fuel and low hull have visible cues, a fast descent displays “HOLD W TO BRAKE BEFORE IMPACT” at 60% of the damage threshold, hard landings explain braking, and the explored-tunnel map supports navigation through surveyed branches while keeping unseen ore hidden. The return-fuel readout is explicitly a conservative vertical estimate with a reserve; it cannot predict detours or piloting. System coverage verifies warning threshold, clearance, and fuel/hull priority. Isolated held-key Chromium showed the cue at 197.5 px/s, then dismissed it under W braking at −27.5 px/s with 100 hull throughout; player noticeability still needs human review.

**Change:** add a persistent low-hull cue and one brief “thrust to brake” hint after the first hard landing. Start with explored-route breadcrumbs or an optional small tunnel map; do not reveal new ore. A fuel-return estimate must account for route/engine and be labelled an estimate, not a guarantee. If a reliable route estimate is too much work, show remaining fuel explicitly and keep the warning honest.

**Acceptance:** navigate back from a sideways branch without guessing; understand the cause of a hard landing; avoid new survival meters or constant warning spam.

## Batch 3 — tune feel and progression after the fixes

### 8. Directional drilling and more distinct layers — P2

**Implemented:** the drill graphic turns toward lateral targets and drilling debris now sprays toward the contacted block. Hard-rock breaks use a lower synthesized impact; dirt, basalt, and hard rock have distinct deterministic procedural marks. Scanner-known same-ore deposits connect into visible veins without revealing unseen tiles or changing geology generation, so old saved worlds retain their terrain. Reduced motion still suppresses shake and particles.

**Verified:** system coverage passes with the unchanged deterministic world generator. Chromium passes all five ore types at near/mid/outer lamp distances and all regional signature views after the render changes. Human assessment of hard-rock sound, vein readability, color-blind use, and visual comfort remains open.

### 9. Validate economy over real sessions — experiment, not a confirmed defect

The current seeded browser run fills cargo and reaches silver in about 20 seconds of drilling, so the first reward is immediate. It does not establish a satisfying 10–30 minute progression curve. Test multiple seeds and record expedition duration, return fuel, sale value, upgrades, and recoveries. Keep the first upgrade accessible; do not slow everything merely to hit a time target. Compare whether cargo, fuel, and hull all create worthwhile choices after the first sale.

**Automated baseline added:** 120 Hz full-signal route simulations on three seeds obey the HUD braking cue and record per-sortie duration, ore, sale credits, return fuel/hull, and service cost. Trips range from 8.7 to 87.6 active seconds; the deepest return retains 14.9–18.5 L with full hull under that modeled response. The no-brake control case reaches zero hull before the fourth signal. This establishes a repeatable baseline but cannot answer whether the cue is noticed, the dives feel tense, or the 10–30 minute loop stays engaging. Human sessions remain required before balance tuning.

### 10. Finish small trust and presentation details — P3

- Completed: mute, music/effects mix, and system reduced-motion preference are applied; isolated Chromium verifies live audio gains and motion-preference changes.
- Completed: current region and useful expedition status replace the old static expedition number.
- Completed: save status advances from “JUST SAVED” to a relative age and continues to show storage failures.
- Completed: the archive now records the unknown deep signal, distinguishing an unresolved depth lead from a recovered transmission and its paid $500 bounty. Browser coverage verifies both states without changing the save schema.
- Completed: export, actual JSON download, validated import, and replacement preview. Continue testing large excavation files and cross-browser download behavior because durable exploration data grows over time.

## Next-session starting instruction

Items 1–8 have since been implemented; see the current [QA report](QA.md) for browser and system evidence. Do not redo the original batches without a newly reproduced defect. The remaining campaign work is a 15–30 minute human session across regions: record trip length, ore sale, return fuel, hull loss, ship progress, regional-find clarity, tool feel, cosmetic visibility, frustrating dead ends, and sound balance. Use those observations before changing economy or damage values. The grayscale ore-art inspection shows distinct shapes, but color-blind players and varied displays have not been assessed directly. Keep user saves isolated during browser QA.
