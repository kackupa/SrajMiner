# UX/UI and gameplay review — 2026-10-05

Implementation status: items 1–6 are built and verified; low-hull/braking cues from item 7 and directional drill/resource silhouettes/reduced shake from item 8 are also implemented. Navigation, economy experiments, and remaining long-term polish stay open. The following records the original review evidence and acceptance criteria. No game behavior was changed during this review. Evidence comes from source inspection, an isolated Chromium session, screenshots, the previous full-loop playtests, and a targeted physics reproduction. The user's current browser save was not touched.

## Batch 1 — fix control and recovery problems first

### 1. Safe recovery and a stable surface dock — P1

**Confirmed:** `PlayerPod.reset()` always places the pod at x=980, y=-22, directly over the original mining shaft. `MiningScene.fail()` restores that position and pauses, but resuming applies gravity immediately. With the first 30 rows excavated, four seconds of zero-input simulation put the recovered pod back at **360 m with 70 hull**. Surface buildings are decorative and provide no physical foundation.

**Change:** create an explicit safe docking state or permanent landing pad, separate from the dig entrance. Recovery must remain stationary until the player deliberately departs. Keep a clear starter-shaft marker. Do not refill excavated tiles to manufacture a floor; that would violate mine persistence. Existing saves must benefit too.

**Acceptance:** excavate under every station, recover, dismiss the dialog, and wait ten seconds: stay at the surface with full hull and no fuel consumption. Leaving the dock must be obvious and use the existing controls. Returning and reloading at the dock must also remain stable.

**Files:** `src/game/player/PlayerPod.ts`, `src/game/MiningScene.ts`, `src/game/surface/SurfaceStation.ts`, save state if docking is persisted.

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

**Observed:** copper, iron, silver, and gold use the same small rectangular crystal shapes; diamond is the exception. Fog further reduces color differences. Resource names appear after collection, and the only full price list is implicit in the sale panel.

**Change:** give resources distinct silhouettes, and add a compact current-target readout when the drill contacts a tile: resource, value per slot, and hardness/progress. Keep it near the pod or integrated into the existing HUD. Show only discovered information.

**Acceptance:** identify iron versus silver without relying solely on color; understand why a deeper tile takes longer; see a valuable target before committing fuel to it. Avoid a permanent large legend or more player stats.

### 5. Warn before full-cargo ore destruction — P2

**Confirmed in code:** mining destroys the tile before `collect()` rejects a full hold. The specific ore-loss toast follows destruction. Its wording says ore was “left behind,” although it is permanently removed rather than retrievable.

**Change:** show an explicit warning on the current ore target before it breaks: “Cargo full — this ore will be lost.” Use accurate post-cut wording. Consider a brief deliberate-hold safeguard for valuable ore only after testing the basic warning. Preserve the ability to excavate an escape route; do not simply block all mining at capacity.

**Acceptance:** a full-bay player can predict the consequence, can still leave the mine, and cannot duplicate discarded ore after reload. No new inventory system.

### 6. One continuous outpost visit — P2

**Observed:** selling, refueling, repairing, and upgrading require closing and reopening separate panels. Upgrades clearly show the next numeric level, but not percentage improvement or how much money is still needed. The sale clears the itemized rows immediately, leaving only the payout visible.

**Change:** retain Sell / Service / Upgrades tabs within one outpost panel. Add a clearly priced “Refuel + repair” action while retaining individual services. Preserve the last sale receipt until leaving the exchange. Explain unaffordable purchases with “Need $X more” and benefits such as “50% faster cutting.” Never auto-spend on an upgrade.

**Acceptance:** complete sell → service → upgrade without repeatedly exiting the panel; all totals match the existing economy; disabled actions explain why; focus remains predictable after transactions.

### 7. Better return and damage cues — P2

**Confirmed in code:** the fuel warning is a fixed 23% threshold, independent of depth or route. Hull only changes color at low values. There is no visible return path through branching tunnels.

**Change:** add a persistent low-hull cue and one brief “thrust to brake” hint after the first hard landing. Start with explored-route breadcrumbs or an optional small tunnel map; do not reveal new ore. A fuel-return estimate must account for route/engine and be labelled an estimate, not a guarantee. If a reliable route estimate is too much work, show remaining fuel explicitly and keep the warning honest.

**Acceptance:** navigate back from a sideways branch without guessing; understand the cause of a hard landing; avoid new survival meters or constant warning spam.

## Batch 3 — tune feel and progression after the fixes

### 8. Directional drilling and more distinct layers — P2

The visible drill points down even for side cuts. Orient the working drill and debris toward the contacted tile, make hard-rock impacts sound/feel different, and strengthen useful ore highlights near the player. Keep shake short and honor reduced-motion preferences in the canvas as well as CSS. Then vary vein outlines and band-specific rock details. Preserve the old generator for old seeds/saves if generation rules change.

### 9. Validate economy over real sessions — experiment, not a confirmed defect

The current seeded browser run fills cargo and reaches silver in about 20 seconds of drilling, so the first reward is immediate. It does not establish a satisfying 10–30 minute progression curve. Test multiple seeds and record expedition duration, return fuel, sale value, upgrades, and recoveries. Keep the first upgrade accessible; do not slow everything merely to hit a time target. Compare whether cargo, fuel, and hull all create worthwhile choices after the first sale.

### 10. Finish small trust and presentation details — P3

- Persist mute and reduced-motion preferences; add separate modest effect/ambience levels if needed.
- Replace the permanently hard-coded “EXPEDITION 01” with a real count or a truthful static label.
- Replace indefinitely “JUST SAVED” with a timestamp/relative age, keeping save errors visible.
- Record the deep signal in a visible outpost discovery display; currently the saved flag and brief toast are easy to miss.
- Add save export/import before asking players to invest hours. Chunk caching is bounded, but durable excavation/exploration sets grow.

## Next-session starting instruction

Implement Batch 1 first, preserving existing saves and the original game scope. Add a regression for idle post-recovery behavior, then browser-test keyboard menus and active gameplay at both desktop sizes. Only after that passes, implement target-ore clarity, pre-cut full-cargo warnings, and the continuous outpost panel. Keep deeper economy changes behind explicit playtest evidence.
