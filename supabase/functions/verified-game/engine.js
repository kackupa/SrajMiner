const o = { tile: 40, width: 48, homeColumn: 24, chunk: 16, meters: 12, spawnX: 980, spawnY: -22 }, et = [
  { id: "scout", slot: "hull", name: "Scout hull", description: "Light cabin. Quick handling, less armour.", power: 8, materials: {}, stats: { hull: 0.85, engine: 1.15 } },
  { id: "hauler", slot: "hull", name: "Hauler hull", description: "External cargo pods. More ore, slower handling.", power: 20, materials: { copper: 6, iron: 4 }, stats: { cargo: 1.6, engine: 0.85 } },
  { id: "bastion", slot: "hull", name: "Bastion hull", description: "Heavy armour for dangerous expeditions. Slower thrust.", power: 30, materials: { iron: 10, silver: 3 }, stats: { hull: 1.7, engine: 0.8 } },
  { id: "standard-hull", slot: "hull", name: "Frontier hull", description: "Balanced cabin for everyday expeditions.", power: 12, materials: {} },
  { id: "borer", slot: "drill", name: "Borer drill", description: "Reliable standard cutting head.", power: 20, materials: {} },
  { id: "excavator", slot: "drill", name: "Excavator drill", description: "High torque cutter. 65% faster cutting, higher power requirement.", power: 38, materials: { iron: 6, copper: 4 }, stats: { drill: 1.65 } },
  { id: "precision", slot: "drill", name: "Precision drill", description: "Compact cutter. Frees fitting power for other equipment.", power: 10, materials: { copper: 4, silver: 2 }, stats: { drill: 0.9 } },
  { id: "standard-engine", slot: "engine", name: "Survey engines", description: "Balanced lift and handling.", power: 15, materials: {} },
  { id: "lift-engine", slot: "engine", name: "Heavy lift engines", description: "35% stronger engine performance for steep return journeys.", power: 28, materials: { iron: 6, copper: 6 }, stats: { engine: 1.35 } },
  { id: "efficient-engine", slot: "engine", name: "Compact engines", description: "Lower fitting power with gentler movement.", power: 8, materials: { copper: 4 }, stats: { engine: 0.9 } },
  { id: "standard-cell", slot: "battery", name: "Survey battery", description: "100 fitting power. Standard charge reserve.", power: 0, capacity: 100, materials: {} },
  { id: "expedition-cell", slot: "battery", name: "Expedition battery", description: "140 fitting power and 50% more charge.", power: 0, capacity: 140, materials: { copper: 6, iron: 4 }, stats: { fuel: 1.5 } },
  { id: "industrial-cell", slot: "battery", name: "Industrial battery", description: "190 fitting power. Double charge, heavier handling.", power: 0, capacity: 190, materials: { copper: 16, silver: 8, iron: 8 }, stats: { fuel: 2, engine: 0.9 } },
  { id: "unarmed", slot: "weapon", name: "No weapon", description: "Keep power available for mining. Retreat to escape creatures.", power: 0, materials: {} },
  { id: "machine-gun", slot: "weapon", name: "Machine gun", description: "Rapid shots. Hold Shift + click. Uses battery charge.", power: 15, materials: { iron: 4, copper: 2 }, weapon: { cooldown: 0.14, energy: 0.45, damage: 0.35, range: 340, color: 16765322 } },
  { id: "autocannon", slot: "weapon", name: "Autocannon", description: "Slow, forceful rounds. Heavy hits and bright impact bursts.", power: 28, materials: { iron: 10, silver: 2 }, weapon: { cooldown: 0.65, energy: 2, damage: 1.5, range: 420, color: 16750707 } },
  { id: "beam-laser", slot: "weapon", name: "Beam laser", description: "Precise energy pulses. High power demand and charge use.", power: 40, materials: { copper: 12, silver: 6 }, weapon: { cooldown: 0.08, energy: 0.65, damage: 0.3, range: 460, color: 9106658 } },
  { id: "empty-utility", slot: "utility", name: "Empty utility bay", description: "Leave room in your power budget.", power: 0, materials: {} },
  { id: "cargo-rack", slot: "utility", name: "Cargo rack", description: "25% more cargo capacity.", power: 12, materials: { iron: 4 }, stats: { cargo: 1.25 } },
  { id: "survey-array", slot: "utility", name: "Survey array", description: "50% greater scanner performance.", power: 16, materials: { copper: 5, silver: 2 }, stats: { scanner: 1.5 } }
], U = {
  depthMeters: 3600,
  passageRadius: 5,
  physicalPassageRadius: 72,
  drillAssistReach: 160
}, ke = U.depthMeters / o.meters * o.tile, tt = U.passageRadius * o.tile, rt = ke * 2, it = rt / o.tile, ae = { radiusRows: 40, columns: Math.round(Math.PI * 40) }, de = (r) => r ? r.radiusRows * o.tile : ke, He = (r) => r ? r.radiusRows * 2 : it, ie = (r) => He(r) * o.tile, st = (r) => r ? r.radiusRows * o.meters : U.depthMeters, at = (r, e) => r < de(e) ? 1 : -1, nt = (r, e) => r < de(e) ? 0 : ie(e), ot = (r, e) => {
  const t = de(e), s = ie(e);
  return Math.max(0, Math.floor(((r < t ? r : s - r) + 16) / o.tile * o.meters));
}, K = { maxRise: 40, seconds: 0.18, footClearance: 22, maxFallSpeed: 60 }, c = {
  gravity: 430,
  acceleration: 650,
  thrust: 980,
  horizontal: 145,
  rise: 185,
  fall: 430,
  safeImpact: 280,
  drillingDescent: 220,
  damageScale: 0.2,
  halfWidth: 13,
  halfHeight: 16,
  /** A narrow physical hull lets the visible pod glide past jagged and curved tile corners. */
  horizontalCollisionInset: 8,
  /** Auto-align around small floor/ceiling lips while steering, never through a full block. */
  horizontalCornerTolerance: 8
}, lt = {
  minimumDepthMeters: 60,
  platform: { credits: 140, materials: { copper: 2, iron: 1 }, widthTiles: 5 },
  service: { credits: 0, materials: { iron: 4, copper: 4 }, widthTiles: 5 },
  light: { credits: 0, materials: { copper: 1, iron: 1 }, widthTiles: 1, range: 280, rays: 120, refreshSeconds: 0.3 },
  turret: { credits: 560, materials: { iron: 4, silver: 3 }, widthTiles: 3, range: 440, reloadSeconds: 1.4 },
  "trade-post": { credits: 0, materials: { copper: 4, iron: 4, silver: 2 }, widthTiles: 5 },
  habitat: { credits: 0, materials: { copper: 6, iron: 4 }, widthTiles: 7, serviceRadius: 220 },
  warehouse: { credits: 0, materials: { iron: 3, silver: 1 }, widthTiles: 5, baseCapacity: 40, capacityUpgrade: [0, 240, 520, 900] },
  extractor: { credits: 0, materials: { copper: 3, iron: 1 }, widthTiles: 4, ratesPerHour: [0, 120, 240, 480], upgradeCredits: [0, 0, 680, 1800] },
  automation: { offlineCapSeconds: 43200 },
  wall: { credits: 80, materials: { copper: 1 }, widthTiles: 1 },
  gate: { credits: 220, materials: { iron: 2 }, widthTiles: 3 },
  fort: { credits: 1400, materials: { iron: 8, silver: 5 }, widthTiles: 7, integrity: 4, linkRadius: 640, rangeBonus: 120 },
  serviceRadius: 100
}, he = { moving: 0.55, thrust: 1.25, drilling: 1.4 }, Se = {
  copper: {
    name: "Copper",
    value: 18,
    color: 15769963,
    hex: "#f0a16b",
    min: 0,
    max: 230,
    rarity: 0.34
  },
  iron: {
    name: "Iron",
    value: 28,
    color: 10464949,
    hex: "#9faeb5",
    min: 24,
    max: 480,
    rarity: 0.26
  },
  silver: {
    name: "Silver",
    value: 55,
    color: 13428958,
    hex: "#cce8de",
    min: 120,
    max: 850,
    rarity: 0.21
  },
  gold: {
    name: "Gold",
    value: 105,
    color: 16108130,
    hex: "#f5ca62",
    min: 312,
    max: 2e3,
    rarity: 0.15
  },
  diamond: {
    name: "Diamond",
    value: 260,
    color: 8451561,
    hex: "#80f5e9",
    min: 612,
    max: 1 / 0,
    rarity: 0.085
  },
  nickel: { name: "Nickel", value: 72, color: 12174732, hex: "#b9c58c", min: 180, max: 1800, rarity: 0.12 },
  titanium: { name: "Titanium", value: 155, color: 10862064, hex: "#a5bdf0", min: 600, max: 1 / 0, rarity: 0.095 },
  cobalt: { name: "Cobalt", value: 125, color: 7248127, hex: "#6e98ff", min: 360, max: 2400, rarity: 0.09 },
  cryocrystal: { name: "Cryocrystal", value: 210, color: 14022911, hex: "#d5f8ff", min: 288, max: 600, rarity: 0.075 }
}, W = Object.keys(Se), Te = [
  {
    min: 0,
    name: "RUST FIELDS",
    type: "dirt",
    hardness: 0.3,
    colors: [8736835, 9722697, 7620671]
  },
  {
    min: 100,
    name: "BASALT SHELF",
    type: "rock",
    hardness: 0.6,
    colors: [6639691, 7361869, 5784895]
  },
  {
    min: 300,
    name: "IRON VEIL",
    type: "hard",
    hardness: 1.05,
    colors: [5325386, 6310482, 4668228]
  },
  {
    min: 600,
    name: "DEEP SILENCE",
    type: "hard",
    hardness: 1.5,
    colors: [3554889, 4474452, 3159360]
  },
  {
    min: 1e3,
    name: "THE BELOW",
    type: "hard",
    hardness: 1.9,
    colors: [2572098, 3427149, 2373692]
  }
], ht = (r) => [...Te].reverse().find((e) => r >= e.min) ?? Te[0], we = {
  "mars-frontier": {
    name: "Mars Frontier",
    shortName: "MARS / RUST FIELDS",
    strata: ["RUST FIELDS", "BASALT SHELF", "IRON VEIL", "DEEP SILENCE", "THE BELOW"],
    palette: [8736835, 6639691, 5325386, 3554889, 2572098],
    caveChance: 0.12,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 1.5, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [1516844, 1516844, 9200470, 9200470], ground: 12222556, edge: 14722934, mountains: [5853006, 7952718, 10250321], moon: 13022370 }
  },
  "cryo-shelf": {
    name: "Cryo Shelf",
    shortName: "ICE MOON / CRYO SHELF",
    strata: ["CRYO DUST", "FROZEN BASALT", "BURIED HULL", "DEEP ICE", "CORE SHADOW"],
    palette: [5404804, 4284016, 3623263, 2702420, 2438219],
    caveChance: 0.17,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 1.5 },
    surface: { sky: [1055529, 1387579, 3233124, 5866380], ground: 6523285, edge: 11130325, mountains: [2702928, 3561065, 4877689], moon: 10801619 }
  },
  "hull-graveyard": {
    name: "Hull Graveyard",
    shortName: "ARK REMAINS / HULL GRAVEYARD",
    strata: ["OUTER PLATING", "BROKEN DECKS", "ENGINE BULKHEAD", "REACTOR VAULT", "BLACK BOX"],
    palette: [5860712, 4807516, 4606805, 3619912, 2635069],
    caveChance: 0.21,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 1.5, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [1055521, 1912885, 3425866, 6585207], ground: 5860457, edge: 10597282, mountains: [2438970, 3491399, 5136988], moon: 11716800 }
  },
  "prism-fault": {
    name: "Prism Fault",
    shortName: "CRYSTAL FAULT / PRISM VEIN",
    strata: ["GLASS CRUST", "PRISM BED", "SILVER FAULT", "LUMEN VEIN", "CORE GEODE"],
    palette: [6577024, 5656441, 4409455, 3429737, 2379612],
    caveChance: 0.09,
    geodeChance: 0.08,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 1.5, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [1513001, 2368324, 3618660, 5657728], ground: 6643586, edge: 11776493, mountains: [2960203, 4012898, 5460595], moon: 12830701 }
  },
  "cinder-vale": {
    name: "Cinder Vale",
    shortName: "EMBER WORLD / CINDER VALE",
    strata: ["ASHGLASS COAST", "OBSIDIAN RIFT", "SULFUR VEIL", "SEALED MAGMA", "EMBER HEART"],
    palette: [7951180, 6112584, 5325130, 4536898, 3681596],
    caveChance: 0.16,
    geodeChance: 0.04,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 0, cobalt: 1.5, cryocrystal: 0 },
    surface: { sky: [1840928, 3154218, 5847098, 9326912], ground: 6899264, edge: 15764056, mountains: [3353140, 4928569, 7357244], moon: 15246188 }
  },
  "vesper-9": {
    name: "Vesper-9",
    shortName: "RETURN WORLD / VESPER-9",
    strata: ["LANTERN GROVE", "ROOTED SHELF", "ECHO REEF", "DUSK MANTLE", "CRYSTAL CORE"],
    palette: [4353893, 3628124, 3427673, 3161685, 2569546],
    caveChance: 0.23,
    geodeChance: 0.08,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 1.5, diamond: 0, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [1055527, 1518650, 3234135, 6587243], ground: 4353373, edge: 11721882, mountains: [2374978, 3232589, 4680533], moon: 12639397 }
  }
}, D = [
  { id: "core-mars", mapId: "mars-frontier", name: "Mars core", tint: 16758382, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-cryo", mapId: "cryo-shelf", name: "Cryo core", tint: 10220002, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-hull", mapId: "hull-graveyard", name: "Iron core", tint: 11000253, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-prism", mapId: "prism-fault", name: "Prism core", tint: 12953599, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-cinder", mapId: "cinder-vale", name: "Cinder core", tint: 16749664, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-vesper", mapId: "vesper-9", name: "Vesper core", tint: 11725198, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 }
], G = { unitsPerCore: 4, jumpCost: 1, extractionSeconds: 10, renewableCeiling: 4 };
D.filter((r) => r.mapId !== "vesper-9").map((r) => r.id);
const ct = {
  "mars-frontier": { chance: 0.012, units: 2, tint: 16754282, name: "THERMAL SEAM", detail: "WARM CORE VEIN · GUARANTEED 2 UNITS" },
  "hull-graveyard": { chance: 0.018, units: 2, tint: 11000253, name: "HULL SALVAGE", detail: "ARK ALLOY CACHE · GUARANTEED 2 UNITS" },
  "cinder-vale": { chance: 0.016, units: 2, tint: 16749664, name: "EMBER GEODE", detail: "SEALED THERMAL CRYSTAL · GUARANTEED 2 UNITS" },
  "vesper-9": { chance: 0.02, units: 3, tint: 11725198, name: "LANTERN BLOOM", detail: "LIVING CRYSTAL CLUSTER · GUARANTEED 3 UNITS" }
}, Ee = {
  drill: {
    name: "Drill",
    description: "Cut faster, extend the drill beam, and widen each pass at higher levels.",
    values: [1, 1.5, 2.2, 3.1, 4.3],
    costs: [140, 360, 850, 1800],
    unit: "× cutting speed",
    icon: "↧"
  },
  fuel: {
    name: "Battery",
    description: "Stay out a little longer.",
    values: [140, 190, 260, 350, 480],
    costs: [120, 320, 750, 1600],
    unit: " charge capacity",
    icon: "◒"
  },
  cargo: {
    name: "Cargo bay",
    description: "Bring more of the shelf home.",
    values: [16, 24, 34, 48, 64],
    costs: [150, 380, 900, 1900],
    unit: " slots",
    icon: "▦"
  },
  hull: {
    name: "Hull",
    description: "Take the harder landing.",
    values: [100, 140, 195, 270, 380],
    costs: [130, 340, 800, 1700],
    unit: " integrity",
    icon: "⬡"
  },
  engine: {
    name: "Engine",
    description: "Climb faster. Handle better.",
    values: [1, 1.18, 1.4, 1.65, 1.95],
    costs: [160, 400, 950, 2e3],
    unit: "× thrust",
    icon: "↑"
  },
  scanner: {
    name: "Survey scanner",
    description: "Push back the fog. Level 5 surveys the full map width around you.",
    values: [4, 8, 13, 22, o.width],
    costs: [180, 420, 950, 2200],
    unit: " tile radius",
    icon: "⌕"
  },
  grapple: {
    name: "Auto grapple",
    description: "A safety hook fires during a dangerous fall and catches higher rock through a clear path.",
    values: [100, 135, 170, 205, 240],
    costs: [170, 410, 980, 2100],
    unit: " px catch range",
    icon: "⌁"
  }
}, dt = Object.keys(Ee), ut = [
  { firstLevel: 6, label: "FIRST PLANETARY CORE RECOVERED", requirement: "first-core" },
  { firstLevel: 11, label: "2 PLANETARY CORES LOGGED", requirement: "two-cores" },
  { firstLevel: 16, label: "ALL PLANETARY CORES LOGGED", requirement: "all-cores" }
];
function ft(r) {
  return [...ut].reverse().find((e) => r >= e.firstLevel);
}
function mt(r, e) {
  const t = ft(r);
  return t ? t.requirement === "first-core" ? e.coreRelics.some((s) => D.some((i) => i.id === s)) : t.requirement === "two-cores" ? e.coreRelics.length >= 2 : D.every((s) => e.coreRelics.includes(s.id)) : !0;
}
const ne = {
  balanced: { name: "Balanced", description: "No bonus, no trade-off. Change paths freely while docked.", rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1 },
  seamCutter: { name: "Seam Cutter", description: "Cut hard rock 20% faster once the deep strata begin.", rockDrillMultiplier: 1.2, scanRadiusBonus: 0, cargoMultiplier: 1 },
  surveyor: { name: "Surveyor", description: "Survey two tiles farther around the pod; the map still reveals only explored ground.", rockDrillMultiplier: 1, scanRadiusBonus: 2, cargoMultiplier: 1 },
  hauler: { name: "Hauler", description: "Carry 25% more ore before the hold fills.", rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1.25 }
};
function Z(r, e) {
  const t = Ee[r], s = t.values;
  if (e <= s.length) return s[Math.max(1, e) - 1];
  const i = e - s.length;
  switch (r) {
    case "drill":
      return s[4] + Math.sqrt(i) * 0.3;
    case "fuel":
      return s[4] + Math.sqrt(i) * 80;
    case "cargo":
      return s[4] + Math.sqrt(i) * 10;
    case "hull":
      return s[4] + Math.sqrt(i) * 55;
    case "engine":
      return s[4] + Math.sqrt(i) * 0.035;
    case "scanner":
      return Math.min(o.width * 2, o.width + Math.sqrt(i) * 8);
    case "grapple":
      return s[4] + Math.sqrt(i) * 14;
  }
}
function pt(r, e) {
  const t = Ee[r], s = t.costs;
  if (e <= s.length) return s[Math.max(1, e) - 1];
  const i = e - s.length;
  return Math.ceil(s[s.length - 1] * (1 + i * 0.45));
}
const xe = (r, e) => Z(e, r[e]), fe = (r) => r <= 5 ? [1, 1, 2, 3, 4][Math.max(0, r - 1)] : Math.min(o.width, 4 + Math.floor(Math.log2(r - 4))), gt = { fuelPrice: 0, hullPrice: 0.45 }, ee = { packCost: 180, packSize: 3, pickupRadius: 28 }, Ne = { cost: 420 }, be = { cost: 760, fuelPerSecond: 1.8 }, te = { cost: 780, thrustMultiplier: 1.45, speedMultiplier: 1.25 }, re = { cost: 880, pullMultiplier: 1.7, fuelMultiplier: 1.5 }, z = { fallSpeed: 205, impactWindowSeconds: 1.5, predictionStepSeconds: 1 / 30, hangSeconds: 0.85, cooldownSeconds: [7, 6, 5, 4, 3] }, yt = {
  hab: { name: "Hab Standard", description: "The hard-wearing outpost finish.", cost: 0, hull: 15386497, trim: 16768928, light: 16773308 },
  polar: { name: "Polar White", description: "High-visibility ice-runner enamel.", cost: 180, hull: 6473671, trim: 11596260, light: 14811120 },
  ark: { name: "Ark Salvage", description: "Deep green, recovered from the old hull.", cost: 360, hull: 8632462, trim: 13166765, light: 15269841 },
  prism: { name: "Prism Bloom", description: "Violet lacquer with a crystal-bright edge.", cost: 600, hull: 11901672, trim: 14797567, light: 15919359 }
}, vt = {
  hab: { name: "Hab Issue", description: "Standard insulated outpost suit.", cost: 0, body: 14278608, trim: 15386497 },
  polar: { name: "Polar Survey", description: "Reflective ice-runner shell.", cost: 160, body: 5617853, trim: 13301998 },
  ark: { name: "Ark Salvage", description: "Field repairs stitched from mothership canvas.", cost: 320, body: 7576178, trim: 13166765 },
  prism: { name: "Prism Runner", description: "A violet suit with a bright helmet seal.", cost: 520, body: 10123721, trim: 14797567 }
}, Mt = {
  standard: { name: "Hab Mark", description: "Outpost identification stripe.", cost: 0, color: 15386497, style: "stripe" },
  arrow: { name: "Descent Arrow", description: "A bold directional survey mark.", cost: 140, color: 7527888, style: "arrow" },
  ark: { name: "Mothership Crest", description: "The lost ship’s recovery insignia.", cost: 280, color: 10802851, style: "crest" },
  prism: { name: "Prism Trace", description: "A luminous mark for deep runs.", cost: 440, color: 12821247, style: "prism" }
}, wt = {
  standard: { name: "Hab Runner", description: "Balanced outpost frame · warm cabin glow.", cost: 0, style: "standard", cabin: 9688268 },
  antenna: { name: "Survey Scout", description: "Beacon mast and sensor vane · mint cabin glow.", cost: 220, style: "antenna", cabin: 10875345 },
  stabilizers: { name: "Cavern Surveyor", description: "Twin landing fins · ice-blue cabin glow.", cost: 360, style: "stabilizers", cabin: 9756671 },
  armor: { name: "Ark Bulwark", description: "Recovered side rails · amber cabin glow.", cost: 540, style: "armor", cabin: 16763526 }
}, Ce = [
  { id: "fragment-1", milestoneId: "first-core-sample", row: 8, x: 24, title: "Warm core sample", landmark: "Thermal Observatory", chamber: { halfWidth: 4, halfHeight: 2 }, detail: "A live thermal trace reveals a safe fracture through the shelf." },
  { id: "fragment-2", milestoneId: "basalt-vein", row: 27, x: 24, title: "Basalt sample", landmark: "Basalt Engine Hall", chamber: { halfWidth: 5, halfHeight: 2 }, detail: "A sample of iron-bearing basalt." },
  { id: "fragment-3", milestoneId: "deep-scan", row: 52, x: 24, title: "Deep mineral sample", landmark: "Deep rock cavern", chamber: { halfWidth: 6, halfHeight: 3 }, detail: "A mineral sample from a deep fracture." },
  { id: "fragment-4", milestoneId: "route-signal", row: 90, x: 24, title: "Lower strata sample", landmark: "Lower rock cavern", chamber: { halfWidth: 7, halfHeight: 3 }, detail: "A sample from the lower geological layer." }
], xt = [
  { id: "hash-cryo", mapId: "cryo-shelf", x: 12, row: 16, name: "ICE SAMPLE", hash: "7C1A·09EF·B44D", crew: "Asha Vale", role: "Survey technician", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A shipyard checksum, signed before the mothership left orbit." },
  { id: "hash-hull", mapId: "hull-graveyard", x: 12, row: 22, name: "WRECK REGISTER", hash: "A308·F11C·620B", crew: "Orrin Bale", role: "Flight Recorder", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A preserved survey record." },
  { id: "hash-prism", mapId: "prism-fault", x: 36, row: 32, name: "CRYSTAL SAMPLE", hash: "D9E2·44A7·C015", crew: "Imani Cho", role: "Navigator", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "An archived reading from the crystal strata." },
  { id: "hash-mars", mapId: "mars-frontier", x: 9, row: 20, name: "RED DUST INDEX", hash: "51B7·C82D·A903", crew: "Sol Reyes", role: "Surface Lead", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A checksum from the first surface team, preserved under the frontier." }
], bt = {
  frame: { name: "Ship frame", description: "The craft’s reinforced outer structure." },
  propulsion: { name: "Engine", description: "The engine that carries the craft between worlds." },
  navigation: { name: "Navigation unit", description: "The unit that charts routes between planets." },
  "life-support": { name: "Life-support unit", description: "The system that keeps the craft and crew alive." }
}, Ct = 200, St = [
  { ore: "copper", left: 16, right: 19, top: 0, bottom: 2 },
  { ore: "iron", left: 16, right: 19, top: 3, bottom: 4 },
  { ore: "silver", left: 16, right: 19, top: 8, bottom: 9 }
], Ue = { worlds: ["cryo-shelf", "mars-frontier"] }, We = {
  reinforcedHull: { hullMultiplier: 1.2 },
  efficientCooling: { drillingMultiplier: 0.9 }
}, Et = "online-1", T = {
  fixedStepMs: 20,
  maxSegmentMs: 240,
  maxSegmentsPerBatch: 20,
  maxBatchMs: 1e3
}, _t = {
  caveColumn: 33,
  caveFloor: 13,
  safeLeft: 29,
  safeRight: 35,
  seams: [
    { ore: "copper", left: 16, right: 19, top: 0, bottom: 2 },
    { ore: "iron", left: 16, right: 19, top: 3, bottom: 5 },
    { ore: "copper", left: 29, right: 31, top: 13, bottom: 14 },
    { ore: "iron", left: 32, right: 35, top: 13, bottom: 14 },
    { ore: "silver", left: 40, right: 45, top: 20, bottom: 21 },
    { ore: "cryocrystal", left: 44, right: 46, top: 18, bottom: 19 }
  ]
}, me = (r) => !!r && typeof r == "object" && !Array.isArray(r), pe = (r, e) => Object.keys(r).length === e.length && e.every((t) => Object.hasOwn(r, t)), ge = (r) => typeof r == "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r), Q = (r, e, t) => typeof r == "number" && Number.isSafeInteger(r) && r >= e && r <= t;
function It(r) {
  if (!me(r) || !pe(r, ["campaign_id", "ruleset_version", "expected_revision", "operation_id", "session_id", "segments"]) || !ge(r.campaign_id) || r.ruleset_version !== Et || !Q(r.expected_revision, 0, Number.MAX_SAFE_INTEGER) || !ge(r.operation_id) || !ge(r.session_id) || !Array.isArray(r.segments) || r.segments.length < 1 || r.segments.length > T.maxSegmentsPerBatch) return null;
  let e = 0, t = -1;
  for (const s of r.segments)
    if (!me(s) || !pe(s, ["sequence", "duration_ms", "left", "right", "up", "down", "drill", "aim_cell"]) || !Q(s.sequence, 0, Number.MAX_SAFE_INTEGER) || s.sequence <= t || !Q(s.duration_ms, T.fixedStepMs, T.maxSegmentMs) || s.duration_ms % T.fixedStepMs !== 0 || !["left", "right", "up", "down", "drill"].every((i) => typeof s[i] == "boolean") || s.aim_cell !== null && (!me(s.aim_cell) || !pe(s.aim_cell, ["column", "row"]) || !Q(s.aim_cell.column, 0, 1e4) || !Q(s.aim_cell.row, 0, 1e6)) || (t = s.sequence, e += s.duration_ms, e > T.maxBatchMs)) return null;
  return r;
}
function Rt(r, e) {
  const t = D.find((s) => s.id === e);
  if (!(!t || r.milestones.includes(e)))
    return r.milestones.push(e), r.coreFuel += G.unitsPerCore, t;
}
function At(r, e, t, s, i, n) {
  if (!t || !s || !i || n >= G.renewableCeiling) return { elapsed: 0, reward: 0 };
  const l = r + Math.max(0, Math.min(0.1, Number.isFinite(e) ? e : 0));
  return l + 1e-8 >= G.extractionSeconds ? { elapsed: 0, reward: Math.min(1, G.renewableCeiling - n) } : { elapsed: l, reward: 0 };
}
function Tt() {
  const r = { hull: "standard-hull", drill: "borer", engine: "standard-engine", battery: "standard-cell", weapon: "unarmed", utility: "empty-utility" };
  return { version: 1, owned: [...Object.values(r), "scout"], fitted: r };
}
const Nt = (r) => et.find((e) => e.id === r), Le = (r, e) => Object.values(r.fitted).reduce((t, s) => t * (Nt(s)?.stats?.[e] ?? 1), 1), X = {
  "cryo-shelf": { id: "contract-cryo", ore: "copper", units: 3, reward: 120 },
  "mars-frontier": { id: "contract-mars", ore: "iron", units: 2, reward: 150 },
  "hull-graveyard": { id: "contract-hull", ore: "iron", units: 3, reward: 210 },
  "prism-fault": { id: "contract-prism", ore: "silver", units: 2, reward: 260 },
  "cinder-vale": { id: "contract-cinder", ore: "cobalt", units: 2, reward: 340 },
  "vesper-9": { id: "contract-vesper", ore: "gold", units: 1, reward: 420 }
}, O = (r, e, t, s) => ({ id: r, ore: e, units: t, reward: s }), Ye = {
  "cryo-shelf": [X["cryo-shelf"], O("contract-cryo-2", "iron", 2, 180), O("contract-cryo-3", "silver", 1, 260)],
  "mars-frontier": [X["mars-frontier"], O("contract-mars-2", "copper", 4, 180), O("contract-mars-3", "nickel", 1, 320)],
  "hull-graveyard": [X["hull-graveyard"], O("contract-hull-2", "silver", 2, 260), O("contract-hull-3", "titanium", 1, 360)],
  "prism-fault": [X["prism-fault"], O("contract-prism-2", "silver", 2, 360), O("contract-prism-3", "diamond", 1, 520)],
  "cinder-vale": [X["cinder-vale"], O("contract-cinder-2", "silver", 2, 320), O("contract-cinder-3", "cobalt", 1, 500)],
  "vesper-9": [X["vesper-9"], O("contract-vesper-2", "gold", 2, 420), O("contract-vesper-3", "gold", 2, 700)]
};
Object.values(Ye).flat().map(({ id: r }) => r);
const Oe = {
  "cryo-shelf": ["copper", "silver", "iron", "cryocrystal"],
  "mars-frontier": ["iron", "silver", "copper", "nickel"],
  "hull-graveyard": ["iron", "copper", "titanium", "silver"],
  "prism-fault": ["silver", "diamond", "copper", "iron"],
  "cinder-vale": ["cobalt", "silver", "copper", "iron"],
  "vesper-9": ["copper", "gold", "silver", "iron"]
};
Object.keys(Oe).flatMap((r) => Oe[r].slice(0, -1).map((e, t) => `demand-${r}-${t + 1}`));
function Be(r, e = []) {
  const t = Ye[r], s = t.findIndex((n) => !e.includes(n.id)), i = s < 0;
  return { order: t[i ? t.length - 1 : s], stage: i ? t.length : s + 1, total: t.length, complete: i };
}
function Lt(r, e, t, s) {
  const i = Be(t, e);
  return s && !i.complete && r[i.order.ore] >= i.order.units;
}
const oe = () => Object.fromEntries(W.map((r) => [r, 0]));
class Ot {
  loadout = Tt();
  deliveries = {};
  money = 80;
  levels = { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 };
  grappleOwned = !1;
  fuel = 140;
  hull = 100;
  cargo = oe();
  shipCargo = oe();
  specialistModules = { reinforcedHull: !1, efficientCooling: !1 };
  maxDepth = 0;
  specialization = "balanced";
  artifact = !1;
  milestones = [];
  shipComponents = [];
  routeFragments = [];
  coreFuel = 0;
  charges = 0;
  salvageMagnet = !1;
  stasisModule = !1;
  returnWinch = !1;
  escapeSuit = !1;
  pilotEscaping = !1;
  buyEscapeSuit() {
    return this.escapeSuit || this.money < te.cost ? !1 : (this.money -= te.cost, this.escapeSuit = !0, !0);
  }
  buyStasisModule() {
    return this.stasisModule || this.money < be.cost ? !1 : (this.money -= be.cost, this.stasisModule = !0, !0);
  }
  buyReturnWinch() {
    return this.returnWinch || this.money < re.cost ? !1 : (this.money -= re.cost, this.returnWinch = !0, !0);
  }
  buySalvageMagnet() {
    return this.salvageMagnet || this.money < Ne.cost ? !1 : (this.money -= Ne.cost, this.salvageMagnet = !0, !0);
  }
  ownedPaints = ["hab"];
  selectedPaint = "hab";
  ownedSuits = ["hab"];
  selectedSuit = "hab";
  ownedDecals = ["standard"];
  selectedDecal = "standard";
  ownedProfiles = ["standard"];
  selectedProfile = "standard";
  buyProfile(e) {
    const t = wt[e];
    return this.ownedProfiles.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedProfiles.push(e), this.selectedProfile = e, !0);
  }
  selectProfile(e) {
    return this.ownedProfiles.includes(e) ? (this.selectedProfile = e, !0) : !1;
  }
  selectSpecialization(e) {
    if (!Object.hasOwn(ne, e)) return !1;
    const t = Math.round(xe(this.levels, "cargo") * Le(this.loadout, "cargo") * ne[e].cargoMultiplier * 2) / 2;
    return this.count > t ? !1 : (this.specialization = e, !0);
  }
  buyDecal(e) {
    const t = Mt[e];
    return this.ownedDecals.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedDecals.push(e), this.selectedDecal = e, !0);
  }
  selectDecal(e) {
    return this.ownedDecals.includes(e) ? (this.selectedDecal = e, !0) : !1;
  }
  buySuit(e) {
    const t = vt[e];
    return this.ownedSuits.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedSuits.push(e), this.selectedSuit = e, !0);
  }
  selectSuit(e) {
    return this.ownedSuits.includes(e) ? (this.selectedSuit = e, !0) : !1;
  }
  buyPaint(e) {
    const t = yt[e];
    return this.ownedPaints.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedPaints.push(e), this.selectedPaint = e, !0);
  }
  selectPaint(e) {
    return this.ownedPaints.includes(e) ? (this.selectedPaint = e, !0) : !1;
  }
  buyCharges() {
    return this.money < ee.packCost ? !1 : (this.money -= ee.packCost, this.charges += ee.packSize, !0);
  }
  useCharge() {
    return this.charges <= 0 ? !1 : (this.charges--, !0);
  }
  collectRouteFragment(e) {
    return !Ce.find((s) => s.id === e) || this.routeFragments.includes(e) ? !1 : (this.routeFragments.push(e), this.money += Ct, !0);
  }
  get shipComplete() {
    return this.milestones.some((e) => D.some((t) => t.id === e)) || Object.keys(bt).every((e) => this.shipComponents.includes(e));
  }
  canTravelToPlanet() {
    return this.shipComplete && this.coreFuel >= G.jumpCost;
  }
  spendCoreFuelForJump() {
    return this.canTravelToPlanet() ? (this.coreFuel -= G.jumpCost, !0) : !1;
  }
  get count() {
    return W.reduce((e, t) => e + this.cargo[t], 0);
  }
  get cargoValue() {
    return W.reduce((e, t) => e + this.cargo[t] * Se[t].value, 0);
  }
  max(e) {
    const t = xe(this.levels, e) * Le(this.loadout, e);
    return e === "cargo" ? Math.round(t * ne[this.specialization].cargoMultiplier * 2) / 2 : e === "hull" && this.specialistModules.reinforcedHull ? t * We.reinforcedHull.hullMultiplier : t;
  }
  drillTime(e) {
    const t = e >= 0.8 ? ne[this.specialization].rockDrillMultiplier : 1;
    return e / (this.max("drill") * t);
  }
  collect(e) {
    return this.count >= this.max("cargo") ? !1 : (this.cargo[e]++, !0);
  }
  collectUnits(e, t) {
    const s = Math.max(0, this.max("cargo") - this.count), i = Math.min(s, t);
    return i > 0 && (this.cargo[e] += i), i;
  }
  sell() {
    const e = this.cargoValue;
    return this.money += e, this.cargo = oe(), e;
  }
  claimMarketContract(e, t) {
    const s = Be(e, this.milestones), i = s.order;
    return s.complete || !Lt(this.cargo, this.milestones, e, t) ? 0 : (this.milestones.push(i.id), this.money += i.reward, i.reward);
  }
  cost(e) {
    return pt(e, this.levels[e]);
  }
  canBuyUpgrade(e) {
    const t = D.filter((s) => this.milestones.includes(s.id)).map((s) => s.id);
    return mt(this.levels[e] + 1, { shipComplete: this.shipComplete, coreRelics: t });
  }
  buy(e) {
    const t = this.cost(e);
    if (this.money < t || !Number.isSafeInteger(this.levels[e] + 1) || !this.canBuyUpgrade(e)) return !1;
    const s = this.max(e);
    return this.money -= t, this.levels[e]++, e === "grapple" && (this.grappleOwned = !0), e === "fuel" && (this.fuel += this.max(e) - s), e === "hull" && (this.hull += this.max(e) - s), !0;
  }
  serviceCost(e) {
    return Math.max(0, Math.ceil(
      (this.max(e) - this[e]) * gt[e === "fuel" ? "fuelPrice" : "hullPrice"]
    ));
  }
  service(e) {
    const t = this.serviceCost(e);
    return this.money < t ? !1 : (this.money -= t, this[e] = Math.max(this[e], this.max(e)), !0);
  }
  serviceAll() {
    const e = this.serviceCost("fuel") + this.serviceCost("hull");
    return this.money < e ? !1 : (this.money -= e, this.fuel = Math.max(this.fuel, this.max("fuel")), this.hull = Math.max(this.hull, this.max("hull")), !0);
  }
  rescue() {
    this.cargo = oe(), this.fuel = this.max("fuel"), this.hull = this.max("hull");
  }
}
const Ge = 0.25;
function Pt(r, e, t, s, i = 1) {
  if ($(t, s), ![r.u, r.v, e, i].every(Number.isFinite) || e < 0 || i <= 0)
    throw new RangeError("Planet tangent speed and position must be finite and non-negative");
  const n = Math.abs(s - r.v) * i * Math.PI / t;
  return e * i / Math.max(n, Ge);
}
function $(r, e) {
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(e) || e <= 0)
    throw new RangeError("Planet chart dimensions must be finite and positive");
}
function F(r, e, t, s = 1) {
  if ($(e, t), !Number.isFinite(r.u) || !Number.isFinite(r.v) || !Number.isFinite(s) || s <= 0)
    throw new RangeError("Planet chart coordinates and tile size must be finite");
  const i = Math.PI * r.u / e, n = t - r.v;
  return {
    x: n * Math.sin(i) * s,
    y: -n * Math.cos(i) * s
  };
}
function Ve(r, e, t, s = 1) {
  if (!Number.isInteger(r.x) || !Number.isInteger(r.y)) throw new RangeError("Planet tile coordinates must be integers");
  return {
    topLeft: F({ u: r.x, v: r.y }, e, t, s),
    topRight: F({ u: r.x + 1, v: r.y }, e, t, s),
    bottomRight: F({ u: r.x + 1, v: r.y + 1 }, e, t, s),
    bottomLeft: F({ u: r.x, v: r.y + 1 }, e, t, s)
  };
}
function Dt(r, e, t, s, i = 1) {
  const { topLeft: n, topRight: l, bottomRight: a, bottomLeft: p } = Ve(r, e, t, i), h = [n, l, a, p];
  if (h.some((u) => Math.hypot(u.x, u.y) <= s)) return !0;
  for (let u = 0; u < h.length; u++) {
    const y = h[u], w = h[(u + 1) % h.length], m = w.x - y.x, C = w.y - y.y, d = Math.max(0, Math.min(1, -(y.x * m + y.y * C) / (m * m + C * C || 1))), g = y.x + m * d, v = y.y + C * d;
    if (Math.hypot(g, v) <= s) return !0;
  }
  return !1;
}
function Ft(r, e, t, s = 1) {
  if ($(e, t), ![r.x, r.y, s].every(Number.isFinite) || s <= 0)
    throw new RangeError("Planet coordinates and tile size must be finite");
  const i = r.x / s, n = r.y / s, l = Math.hypot(i, n);
  if (l < 1e-10) return { u: e / 2, v: t };
  const a = i < 0 ? -l : l, p = i < 0 ? Math.atan2(-i, n) : Math.atan2(i, -n);
  return {
    u: Math.max(0, Math.min(e, p * e / Math.PI)),
    v: t - a
  };
}
function ye(r, e, t, s, i = 1) {
  if ($(t, s), ![r.u, r.v, e.x, e.y, i].every(Number.isFinite) || i <= 0)
    throw new RangeError("Planet vector and tile size must be finite");
  const n = Math.PI * r.u / t, a = (s - r.v) * i * Math.PI / t, p = -Math.sin(n) * e.x + Math.cos(n) * e.y, h = Math.cos(n) * e.x + Math.sin(n) * e.y;
  if (Math.abs(a) >= i * 0.025) return { x: h * i / a, y: p };
  const u = Ge;
  return { x: h * i / u, y: p };
}
function kt(r, e, t, s, i) {
  if ($(s, i), ![r.u, r.v, e, t].every(Number.isFinite))
    throw new RangeError("Planet seam state must be finite");
  const n = Math.floor(r.u / s), l = r.u - n * s, a = Math.abs(n % 2) === 1;
  return {
    u: Object.is(l, -0) ? 0 : l,
    v: a ? i * 2 - r.v : r.v,
    dv: a ? -e : e,
    aimV: a ? -t : t,
    crossings: n
  };
}
function le(r, e, t) {
  if ($(e, t), !Number.isInteger(r.x) || !Number.isInteger(r.y)) throw new RangeError("Planet tile coordinates must be integers");
  const s = Math.floor(r.x / e);
  return { x: r.x - s * e, y: Math.abs(s % 2) === 1 ? t * 2 - r.y - 1 : r.y };
}
function Pe(r, e, t) {
  const s = r.planetChart;
  return F({ u: e / o.tile, v: t / o.tile }, s.columns, s.radiusRows, o.tile);
}
function Ht(r, e, t, s, i) {
  if (i?.planetChart) {
    const a = Pe(i, r, e), p = Pe(i, t, s);
    return Math.hypot(p.x - a.x, p.y - a.y) <= ee.pickupRadius + Math.hypot(c.halfWidth, c.halfHeight);
  }
  const n = Math.max(0, Math.abs(t - r) - c.halfWidth), l = Math.max(0, Math.abs(s - e) - c.halfHeight);
  return Math.hypot(n, l) <= ee.pickupRadius;
}
class Ut {
  constructor(e, t) {
    this.world = e, this.progress = t;
  }
  target;
  elapsed = 0;
  ratio = 0;
  effectiveWidth = 1;
  warningRemaining = 0;
  cargoOverflow = !1;
  warningUnits = 0;
  warningSpace = 0;
  affected = [];
  update(e, t, s, i = "horizontal", n = /* @__PURE__ */ new Set()) {
    if (!t || t.type === "boundary" || t.type === "empty") {
      this.warningRemaining = 0, this.cargoOverflow = !1, this.warningUnits = 0, this.warningSpace = Math.max(0, this.progress.max("cargo") - this.progress.count), this.target = void 0, this.affected = [], this.elapsed = 0, this.ratio = 0, this.effectiveWidth = fe(this.progress.levels.drill);
      return;
    }
    (this.target?.x !== t.x || this.target?.y !== t.y) && (this.elapsed = 0), this.target = t;
    const l = this.world.planetChart, a = typeof i == "string" ? i === "vertical" : Math.abs(i.y) >= Math.abs(i.x), p = l ? Math.abs(l.radiusRows - (t.y + 0.5)) : 1 / 0, h = l ? Math.max(0.1, o.tile * p * Math.PI / l.columns) : o.tile, u = l && a && p * o.tile > U.physicalPassageRadius ? Math.ceil((2 * c.halfWidth + 4) / h) : 1, y = fe(this.progress.levels.drill), w = Math.max(y, u), m = Math.max(1, y / u);
    this.effectiveWidth = w;
    const C = -Math.floor((w - 1) / 2);
    this.affected = Array.from({ length: w }, (g, v) => {
      const b = C + v;
      if (typeof i == "string")
        return this.world.get(t.x + (i === "horizontal" ? b : 0), t.y + (i === "vertical" ? b : 0));
      const x = Math.hypot(i.x, i.y) || 1, f = -i.y / x, S = i.x / x;
      return this.world.get(Math.round(t.x + f * b), Math.round(t.y + S * b));
    }).filter((g, v, b) => g.type !== "empty" && g.type !== "boundary" && !n.has(`${g.x},${g.y}`) && b.findIndex((x) => x.x === g.x && x.y === g.y) === v), this.elapsed += e;
    const d = this.affected.reduce((g, v) => g + (v.ore ? v.oreUnits ?? 1 : 0), 0);
    if (this.warningUnits = d, this.warningSpace = Math.max(0, this.progress.max("cargo") - this.progress.count), this.cargoOverflow = d > 0 && d > this.warningSpace, this.warningRemaining = 0, this.progress.fuel = Math.max(0, this.progress.fuel - e * he.drilling * m * (this.progress.specialistModules.efficientCooling ? We.efficientCooling.drillingMultiplier : 1)), this.ratio = Math.min(1, this.elapsed / this.progress.drillTime(t.hardness)), this.ratio >= 1) {
      for (const g of this.affected) {
        this.world.break(g.x, g.y);
        const v = g.ore ? this.progress.collectUnits(g.ore, g.oreUnits ?? 1) : 0;
        s(g, v, g.ore ? Math.max(0, (g.oreUnits ?? 1) - v) : 0);
      }
      this.target = void 0, this.affected = [], this.elapsed = 0, this.ratio = 0, this.effectiveWidth = fe(this.progress.levels.drill), this.cargoOverflow = !1, this.warningUnits = 0;
    }
  }
}
function Wt(r, e) {
  return e.length >= 4 ? 4 : e.length > 0 ? 3 : r.length >= 4 ? 2 : r.length > 0 ? 1 : 0;
}
const ce = (r, e, t) => {
  const s = ie(t);
  return (e < 0 && e > -650 || e >= s && e <= s + 650) && r > 560 && r < 1410;
}, Yt = (r, e, t) => {
  if (!t) return ce(r, e);
  const s = ie(t), i = t.columns * o.tile;
  return r >= 0 && r < i && (e < 0 && e > -650 || e >= s && e <= s + 650);
};
function Bt(r, e, t, s) {
  const i = r.gravitySign(e.y), n = Math.sign(t - e.x);
  if (!n || Math.abs(e.vy) > K.maxFallSpeed) return;
  const l = r.surfaceHeight(e.x, e.y);
  if (Math.abs(e.y - (l - i * K.footClearance)) > 8) return;
  const a = (w, m) => r.solid(Math.floor(w / o.tile), Math.floor((m + i * 2) / o.tile));
  if (!a(e.x, l)) return;
  const p = t + n * (c.halfWidth - c.horizontalCollisionInset + 2), h = r.surfaceHeight(p, e.y), u = (l - h) * i;
  if (u <= c.horizontalCornerTolerance || u > K.maxRise || !a(p, h))
    return;
  const y = h - i * K.footClearance;
  for (let w = 1; w <= Math.ceil(Math.abs(y - e.y)); w++)
    if (s(e.x, e.y + Math.sign(y - e.y) * Math.min(w, Math.abs(y - e.y))))
      return;
  for (let w = 1; w <= Math.ceil(Math.abs(t - e.x)); w++)
    if (s(e.x + n * Math.min(w, Math.abs(t - e.x)), y)) return;
  return { x: t, y };
}
Object.fromEntries(Object.entries(we).map(([r, e]) => [r, e.oreFactors]));
function De(r, e, t, s, i, n, l) {
  if (!(l || Math.abs(s - t) < 1e-5))
    for (const a of r) {
      if (a.kind === "light" || a.kind === "trade-post" || a.kind === "warehouse" || a.kind === "wall" || a.kind === "gate" || a.kind === "fort") continue;
      const p = lt[a.kind].widthTiles * o.tile / 2;
      if (Math.abs(e - a.x) > p) continue;
      const h = t + i * n - a.y, u = s + i * n - a.y;
      if (h * i <= 0 && u * i >= 0) return a.y - i * n;
    }
}
function qe(r, e, t, s = 1) {
  const i = F({ u: r, v: e }, t.columns, t.radiusRows, s);
  if (Math.hypot(i.x, i.y) < 1e-6) return;
  const n = -Math.PI / 2 - Math.atan2(i.y, i.x);
  return Math.atan2(Math.sin(n), Math.cos(n));
}
function Fe(r, e, t) {
  const s = Math.cos(t), i = Math.sin(t);
  return { x: r * s + e * i, y: -r * i + e * s };
}
function Gt(r, e, t, s, i = 1) {
  const n = Math.floor(e / o.tile), l = Math.floor(t / o.tile), a = Math.ceil(s / o.tile);
  let p, h = 1 / 0;
  const u = i > 0 ? Math.max(0, l - a) : l + 1, y = i > 0 ? l - 1 : l + a, w = r.planetChart ? n - a : Math.max(0, n - a), m = r.planetChart ? n + a : Math.min(r.widthTiles - 1, n + a);
  for (let C = u; C <= y; C++) for (let d = w; d <= m; d++) {
    if (r.get(d, C).type === "empty") continue;
    const g = d * o.tile + o.tile / 2, v = i > 0 ? (C + 1) * o.tile + 2 : C * o.tile - 2, b = g - e, x = v - t, f = Math.hypot(b, x);
    if (x * i > -26 || f > s || f >= h) continue;
    let S = !0;
    const N = Math.ceil(f / (o.tile / 3));
    for (let P = 1; P < N; P++) {
      const V = e + b * P / N, Y = t + x * P / N;
      if (r.solid(Math.floor(V / o.tile), Math.floor(Y / o.tile))) {
        S = !1;
        break;
      }
    }
    S && (p = { x: g, y: v }, h = f);
  }
  return p;
}
function je(r, e) {
  return e && Math.abs(e.radiusRows - r / o.tile) / e.radiusRows < 0.65 ? Math.min(3, c.horizontalCollisionInset) : c.horizontalCollisionInset;
}
function Vt(r, e, t, s, i, n) {
  const l = r.planetChart, a = c.halfWidth - je(i, l), p = (m) => ({
    x: m.x * Math.cos(n) - m.y * Math.sin(n),
    y: m.x * Math.sin(n) + m.y * Math.cos(n)
  }), h = Ve({ x: e, y: t }, l.columns, l.radiusRows, o.tile), u = p(F({ u: s / o.tile, v: i / o.tile }, l.columns, l.radiusRows, o.tile)), y = [h.topLeft, h.topRight, h.bottomRight, h.bottomLeft].map(p), w = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let m = 0; m < y.length; m++) {
    const C = y[m], d = y[(m + 1) % y.length], g = d.x - C.x, v = d.y - C.y;
    w.push({ x: -v, y: g });
  }
  for (const m of w) {
    const C = Math.hypot(m.x, m.y) || 1, d = m.x / C, g = m.y / C, v = y.map((f) => f.x * d + f.y * g), b = u.x * d + u.y * g, x = Math.abs(d) * a + Math.abs(g) * c.halfHeight;
    if (Math.max(...v) < b - x || Math.min(...v) > b + x) return !1;
  }
  return !0;
}
function qt(r, e, t, s) {
  const i = r.planetChart, n = c.halfWidth - je(t, i), l = [
    { x: -n, y: -16 },
    { x: n, y: -16 },
    { x: n, y: c.halfHeight },
    { x: -n, y: c.halfHeight }
  ].map((v) => {
    const b = e + v.x * Math.cos(s) + v.y * Math.sin(s), x = t - v.x * Math.sin(s) + v.y * Math.cos(s), f = F({ u: b / o.tile, v: x / o.tile }, i.columns, i.radiusRows, o.tile);
    return Ft(f, i.columns, i.radiusRows, o.tile);
  }), a = l.map((v) => v.u), p = l.map((v) => v.v), h = Math.min(...a), u = Math.max(...a), y = u - h > i.columns / 2, w = y ? 0 : Math.floor(h) - 2, m = y ? i.columns - 1 : Math.ceil(u) + 1, C = Math.max(-1, Math.floor(Math.min(...p)) - 2), d = Math.min(i.radiusRows * 2, Math.ceil(Math.max(...p)) + 1), g = [];
  for (let v = C; v <= d; v++) for (let b = w; b <= m; b++) {
    const x = r.get(b, v);
    x.type !== "empty" && Vt(r, b, v, e, t, s) && !g.some((f) => f.x === x.x && f.y === x.y) && g.push(x);
  }
  return g;
}
class jt {
  constructor(e, t) {
    this.world = e, this.progress = t;
  }
  x = o.spawnX;
  y = o.spawnY;
  vx = 0;
  vy = 0;
  facing = 1;
  thrusting = !1;
  stasisActive = !1;
  reeling = !1;
  grappleAnchor;
  planetSeamCrossings = 0;
  structures = [];
  grappleHang = 0;
  grappleCooldown = 0;
  scannerRadius = 4;
  docked = !0;
  surfaceStepEnabled = !1;
  surfaceStep;
  reset() {
    this.surfaceStep = void 0, this.docked = !0, this.thrusting = !1, this.stasisActive = !1, this.reeling = !1, this.grappleAnchor = void 0, this.grappleHang = this.grappleCooldown = 0, this.x = o.spawnX, this.y = o.spawnY, this.vx = 0, this.vy = 0;
  }
  overlaps(e, t, s) {
    if (this.world.planetChart) return qt(
      this.world,
      e,
      t,
      s ?? qe(e / o.tile, t / o.tile, this.world.planetChart) ?? 0
    );
    const i = [];
    for (let n = Math.floor((t - c.halfHeight + 1e-5) / o.tile); n <= Math.floor((t + c.halfHeight - 1e-5) / o.tile); n++)
      for (let l = Math.floor((e - c.halfWidth + c.horizontalCollisionInset + 1e-5) / o.tile); l <= Math.floor((e + c.halfWidth - c.horizontalCollisionInset - 1e-5) / o.tile); l++)
        this.world.solid(l, n) && i.push(this.world.get(l, n));
    return i;
  }
  horizontalClearance(e, t) {
    const s = this.world.gravitySign(this.y), i = [!0, !0];
    for (let n = 1; n <= c.horizontalCornerTolerance; n++)
      for (let l = 0; l < 2; l++) {
        if (!i[l]) continue;
        const a = this.y + (l === 0 ? -s : s) * n;
        if (this.overlaps(this.x, a, t).length) {
          i[l] = !1;
          continue;
        }
        if (!this.overlaps(e, a, t).length) return a;
      }
  }
  townPlatformCrossing(e, t, s, i, n) {
    if (n || e < 430 || e > 1540 || Math.abs(s - t) < 1e-5 || this.progress.milestones.includes("mothership-origin")) return;
    const l = Wt(this.progress.shipComponents, this.progress.milestones.filter((a) => a.startsWith("core-")));
    for (let a = 0; a <= l; a++) {
      const p = nt(t, this.world.planetChart) - i * (132 + a * 94), h = t + i * c.halfHeight, u = s + i * c.halfHeight;
      if ((h - p) * i <= 0 && (u - p) * i >= 0) return p - i * c.halfHeight;
    }
  }
  predictsDamagingImpact(e, t) {
    let s = this.x, i = this.y, n = this.vx, l = this.vy;
    const a = this.progress.max("engine"), p = Number(e.right) - Number(e.left), h = e.escapePack ? te.speedMultiplier : 1, u = c.rise * a * h, y = z.predictionStepSeconds;
    for (let w = 0; w < z.impactWindowSeconds; w += y) {
      const m = this.world.gravitySign(i);
      n += p * c.acceleration * a * h * y, p || (n *= Math.exp(-10 * y)), n = Math.max(-145 * a * h, Math.min(c.horizontal * a * h, n));
      const C = s + n * y;
      this.overlaps(C, i, t).length ? n = 0 : s = C, l += m * (c.gravity + (e.down ? 110 : 0)) * y, l = m > 0 ? Math.max(-u, Math.min(c.fall, l)) : Math.max(-430, Math.min(u, l));
      const d = i + l * y, g = this.townPlatformCrossing(s, i, d, m, !!e.down), v = De(this.structures, s, i, d, m, c.halfHeight, !!e.down), b = this.world.surfaceHeight(s, i), x = b - m * 22, S = l * -m > 0 && (m > 0 ? i >= x && d <= x : i <= x && d >= x);
      if (g !== void 0 || v !== void 0 || S) return !1;
      const N = this.overlaps(s, d, t);
      if (N.length && l * m > 0) return Math.abs(l) > c.safeImpact;
      N.length ? l = 0 : i = d;
    }
    return !1;
  }
  wrapPlanetPosition() {
    const e = this.world.planetChart;
    if (!e) return;
    const t = kt(
      { u: this.x / o.tile, v: this.y / o.tile },
      this.vy / o.tile,
      0,
      e.columns,
      e.radiusRows
    );
    t.crossings && (this.x = t.u * o.tile, this.y = t.v * o.tile, this.vy = t.dv * o.tile, this.planetSeamCrossings += t.crossings);
  }
  update(e, t, s, i = 0) {
    this.planetSeamCrossings = 0;
    const n = this.world.gravitySign(this.y), l = this.progress, a = l.max("engine"), p = !!t.stasis && l.stasisModule && l.fuel > 0 && this.y > 0, h = !!t.reel && l.returnWinch && l.fuel > 0 && this.y > 0 && !p;
    if (this.surfaceStep) {
      const M = this.surfaceStep;
      if (!this.surfaceStepEnabled || t.up || t.down || t.mothership || h || p || Number(t.right) - Number(t.left) !== M.screenDir) this.surfaceStep = void 0;
      else {
        M.elapsed = Math.min(K.seconds, M.elapsed + e);
        const E = M.elapsed / K.seconds, R = E * E * (3 - 2 * E), H = M.fromY + (M.y - M.fromY) * R;
        if (this.overlaps(this.x, H, i).length) this.surfaceStep = void 0;
        else {
          this.y = H, this.vy = 0, this.thrusting = !1, l.fuel = Math.max(0, l.fuel - e * he.moving), E >= 1 && (this.overlaps(M.x, this.y, i).length || (this.x = M.x), this.surfaceStep = void 0);
          return;
        }
      }
    }
    if (this.docked) {
      if (!t.left && !t.right && !t.down && !t.up && !p) {
        this.vx = 0, this.vy = 0, this.thrusting = !1, this.stasisActive = !1, this.reeling = !1;
        return;
      }
      if (!t.left && !t.right && !t.down && !t.up && t.stasis && !p) return;
      this.docked = !1;
    }
    if (this.grappleCooldown = Math.max(0, this.grappleCooldown - e), this.grappleAnchor)
      if (this.grappleHang = Math.max(0, this.grappleHang - e), t.up || t.releaseGrapple || this.grappleHang <= 0) this.grappleAnchor = void 0;
      else {
        this.vx = this.vy = 0, this.thrusting = this.reeling = this.stasisActive = !1;
        return;
      }
    const u = Number(t.right) - Number(t.left), y = Fe(u, 0, i), w = Fe(0, -1, i), m = this.world.planetChart, C = m ? ye(
      { u: this.x / o.tile, v: this.y / o.tile },
      y,
      m.columns,
      m.radiusRows,
      o.tile
    ) : y;
    let d = m ? ye(
      { u: this.x / o.tile, v: this.y / o.tile },
      w,
      m.columns,
      m.radiusRows,
      o.tile
    ) : w;
    if (h && t.winchTarget) {
      const M = m ? F({ u: this.x / o.tile, v: this.y / o.tile }, m.columns, m.radiusRows, o.tile) : { x: this.x, y: this.y }, E = m ? F({ u: t.winchTarget.x / o.tile, v: t.winchTarget.y / o.tile }, m.columns, m.radiusRows, o.tile) : t.winchTarget, R = E.x - M.x, H = E.y - M.y, _ = Math.hypot(R, H);
      if (_ > 1) {
        const A = { x: R / _, y: H / _ };
        d = m ? ye({ u: this.x / o.tile, v: this.y / o.tile }, A, m.columns, m.radiusRows, o.tile) : A;
      }
    }
    const g = C.x, v = C.y, b = !!t.escapePack;
    if (this.stasisActive = p, this.reeling = h, this.thrusting = (t.up || h) && (t.mothership ? l.coreFuel > 0 && l.shipComplete : l.fuel > 0 || b) && !this.stasisActive, u && (this.facing = u), t.down && !u && this.vy * n >= 0) {
      const M = Math.floor(this.x / o.tile) * o.tile + o.tile / 2, E = this.x + Math.max(-70 * e, Math.min(70 * e, M - this.x));
      this.overlaps(E, this.y, i).length || (this.x = E);
    }
    const x = b ? te.speedMultiplier : 1, f = b ? te.thrustMultiplier : 1, S = m ? Pt(
      { u: this.x / o.tile, v: this.y / o.tile },
      c.horizontal * a * x,
      m.columns,
      m.radiusRows,
      o.tile
    ) : c.horizontal * a * x;
    if (this.vx += g * c.acceleration * a * x * e, this.vy += v * c.acceleration * a * x * e, u || (this.vx *= Math.exp(-10 * e)), this.vx = Math.max(-S, Math.min(S, this.vx)), this.stasisActive) this.vy = 0;
    else {
      const M = this.thrusting ? c.thrust * a * f * (this.reeling ? re.pullMultiplier : 1) : 0;
      this.vx += d.x * M * e, this.vy += (n * (c.gravity + (t.down ? 110 : 0)) + d.y * M) * e, this.vx = Math.max(-S, Math.min(S, this.vx));
    }
    const N = c.rise * a * x * (this.reeling ? re.pullMultiplier : 1), P = !!this.world.planetChart && Math.abs(this.y - this.world.coreWorldY) <= tt, V = P ? Math.max(N, c.fall) : N;
    if (this.vy = n > 0 ? Math.max(-V, Math.min(c.fall, this.vy)) : Math.max(-430, Math.min(V, this.vy)), t.down && l.fuel > 0 && !t.mothership && !P && this.vy * n > c.drillingDescent && (this.vy = n * c.drillingDescent), l.grappleOwned && t.grappleEnabled !== !1 && !t.mothership && this.grappleCooldown <= 0 && n * this.vy >= z.fallSpeed && !t.up && !t.releaseGrapple && !h && !this.stasisActive && this.predictsDamagingImpact(t, i)) {
      const M = Gt(this.world, this.x, this.y, xe(l.levels, "grapple"), n);
      if (M) {
        this.grappleAnchor = M, this.grappleHang = z.hangSeconds, this.grappleCooldown = Math.max(1, z.cooldownSeconds.at(-1) - Math.max(0, l.levels.grapple - z.cooldownSeconds.length)), this.vx = this.vy = 0, this.thrusting = this.reeling = !1;
        return;
      }
    }
    t.mothership || (l.fuel = Math.max(
      0,
      l.fuel - (b ? 0 : e * ((g || t.down ? he.moving : 0) + (this.thrusting ? he.thrust * (this.reeling ? re.fuelMultiplier : 1) : 0) + (this.stasisActive ? be.fuelPerSecond : 0)))
    ));
    let Y;
    const q = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * e / 7));
    for (let M = 0; M < q; M++) {
      const E = this.x + this.vx * e / q, R = this.overlaps(E, this.y, i);
      if (R.length && this.surfaceStepEnabled && u && !t.up && !t.down && !t.mothership && !b && !h && !p && !P && Math.abs(this.vx) < c.safeImpact) {
        const I = Bt(this.world, this, E, (j, k) => this.overlaps(j, k, i).length > 0);
        if (I) {
          this.surfaceStep = { x: I.x, y: I.y, fromY: this.y, elapsed: 0, screenDir: u }, this.vy = 0, this.thrusting = !1;
          return;
        }
      }
      const H = R.length && u && !t.down && !t.mothership && !P && !h && !p && Math.abs(this.vy) < c.safeImpact && Math.abs(this.vx) < c.safeImpact && !R.some((I) => I.type === "boundary") ? this.horizontalClearance(E, i) : void 0;
      H !== void 0 ? (this.x = E, this.y = H, this.vy * n > 0 && (this.vy = 0)) : R.length ? (u && (Y = R.find((I) => I.type !== "boundary")), Math.abs(this.vx) > c.safeImpact && s((Math.abs(this.vx) - c.safeImpact) * c.damageScale), this.world.planetChart || (this.x = this.vx > 0 ? Math.min(...R.map((I) => I.x * o.tile)) - (c.halfWidth - c.horizontalCollisionInset) : Math.max(...R.map((I) => (I.x + 1) * o.tile)) + (c.halfWidth - c.horizontalCollisionInset)), this.vx = 0) : this.x = E, this.wrapPlanetPosition();
      const _ = this.world.gravitySign(this.y), A = this.y + this.vy * e / q, ze = o.homeColumn, Xe = Math.round(this.world.coreWorldY / o.tile), _e = (I, j) => {
        const k = Math.floor(I / o.tile), Je = Math.floor(j / o.tile);
        return (k - ze) ** 2 + (Je - Xe) ** 2 <= U.passageRadius ** 2;
      }, Ke = _e(this.x, this.y), se = this.overlaps(this.x, A, i), Ie = this.townPlatformCrossing(this.x, this.y, A, _, t.down), $e = De(this.structures, this.x, this.y, A, _, c.halfHeight, t.down), Re = this.world.surfaceHeight(this.x, this.y), L = Re - _ * 22, Qe = this.vy * -_ > 0, Ae = this.world.terrain ? this.world.solid(Math.floor(this.x / o.tile), Math.floor((Re + _) / o.tile)) : this.world.planetChart ? Yt(this.x, L, this.world.planetChart) : ce(this.x, L);
      if ((_ > 0 ? this.y >= L && A <= L : this.y <= L && A >= L) && Qe && Ae && (this.reeling || !t.up && !t.down)) {
        this.y = L, this.vy = 0, this.thrusting = !1, this.reeling = !1, this.docked = !t.left && !t.right;
        return;
      }
      const Ze = this.vy * _ > 0;
      if ((_ > 0 ? this.y <= L && A >= L : this.y >= L && A <= L) && Ze && !t.down && Ae) {
        this.y = L, !t.left && !t.right && (this.vx = 0), this.vy = 0, this.docked = !t.left && !t.right, this.thrusting = !1, this.reeling = !1;
        return;
      }
      const ue = Ke && _e(this.x, A) && (this.y < this.world.coreWorldY && A >= this.world.coreWorldY || this.y > this.world.coreWorldY && A <= this.world.coreWorldY) ? void 0 : Ie ?? $e;
      if (ue !== void 0 && this.vy * _ > 0)
        Ie === void 0 && !ce(this.x, ue, this.world.planetChart) && Math.abs(this.vy) > c.safeImpact && s((Math.abs(this.vy) - c.safeImpact) * c.damageScale), this.y = ue, this.vy = 0;
      else if (se.length) {
        this.vy * _ > 0 && (t.down && (Y = se.find((k) => k.type !== "boundary")), !ce(this.x, this.y, this.world.planetChart) && Math.abs(this.vy) > c.safeImpact && s((Math.abs(this.vy) - c.safeImpact) * c.damageScale));
        const I = Math.min(...se.map((k) => k.y * o.tile)), j = Math.max(...se.map((k) => (k.y + 1) * o.tile));
        this.world.planetChart || (this.y = this.vy * _ > 0 ? _ > 0 ? I - c.halfHeight : j + c.halfHeight : _ > 0 ? j + c.halfHeight : I - c.halfHeight), this.vy = 0;
      } else this.y = A;
      this.world.planetChart || (this.x = Math.max(c.halfWidth, Math.min(this.world.widthTiles * o.tile - c.halfWidth, this.x))), !this.world.planetChart && this.y < -652 && (this.y = -652, this.vy = 0);
    }
    return t.up || b ? void 0 : Y;
  }
}
function zt(r, e, t) {
  const s = r.widthTiles, i = Math.floor(e / o.tile / s), n = t > r.coreWorldY != (Math.abs(i) % 2 === 1);
  return (Math.floor(e / o.tile) % s + s) % s + (n ? s : 0);
}
function Xt(r, e, t) {
  return r.terrain?.heights[zt(r, e, t)] ?? 0;
}
function Kt(r, e, t) {
  if (!r.terrain) return !1;
  const s = t >= r.farSurfaceRow / 2, i = e + (s ? r.widthTiles : 0), n = s ? r.farSurfaceRow - 1 - t : t;
  return r.terrain.caves.some((l) => {
    const a = r.terrain.heights[l], p = i - l;
    return Math.abs(p) <= 1 && n >= a && n <= a + 7 || (p - 3) ** 2 / 16 + (n - a - 7) ** 2 / 4 <= 1;
  });
}
const J = (r, e) => `${r},${e}`;
function B(r, e, t, s = 0) {
  let i = Math.imul(e ^ r, 374761393) ^ Math.imul(t ^ s, 668265263);
  return i = Math.imul(i ^ i >>> 13, 1274126177), ((i ^ i >>> 16) >>> 0) / 4294967296;
}
function ve(r, e, t) {
  if (e !== "cryo-shelf" || !t || t.radiusRows >= 64) return r;
  const s = t.radiusRows / 64;
  return r <= 64 ? Math.round(r * s) : t.radiusRows * 2 - Math.round((128 - r) * s);
}
class $t {
  constructor(e, t = [], s = [], i = "mars-frontier", n) {
    this.seed = e, this.mapId = i, this.planetChart = n, this.destroyed = new Set(t), this.discovered = new Set(s);
  }
  miningOnly = !1;
  openingLayout = !1;
  terrain;
  clearedTerritories = /* @__PURE__ */ new Set();
  surfaceHeight(e, t) {
    const s = Xt(this, e, t) * o.tile;
    return t < this.coreWorldY ? s : this.farSurfaceY - s;
  }
  aboveTerrain(e, t) {
    const s = this.surfaceHeight(e, t);
    return t < this.coreWorldY ? t < s : t >= s;
  }
  atTerrainSurface(e, t) {
    const s = this.surfaceHeight(e, t);
    return (t - s) * this.gravitySign(t) < 8;
  }
  clearedCaves = /* @__PURE__ */ new Set();
  /** Transient authored test habitats; deliberately absent from save snapshots. */
  studyHabitats;
  chunks = /* @__PURE__ */ new Map();
  destroyed = /* @__PURE__ */ new Set();
  discovered = /* @__PURE__ */ new Set();
  get widthTiles() {
    return this.planetChart?.columns ?? o.width;
  }
  get coreWorldY() {
    return de(this.planetChart);
  }
  get farSurfaceY() {
    return ie(this.planetChart);
  }
  get farSurfaceRow() {
    return He(this.planetChart);
  }
  get coreDepthMeters() {
    return st(this.planetChart);
  }
  generate(e, t) {
    this.planetChart && ({ x: e, y: t } = le({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows));
    const s = this.planetChart ? ot(t * o.tile, this.planetChart) : t * o.meters, i = ht(s), n = we[this.mapId], l = Math.max(0, Qt(s)), a = {
      x: e,
      y: t,
      type: i.type,
      hardness: i.hardness,
      tint: this.mapId === "mars-frontier" ? i.colors[Math.floor(B(this.seed, e, t, 1) * 3)] : we[this.mapId].palette[l]
    };
    if (e < 0 || e >= this.widthTiles) return { ...a, type: "boundary", hardness: 1 / 0 };
    if (t < 0) return { ...a, type: "empty" };
    if (t >= this.farSurfaceRow) return { ...a, type: "empty", ore: void 0 };
    if (this.aboveTerrain((e + 0.5) * o.tile, (t + 0.5) * o.tile) || !(this.openingLayout && this.miningOnly && e >= 28 && e <= 47 && t <= 22) && Kt(this, e, t)) return { ...a, type: "empty", ore: void 0 };
    if (this.openingLayout && this.miningOnly) {
      const d = _t;
      if (e >= d.caveColumn - 1 && e <= d.caveColumn + 1 && t >= 0 && t <= 12 || e >= d.safeLeft && e <= d.safeRight && t >= 8 && t < d.caveFloor || e >= 37 && e <= 38 && t >= 11 && t <= 17 || e >= 39 && e <= 46 && t >= 14 && t <= 19) return { ...a, type: "empty", ore: void 0 };
      if (e === 36 && t >= 11 && t <= 12) return { ...a, type: "dirt", hardness: 0.8, ore: "iron", oreUnits: 1 };
      const g = d.seams.find((v) => e >= v.left && e <= v.right && t >= v.top && t <= v.bottom);
      if (g) return { ...a, type: "dirt", hardness: 0.8, ore: g.ore, oreUnits: 1 };
      if (e >= 14 && e <= 22 && t <= 12) return { ...a, type: "dirt", hardness: 0.8, ore: void 0 };
      if (e >= 28 && e <= 47 && t >= 7 && t <= 22) return { ...a, type: "dirt", hardness: 0.8, ore: void 0 };
    }
    const p = this.coreWorldY, h = Math.round(p / o.tile), u = o.homeColumn, y = D.find((d) => d.mapId === this.mapId);
    if (e === u && t === h && y)
      return { ...a, type: "hard", hardness: Math.max(2.2, i.hardness), ore: void 0, coreRelicId: y.id, tint: y.tint };
    if (this.planetChart && Dt(
      { x: e, y: t },
      this.planetChart.columns,
      this.planetChart.radiusRows,
      U.physicalPassageRadius,
      o.tile
    )) return { ...a, type: "empty", ore: void 0, tint: 7649707 };
    if ((e - u) ** 2 + (t - h) ** 2 <= U.passageRadius ** 2)
      return { ...a, type: "empty", ore: void 0, tint: 7649707 };
    if (t === h) return { ...a, type: "boundary", hardness: 1 / 0, ore: void 0 };
    const w = this.mapId === "cryo-shelf" ? Ce.find((d) => d.x === e && ve(d.row, this.mapId, this.planetChart) === t) : void 0;
    if (w && !this.miningOnly) return { ...a, fragmentId: w.id, landmarkId: w.id, tint: 9560018, hardness: Math.max(0.8, i.hardness), ore: void 0 };
    if (this.mapId === "cryo-shelf") {
      const d = Ce.find(
        (g) => Math.abs(e - g.x) <= g.chamber.halfWidth && Math.abs(t - ve(g.row, this.mapId, this.planetChart)) <= g.chamber.halfHeight && (e - g.x) ** 2 / (g.chamber.halfWidth + 0.5) ** 2 + (t - ve(g.row, this.mapId, this.planetChart)) ** 2 / (g.chamber.halfHeight + 0.5) ** 2 <= 1
      );
      if (d) return { ...a, type: "empty", ore: void 0, fragmentId: void 0, landmarkId: d.id, tint: 6721425 };
    }
    for (const d of [...W].reverse()) {
      const g = Se[d], v = s, b = d === "diamond" ? 2 : 3;
      if (v >= g.min && v <= g.max && B(this.seed, Math.floor(e / b), Math.floor(t / b), W.indexOf(d) + 20) < Math.min(0.9, g.rarity * n.oreFactors[d]) && B(this.seed, e, t, 50) > 0.15) {
        a.ore = d;
        const x = B(this.seed, e, t, 91);
        a.oreUnits = x > 0.996 ? 3 : x > 0.96 ? 2 : x > 0.88 ? 0.5 : 1, n.geodeChance > 0 && B(this.seed, e, t, 207) < n.geodeChance && (a.geode = !0, a.oreUnits = 3);
        const f = ct[this.mapId];
        f && B(this.seed, e, t, 311) < f.chance && (a.regionFind = this.mapId, a.oreUnits = Math.max(a.oreUnits, f.units));
        break;
      }
    }
    t < 3 && e >= 23 && e <= 25 && (a.ore = "copper", a.oreUnits = 1);
    const m = this.miningOnly && this.mapId === "cryo-shelf" && St.find((d) => e >= d.left && e <= d.right && t >= d.top && t <= d.bottom);
    m && (a.type = "dirt", a.hardness = Math.min(a.hardness, 0.8), a.ore = m.ore, a.oreUnits = 1), t > 5 && !a.ore && B(this.seed, Math.floor((e + 1) / 4), Math.floor(t / 3), 80) < n.caveChance && (a.type = "empty");
    const C = xt.find((d) => d.mapId === this.mapId && d.x === e && d.row === t);
    return C && !this.miningOnly && (a.signalHashId = C.id, a.type === "empty" && (a.type = "rock")), a;
  }
  get(e, t) {
    if (this.planetChart && ({ x: e, y: t } = le({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows)), t < 0 || e < 0 || e >= this.widthTiles) return this.generate(e, t);
    const s = Math.floor(e / o.chunk), i = Math.floor(t / o.chunk), n = J(s, i);
    let l = this.chunks.get(n);
    if (!l) {
      l = [];
      for (let p = 0; p < o.chunk; p++)
        for (let h = 0; h < o.chunk; h++)
          l.push(this.generate(s * o.chunk + h, i * o.chunk + p));
      this.chunks.set(n, l);
    }
    const a = l[t % o.chunk * o.chunk + e % o.chunk];
    return this.destroyed.has(J(e, t)) && a.type !== "boundary" ? { ...a, type: "empty", ore: void 0, fragmentId: void 0, signalHashId: void 0, coreRelicId: void 0, geode: void 0, regionFind: void 0 } : a;
  }
  solid(e, t) {
    return this.get(e, t).type !== "empty";
  }
  gravitySign(e) {
    return at(e, this.planetChart);
  }
  break(e, t) {
    const s = this.planetChart ? le({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows) : { x: e, y: t };
    this.get(s.x, s.y).type !== "boundary" && this.destroyed.add(J(s.x, s.y));
  }
  reveal(e, t, s = 0, i = 4) {
    const n = Math.floor(e / o.tile), l = Math.floor(t / o.tile), a = Math.min(this.widthTiles * 2, Math.max(1, i + s)), p = Math.floor(a * 6 / 7);
    for (let h = Math.max(0, l - p); h <= l + p; h++)
      for (let u = this.planetChart ? n - a : Math.max(0, n - a); u <= (this.planetChart ? n + a : Math.min(this.widthTiles - 1, n + a)); u++)
        if (Math.hypot(u - n, (h - l) * 1.1) < a) {
          const y = this.planetChart ? le({ x: u, y: h }, this.planetChart.columns, this.planetChart.radiusRows) : { x: u, y: h };
          (!this.planetChart || y.y >= 0 && y.y < this.planetChart.radiusRows * 2) && this.discovered.add(J(y.x, y.y));
        }
  }
  prune(e, t) {
    const s = Math.floor(e / o.tile / o.chunk), i = t === void 0 ? void 0 : Math.floor(t / o.tile / o.chunk);
    for (const n of this.chunks.keys()) {
      const [l, a] = n.split(",").map(Number);
      (Math.abs(a - s) > 2 || this.planetChart && i !== void 0 && Math.abs(l - i) > 3) && this.chunks.delete(n);
    }
  }
}
function Qt(r) {
  return r >= 1e3 ? 4 : r >= 600 ? 3 : r >= 300 ? 2 : r >= 100 ? 1 : 0;
}
function Zt(r, e, t, s = "cryo-shelf") {
  if (!Ue.worlds.includes(s)) throw new Error("INVALID_STATE");
  if (!Number.isSafeInteger(t) || t < r.observed_at_ms || e.length < 1 || e.length > T.maxSegmentsPerBatch) throw new Error("INVALID_COMMAND");
  const i = e.reduce((f, S) => f + S.duration_ms, 0), n = Math.min(
    T.maxBatchMs,
    r.input_budget_ms + t - r.observed_at_ms
  );
  if (i > n || i > T.maxBatchMs) throw new Error("RATE_LIMITED");
  let l = r.last_sequence;
  for (const f of e)
    if (f.sequence !== ++l || f.aim_cell !== null || !Number.isSafeInteger(f.duration_ms) || f.duration_ms < T.fixedStepMs || f.duration_ms > T.maxSegmentMs || f.duration_ms % T.fixedStepMs !== 0 || !["left", "right", "up", "down", "drill"].every((S) => typeof f[S] == "boolean"))
      throw new Error("INVALID_COMMAND");
  const a = new $t(r.world_seed, r.destroyed_cells, [], s, ae), p = D.find((f) => f.mapId === s);
  a.miningOnly = !0;
  const h = new Ot();
  h.levels = { ...r.levels }, h.grappleOwned = r.levels.grapple > 1, h.money = 0, h.coreFuel = r.core_fuel, h.milestones = [...r.core_relics], h.fuel = r.fuel_milli / 1e3, h.hull = r.hull_milli / 1e3;
  for (const f of W) h.cargo[f] = (r.cargo_half_units[f] ?? 0) / 2;
  const u = new jt(a, h);
  Object.assign(u, r.pod);
  const y = new Ut(a, h);
  r.drill_target && (y.target = a.get(r.drill_target.x, r.drill_target.y)), y.elapsed = r.drill_elapsed_ms / 1e3;
  const w = r.drops.map((f) => ({ ...f })), m = new Set(r.destroyed_cells), C = { ...r.cargo_half_units };
  let d = r.core_extraction_elapsed_ms;
  if (h.fuel <= 0 || h.hull <= 0) throw new Error("INVALID_COMMAND");
  let g = !1;
  for (const f of e) {
    for (let S = 0; S < f.duration_ms; S += T.fixedStepMs) {
      const N = T.fixedStepMs / 1e3, P = qe(u.x / o.tile, u.y / o.tile, ae) ?? 0, V = { left: f.left, right: f.right, up: f.up, down: f.down, grappleEnabled: !1 }, Y = u.update(N, V, (M) => {
        h.hull = Math.max(0, h.hull - M);
      }, P);
      if (h.fuel <= 0 || h.hull <= 0) {
        g = !0;
        break;
      }
      y.update(N, f.drill && !f.up ? Y : void 0, (M, E, R) => {
        M.coreRelicId && Rt(h, M.coreRelicId), R > 0 && M.ore && w.push({
          id: J(M.x, M.y),
          x: M.x,
          y: M.y,
          ore: M.ore,
          quantity_half_units: Math.round(R * 2)
        });
      }, f.down ? "vertical" : "horizontal");
      const q = At(
        d / 1e3,
        N,
        !!p && h.milestones.includes(p.id),
        a.get(o.homeColumn, ae.radiusRows).type === "empty",
        Math.abs(u.y - ae.radiusRows * o.tile) <= U.drillAssistReach && (f.down || f.drill),
        h.coreFuel
      );
      d = Math.round(q.elapsed * 1e3), h.coreFuel += q.reward;
      for (const M of w) {
        if (M.quantity_half_units <= 0 || !Ht(u.x, u.y, (M.x + 0.5) * o.tile, (M.y + 0.5) * o.tile, a)) continue;
        const E = h.collectUnits(M.ore, M.quantity_half_units / 2);
        M.quantity_half_units -= Math.round(E * 2);
      }
    }
    if (g) break;
  }
  const v = {}, b = {};
  for (const f of W) {
    const S = Math.round(h.cargo[f] * 2);
    S > 0 && (v[f] = S), S !== (C[f] ?? 0) && (b[f] = S - (C[f] ?? 0));
  }
  const x = [...a.destroyed].sort();
  return {
    state: {
      world_seed: r.world_seed,
      levels: { ...r.levels },
      destroyed_cells: x,
      pod: { x: u.x, y: u.y, vx: u.vx, vy: u.vy, docked: u.docked },
      fuel_milli: Math.round(h.fuel * 1e3),
      hull_milli: Math.round(h.hull * 1e3),
      core_fuel: h.coreFuel,
      core_relics: D.map((f) => f.id).filter((f) => h.milestones.includes(f)),
      core_extraction_elapsed_ms: d,
      cargo_half_units: v,
      drops: w.filter((f) => f.quantity_half_units > 0),
      drill_target: y.target ? { x: y.target.x, y: y.target.y } : null,
      drill_elapsed_ms: Math.round(y.elapsed * 1e3),
      last_sequence: l,
      input_budget_ms: n - i,
      observed_at_ms: t
    },
    destroyed_cells: x.filter((f) => !m.has(f)),
    cargo_delta_half_units: b
  };
}
const Me = (r) => !!r && typeof r == "object" && !Array.isArray(r), Jt = (r) => typeof r == "number" && Number.isFinite(r);
function er(r, e) {
  if (!Me(r) || !Number.isSafeInteger(r.world_seed) || r.world_seed < 0 || r.world_seed > 4294967295 || !Me(r.levels) || !dt.every((i) => Number.isSafeInteger(r.levels[i]) && Number(r.levels[i]) >= 1 && Number(r.levels[i]) <= 5) || !Array.isArray(r.destroyed_cells) || !r.destroyed_cells.every((i) => typeof i == "string") || !Me(r.pod) || !["x", "y", "vx", "vy"].every((i) => Jt(r.pod[i])) || typeof r.pod.docked != "boolean" || !Number.isSafeInteger(r.fuel_milli) || !Number.isSafeInteger(r.hull_milli) || !Number.isSafeInteger(r.core_fuel) || r.core_fuel < 0 || r.core_fuel > D.length * G.unitsPerCore || !Array.isArray(r.core_relics) || !r.core_relics.every((i) => typeof i == "string" && D.some((n) => n.id === i)) || new Set(r.core_relics).size !== r.core_relics.length || !Number.isSafeInteger(r.core_extraction_elapsed_ms) || r.core_extraction_elapsed_ms < 0 || r.core_extraction_elapsed_ms >= 1e4 || !Array.isArray(r.drops) || !Number.isSafeInteger(r.drill_elapsed_ms) || !Number.isSafeInteger(r.last_sequence) || !Number.isSafeInteger(r.input_budget_ms) || r.input_budget_ms < 0 || r.input_budget_ms > T.maxBatchMs || !Number.isSafeInteger(r.observed_at_ms)) throw new Error("INVALID_STATE");
  const t = r.levels;
  if (r.fuel_milli < 0 || r.fuel_milli > Z("fuel", t.fuel) * 1e3 || r.hull_milli < 0 || r.hull_milli > Z("hull", t.hull) * 1e3) throw new Error("INVALID_STATE");
  const s = {};
  for (const i of e) {
    if (!W.includes(i.ore) || Object.hasOwn(s, i.ore)) throw new Error("INVALID_STATE");
    const n = Number(i.quantity_half_units);
    if (!Number.isSafeInteger(n) || n < 0 || n > Z("cargo", t.cargo) * 2)
      throw new Error("INVALID_STATE");
    n > 0 && (s[i.ore] = n);
  }
  if (Object.values(s).reduce((i, n) => i + n, 0) > Z("cargo", t.cargo) * 2) throw new Error("INVALID_STATE");
  return { ...r, cargo_half_units: s };
}
async function sr(r, e, t, s) {
  const i = It(r);
  if (!i || !e || !Number.isSafeInteger(s)) throw new Error("INVALID_COMMAND");
  const n = {
    owner_id: e,
    campaign_id: i.campaign_id,
    expected_revision: i.expected_revision,
    operation_id: i.operation_id,
    session_id: i.session_id,
    input: i
  };
  if (await t.hasOperation(e, i.operation_id))
    return t.commit({ ...n, new_state: {} });
  const l = await t.campaign(i.campaign_id);
  if (!l || l.owner_id !== e) throw new Error("ACCESS_REQUIRED");
  if (l.ruleset_version !== i.ruleset_version) throw new Error("RULESET_MISMATCH");
  if (!Ue.worlds.includes(l.active_planet)) throw new Error("INVALID_STATE");
  if (l.revision !== i.expected_revision) throw new Error("STALE_REVISION");
  const [a, p] = await Promise.all([
    t.simulation(i.campaign_id),
    t.minerInventory(i.campaign_id)
  ]), h = er(a, p), u = Zt(h, i.segments, s, l.active_planet).state;
  return t.commit({ ...n, new_state: u });
}
export {
  sr as executeVerifiedGameBatch
};
