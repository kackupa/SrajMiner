# Physical phone acceptance test

The browser checks do not establish physical-device usability or thermal performance. Run this on iPhone Safari and Android Chrome before marking the mobile goal complete.

## Access
On the development computer, run `npm run dev -- --host 0.0.0.0`. Connect the phone to the same trusted Wi-Fi and open the printed network address. Keep the development server private to that network. Use a fresh browser profile for the fresh-game test; do not clear an existing campaign to test.

## Record
Record phone model, OS/browser version, portrait and landscape viewport, date, and whether reduced motion is enabled. Note whether the phone becomes noticeably hot or starts dropping frames after 15 minutes.

## Play
1. Start fresh. Move, drill, thrust and brake using touch alone. Slide between directions without lifting. Hold thrust and drill with two fingers; release each independently.
2. Mine the copper and iron seams near the ship. Return with enough carried ore for the camp. Recharge for free. Place the camp, then earn copper/iron/silver and place the uplink.
3. Store and withdraw half-units. Fill both holds, discard an amount from the miner, then withdraw the missing construction ore. Cancel a discard first and verify nothing changes. Verify the native confirmation is readable.
4. Sell using Max, switch customers, buy an affordable upgrade. Reload and check credits, levels, inventory and buildings.
5. Rotate during held input and while entering an amount. Switch apps and lock/unlock. The game should pause on interruption; no held inputs should survive. Menu values and selected ore should remain through rotation.
6. Check every component in Workshop. Navigate all main menus, Back/Return to mine and Previous/Next. No clipped controls, page-width overflow or browser scrollbars. Check with the software keyboard open.
7. Play for 15 minutes, including sustained mining and returning. Note battery/heat, input delays and jank. Any collision tunnelling, inability to return on the tested route, or duplicated ore is blocking.

Report the first unclear action or awkward thumb reach as a usability failure, even if the flow technically completes. Do not mark a device pass solely because the game loads.
