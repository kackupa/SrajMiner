# Ore Frontier beta release plan

## Beta promise

Ship a stable, phone-friendly mining game with an optional, shared player market. Mining remains playable offline and single-player; the first multiplayer feature is trading ore with other players. Do not put campaign saves or miner movement on a server in this beta.

## Release gates

1. **Mining and usability:** fix the star-map viewport, remove in-game native dropdowns, eliminate visible page scrollbars, and check the core loop on desktop plus the user's Android device. Release-blocking playtests: start, drill, manage cargo, return safely, store/sell, upgrade, travel, resume a save. Keep the README aligned with actual findings.
2. **Private market test:** add Supabase Auth and Postgres for public identities, ore listings, trades, balances, and an append-only transaction ledger. Use a small order board: sellers post a quantity and unit price; ore and credits are reserved on listing; another player can fill all or part; cancellation releases the remainder. Use one database transaction/RPC for each post, fill, and cancel. Enforce ownership, available balance, listing state, quantity, and price limits in the database; enable row-level security; never accept client-calculated balances or market settlement. Realtime only refreshes the board; it is not the source of truth.
3. **Economy and abuse checks:** market inventory is a separate online vault. Importing campaign saves never mints tradable ore or credits. Start with a capped beta supply, per-account order limits, rate limits, audit log, admin freeze, and a resettable test economy. Decide whether this is purely a playtest ledger or has any redeemable/on-chain value before inviting public users.
4. **Open beta:** deploy the static Vite build to Cloudflare Pages and Supabase to its free tier. The free quotas are useful for a small test, but Supabase free projects can pause after inactivity and do not include automatic database backups; establish manual exports and monitor quotas before invitations. ([Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Supabase pricing](https://supabase.com/pricing), [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits))
5. **Widen only after:** trade concurrency tests, exploit review, recovery/backup restore, Android touch check, browser checks, and a clear reset/incident process pass. Free hosting is a beta starting point, not a production availability promise.

## Market UX

One full-screen Market screen with a live status and your available credits/ore, compact ore tabs, and rows/cards showing best buy and sell prices, quantity, and age. Actions are direct buttons: **Sell ore**, **Buy ore**, **My orders**, **Cancel**. Quantity and unit price use visible stepper/text fields, never dropdowns. Show a quote and exact settlement before confirmation; distinguish reserved from available assets. Provide empty, offline, stale-price, insufficient-funds, and partial-fill states. On narrow screens, use one ore at a time with next/previous ore buttons and no nested scrolling.

## Website and free infrastructure

The game and website are **Ore Frontier** at **playorefrontier.xyz**, registered at Namecheap and connected to Cloudflare Pages. The current Pages project is free and creates branch previews; nameserver propagation for the custom domain remains pending. For the multiplayer market, use Supabase Auth/Postgres/Realtime on its free tier for a private test. Keep keys that can write data server-side only; the browser receives only public project configuration. Set up a staging project and a production project before open beta. Review current provider quotas, backup limits and inactive-project pauses before inviting players.

## Token and chain

The token name and ticker are **CREDIT**. Target **Robinhood Chain only**, with a planned **CREDIT/WETH** pair. The token is not launched; contract, supply, distribution, vesting and game utility remain to be defined. The DEX banner and launch media should promote Ore Frontier gameplay, the player market and a clear beta link. Do not imply token returns or promise game utility that is not live.

For the game beta, label the existing local credits as **test credits** until the wallet flow, ledger reconciliation, and contract integration are ready. Then connect the game-market account to a wallet and define exactly how on-chain CREDIT enters and leaves the game economy; do not let imported campaign saves mint tokens. The game ore order book can price listings in CREDIT, while the separate DEX pair is CREDIT/WETH. Before launch, choose the Robinhood Chain launchpad/DEX provider, verify their token listing and banner requirements, complete contract review and testnet trials, settle supply/distribution and permissions, and get jurisdiction-specific advice. Robinhood Chain is EVM-compatible, has mainnet chain ID 4663, and uses ETH for gas; Robinhood's official docs describe standard Solidity/Foundry/Hardhat contract deployment. ([Robinhood Chain contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/), [network details](https://docs.robinhood.com/chain/connecting/))

## X launch and media rollout

1. **Build in public (week before invites):** short progress clips focused on a player problem and fix; announce the beta scope plainly, with no token price or return language.
2. **Gameplay trailer (30–45 seconds, 16:9 plus 9:16 crop):** 0–3s miner descends into a glowing seam; 3–10s show directional drilling, ore pickup, hull/cargo feedback; 10–17s return to mothership and unload; 17–25s show the shared market listing and another player filling it; 25–35s show purchase/build/travel; final card: “Ore Frontier · browser beta · help shape the frontier.” Capture actual playable footage, add captions, UI tap/keyboard hints, and disclose that the market is beta. No token teaser in this video.
3. **Invite wave:** X post with a 10-second loop and direct beta link, then one follow-up thread explaining controls, market rules, known limitations, and feedback link. Invite a small cohort first; track first successful descent, safe return rate, market listing/fill/cancel success, mobile completion, and crash reports.
4. **Open beta:** publish a gameplay clip, changelog, and known-issues post together. Share weekly fixes and real test findings; do not manufacture player counts or imply live token utility.
5. **DEX launch creative:** create the listing banner and token page around actual mining gameplay. Use a short footage loop with the game name, ore trading, beta URL, and a plain statement of what CREDIT does at launch. Update it later as features ship.
6. **After beta stability:** publish CREDIT's real purpose, supply/distribution, permissions, risks, and contract address; then complete the review and provider checks before opening the CREDIT/WETH market.
