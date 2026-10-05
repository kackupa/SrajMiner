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

## Upgrade levels

| Category | Levels 1 → 5                          | Purchase costs, levels 2 → 5 |
| -------- | ------------------------------------- | ---------------------------- |
| Drill    | 1 / 1.5 / 2.2 / 3.1 / 4.3 × speed     | $140 / $360 / $850 / $1,800  |
| Fuel     | 140 / 190 / 260 / 350 / 480 L         | $120 / $320 / $750 / $1,600  |
| Cargo    | 16 / 24 / 34 / 48 / 64 slots          | $150 / $380 / $900 / $1,900  |
| Hull     | 100 / 140 / 195 / 270 / 380 integrity | $130 / $340 / $800 / $1,700  |
| Engine   | 1 / 1.18 / 1.4 / 1.65 / 1.95 × output | $160 / $400 / $950 / $2,000  |

Fuel and hull purchases also fill the newly added capacity. An early full copper load earns $288, enough to service the pod and afford its first upgrade. Starting bank balance is $80.

## Consumption and service

Movement/descent input: 0.55 L/s. Thrust: 1.25 L/s. Active drilling: an additional 1.4 L/s. No idle drain. Fuel service costs $0.30 per missing liter; hull repair costs $0.45 per missing integrity, each rounded up to whole credits.

Base drilling times are 0.30 s for dirt, 0.60 s for basalt, 1.05 s below 300 m, 1.50 s below 600 m, and 1.90 s below 1,000 m. Divide by drill output. Traversal between tiles adds time. Level 2 drill is intentionally conspicuous.

## Damage tuning from playtesting

Initial testing showed a 360 m run and return could consume around three quarters of the hull through cave drops and landing. Raised the safe impact threshold from 245 to 280 pixels/s and reduced damage from 0.25 to 0.20 per excess pixel/s. Terminal fall speed remains 430: a maximum-speed landing costs 30 hull. One-tile drops remain safe. Hull upgrades raise the margin for error, while engine upgrades make ascent and braking stronger.

Fuel is deliberately forgiving on the first expedition. Longer excursions and chasing high-value seams introduce the return decision. Long-session late-game economics still need wider human playtesting.
