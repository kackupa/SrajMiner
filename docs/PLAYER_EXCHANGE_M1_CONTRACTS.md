# Player Exchange M1 contracts and trust boundary

2026-10-19. Status: M1 contracts and local PostgreSQL v2 isolation tests passed. The empty foundation also applied in isolated Supabase staging with RLS, privileges and zero rows inspected. Live Auth/API owner isolation and server gameplay enforcement remain unverified. This document is a design contract for the later backend, not a claim that online trading works.

## Campaign decision

The user approved two separate campaigns. `mars-miner.v1` remains the Local save, playable offline and eligible only for authenticated backup/restore as data. A Verified Online campaign is created once from server-issued initial state: zero ore, zero credits, standard rig and landed mothership. Its inventory, wallet, progression, world and session revision are server-owned. Sign-in or backup never converts Local ore/credits into Online balances. The legacy `/market` beta and its faucet remain isolated.

## Wire units and limits

`src/game/online/MarketUnits.ts` defines integer `HalfUnits` and `CreditMinor`. One ore is two half-units; one credit is 100 minor units. A price is entered as whole credits per **full** ore. A half-unit fill costs `price_minor / 2`, with no float settlement. SQL `bigint` values cross JSON boundaries as validated decimal strings; unsafe JavaScript integers are rejected. `src/game/config.ts` holds beta limits: ten open listings, 1–2,000 half-units per listing, 1–100,000 credits per full ore, and 1,000,000,000 credit minor (10,000,000 credits) listing total. Server SQL must independently apply the same versioned limits and check multiplication/overflow.

`src/game/online/Protocol.ts` defines `online-1`, typed market commands and receipts, structured error codes, and a strict parser. The request contains a campaign UUID, ruleset, expected revision, operation UUID and typed command. It contains **no** trusted account ID, inventory total, wallet balance, ore yield or elapsed production time. Extra fields are rejected. The server derives the account from verified Auth and validates all world/capacity/access conditions from canonical state. No browser parser is an authority boundary.

`src/game/online/GameProtocol.ts` defines the first fixed-step movement/drilling batch: ordered input segments only, each 20–240 ms in 20 ms steps, at most 20 segments/1,000 ms per batch. The input may name an aim cell but never claims position, path, ore type, yield or resulting inventory. Server elapsed-time budget, canonical movement/collision, drill reach, cell state and session lease still need implementation; the parser alone cannot prove mining was legal.

## Idempotency and receipts

The server must reserve `(owner_id, operation_id)` in the same database transaction as each mutation. It stores a canonical input hash and final receipt. A retry with identical input returns the exact stored receipt; reuse with different input returns `OPERATION_CONFLICT`. The operation ID must survive network timeout and retry in the client. Revision checks prevent stale purchases and mixed device snapshots; they do not replace idempotency. A quote is informational and the fill rechecks listing price/revision, remaining escrow, buyer credits and authoritative ship room.

Receipts identify operation, campaign, kind, revision, server timestamp and exact debits/credits. The first game receipt additionally carries canonical position, last accepted sequence, destroyed cells and cargo deltas. They are durable facts; a success toast alone is never proof. The owner-facing receipt must omit counterparty private balances. The request/receipt schema must expand for every audited Local mutator before Online gameplay is enabled.

## Conservation rules

- Ore across all available inventories, listing escrow and Market returns changes only for server-verified mining/finite production, explicit gameplay consumption/refund, discard or recovery. Listing creation moves available to escrow. Purchase moves escrow to buyer ship. Cancel moves remaining escrow to returns. Claim moves returns to an accessible inventory. None of these trade moves mint ore.
- Player-to-player trade conserves total `credit_minor`: buyer debit equals seller credit. NPC credits, service costs and contract rewards have explicit issuance/sink ledger reasons. No client-reported balances enter these equations.
- Every source and sink is nonnegative. Capacity checks use current canonical state after bounded passive-production settlement. Partial fills and claims move exact integer half-units. `original = filled + remaining + cancelled`; once closed, remaining escrow is zero.
- All touched campaign revisions and ledger lines commit atomically with the operation receipt. A failed command leaves state unchanged. Database constraints and real concurrent transaction tests are required; the pure `conserved*` helpers only check arithmetic.

Global transaction lock order: operation key, affected campaign rows sorted by UUID, listing/escrow rows, then inventory/wallet rows in stable key order. Read a counterparty identifier before locking, then lock in global order and re-read the listing. Bounded retries for serialization/deadlock failures reuse the same operation ID. The market kill switch blocks creation/fills server-side while leaving reads/cancel/claims available.

## Legacy isolation evidence and remaining proof

Source inspection found only legacy `market_*` tables/RPCs, the separate `market.html` entry and `src/market.ts` REST client. The market and game protocol modules import config/types only; the backup module imports `SaveManager` strictly for Local storage validation. No online economy module calls legacy `market_*` or the beta faucet. The Local save key is unchanged. The v2 foundation migration creates empty `online_*` tables with owner-only reads and no browser write grant, mint function or import path. `tests/online-isolation-db.test.ts` applied both legacy migrations and the v2 foundation in in-memory PostgreSQL, then proved beta starter creation and a legacy admin grant left the v2 wallet at zero and inventory empty. It also denied authenticated direct writes and cross-owner reads. In isolated Supabase staging, the three v2 tables were empty, RLS was enabled and anon/authenticated browser write grants were absent. Live Auth/API isolation and future mutation functions still require separate review and tests.

## Evidence

`tests/online-contracts.test.ts` covers half-unit conversion, exact minor-cost arithmetic, boundaries/overflow, unsafe SQL integer strings, strict rejection of claimed balances/position/yield/extra fields, input duration/order and conservation identities. `tests/online-isolation-db.test.ts` is the local SQL isolation evidence. Full `npm test` and `npm run build` passed with the v2 foundation. No browser UI or save schema changed in M1.
