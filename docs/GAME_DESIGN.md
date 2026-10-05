# Game design — v0.1

## The promise

A tiny machine against a quiet, enormous planet. The player chooses when a promising seam is worth another few seconds away from safety. A good expedition finances a noticeably better next one.

## Complete loop

Start at Outpost 07 with $80, full fuel, full hull, and 16 cargo slots. The first three rows beneath the pod contain an onboarding copper seam. Hold a direction to drill; ore is automatically collected. Excavated passages remain open forever. Return through them using thrust, then sell at the compact surface hub. The full hub is within service range; precise parking is unnecessary.

The three service panels are ore exchange, fuel/repair, and a five-category workshop. Panels pause time. Upgrade levels run from 1 through 5. The game is open-ended; reaching the deep layer is a milestone rather than a victory screen.

## Risk

Only fuel, hull, and cargo need managing. Thrusters and drills use fuel. Gravity itself does not. Long uncontrolled falls cause velocity-based hull damage. Small individual tile drops are safe. Cargo is weightless and has a strict capacity: drilling a full bay's ore tile destroys that ore without storing it, with explicit feedback.

Failure or confirmed emergency recovery removes unsold cargo and restores the pod at the outpost. Money, upgrades, exploration, and tunnels survive. Free recovery is deliberately available to avoid bankruptcy soft locks.

## World

48 tiles wide, effectively open-ended below, 40 pixels per tile, 12 displayed meters per row. Seeded 16×16 chunks are generated on demand. Coarse ore cells with missing pieces form clustered veins; occasional ore-free cave cells interrupt solid ground. Rust, basalt, hard rock, dense rock, and a strange deep layer provide changing colors and drill times.

Headlights reveal a generous neighborhood around the pod. Previously seen passages remain dim. Unseen rock hides its resource content. Layer names, depth, and maximum depth communicate progression.

## Feel and presentation

Original procedural pixel-style terrain, a yellow pod, utility sheds, flags, an antenna, layered mountains, atmospheric dust, and a crescent moon. A muted industrial HUD uses amber for fuel/currency and pale green for hull. Cracks, a cut progress bar, debris, short shake, floating pickups, sale counting, and synthesized sounds provide feedback.

At 1,050 m, the pod detects a buried transmission, earns a one-time $500 survey bounty, and records a discovery flag. This is a small mystery teaser, not a quest or story system.

## Deliberate limits

No enemies, weapons, hunger, crafting, quests, NPC dialogue, multiple planets, extra vehicles, online features, or monetization. The game is a desktop vertical slice, not a large mining simulator.
