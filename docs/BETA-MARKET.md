# Ore Frontier player market beta

The global ore market is a separate online feature for player-to-player buy and sell orders. The mining campaign and its local save are not connected to it. The market's initial `test credits` and ore are server-owned beta balances; they are not the CREDIT token, have no cash value, and cannot be transferred on-chain.

## Current implementation

- `market.html` and `src/market.ts` provide email-link sign-in, an ore order book, order posting, partial fills, cancellation and explicit settlement confirmation.
- `supabase/migrations/20261017000000_player_market.sql` defines accounts, wallets, ore inventory, listings, an append-only ledger, row-level-security policies, and atomic database functions for listing, fill, cancel and capped playtest grants.
- Sell orders reserve ore. Buy orders reserve test credits. A fill moves reserved assets and updates the order and ledger in one database transaction. Cancellation restores only the unfilled reservation.
- The browser uses only the Supabase project URL and public anon key in `.env.local`, represented by `.env.example`. Never add the service-role key to a `VITE_` variable or browser bundle.
- `market_admin_grant` is restricted to the Supabase service role and caps each grant at 500 ore and 50,000 test credits. No game save, browser parameter or public route can create balances.
- A new account receives one beta starter balance from the auth-user trigger: 5,000 test credits, 100 Copper and 100 Iron. A locked database faucet caps total issuance at 1,000,000 credits and 20,000 units each of Copper and Iron (200 accounts). This lets a small tester cohort try the order book without a browser-callable service-role endpoint. These are test assets and have no cash value; they are not an on-chain token faucet.
- A user may have at most 10 open orders. A listing is limited to 1,000 units and 100,000 test credits per unit, with a 10,000,000 total value cap.

## Setup status

The dedicated `ore-frontier-beta` Supabase project has been created in the free `samuelgoodey` organization, in the Ireland region. The original five market tables, four settlement/grant functions, and row-level security were applied and verified in Supabase on 2026-10-17. The follow-up faucet table and account-trigger migration are local only and still need to be applied. The auth redirect allow-list is configured, and the public client variables are saved in Cloudflare Pages for both production and preview builds. The source changes still need to reach the PR before Cloudflare can build the hosted market route. Until then, `/market` on current deployments is not the new market page.

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured for both Cloudflare Pages environments. Apply the follow-up beta starter-balance migration before inviting testers. The service-role key must stay in a server-side secret store only if a separately reviewed admin-grant service is added; there is no such service in this client. The connected GitHub identity is `samuelgoodey`, while the repository belongs to `kackupa`; GitHub reports `push: false`, so the new source has not been committed to the PR or deployed.

## Required beta checks

Use two separate test accounts created after applying both migrations. Verify each account receives the bounded starter balance once and the global faucet cannot exceed its cap. Then check: listing reserves assets; two competing fills cannot oversell; partial fills move only the filled amount; cancellation releases the remainder once; self-trades and overspending are rejected; users cannot read another player's wallet or inventory; and neither game-save import nor the client can mint balances. Also verify email-link auth on the Pages preview, phone and desktop layout, and the Supabase free-tier limits before inviting players.

## Known status

The UI compiles and its setup screen has been checked locally. Database execution, email authentication, two-account settlement tests, production deployment, and physical-device behavior are not yet verified. This exchange is a test economy only; token launch and CREDIT utility are out of scope for this beta implementation.
