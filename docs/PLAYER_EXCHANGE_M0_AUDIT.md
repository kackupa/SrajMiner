# Player Exchange M0 audit

Recorded 2026-10-19. This is a source and local-baseline inventory, not evidence that the legacy market or a new verified economy is deployed. The separate Local/Verified Online campaign split was approved by the user. Existing Local `mars-miner.v1` saves must remain intact; no local balance is eligible for Online minting.

## Baseline and scope

- Working tree at kickoff: modified `README.md`; untracked `docs/PLAYER_EXCHANGE_UPDATE_PLAN.md` and `unity-ship-assault/`. The latter is unrelated and untouched. No existing user save was read or modified for QA.
- Stack: Phaser 3, TypeScript, Vite. `SaveManager` validates/migrates version 32 under `mars-miner.v1`; world snapshots, inventories and finite extraction ledger persist separately from render chunks. No save schema has been changed here.
- `npm install` passed; `npm test` passed (177 core systems plus supplemental suites); `npm run build` passed with the pre-existing large game-bundle advisory.
- The previous two-world expansion notes report an earned Cryo-to-Mars-to-Cryo route with nickel, buildings, specialist installation and renewable core extraction under controlled browser frames. M0 requires a fresh repeat; its result is recorded below when complete, not inferred from those notes.

## Current economy mutation inventory

The validation and rollback listed here are **Local** behavior. None is a server receipt. Each row needs a versioned authoritative Online command or must be disabled in Online. Tests named below are existing local coverage and cannot prove Online ownership.

| Source or sink | Current code path | Current validation and persistence | Online receipt/test requirement |
| --- | --- | --- | --- |
| Mined tiles, ore drops and core relic | `MiningScene.update`, `MiningSystem.update`, `collectOreDrop`, `TileWorld` | Local collision, drill/cargo limits, destroyed cells and drops saved in `WorldSave`; core milestone and fuel are local | Canonical world/position/input/time and cell claim; atomic reward plus destruction; forged path/yield/replay tests |
| Renewable core fuel and interworld travel | `MiningScene` core extraction and `travelToMap`; `RenewableFuel.coreExtractionStep`, `Travel.travelQuote/commitTravel` | Exposed-core duration, fuel ceiling, allowlist, return reserve and candidate save rollback | Server timed extraction and one atomic map/fuel/world switch; repeated command receipt |
| Passive extraction | `MiningScene.applyAutomatedProduction`, `Warehouse.accumulateLocalProduction/accumulateAutomatedProduction`, `ExtractionSeams` | Elapsed cap, finite shared seam, local/ship capacity; ledger and timestamp saved | Server clock, production settlement at transaction boundaries, exact sink/capacity receipt |
| Cargo pickup, transfer, disposal and recovery | `Progress.collectUnits`, `Freight.transferFreight`, `Warehouse.transferWarehouseOre`, `MiningScene` discard/recover handlers | Half-unit/capacity/access checks and local save rollback in most transactions; recovery forfeits cargo | Stable drop IDs, single claim, authoritative capacities/location and nonrepeatable forfeiture receipt |
| Direct civilian/remote sale | `InventorySale.sellInventory`, `Civilisations.settleCivilianShipment`, `Sale.buildSaleReceipt`, `MiningScene` sale callbacks | Source inventory debit, capped bonuses/deliveries and save rollback | Server debit and credit issuance ledger, destination/demand validation, idempotent receipt |
| Contracts and system projects | `Progress.fulfillContract`, `ColonyOrders.deliverColonyOrder`, `SystemProjects` contributions, `MarketContracts` | Milestone once, required materials, planet gating and local rollback | Server milestone ownership, exact debits/rewards and replay test |
| Rig upgrades, specialist modules and optional gear | `RigUpgrade.installRigUpgrade`, `SpecialistModules.installSpecialist`, `Progress` purchase/service methods | Materials or credits, prerequisite/ownership, stat effects; saved locally | Server costs/ownership/capacity effects, once-only purchase and receipt |
| Building placement, upgrades, move, dismantle, repair | `MiningScene` construction handlers; `PlanetaryMaterials.spendPlanetaryMaterials`, `UndergroundStructures`, `ColonyManagement.dismantleBuilding` | Site/support/material/credit/capacity checks; rollback on failed save | Canonical site/ownership, exact debit/refund, no free refund cycle, competing-spend test |
| Ship/miner service, hull/fuel, cosmetics and consumables | `Progress.service/serviceAll`, purchase methods, `MiningScene` UI callbacks | Local cost and status checks, then local save | Server wallet and item state, no repeated award, revision receipt |
| Save import/reset/export | `SaveManager.parseSaveFile/migrateSave/write`, `MiningScene` import/reset callbacks | Versioned local validation; user-provided JSON can set local money/cargo | Backup-only storage; absolutely no Online balance or progress import/reset mint path |

`MiningScene.ts` is the main orchestration choke point. Direct mutations appear in its sale, freight, upgrade, construction, production, travel, mining, recovery and import callbacks. The Online adapter must cover all of them; wrapping only the player exchange would leave client mint paths.

## Existing online and hosting surface

- `market.html` / `src/market.ts` are a separate isolated beta market. They use custom Supabase Auth REST calls, a distinct `ore-frontier-market-session-v1` localStorage key, `auth/v1/otp`, refresh token, `auth/v1/user`, and PostgREST/RPC calls. Its UI does not read the mining save. The hand-written session flow is not the intended maintained client for Verified Online.
- `20261017000000_player_market.sql` creates legacy profiles, wallets, inventory, buy/sell listings, ledger, auth trigger and create/fill/cancel/admin-grant RPCs. RLS grants reads to authenticated users and mutation only through RPCs. This schema uses integer market units, lacks a general operation idempotency key, and does not prove game-earned cargo. The admin grant is service-role only in source; deployment state has not been rechecked.
- `20261017000001_market_beta_starter_balances.sql` is a **legacy test** faucet migration. No v2 path may consume its rows, trigger or grant. Both migrations remain untouched pending isolated backend review.
- `.env.example` has only browser publishable Supabase placeholders. No service-role key belongs in `VITE_` variables. `vite.config.ts` includes `market.html`; `public/_redirects` routes `/market` to it. `.github/workflows/pages.yml` publishes GitHub Pages on main/master pushes. README and `docs/BETA-MARKET.md` mention Cloudflare Pages and historical beta project status. These are configuration/history, not current production verification.
- No local/staging database, applied-migration listing, current Auth email-delivery check or production account access has been established in this audit. No migration was executed. Current quotas/runtime support require official docs/account verification before a deployment design is fixed.

## Trust boundary for M1+

Local saves and the legacy beta schema are untrusted for Verified Online credits/ore. Online startup must create a fresh server-owned campaign with zero balances. Every subsequent mint, debit, transfer and capacity change must be decided by versioned server rules and recorded with idempotent operation results. Until that full gameplay command path and real database contention tests exist, the player exchange must remain an isolated playtest and cannot be presented as the integrated mine-to-market feature.

## Fresh browser repeat

`output/playwright/player-exchange-m0-run.cjs` completed a fresh earned Cryo-to-Mars-to-Cryo route with controlled browser frames and real keyboard/mouse input, no resource grants. Seed 2223671298: core recovered at depth 441 m; rig returned to the dock with hull 100, 4 core fuel and zero overlap. Cryo warehouse/extractor were built from earned ore; then Mars warehouse/extractor were built, 4 nickel mined, and the ship returned to Cryo. Reinforced hull installation consumed the required imported nickel/iron, raised maximum hull from 100 to 120, and survived reload along with both colonies. Final core fuel was 2; no page errors. Visual captures inspected: `output/playwright/ore-earned-mars-frontier-extractor.png` and `ore-earned-hull-installed.png`. An initial attempt stopped on a removed `#freight-next` QA selector; the ignored harness was updated to current inventory pages and the whole route passed on rerun. The initial attempt is not counted as gameplay acceptance.

`output/playwright/player-exchange-m0-layout.cjs` passed 320×568, 390×844, 844×390, 1280×720 and 1597×777 in local Chrome. For both welcome and active game views, document scroll deltas were zero, no visible button extended beyond the viewport, no select/checkbox appeared, and no page error fired. Captures: `output/playwright/player-exchange-m0-intro-*.png` and `player-exchange-m0-game-*.png`. The 320×568 active-game image was visually inspected. This is browser emulation; physical Android remains untested.
