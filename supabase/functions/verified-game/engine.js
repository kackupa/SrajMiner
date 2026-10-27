const a = { tile: 40, width: 48, homeColumn: 24, chunk: 16, meters: 12, spawnX: 980, spawnY: -22 }, Ze = [
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
], k = {
  depthMeters: 3600,
  passageRadius: 5,
  physicalPassageRadius: 72,
  drillAssistReach: 160
}, Fe = k.depthMeters / a.meters * a.tile, Je = k.passageRadius * a.tile, et = Fe * 2, tt = et / a.tile, se = { radiusRows: 40, columns: Math.round(Math.PI * 40) }, he = (r) => r ? r.radiusRows * a.tile : Fe, ke = (r) => r ? r.radiusRows * 2 : tt, ee = (r) => ke(r) * a.tile, rt = (r) => r ? r.radiusRows * a.meters : k.depthMeters, it = (r, e) => r < he(e) ? 1 : -1, st = (r, e) => r < he(e) ? 0 : ee(e), at = (r, e) => {
  const t = he(e), i = ee(e);
  return Math.max(0, Math.floor(((r < t ? r : i - r) + 16) / a.tile * a.meters));
}, u = {
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
  horizontalCollisionInset: 8
}, nt = {
  minimumDepthMeters: 60,
  platform: { credits: 140, materials: { copper: 2, iron: 1 }, widthTiles: 5 },
  service: { credits: 0, materials: { iron: 4, copper: 4 }, widthTiles: 5 },
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
}, we = { moving: 0.55, thrust: 1.25, drilling: 1.4 }, Ce = {
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
}, H = Object.keys(Ce), Ie = [
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
], ot = (r) => [...Ie].reverse().find((e) => r >= e.min) ?? Ie[0], ve = {
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
}, L = [
  { id: "core-mars", mapId: "mars-frontier", name: "Mars core", tint: 16758382, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-cryo", mapId: "cryo-shelf", name: "Cryo core", tint: 10220002, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-hull", mapId: "hull-graveyard", name: "Iron core", tint: 11000253, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-prism", mapId: "prism-fault", name: "Prism core", tint: 12953599, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-cinder", mapId: "cinder-vale", name: "Cinder core", tint: 16749664, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 },
  { id: "core-vesper", mapId: "vesper-9", name: "Vesper core", tint: 11725198, detail: "Concentrated planetary material used by the mothership jump drive.", record: "Core extracted. Fuel transferred to the mothership.", bounty: 0 }
], Y = { unitsPerCore: 4, jumpCost: 1, extractionSeconds: 10, renewableCeiling: 4 };
L.filter((r) => r.mapId !== "vesper-9").map((r) => r.id);
const lt = {
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
    values: [4, 8, 13, 22, a.width],
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
}, ht = Object.keys(Ee), ct = [
  { firstLevel: 6, label: "FIRST PLANETARY CORE RECOVERED", requirement: "first-core" },
  { firstLevel: 11, label: "2 PLANETARY CORES LOGGED", requirement: "two-cores" },
  { firstLevel: 16, label: "ALL PLANETARY CORES LOGGED", requirement: "all-cores" }
];
function dt(r) {
  return [...ct].reverse().find((e) => r >= e.firstLevel);
}
function ut(r, e) {
  const t = dt(r);
  return t ? t.requirement === "first-core" ? e.coreRelics.some((i) => L.some((s) => s.id === i)) : t.requirement === "two-cores" ? e.coreRelics.length >= 2 : L.every((i) => e.coreRelics.includes(i.id)) : !0;
}
const ae = {
  balanced: { name: "Balanced", description: "No bonus, no trade-off. Change paths freely while docked.", rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1 },
  seamCutter: { name: "Seam Cutter", description: "Cut hard rock 20% faster once the deep strata begin.", rockDrillMultiplier: 1.2, scanRadiusBonus: 0, cargoMultiplier: 1 },
  surveyor: { name: "Surveyor", description: "Survey two tiles farther around the pod; the map still reveals only explored ground.", rockDrillMultiplier: 1, scanRadiusBonus: 2, cargoMultiplier: 1 },
  hauler: { name: "Hauler", description: "Carry 25% more ore before the hold fills.", rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1.25 }
};
function K(r, e) {
  const t = Ee[r], i = t.values;
  if (e <= i.length) return i[Math.max(1, e) - 1];
  const s = e - i.length;
  switch (r) {
    case "drill":
      return i[4] + Math.sqrt(s) * 0.3;
    case "fuel":
      return i[4] + Math.sqrt(s) * 80;
    case "cargo":
      return i[4] + Math.sqrt(s) * 10;
    case "hull":
      return i[4] + Math.sqrt(s) * 55;
    case "engine":
      return i[4] + Math.sqrt(s) * 0.035;
    case "scanner":
      return Math.min(a.width * 2, a.width + Math.sqrt(s) * 8);
    case "grapple":
      return i[4] + Math.sqrt(s) * 14;
  }
}
function mt(r, e) {
  const t = Ee[r], i = t.costs;
  if (e <= i.length) return i[Math.max(1, e) - 1];
  const s = e - i.length;
  return Math.ceil(i[i.length - 1] * (1 + s * 0.45));
}
const Me = (r, e) => K(e, r[e]), de = (r) => r <= 5 ? [1, 1, 2, 3, 4][Math.max(0, r - 1)] : Math.min(a.width, 4 + Math.floor(Math.log2(r - 4))), ft = { fuelPrice: 0, hullPrice: 0.45 }, Q = { packCost: 180, packSize: 3, pickupRadius: 28 }, Te = { cost: 420 }, xe = { cost: 760, fuelPerSecond: 1.8 }, Z = { cost: 780, thrustMultiplier: 1.45, speedMultiplier: 1.25 }, J = { cost: 880, pullMultiplier: 1.7, fuelMultiplier: 1.5 }, q = { fallSpeed: 205, impactWindowSeconds: 1.5, predictionStepSeconds: 1 / 30, hangSeconds: 0.85, cooldownSeconds: [7, 6, 5, 4, 3] }, pt = {
  hab: { name: "Hab Standard", description: "The hard-wearing outpost finish.", cost: 0, hull: 15386497, trim: 16768928, light: 16773308 },
  polar: { name: "Polar White", description: "High-visibility ice-runner enamel.", cost: 180, hull: 6473671, trim: 11596260, light: 14811120 },
  ark: { name: "Ark Salvage", description: "Deep green, recovered from the old hull.", cost: 360, hull: 8632462, trim: 13166765, light: 15269841 },
  prism: { name: "Prism Bloom", description: "Violet lacquer with a crystal-bright edge.", cost: 600, hull: 11901672, trim: 14797567, light: 15919359 }
}, gt = {
  hab: { name: "Hab Issue", description: "Standard insulated outpost suit.", cost: 0, body: 14278608, trim: 15386497 },
  polar: { name: "Polar Survey", description: "Reflective ice-runner shell.", cost: 160, body: 5617853, trim: 13301998 },
  ark: { name: "Ark Salvage", description: "Field repairs stitched from mothership canvas.", cost: 320, body: 7576178, trim: 13166765 },
  prism: { name: "Prism Runner", description: "A violet suit with a bright helmet seal.", cost: 520, body: 10123721, trim: 14797567 }
}, yt = {
  standard: { name: "Hab Mark", description: "Outpost identification stripe.", cost: 0, color: 15386497, style: "stripe" },
  arrow: { name: "Descent Arrow", description: "A bold directional survey mark.", cost: 140, color: 7527888, style: "arrow" },
  ark: { name: "Mothership Crest", description: "The lost ship’s recovery insignia.", cost: 280, color: 10802851, style: "crest" },
  prism: { name: "Prism Trace", description: "A luminous mark for deep runs.", cost: 440, color: 12821247, style: "prism" }
}, wt = {
  standard: { name: "Hab Runner", description: "Balanced outpost frame · warm cabin glow.", cost: 0, style: "standard", cabin: 9688268 },
  antenna: { name: "Survey Scout", description: "Beacon mast and sensor vane · mint cabin glow.", cost: 220, style: "antenna", cabin: 10875345 },
  stabilizers: { name: "Cavern Surveyor", description: "Twin landing fins · ice-blue cabin glow.", cost: 360, style: "stabilizers", cabin: 9756671 },
  armor: { name: "Ark Bulwark", description: "Recovered side rails · amber cabin glow.", cost: 540, style: "armor", cabin: 16763526 }
}, be = [
  { id: "fragment-1", milestoneId: "first-core-sample", row: 8, x: 24, title: "Warm core sample", landmark: "Thermal Observatory", chamber: { halfWidth: 4, halfHeight: 2 }, detail: "A live thermal trace reveals a safe fracture through the shelf." },
  { id: "fragment-2", milestoneId: "basalt-vein", row: 27, x: 24, title: "Basalt sample", landmark: "Basalt Engine Hall", chamber: { halfWidth: 5, halfHeight: 2 }, detail: "A sample of iron-bearing basalt." },
  { id: "fragment-3", milestoneId: "deep-scan", row: 52, x: 24, title: "Deep mineral sample", landmark: "Deep rock cavern", chamber: { halfWidth: 6, halfHeight: 3 }, detail: "A mineral sample from a deep fracture." },
  { id: "fragment-4", milestoneId: "route-signal", row: 90, x: 24, title: "Lower strata sample", landmark: "Lower rock cavern", chamber: { halfWidth: 7, halfHeight: 3 }, detail: "A sample from the lower geological layer." }
], vt = [
  { id: "hash-cryo", mapId: "cryo-shelf", x: 12, row: 16, name: "ICE SAMPLE", hash: "7C1A·09EF·B44D", crew: "Asha Vale", role: "Survey technician", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A shipyard checksum, signed before the mothership left orbit." },
  { id: "hash-hull", mapId: "hull-graveyard", x: 12, row: 22, name: "WRECK REGISTER", hash: "A308·F11C·620B", crew: "Orrin Bale", role: "Flight Recorder", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A preserved survey record." },
  { id: "hash-prism", mapId: "prism-fault", x: 36, row: 32, name: "CRYSTAL SAMPLE", hash: "D9E2·44A7·C015", crew: "Imani Cho", role: "Navigator", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "An archived reading from the crystal strata." },
  { id: "hash-mars", mapId: "mars-frontier", x: 9, row: 20, name: "RED DUST INDEX", hash: "51B7·C82D·A903", crew: "Sol Reyes", role: "Surface Lead", transcript: "Archived geological reading. This legacy record is kept with the expedition save.", detail: "A checksum from the first surface team, preserved under the frontier." }
], Mt = {
  frame: { name: "Ship frame", description: "The craft’s reinforced outer structure." },
  propulsion: { name: "Engine", description: "The engine that carries the craft between worlds." },
  navigation: { name: "Navigation unit", description: "The unit that charts routes between planets." },
  "life-support": { name: "Life-support unit", description: "The system that keeps the craft and crew alive." }
}, xt = 200, bt = [
  { ore: "copper", left: 16, right: 19, top: 0, bottom: 2 },
  { ore: "iron", left: 16, right: 19, top: 3, bottom: 4 },
  { ore: "silver", left: 16, right: 19, top: 8, bottom: 9 }
], He = { worlds: ["cryo-shelf", "mars-frontier"] }, Ue = {
  reinforcedHull: { hullMultiplier: 1.2 },
  efficientCooling: { drillingMultiplier: 0.9 }
}, Ct = "online-1", R = {
  fixedStepMs: 20,
  maxSegmentMs: 240,
  maxSegmentsPerBatch: 20,
  maxBatchMs: 1e3
}, Et = {
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
}, ue = (r) => !!r && typeof r == "object" && !Array.isArray(r), me = (r, e) => Object.keys(r).length === e.length && e.every((t) => Object.hasOwn(r, t)), fe = (r) => typeof r == "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r), z = (r, e, t) => typeof r == "number" && Number.isSafeInteger(r) && r >= e && r <= t;
function St(r) {
  if (!ue(r) || !me(r, ["campaign_id", "ruleset_version", "expected_revision", "operation_id", "session_id", "segments"]) || !fe(r.campaign_id) || r.ruleset_version !== Ct || !z(r.expected_revision, 0, Number.MAX_SAFE_INTEGER) || !fe(r.operation_id) || !fe(r.session_id) || !Array.isArray(r.segments) || r.segments.length < 1 || r.segments.length > R.maxSegmentsPerBatch) return null;
  let e = 0, t = -1;
  for (const i of r.segments)
    if (!ue(i) || !me(i, ["sequence", "duration_ms", "left", "right", "up", "down", "drill", "aim_cell"]) || !z(i.sequence, 0, Number.MAX_SAFE_INTEGER) || i.sequence <= t || !z(i.duration_ms, R.fixedStepMs, R.maxSegmentMs) || i.duration_ms % R.fixedStepMs !== 0 || !["left", "right", "up", "down", "drill"].every((s) => typeof i[s] == "boolean") || i.aim_cell !== null && (!ue(i.aim_cell) || !me(i.aim_cell, ["column", "row"]) || !z(i.aim_cell.column, 0, 1e4) || !z(i.aim_cell.row, 0, 1e6)) || (t = i.sequence, e += i.duration_ms, e > R.maxBatchMs)) return null;
  return r;
}
function _t(r, e) {
  const t = L.find((i) => i.id === e);
  if (!(!t || r.milestones.includes(e)))
    return r.milestones.push(e), r.coreFuel += Y.unitsPerCore, t;
}
function Rt(r, e, t, i, s, o) {
  if (!t || !i || !s || o >= Y.renewableCeiling) return { elapsed: 0, reward: 0 };
  const l = r + Math.max(0, Math.min(0.1, Number.isFinite(e) ? e : 0));
  return l + 1e-8 >= Y.extractionSeconds ? { elapsed: 0, reward: Math.min(1, Y.renewableCeiling - o) } : { elapsed: l, reward: 0 };
}
function At() {
  const r = { hull: "standard-hull", drill: "borer", engine: "standard-engine", battery: "standard-cell", weapon: "unarmed", utility: "empty-utility" };
  return { version: 1, owned: [...Object.values(r), "scout"], fitted: r };
}
const It = (r) => Ze.find((e) => e.id === r), Ne = (r, e) => Object.values(r.fitted).reduce((t, i) => t * (It(i)?.stats?.[e] ?? 1), 1), j = {
  "cryo-shelf": { id: "contract-cryo", ore: "copper", units: 3, reward: 120 },
  "mars-frontier": { id: "contract-mars", ore: "iron", units: 2, reward: 150 },
  "hull-graveyard": { id: "contract-hull", ore: "iron", units: 3, reward: 210 },
  "prism-fault": { id: "contract-prism", ore: "silver", units: 2, reward: 260 },
  "cinder-vale": { id: "contract-cinder", ore: "cobalt", units: 2, reward: 340 },
  "vesper-9": { id: "contract-vesper", ore: "gold", units: 1, reward: 420 }
}, T = (r, e, t, i) => ({ id: r, ore: e, units: t, reward: i }), We = {
  "cryo-shelf": [j["cryo-shelf"], T("contract-cryo-2", "iron", 2, 180), T("contract-cryo-3", "silver", 1, 260)],
  "mars-frontier": [j["mars-frontier"], T("contract-mars-2", "copper", 4, 180), T("contract-mars-3", "nickel", 1, 320)],
  "hull-graveyard": [j["hull-graveyard"], T("contract-hull-2", "silver", 2, 260), T("contract-hull-3", "titanium", 1, 360)],
  "prism-fault": [j["prism-fault"], T("contract-prism-2", "silver", 2, 360), T("contract-prism-3", "diamond", 1, 520)],
  "cinder-vale": [j["cinder-vale"], T("contract-cinder-2", "silver", 2, 320), T("contract-cinder-3", "cobalt", 1, 500)],
  "vesper-9": [j["vesper-9"], T("contract-vesper-2", "gold", 2, 420), T("contract-vesper-3", "gold", 2, 700)]
};
Object.values(We).flat().map(({ id: r }) => r);
const Le = {
  "cryo-shelf": ["copper", "silver", "iron", "cryocrystal"],
  "mars-frontier": ["iron", "silver", "copper", "nickel"],
  "hull-graveyard": ["iron", "copper", "titanium", "silver"],
  "prism-fault": ["silver", "diamond", "copper", "iron"],
  "cinder-vale": ["cobalt", "silver", "copper", "iron"],
  "vesper-9": ["copper", "gold", "silver", "iron"]
};
Object.keys(Le).flatMap((r) => Le[r].slice(0, -1).map((e, t) => `demand-${r}-${t + 1}`));
function Be(r, e = []) {
  const t = We[r], i = t.findIndex((o) => !e.includes(o.id)), s = i < 0;
  return { order: t[s ? t.length - 1 : i], stage: s ? t.length : i + 1, total: t.length, complete: s };
}
function Tt(r, e, t, i) {
  const s = Be(t, e);
  return i && !s.complete && r[s.order.ore] >= s.order.units;
}
const ne = () => Object.fromEntries(H.map((r) => [r, 0]));
class Nt {
  loadout = At();
  deliveries = {};
  money = 80;
  levels = { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 };
  grappleOwned = !1;
  fuel = 140;
  hull = 100;
  cargo = ne();
  shipCargo = ne();
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
    return this.escapeSuit || this.money < Z.cost ? !1 : (this.money -= Z.cost, this.escapeSuit = !0, !0);
  }
  buyStasisModule() {
    return this.stasisModule || this.money < xe.cost ? !1 : (this.money -= xe.cost, this.stasisModule = !0, !0);
  }
  buyReturnWinch() {
    return this.returnWinch || this.money < J.cost ? !1 : (this.money -= J.cost, this.returnWinch = !0, !0);
  }
  buySalvageMagnet() {
    return this.salvageMagnet || this.money < Te.cost ? !1 : (this.money -= Te.cost, this.salvageMagnet = !0, !0);
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
    if (!Object.hasOwn(ae, e)) return !1;
    const t = Math.round(Me(this.levels, "cargo") * Ne(this.loadout, "cargo") * ae[e].cargoMultiplier * 2) / 2;
    return this.count > t ? !1 : (this.specialization = e, !0);
  }
  buyDecal(e) {
    const t = yt[e];
    return this.ownedDecals.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedDecals.push(e), this.selectedDecal = e, !0);
  }
  selectDecal(e) {
    return this.ownedDecals.includes(e) ? (this.selectedDecal = e, !0) : !1;
  }
  buySuit(e) {
    const t = gt[e];
    return this.ownedSuits.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedSuits.push(e), this.selectedSuit = e, !0);
  }
  selectSuit(e) {
    return this.ownedSuits.includes(e) ? (this.selectedSuit = e, !0) : !1;
  }
  buyPaint(e) {
    const t = pt[e];
    return this.ownedPaints.includes(e) || this.money < t.cost ? !1 : (this.money -= t.cost, this.ownedPaints.push(e), this.selectedPaint = e, !0);
  }
  selectPaint(e) {
    return this.ownedPaints.includes(e) ? (this.selectedPaint = e, !0) : !1;
  }
  buyCharges() {
    return this.money < Q.packCost ? !1 : (this.money -= Q.packCost, this.charges += Q.packSize, !0);
  }
  useCharge() {
    return this.charges <= 0 ? !1 : (this.charges--, !0);
  }
  collectRouteFragment(e) {
    return !be.find((i) => i.id === e) || this.routeFragments.includes(e) ? !1 : (this.routeFragments.push(e), this.money += xt, !0);
  }
  get shipComplete() {
    return this.milestones.some((e) => L.some((t) => t.id === e)) || Object.keys(Mt).every((e) => this.shipComponents.includes(e));
  }
  canTravelToPlanet() {
    return this.shipComplete && this.coreFuel >= Y.jumpCost;
  }
  spendCoreFuelForJump() {
    return this.canTravelToPlanet() ? (this.coreFuel -= Y.jumpCost, !0) : !1;
  }
  get count() {
    return H.reduce((e, t) => e + this.cargo[t], 0);
  }
  get cargoValue() {
    return H.reduce((e, t) => e + this.cargo[t] * Ce[t].value, 0);
  }
  max(e) {
    const t = Me(this.levels, e) * Ne(this.loadout, e);
    return e === "cargo" ? Math.round(t * ae[this.specialization].cargoMultiplier * 2) / 2 : e === "hull" && this.specialistModules.reinforcedHull ? t * Ue.reinforcedHull.hullMultiplier : t;
  }
  drillTime(e) {
    const t = e >= 0.8 ? ae[this.specialization].rockDrillMultiplier : 1;
    return e / (this.max("drill") * t);
  }
  collect(e) {
    return this.count >= this.max("cargo") ? !1 : (this.cargo[e]++, !0);
  }
  collectUnits(e, t) {
    const i = Math.max(0, this.max("cargo") - this.count), s = Math.min(i, t);
    return s > 0 && (this.cargo[e] += s), s;
  }
  sell() {
    const e = this.cargoValue;
    return this.money += e, this.cargo = ne(), e;
  }
  claimMarketContract(e, t) {
    const i = Be(e, this.milestones), s = i.order;
    return i.complete || !Tt(this.cargo, this.milestones, e, t) ? 0 : (this.milestones.push(s.id), this.money += s.reward, s.reward);
  }
  cost(e) {
    return mt(e, this.levels[e]);
  }
  canBuyUpgrade(e) {
    const t = L.filter((i) => this.milestones.includes(i.id)).map((i) => i.id);
    return ut(this.levels[e] + 1, { shipComplete: this.shipComplete, coreRelics: t });
  }
  buy(e) {
    const t = this.cost(e);
    if (this.money < t || !Number.isSafeInteger(this.levels[e] + 1) || !this.canBuyUpgrade(e)) return !1;
    const i = this.max(e);
    return this.money -= t, this.levels[e]++, e === "grapple" && (this.grappleOwned = !0), e === "fuel" && (this.fuel += this.max(e) - i), e === "hull" && (this.hull += this.max(e) - i), !0;
  }
  serviceCost(e) {
    return Math.max(0, Math.ceil(
      (this.max(e) - this[e]) * ft[e === "fuel" ? "fuelPrice" : "hullPrice"]
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
    this.cargo = ne(), this.fuel = this.max("fuel"), this.hull = this.max("hull");
  }
}
const Ye = 0.25;
function Lt(r, e, t, i, s = 1) {
  if (X(t, i), ![r.u, r.v, e, s].every(Number.isFinite) || e < 0 || s <= 0)
    throw new RangeError("Planet tangent speed and position must be finite and non-negative");
  const o = Math.abs(i - r.v) * s * Math.PI / t;
  return e * s / Math.max(o, Ye);
}
function X(r, e) {
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(e) || e <= 0)
    throw new RangeError("Planet chart dimensions must be finite and positive");
}
function D(r, e, t, i = 1) {
  if (X(e, t), !Number.isFinite(r.u) || !Number.isFinite(r.v) || !Number.isFinite(i) || i <= 0)
    throw new RangeError("Planet chart coordinates and tile size must be finite");
  const s = Math.PI * r.u / e, o = t - r.v;
  return {
    x: o * Math.sin(s) * i,
    y: -o * Math.cos(s) * i
  };
}
function Ge(r, e, t, i = 1) {
  if (!Number.isInteger(r.x) || !Number.isInteger(r.y)) throw new RangeError("Planet tile coordinates must be integers");
  return {
    topLeft: D({ u: r.x, v: r.y }, e, t, i),
    topRight: D({ u: r.x + 1, v: r.y }, e, t, i),
    bottomRight: D({ u: r.x + 1, v: r.y + 1 }, e, t, i),
    bottomLeft: D({ u: r.x, v: r.y + 1 }, e, t, i)
  };
}
function Ot(r, e, t, i, s = 1) {
  const { topLeft: o, topRight: l, bottomRight: n, bottomLeft: g } = Ge(r, e, t, s), h = [o, l, n, g];
  if (h.some((m) => Math.hypot(m.x, m.y) <= i)) return !0;
  for (let m = 0; m < h.length; m++) {
    const w = h[m], C = h[(m + 1) % h.length], f = C.x - w.x, x = C.y - w.y, c = Math.max(0, Math.min(1, -(w.x * f + w.y * x) / (f * f + x * x || 1))), p = w.x + f * c, y = w.y + x * c;
    if (Math.hypot(p, y) <= i) return !0;
  }
  return !1;
}
function Pt(r, e, t, i = 1) {
  if (X(e, t), ![r.x, r.y, i].every(Number.isFinite) || i <= 0)
    throw new RangeError("Planet coordinates and tile size must be finite");
  const s = r.x / i, o = r.y / i, l = Math.hypot(s, o);
  if (l < 1e-10) return { u: e / 2, v: t };
  const n = s < 0 ? -l : l, g = s < 0 ? Math.atan2(-s, o) : Math.atan2(s, -o);
  return {
    u: Math.max(0, Math.min(e, g * e / Math.PI)),
    v: t - n
  };
}
function pe(r, e, t, i, s = 1) {
  if (X(t, i), ![r.u, r.v, e.x, e.y, s].every(Number.isFinite) || s <= 0)
    throw new RangeError("Planet vector and tile size must be finite");
  const o = Math.PI * r.u / t, n = (i - r.v) * s * Math.PI / t, g = -Math.sin(o) * e.x + Math.cos(o) * e.y, h = Math.cos(o) * e.x + Math.sin(o) * e.y;
  if (Math.abs(n) >= s * 0.025) return { x: h * s / n, y: g };
  const m = Ye;
  return { x: h * s / m, y: g };
}
function Dt(r, e, t, i, s) {
  if (X(i, s), ![r.u, r.v, e, t].every(Number.isFinite))
    throw new RangeError("Planet seam state must be finite");
  const o = Math.floor(r.u / i), l = r.u - o * i, n = Math.abs(o % 2) === 1;
  return {
    u: Object.is(l, -0) ? 0 : l,
    v: n ? s * 2 - r.v : r.v,
    dv: n ? -e : e,
    aimV: n ? -t : t,
    crossings: o
  };
}
function oe(r, e, t) {
  if (X(e, t), !Number.isInteger(r.x) || !Number.isInteger(r.y)) throw new RangeError("Planet tile coordinates must be integers");
  const i = Math.floor(r.x / e);
  return { x: r.x - i * e, y: Math.abs(i % 2) === 1 ? t * 2 - r.y - 1 : r.y };
}
function Oe(r, e, t) {
  const i = r.planetChart;
  return D({ u: e / a.tile, v: t / a.tile }, i.columns, i.radiusRows, a.tile);
}
function Ft(r, e, t, i, s) {
  if (s?.planetChart) {
    const n = Oe(s, r, e), g = Oe(s, t, i);
    return Math.hypot(g.x - n.x, g.y - n.y) <= Q.pickupRadius + Math.hypot(u.halfWidth, u.halfHeight);
  }
  const o = Math.max(0, Math.abs(t - r) - u.halfWidth), l = Math.max(0, Math.abs(i - e) - u.halfHeight);
  return Math.hypot(o, l) <= Q.pickupRadius;
}
class kt {
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
  update(e, t, i, s = "horizontal", o = /* @__PURE__ */ new Set()) {
    if (!t || t.type === "boundary" || t.type === "empty") {
      this.warningRemaining = 0, this.cargoOverflow = !1, this.warningUnits = 0, this.warningSpace = Math.max(0, this.progress.max("cargo") - this.progress.count), this.target = void 0, this.affected = [], this.elapsed = 0, this.ratio = 0, this.effectiveWidth = de(this.progress.levels.drill);
      return;
    }
    (this.target?.x !== t.x || this.target?.y !== t.y) && (this.elapsed = 0), this.target = t;
    const l = this.world.planetChart, n = typeof s == "string" ? s === "vertical" : Math.abs(s.y) >= Math.abs(s.x), g = l ? Math.abs(l.radiusRows - (t.y + 0.5)) : 1 / 0, h = l ? Math.max(0.1, a.tile * g * Math.PI / l.columns) : a.tile, m = l && n && g * a.tile > k.physicalPassageRadius ? Math.ceil((2 * u.halfWidth + 4) / h) : 1, w = de(this.progress.levels.drill), C = Math.max(w, m), f = Math.max(1, w / m);
    this.effectiveWidth = C;
    const x = -Math.floor((C - 1) / 2);
    this.affected = Array.from({ length: C }, (p, y) => {
      const M = x + y;
      if (typeof s == "string")
        return this.world.get(t.x + (s === "horizontal" ? M : 0), t.y + (s === "vertical" ? M : 0));
      const v = Math.hypot(s.x, s.y) || 1, d = -s.y / v, E = s.x / v;
      return this.world.get(Math.round(t.x + d * M), Math.round(t.y + E * M));
    }).filter((p, y, M) => p.type !== "empty" && p.type !== "boundary" && !o.has(`${p.x},${p.y}`) && M.findIndex((v) => v.x === p.x && v.y === p.y) === y), this.elapsed += e;
    const c = this.affected.reduce((p, y) => p + (y.ore ? y.oreUnits ?? 1 : 0), 0);
    if (this.warningUnits = c, this.warningSpace = Math.max(0, this.progress.max("cargo") - this.progress.count), this.cargoOverflow = c > 0 && c > this.warningSpace, this.warningRemaining = 0, this.progress.fuel = Math.max(0, this.progress.fuel - e * we.drilling * f * (this.progress.specialistModules.efficientCooling ? Ue.efficientCooling.drillingMultiplier : 1)), this.ratio = Math.min(1, this.elapsed / this.progress.drillTime(t.hardness)), this.ratio >= 1) {
      for (const p of this.affected) {
        this.world.break(p.x, p.y);
        const y = p.ore ? this.progress.collectUnits(p.ore, p.oreUnits ?? 1) : 0;
        i(p, y, p.ore ? Math.max(0, (p.oreUnits ?? 1) - y) : 0);
      }
      this.target = void 0, this.affected = [], this.elapsed = 0, this.ratio = 0, this.effectiveWidth = de(this.progress.levels.drill), this.cargoOverflow = !1, this.warningUnits = 0;
    }
  }
}
function Ht(r, e) {
  return e.length >= 4 ? 4 : e.length > 0 ? 3 : r.length >= 4 ? 2 : r.length > 0 ? 1 : 0;
}
const le = (r, e, t) => {
  const i = ee(t);
  return (e < 0 && e > -650 || e >= i && e <= i + 650) && r > 560 && r < 1410;
}, Ut = (r, e, t) => {
  if (!t) return le(r, e);
  const i = ee(t), s = t.columns * a.tile;
  return r >= 0 && r < s && (e < 0 && e > -650 || e >= i && e <= i + 650);
};
Object.fromEntries(Object.entries(ve).map(([r, e]) => [r, e.oreFactors]));
function Pe(r, e, t, i, s, o, l) {
  if (!(l || Math.abs(i - t) < 1e-5))
    for (const n of r) {
      if (n.kind === "trade-post" || n.kind === "warehouse" || n.kind === "wall" || n.kind === "gate" || n.kind === "fort") continue;
      const g = nt[n.kind].widthTiles * a.tile / 2;
      if (Math.abs(e - n.x) > g) continue;
      const h = t + s * o - n.y, m = i + s * o - n.y;
      if (h * s <= 0 && m * s >= 0) return n.y - s * o;
    }
}
function Ve(r, e, t, i = 1) {
  const s = D({ u: r, v: e }, t.columns, t.radiusRows, i);
  if (Math.hypot(s.x, s.y) < 1e-6) return;
  const o = -Math.PI / 2 - Math.atan2(s.y, s.x);
  return Math.atan2(Math.sin(o), Math.cos(o));
}
function De(r, e, t) {
  const i = Math.cos(t), s = Math.sin(t);
  return { x: r * i + e * s, y: -r * s + e * i };
}
function Wt(r, e, t, i, s = 1) {
  const o = Math.floor(e / a.tile), l = Math.floor(t / a.tile), n = Math.ceil(i / a.tile);
  let g, h = 1 / 0;
  const m = s > 0 ? Math.max(0, l - n) : l + 1, w = s > 0 ? l - 1 : l + n, C = r.planetChart ? o - n : Math.max(0, o - n), f = r.planetChart ? o + n : Math.min(r.widthTiles - 1, o + n);
  for (let x = m; x <= w; x++) for (let c = C; c <= f; c++) {
    if (r.get(c, x).type === "empty") continue;
    const p = c * a.tile + a.tile / 2, y = s > 0 ? (x + 1) * a.tile + 2 : x * a.tile - 2, M = p - e, v = y - t, d = Math.hypot(M, v);
    if (v * s > -26 || d > i || d >= h) continue;
    let E = !0;
    const A = Math.ceil(d / (a.tile / 3));
    for (let F = 1; F < A; F++) {
      const G = e + M * F / A, U = t + v * F / A;
      if (r.solid(Math.floor(G / a.tile), Math.floor(U / a.tile))) {
        E = !1;
        break;
      }
    }
    E && (g = { x: p, y }, h = d);
  }
  return g;
}
function qe(r, e) {
  return e && Math.abs(e.radiusRows - r / a.tile) / e.radiusRows < 0.65 ? Math.min(3, u.horizontalCollisionInset) : u.horizontalCollisionInset;
}
function Bt(r, e, t, i, s, o) {
  const l = r.planetChart, n = u.halfWidth - qe(s, l), g = (f) => ({
    x: f.x * Math.cos(o) - f.y * Math.sin(o),
    y: f.x * Math.sin(o) + f.y * Math.cos(o)
  }), h = Ge({ x: e, y: t }, l.columns, l.radiusRows, a.tile), m = g(D({ u: i / a.tile, v: s / a.tile }, l.columns, l.radiusRows, a.tile)), w = [h.topLeft, h.topRight, h.bottomRight, h.bottomLeft].map(g), C = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let f = 0; f < w.length; f++) {
    const x = w[f], c = w[(f + 1) % w.length], p = c.x - x.x, y = c.y - x.y;
    C.push({ x: -y, y: p });
  }
  for (const f of C) {
    const x = Math.hypot(f.x, f.y) || 1, c = f.x / x, p = f.y / x, y = w.map((d) => d.x * c + d.y * p), M = m.x * c + m.y * p, v = Math.abs(c) * n + Math.abs(p) * u.halfHeight;
    if (Math.max(...y) < M - v || Math.min(...y) > M + v) return !1;
  }
  return !0;
}
function Yt(r, e, t, i) {
  const s = r.planetChart, o = u.halfWidth - qe(t, s), l = [
    { x: -o, y: -16 },
    { x: o, y: -16 },
    { x: o, y: u.halfHeight },
    { x: -o, y: u.halfHeight }
  ].map((y) => {
    const M = e + y.x * Math.cos(i) + y.y * Math.sin(i), v = t - y.x * Math.sin(i) + y.y * Math.cos(i), d = D({ u: M / a.tile, v: v / a.tile }, s.columns, s.radiusRows, a.tile);
    return Pt(d, s.columns, s.radiusRows, a.tile);
  }), n = l.map((y) => y.u), g = l.map((y) => y.v), h = Math.min(...n), m = Math.max(...n), w = m - h > s.columns / 2, C = w ? 0 : Math.floor(h) - 2, f = w ? s.columns - 1 : Math.ceil(m) + 1, x = Math.max(-1, Math.floor(Math.min(...g)) - 2), c = Math.min(s.radiusRows * 2, Math.ceil(Math.max(...g)) + 1), p = [];
  for (let y = x; y <= c; y++) for (let M = C; M <= f; M++) {
    const v = r.get(M, y);
    v.type !== "empty" && Bt(r, M, y, e, t, i) && !p.some((d) => d.x === v.x && d.y === v.y) && p.push(v);
  }
  return p;
}
class Gt {
  constructor(e, t) {
    this.world = e, this.progress = t;
  }
  x = a.spawnX;
  y = a.spawnY;
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
  reset() {
    this.docked = !0, this.thrusting = !1, this.stasisActive = !1, this.reeling = !1, this.grappleAnchor = void 0, this.grappleHang = this.grappleCooldown = 0, this.x = a.spawnX, this.y = a.spawnY, this.vx = 0, this.vy = 0;
  }
  overlaps(e, t, i) {
    if (this.world.planetChart) return Yt(
      this.world,
      e,
      t,
      i ?? Ve(e / a.tile, t / a.tile, this.world.planetChart) ?? 0
    );
    const s = [];
    for (let o = Math.floor((t - u.halfHeight + 1e-5) / a.tile); o <= Math.floor((t + u.halfHeight - 1e-5) / a.tile); o++)
      for (let l = Math.floor((e - u.halfWidth + u.horizontalCollisionInset + 1e-5) / a.tile); l <= Math.floor((e + u.halfWidth - u.horizontalCollisionInset - 1e-5) / a.tile); l++)
        this.world.solid(l, o) && s.push(this.world.get(l, o));
    return s;
  }
  townPlatformCrossing(e, t, i, s, o) {
    if (o || e < 430 || e > 1540 || Math.abs(i - t) < 1e-5 || this.progress.milestones.includes("mothership-origin")) return;
    const l = Ht(this.progress.shipComponents, this.progress.milestones.filter((n) => n.startsWith("core-")));
    for (let n = 0; n <= l; n++) {
      const g = st(t, this.world.planetChart) - s * (132 + n * 94), h = t + s * u.halfHeight, m = i + s * u.halfHeight;
      if ((h - g) * s <= 0 && (m - g) * s >= 0) return g - s * u.halfHeight;
    }
  }
  predictsDamagingImpact(e, t) {
    let i = this.x, s = this.y, o = this.vx, l = this.vy;
    const n = this.progress.max("engine"), g = Number(e.right) - Number(e.left), h = e.escapePack ? Z.speedMultiplier : 1, m = u.rise * n * h, w = q.predictionStepSeconds;
    for (let C = 0; C < q.impactWindowSeconds; C += w) {
      const f = this.world.gravitySign(s);
      o += g * u.acceleration * n * h * w, g || (o *= Math.exp(-10 * w)), o = Math.max(-145 * n * h, Math.min(u.horizontal * n * h, o));
      const x = i + o * w;
      this.overlaps(x, s, t).length ? o = 0 : i = x, l += f * (u.gravity + (e.down ? 110 : 0)) * w, l = f > 0 ? Math.max(-m, Math.min(u.fall, l)) : Math.max(-430, Math.min(m, l));
      const c = s + l * w, p = this.townPlatformCrossing(i, s, c, f, !!e.down), y = Pe(this.structures, i, s, c, f, u.halfHeight, !!e.down), M = this.world.surfaceHeight(i, s), v = M - f * 22, E = l * -f > 0 && (f > 0 ? s >= v && c <= v : s <= v && c >= v);
      if (p !== void 0 || y !== void 0 || E) return !1;
      const A = this.overlaps(i, c, t);
      if (A.length && l * f > 0) return Math.abs(l) > u.safeImpact;
      A.length ? l = 0 : s = c;
    }
    return !1;
  }
  wrapPlanetPosition() {
    const e = this.world.planetChart;
    if (!e) return;
    const t = Dt(
      { u: this.x / a.tile, v: this.y / a.tile },
      this.vy / a.tile,
      0,
      e.columns,
      e.radiusRows
    );
    t.crossings && (this.x = t.u * a.tile, this.y = t.v * a.tile, this.vy = t.dv * a.tile, this.planetSeamCrossings += t.crossings);
  }
  update(e, t, i, s = 0) {
    this.planetSeamCrossings = 0;
    const o = this.world.gravitySign(this.y), l = this.progress, n = l.max("engine"), g = !!t.stasis && l.stasisModule && l.fuel > 0 && this.y > 0, h = !!t.reel && l.returnWinch && l.fuel > 0 && this.y > 0 && !g;
    if (this.docked) {
      if (!t.left && !t.right && !t.down && !t.up && !g) {
        this.vx = 0, this.vy = 0, this.thrusting = !1, this.stasisActive = !1, this.reeling = !1;
        return;
      }
      if (!t.left && !t.right && !t.down && !t.up && t.stasis && !g) return;
      this.docked = !1;
    }
    if (this.grappleCooldown = Math.max(0, this.grappleCooldown - e), this.grappleAnchor)
      if (this.grappleHang = Math.max(0, this.grappleHang - e), t.up || t.releaseGrapple || this.grappleHang <= 0) this.grappleAnchor = void 0;
      else {
        this.vx = this.vy = 0, this.thrusting = this.reeling = this.stasisActive = !1;
        return;
      }
    const m = Number(t.right) - Number(t.left), w = De(m, 0, s), C = De(0, -1, s), f = this.world.planetChart, x = f ? pe(
      { u: this.x / a.tile, v: this.y / a.tile },
      w,
      f.columns,
      f.radiusRows,
      a.tile
    ) : w;
    let c = f ? pe(
      { u: this.x / a.tile, v: this.y / a.tile },
      C,
      f.columns,
      f.radiusRows,
      a.tile
    ) : C;
    if (h && t.winchTarget) {
      const b = f ? D({ u: this.x / a.tile, v: this.y / a.tile }, f.columns, f.radiusRows, a.tile) : { x: this.x, y: this.y }, N = f ? D({ u: t.winchTarget.x / a.tile, v: t.winchTarget.y / a.tile }, f.columns, f.radiusRows, a.tile) : t.winchTarget, O = N.x - b.x, S = N.y - b.y, _ = Math.hypot(O, S);
      if (_ > 1) {
        const te = { x: O / _, y: S / _ };
        c = f ? pe({ u: this.x / a.tile, v: this.y / a.tile }, te, f.columns, f.radiusRows, a.tile) : te;
      }
    }
    const p = x.x, y = x.y, M = !!t.escapePack;
    if (this.stasisActive = g, this.reeling = h, this.thrusting = (t.up || h) && (t.mothership ? l.coreFuel > 0 && l.shipComplete : l.fuel > 0 || M) && !this.stasisActive, m && (this.facing = m), t.down && !m && this.vy * o >= 0) {
      const b = Math.floor(this.x / a.tile) * a.tile + a.tile / 2, N = this.x + Math.max(-70 * e, Math.min(70 * e, b - this.x));
      this.overlaps(N, this.y, s).length || (this.x = N);
    }
    const v = M ? Z.speedMultiplier : 1, d = M ? Z.thrustMultiplier : 1, E = f ? Lt(
      { u: this.x / a.tile, v: this.y / a.tile },
      u.horizontal * n * v,
      f.columns,
      f.radiusRows,
      a.tile
    ) : u.horizontal * n * v;
    if (this.vx += p * u.acceleration * n * v * e, this.vy += y * u.acceleration * n * v * e, m || (this.vx *= Math.exp(-10 * e)), this.vx = Math.max(-E, Math.min(E, this.vx)), this.stasisActive) this.vy = 0;
    else {
      const b = this.thrusting ? u.thrust * n * d * (this.reeling ? J.pullMultiplier : 1) : 0;
      this.vx += c.x * b * e, this.vy += (o * (u.gravity + (t.down ? 110 : 0)) + c.y * b) * e, this.vx = Math.max(-E, Math.min(E, this.vx));
    }
    const A = u.rise * n * v * (this.reeling ? J.pullMultiplier : 1), F = !!this.world.planetChart && Math.abs(this.y - this.world.coreWorldY) <= Je, G = F ? Math.max(A, u.fall) : A;
    if (this.vy = o > 0 ? Math.max(-G, Math.min(u.fall, this.vy)) : Math.max(-430, Math.min(G, this.vy)), t.down && l.fuel > 0 && !t.mothership && !F && this.vy * o > u.drillingDescent && (this.vy = o * u.drillingDescent), l.grappleOwned && t.grappleEnabled !== !1 && !t.mothership && this.grappleCooldown <= 0 && o * this.vy >= q.fallSpeed && !t.up && !t.releaseGrapple && !h && !this.stasisActive && this.predictsDamagingImpact(t, s)) {
      const b = Wt(this.world, this.x, this.y, Me(l.levels, "grapple"), o);
      if (b) {
        this.grappleAnchor = b, this.grappleHang = q.hangSeconds, this.grappleCooldown = Math.max(1, q.cooldownSeconds.at(-1) - Math.max(0, l.levels.grapple - q.cooldownSeconds.length)), this.vx = this.vy = 0, this.thrusting = this.reeling = !1;
        return;
      }
    }
    t.mothership || (l.fuel = Math.max(
      0,
      l.fuel - (M ? 0 : e * ((p || t.down ? we.moving : 0) + (this.thrusting ? we.thrust * (this.reeling ? J.fuelMultiplier : 1) : 0) + (this.stasisActive ? xe.fuelPerSecond : 0)))
    ));
    let U;
    const V = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * e / 7));
    for (let b = 0; b < V; b++) {
      const N = this.x + this.vx * e / V, O = this.overlaps(N, this.y, s);
      O.length ? (m && (U = O.find((P) => P.type !== "boundary")), Math.abs(this.vx) > u.safeImpact && i((Math.abs(this.vx) - u.safeImpact) * u.damageScale), this.world.planetChart || (this.x = this.vx > 0 ? Math.min(...O.map((P) => P.x * a.tile)) - (u.halfWidth - u.horizontalCollisionInset) : Math.max(...O.map((P) => (P.x + 1) * a.tile)) + (u.halfWidth - u.horizontalCollisionInset)), this.vx = 0) : this.x = N, this.wrapPlanetPosition();
      const S = this.world.gravitySign(this.y), _ = this.y + this.vy * e / V, te = a.homeColumn, je = Math.round(this.world.coreWorldY / a.tile), Se = (P, ie) => {
        const W = Math.floor(P / a.tile), Qe = Math.floor(ie / a.tile);
        return (W - te) ** 2 + (Qe - je) ** 2 <= k.passageRadius ** 2;
      }, Xe = Se(this.x, this.y), re = this.overlaps(this.x, _, s), _e = this.townPlatformCrossing(this.x, this.y, _, S, t.down), ze = Pe(this.structures, this.x, this.y, _, S, u.halfHeight, t.down), Re = this.world.surfaceHeight(this.x, this.y), I = Re - S * 22, Ke = this.vy * -S > 0, Ae = this.world.terrain ? this.world.solid(Math.floor(this.x / a.tile), Math.floor((Re + S) / a.tile)) : this.world.planetChart ? Ut(this.x, I, this.world.planetChart) : le(this.x, I);
      if ((S > 0 ? this.y >= I && _ <= I : this.y <= I && _ >= I) && Ke && Ae && (this.reeling || !t.up && !t.down)) {
        this.y = I, this.vy = 0, this.thrusting = !1, this.reeling = !1, this.docked = !t.left && !t.right;
        return;
      }
      const $e = this.vy * S > 0;
      if ((S > 0 ? this.y <= I && _ >= I : this.y >= I && _ <= I) && $e && !t.down && Ae) {
        this.y = I, !t.left && !t.right && (this.vx = 0), this.vy = 0, this.docked = !t.left && !t.right, this.thrusting = !1, this.reeling = !1;
        return;
      }
      const ce = Xe && Se(this.x, _) && (this.y < this.world.coreWorldY && _ >= this.world.coreWorldY || this.y > this.world.coreWorldY && _ <= this.world.coreWorldY) ? void 0 : _e ?? ze;
      if (ce !== void 0 && this.vy * S > 0)
        _e === void 0 && !le(this.x, ce, this.world.planetChart) && Math.abs(this.vy) > u.safeImpact && i((Math.abs(this.vy) - u.safeImpact) * u.damageScale), this.y = ce, this.vy = 0;
      else if (re.length) {
        this.vy * S > 0 && (t.down && (U = re.find((W) => W.type !== "boundary")), !le(this.x, this.y, this.world.planetChart) && Math.abs(this.vy) > u.safeImpact && i((Math.abs(this.vy) - u.safeImpact) * u.damageScale));
        const P = Math.min(...re.map((W) => W.y * a.tile)), ie = Math.max(...re.map((W) => (W.y + 1) * a.tile));
        this.world.planetChart || (this.y = this.vy * S > 0 ? S > 0 ? P - u.halfHeight : ie + u.halfHeight : S > 0 ? ie + u.halfHeight : P - u.halfHeight), this.vy = 0;
      } else this.y = _;
      this.world.planetChart || (this.x = Math.max(u.halfWidth, Math.min(this.world.widthTiles * a.tile - u.halfWidth, this.x))), !this.world.planetChart && this.y < -652 && (this.y = -652, this.vy = 0);
    }
    return t.up || M ? void 0 : U;
  }
}
function Vt(r, e, t) {
  const i = r.widthTiles, s = Math.floor(e / a.tile / i), o = t > r.coreWorldY != (Math.abs(s) % 2 === 1);
  return (Math.floor(e / a.tile) % i + i) % i + (o ? i : 0);
}
function qt(r, e, t) {
  return r.terrain?.heights[Vt(r, e, t)] ?? 0;
}
function jt(r, e, t) {
  if (!r.terrain) return !1;
  const i = t >= r.farSurfaceRow / 2, s = e + (i ? r.widthTiles : 0), o = i ? r.farSurfaceRow - 1 - t : t;
  return r.terrain.caves.some((l) => {
    const n = r.terrain.heights[l], g = s - l;
    return Math.abs(g) <= 1 && o >= n && o <= n + 7 || (g - 3) ** 2 / 16 + (o - n - 7) ** 2 / 4 <= 1;
  });
}
const $ = (r, e) => `${r},${e}`;
function B(r, e, t, i = 0) {
  let s = Math.imul(e ^ r, 374761393) ^ Math.imul(t ^ i, 668265263);
  return s = Math.imul(s ^ s >>> 13, 1274126177), ((s ^ s >>> 16) >>> 0) / 4294967296;
}
function ge(r, e, t) {
  if (e !== "cryo-shelf" || !t || t.radiusRows >= 64) return r;
  const i = t.radiusRows / 64;
  return r <= 64 ? Math.round(r * i) : t.radiusRows * 2 - Math.round((128 - r) * i);
}
class Xt {
  constructor(e, t = [], i = [], s = "mars-frontier", o) {
    this.seed = e, this.mapId = s, this.planetChart = o, this.destroyed = new Set(t), this.discovered = new Set(i);
  }
  miningOnly = !1;
  openingLayout = !1;
  terrain;
  clearedTerritories = /* @__PURE__ */ new Set();
  surfaceHeight(e, t) {
    const i = qt(this, e, t) * a.tile;
    return t < this.coreWorldY ? i : this.farSurfaceY - i;
  }
  aboveTerrain(e, t) {
    const i = this.surfaceHeight(e, t);
    return t < this.coreWorldY ? t < i : t >= i;
  }
  atTerrainSurface(e, t) {
    const i = this.surfaceHeight(e, t);
    return (t - i) * this.gravitySign(t) < 8;
  }
  clearedCaves = /* @__PURE__ */ new Set();
  chunks = /* @__PURE__ */ new Map();
  destroyed = /* @__PURE__ */ new Set();
  discovered = /* @__PURE__ */ new Set();
  get widthTiles() {
    return this.planetChart?.columns ?? a.width;
  }
  get coreWorldY() {
    return he(this.planetChart);
  }
  get farSurfaceY() {
    return ee(this.planetChart);
  }
  get farSurfaceRow() {
    return ke(this.planetChart);
  }
  get coreDepthMeters() {
    return rt(this.planetChart);
  }
  generate(e, t) {
    this.planetChart && ({ x: e, y: t } = oe({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows));
    const i = this.planetChart ? at(t * a.tile, this.planetChart) : t * a.meters, s = ot(i), o = ve[this.mapId], l = Math.max(0, zt(i)), n = {
      x: e,
      y: t,
      type: s.type,
      hardness: s.hardness,
      tint: this.mapId === "mars-frontier" ? s.colors[Math.floor(B(this.seed, e, t, 1) * 3)] : ve[this.mapId].palette[l]
    };
    if (e < 0 || e >= this.widthTiles) return { ...n, type: "boundary", hardness: 1 / 0 };
    if (t < 0) return { ...n, type: "empty" };
    if (t >= this.farSurfaceRow) return { ...n, type: "empty", ore: void 0 };
    if (this.aboveTerrain((e + 0.5) * a.tile, (t + 0.5) * a.tile) || !(this.openingLayout && this.miningOnly && e >= 28 && e <= 47 && t <= 22) && jt(this, e, t)) return { ...n, type: "empty", ore: void 0 };
    if (this.openingLayout && this.miningOnly) {
      const c = Et;
      if (e >= c.caveColumn - 1 && e <= c.caveColumn + 1 && t >= 0 && t <= 12 || e >= c.safeLeft && e <= c.safeRight && t >= 8 && t < c.caveFloor || e >= 37 && e <= 38 && t >= 11 && t <= 17 || e >= 39 && e <= 46 && t >= 14 && t <= 19) return { ...n, type: "empty", ore: void 0 };
      if (e === 36 && t >= 11 && t <= 12) return { ...n, type: "dirt", hardness: 0.8, ore: "iron", oreUnits: 1 };
      const p = c.seams.find((y) => e >= y.left && e <= y.right && t >= y.top && t <= y.bottom);
      if (p) return { ...n, type: "dirt", hardness: 0.8, ore: p.ore, oreUnits: 1 };
      if (e >= 14 && e <= 22 && t <= 12) return { ...n, type: "dirt", hardness: 0.8, ore: void 0 };
      if (e >= 28 && e <= 47 && t >= 7 && t <= 22) return { ...n, type: "dirt", hardness: 0.8, ore: void 0 };
    }
    const g = this.coreWorldY, h = Math.round(g / a.tile), m = a.homeColumn, w = L.find((c) => c.mapId === this.mapId);
    if (e === m && t === h && w)
      return { ...n, type: "hard", hardness: Math.max(2.2, s.hardness), ore: void 0, coreRelicId: w.id, tint: w.tint };
    if (this.planetChart && Ot(
      { x: e, y: t },
      this.planetChart.columns,
      this.planetChart.radiusRows,
      k.physicalPassageRadius,
      a.tile
    )) return { ...n, type: "empty", ore: void 0, tint: 7649707 };
    if ((e - m) ** 2 + (t - h) ** 2 <= k.passageRadius ** 2)
      return { ...n, type: "empty", ore: void 0, tint: 7649707 };
    if (t === h) return { ...n, type: "boundary", hardness: 1 / 0, ore: void 0 };
    const C = this.mapId === "cryo-shelf" ? be.find((c) => c.x === e && ge(c.row, this.mapId, this.planetChart) === t) : void 0;
    if (C && !this.miningOnly) return { ...n, fragmentId: C.id, landmarkId: C.id, tint: 9560018, hardness: Math.max(0.8, s.hardness), ore: void 0 };
    if (this.mapId === "cryo-shelf") {
      const c = be.find(
        (p) => Math.abs(e - p.x) <= p.chamber.halfWidth && Math.abs(t - ge(p.row, this.mapId, this.planetChart)) <= p.chamber.halfHeight && (e - p.x) ** 2 / (p.chamber.halfWidth + 0.5) ** 2 + (t - ge(p.row, this.mapId, this.planetChart)) ** 2 / (p.chamber.halfHeight + 0.5) ** 2 <= 1
      );
      if (c) return { ...n, type: "empty", ore: void 0, fragmentId: void 0, landmarkId: c.id, tint: 6721425 };
    }
    for (const c of [...H].reverse()) {
      const p = Ce[c], y = i, M = c === "diamond" ? 2 : 3;
      if (y >= p.min && y <= p.max && B(this.seed, Math.floor(e / M), Math.floor(t / M), H.indexOf(c) + 20) < Math.min(0.9, p.rarity * o.oreFactors[c]) && B(this.seed, e, t, 50) > 0.15) {
        n.ore = c;
        const v = B(this.seed, e, t, 91);
        n.oreUnits = v > 0.996 ? 3 : v > 0.96 ? 2 : v > 0.88 ? 0.5 : 1, o.geodeChance > 0 && B(this.seed, e, t, 207) < o.geodeChance && (n.geode = !0, n.oreUnits = 3);
        const d = lt[this.mapId];
        d && B(this.seed, e, t, 311) < d.chance && (n.regionFind = this.mapId, n.oreUnits = Math.max(n.oreUnits, d.units));
        break;
      }
    }
    t < 3 && e >= 23 && e <= 25 && (n.ore = "copper", n.oreUnits = 1);
    const f = this.miningOnly && this.mapId === "cryo-shelf" && bt.find((c) => e >= c.left && e <= c.right && t >= c.top && t <= c.bottom);
    f && (n.type = "dirt", n.hardness = Math.min(n.hardness, 0.8), n.ore = f.ore, n.oreUnits = 1), t > 5 && !n.ore && B(this.seed, Math.floor((e + 1) / 4), Math.floor(t / 3), 80) < o.caveChance && (n.type = "empty");
    const x = vt.find((c) => c.mapId === this.mapId && c.x === e && c.row === t);
    return x && !this.miningOnly && (n.signalHashId = x.id, n.type === "empty" && (n.type = "rock")), n;
  }
  get(e, t) {
    if (this.planetChart && ({ x: e, y: t } = oe({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows)), t < 0 || e < 0 || e >= this.widthTiles) return this.generate(e, t);
    const i = Math.floor(e / a.chunk), s = Math.floor(t / a.chunk), o = $(i, s);
    let l = this.chunks.get(o);
    if (!l) {
      l = [];
      for (let g = 0; g < a.chunk; g++)
        for (let h = 0; h < a.chunk; h++)
          l.push(this.generate(i * a.chunk + h, s * a.chunk + g));
      this.chunks.set(o, l);
    }
    const n = l[t % a.chunk * a.chunk + e % a.chunk];
    return this.destroyed.has($(e, t)) && n.type !== "boundary" ? { ...n, type: "empty", ore: void 0, fragmentId: void 0, signalHashId: void 0, coreRelicId: void 0, geode: void 0, regionFind: void 0 } : n;
  }
  solid(e, t) {
    return this.get(e, t).type !== "empty";
  }
  gravitySign(e) {
    return it(e, this.planetChart);
  }
  break(e, t) {
    const i = this.planetChart ? oe({ x: e, y: t }, this.planetChart.columns, this.planetChart.radiusRows) : { x: e, y: t };
    this.get(i.x, i.y).type !== "boundary" && this.destroyed.add($(i.x, i.y));
  }
  reveal(e, t, i = 0, s = 4) {
    const o = Math.floor(e / a.tile), l = Math.floor(t / a.tile), n = Math.min(this.widthTiles * 2, Math.max(1, s + i)), g = Math.floor(n * 6 / 7);
    for (let h = Math.max(0, l - g); h <= l + g; h++)
      for (let m = this.planetChart ? o - n : Math.max(0, o - n); m <= (this.planetChart ? o + n : Math.min(this.widthTiles - 1, o + n)); m++)
        if (Math.hypot(m - o, (h - l) * 1.1) < n) {
          const w = this.planetChart ? oe({ x: m, y: h }, this.planetChart.columns, this.planetChart.radiusRows) : { x: m, y: h };
          (!this.planetChart || w.y >= 0 && w.y < this.planetChart.radiusRows * 2) && this.discovered.add($(w.x, w.y));
        }
  }
  prune(e, t) {
    const i = Math.floor(e / a.tile / a.chunk), s = t === void 0 ? void 0 : Math.floor(t / a.tile / a.chunk);
    for (const o of this.chunks.keys()) {
      const [l, n] = o.split(",").map(Number);
      (Math.abs(n - i) > 2 || this.planetChart && s !== void 0 && Math.abs(l - s) > 3) && this.chunks.delete(o);
    }
  }
}
function zt(r) {
  return r >= 1e3 ? 4 : r >= 600 ? 3 : r >= 300 ? 2 : r >= 100 ? 1 : 0;
}
function Kt(r, e, t, i = "cryo-shelf") {
  if (!He.worlds.includes(i)) throw new Error("INVALID_STATE");
  if (!Number.isSafeInteger(t) || t < r.observed_at_ms || e.length < 1 || e.length > R.maxSegmentsPerBatch) throw new Error("INVALID_COMMAND");
  const s = e.reduce((d, E) => d + E.duration_ms, 0), o = Math.min(
    R.maxBatchMs,
    r.input_budget_ms + t - r.observed_at_ms
  );
  if (s > o || s > R.maxBatchMs) throw new Error("RATE_LIMITED");
  let l = r.last_sequence;
  for (const d of e)
    if (d.sequence !== ++l || d.aim_cell !== null || !Number.isSafeInteger(d.duration_ms) || d.duration_ms < R.fixedStepMs || d.duration_ms > R.maxSegmentMs || d.duration_ms % R.fixedStepMs !== 0 || !["left", "right", "up", "down", "drill"].every((E) => typeof d[E] == "boolean"))
      throw new Error("INVALID_COMMAND");
  const n = new Xt(r.world_seed, r.destroyed_cells, [], i, se), g = L.find((d) => d.mapId === i);
  n.miningOnly = !0;
  const h = new Nt();
  h.levels = { ...r.levels }, h.grappleOwned = r.levels.grapple > 1, h.money = 0, h.coreFuel = r.core_fuel, h.milestones = [...r.core_relics], h.fuel = r.fuel_milli / 1e3, h.hull = r.hull_milli / 1e3;
  for (const d of H) h.cargo[d] = (r.cargo_half_units[d] ?? 0) / 2;
  const m = new Gt(n, h);
  Object.assign(m, r.pod);
  const w = new kt(n, h);
  r.drill_target && (w.target = n.get(r.drill_target.x, r.drill_target.y)), w.elapsed = r.drill_elapsed_ms / 1e3;
  const C = r.drops.map((d) => ({ ...d })), f = new Set(r.destroyed_cells), x = { ...r.cargo_half_units };
  let c = r.core_extraction_elapsed_ms;
  if (h.fuel <= 0 || h.hull <= 0) throw new Error("INVALID_COMMAND");
  let p = !1;
  for (const d of e) {
    for (let E = 0; E < d.duration_ms; E += R.fixedStepMs) {
      const A = R.fixedStepMs / 1e3, F = Ve(m.x / a.tile, m.y / a.tile, se) ?? 0, G = { left: d.left, right: d.right, up: d.up, down: d.down, grappleEnabled: !1 }, U = m.update(A, G, (b) => {
        h.hull = Math.max(0, h.hull - b);
      }, F);
      if (h.fuel <= 0 || h.hull <= 0) {
        p = !0;
        break;
      }
      w.update(A, d.drill && !d.up ? U : void 0, (b, N, O) => {
        b.coreRelicId && _t(h, b.coreRelicId), O > 0 && b.ore && C.push({
          id: $(b.x, b.y),
          x: b.x,
          y: b.y,
          ore: b.ore,
          quantity_half_units: Math.round(O * 2)
        });
      }, d.down ? "vertical" : "horizontal");
      const V = Rt(
        c / 1e3,
        A,
        !!g && h.milestones.includes(g.id),
        n.get(a.homeColumn, se.radiusRows).type === "empty",
        Math.abs(m.y - se.radiusRows * a.tile) <= k.drillAssistReach && (d.down || d.drill),
        h.coreFuel
      );
      c = Math.round(V.elapsed * 1e3), h.coreFuel += V.reward;
      for (const b of C) {
        if (b.quantity_half_units <= 0 || !Ft(m.x, m.y, (b.x + 0.5) * a.tile, (b.y + 0.5) * a.tile, n)) continue;
        const N = h.collectUnits(b.ore, b.quantity_half_units / 2);
        b.quantity_half_units -= Math.round(N * 2);
      }
    }
    if (p) break;
  }
  const y = {}, M = {};
  for (const d of H) {
    const E = Math.round(h.cargo[d] * 2);
    E > 0 && (y[d] = E), E !== (x[d] ?? 0) && (M[d] = E - (x[d] ?? 0));
  }
  const v = [...n.destroyed].sort();
  return {
    state: {
      world_seed: r.world_seed,
      levels: { ...r.levels },
      destroyed_cells: v,
      pod: { x: m.x, y: m.y, vx: m.vx, vy: m.vy, docked: m.docked },
      fuel_milli: Math.round(h.fuel * 1e3),
      hull_milli: Math.round(h.hull * 1e3),
      core_fuel: h.coreFuel,
      core_relics: L.map((d) => d.id).filter((d) => h.milestones.includes(d)),
      core_extraction_elapsed_ms: c,
      cargo_half_units: y,
      drops: C.filter((d) => d.quantity_half_units > 0),
      drill_target: w.target ? { x: w.target.x, y: w.target.y } : null,
      drill_elapsed_ms: Math.round(w.elapsed * 1e3),
      last_sequence: l,
      input_budget_ms: o - s,
      observed_at_ms: t
    },
    destroyed_cells: v.filter((d) => !f.has(d)),
    cargo_delta_half_units: M
  };
}
const ye = (r) => !!r && typeof r == "object" && !Array.isArray(r), $t = (r) => typeof r == "number" && Number.isFinite(r);
function Qt(r, e) {
  if (!ye(r) || !Number.isSafeInteger(r.world_seed) || r.world_seed < 0 || r.world_seed > 4294967295 || !ye(r.levels) || !ht.every((s) => Number.isSafeInteger(r.levels[s]) && Number(r.levels[s]) >= 1 && Number(r.levels[s]) <= 5) || !Array.isArray(r.destroyed_cells) || !r.destroyed_cells.every((s) => typeof s == "string") || !ye(r.pod) || !["x", "y", "vx", "vy"].every((s) => $t(r.pod[s])) || typeof r.pod.docked != "boolean" || !Number.isSafeInteger(r.fuel_milli) || !Number.isSafeInteger(r.hull_milli) || !Number.isSafeInteger(r.core_fuel) || r.core_fuel < 0 || r.core_fuel > L.length * Y.unitsPerCore || !Array.isArray(r.core_relics) || !r.core_relics.every((s) => typeof s == "string" && L.some((o) => o.id === s)) || new Set(r.core_relics).size !== r.core_relics.length || !Number.isSafeInteger(r.core_extraction_elapsed_ms) || r.core_extraction_elapsed_ms < 0 || r.core_extraction_elapsed_ms >= 1e4 || !Array.isArray(r.drops) || !Number.isSafeInteger(r.drill_elapsed_ms) || !Number.isSafeInteger(r.last_sequence) || !Number.isSafeInteger(r.input_budget_ms) || r.input_budget_ms < 0 || r.input_budget_ms > R.maxBatchMs || !Number.isSafeInteger(r.observed_at_ms)) throw new Error("INVALID_STATE");
  const t = r.levels;
  if (r.fuel_milli < 0 || r.fuel_milli > K("fuel", t.fuel) * 1e3 || r.hull_milli < 0 || r.hull_milli > K("hull", t.hull) * 1e3) throw new Error("INVALID_STATE");
  const i = {};
  for (const s of e) {
    if (!H.includes(s.ore) || Object.hasOwn(i, s.ore)) throw new Error("INVALID_STATE");
    const o = Number(s.quantity_half_units);
    if (!Number.isSafeInteger(o) || o < 0 || o > K("cargo", t.cargo) * 2)
      throw new Error("INVALID_STATE");
    o > 0 && (i[s.ore] = o);
  }
  if (Object.values(i).reduce((s, o) => s + o, 0) > K("cargo", t.cargo) * 2) throw new Error("INVALID_STATE");
  return { ...r, cargo_half_units: i };
}
async function tr(r, e, t, i) {
  const s = St(r);
  if (!s || !e || !Number.isSafeInteger(i)) throw new Error("INVALID_COMMAND");
  const o = {
    owner_id: e,
    campaign_id: s.campaign_id,
    expected_revision: s.expected_revision,
    operation_id: s.operation_id,
    session_id: s.session_id,
    input: s
  };
  if (await t.hasOperation(e, s.operation_id))
    return t.commit({ ...o, new_state: {} });
  const l = await t.campaign(s.campaign_id);
  if (!l || l.owner_id !== e) throw new Error("ACCESS_REQUIRED");
  if (l.ruleset_version !== s.ruleset_version) throw new Error("RULESET_MISMATCH");
  if (!He.worlds.includes(l.active_planet)) throw new Error("INVALID_STATE");
  if (l.revision !== s.expected_revision) throw new Error("STALE_REVISION");
  const [n, g] = await Promise.all([
    t.simulation(s.campaign_id),
    t.minerInventory(s.campaign_id)
  ]), h = Qt(n, g), m = Kt(h, s.segments, i, l.active_planet).state;
  return t.commit({ ...o, new_state: m });
}
export {
  tr as executeVerifiedGameBatch
};
