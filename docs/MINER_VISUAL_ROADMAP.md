# Miner visual progression roadmap

This is an original concept sheet for the current geometric Phaser miner, not a replacement sprite or a promise to expand its collision body. It turns the existing five drill hardware tiers into a coherent silhouette progression. The drill is the clearest earned upgrade; the cabin remains readable, the chassis grows modestly, and the pilot stays visible. Optional paint, suit, decal, and profile choices remain separate from upgrade identity.

![Original five-tier miner concept sheet](miner-tier-sheet.svg)

| Drill tier | Workshop name | Readable hardware change | Cut animation accent |
|---|---|---|---|
| 1 | Field Bit | Short single contact bit; narrow nose | Compact extension, small warm contact flash |
| 2 | Extended Auger | Longer twin rails and visible auger teeth | Repeating tooth glint while cutting |
| 3 | Resonance Lance | Coil collar around the drill rail | Matching-color pulse rings at breakthrough |
| 4 | Survey Bore | Braced nose and stabilizer struts | Brace settles on impact; controlled recoil |
| 5 | Laser Miner | Long emitter, heat fins, mint cutting channel | Heat rises during a sustained cut, then a brief visible vent |

## Shared parts and animation states

Keep the miner assembled from reusable vector shapes so tiers can share the same collision capsule and pilot position:

- **Chassis:** cabin shell, undercarriage, side armor, feet/skids, cargo bay, and a few panel highlights. Hull progression may add armor plates and modest side width; do not enlarge the collision body to match decorative growth.
- **Power pack:** replaceable rear tank and two status lamps. Fuel level should not add another survival meter or create a requirement for a new HUD bar.
- **Drill mount:** one pivot at the nose, a tier-specific head/rail/coil/frame/emitter, and the already implemented 360-degree aim. Keep decorative attachments clear of adjacent mineable cells.
- **Recovery attachments:** winch spool and cable guide; grapple housings that stay visually quiet until a catch; charge rack; salvage-magnet pickup halo. These identify installed equipment without changing optional cosmetic choice.
- **Pilot:** helmet window and one high-contrast visor highlight. Preserve pilot visibility inside the largest pod scale and during escape-suit ejection.

Use a small set of shared poses rather than a bespoke animation per tier: idle bob; lateral thrust; braking; drill extension and recoil; hard-impact brace; grapple tension/catch; winch pull; charge release; laser heat build/vent; and pilot ejection. Reduced-motion mode should retain static state cues and omit shake, pulsing, and camera-dependent flourish. Audio timing can accent the same cut/recoil/vent events without making movement noisy.

## Implementation guardrails

The current game draws the miner with Phaser Graphics in `MiningScene`; this sheet is a design reference only. Implement later as functions/data for chassis modules and drill modules, with color/material inputs from the equipped cosmetics. Keep progression modules mechanically distinct from cosmetic finishes. Validate every tier at the starter and maximum visual scales, aim in all directions, both gravity hemispheres, docking, and terrain contact. Browser review should check target readability at normal play zoom and orbital zoom before the sheet is treated as approved art.

Current implementation already covers the tier names, modest pod growth, 360-degree drill pivot, hardware cues, breakthrough effects, and tier-five heat/vent behavior. Remaining design work is human review of silhouette readability and this concept direction before any replacement art or animation expansion.
