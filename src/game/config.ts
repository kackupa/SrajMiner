export const WORLD = { tile: 40, width: 48, chunk: 16, meters: 12, spawnX: 980, spawnY: -22 };
export const PHYSICS = {
  gravity: 430,
  acceleration: 650,
  thrust: 980,
  horizontal: 145,
  rise: 185,
  fall: 430,
  safeImpact: 280,
  damageScale: 0.2,
  halfWidth: 13,
  halfHeight: 16,
};
export const FUEL = { moving: 0.55, thrust: 1.25, drilling: 1.4 };
export const ORES = {
  copper: {
    name: 'Copper',
    value: 18,
    color: 0xf0a16b,
    hex: '#f0a16b',
    min: 0,
    max: 230,
    rarity: 0.34,
  },
  iron: {
    name: 'Iron',
    value: 28,
    color: 0x9faeb5,
    hex: '#9faeb5',
    min: 24,
    max: 480,
    rarity: 0.26,
  },
  silver: {
    name: 'Silver',
    value: 55,
    color: 0xcce8de,
    hex: '#cce8de',
    min: 120,
    max: 850,
    rarity: 0.21,
  },
  gold: {
    name: 'Gold',
    value: 105,
    color: 0xf5ca62,
    hex: '#f5ca62',
    min: 312,
    max: 2000,
    rarity: 0.15,
  },
  diamond: {
    name: 'Diamond',
    value: 260,
    color: 0x80f5e9,
    hex: '#80f5e9',
    min: 612,
    max: Infinity,
    rarity: 0.085,
  },
} as const;
export type Ore = keyof typeof ORES;
export const ORE_KEYS = Object.keys(ORES) as Ore[];
export const BANDS = [
  {
    min: 0,
    name: 'RUST FIELDS',
    type: 'dirt',
    hardness: 0.3,
    colors: [0x855043, 0x945b49, 0x74483f],
  },
  {
    min: 100,
    name: 'BASALT SHELF',
    type: 'rock',
    hardness: 0.6,
    colors: [0x65504b, 0x70554d, 0x58453f],
  },
  {
    min: 300,
    name: 'IRON VEIL',
    type: 'hard',
    hardness: 1.05,
    colors: [0x51424a, 0x604a52, 0x473b44],
  },
  {
    min: 600,
    name: 'DEEP SILENCE',
    type: 'hard',
    hardness: 1.5,
    colors: [0x363e49, 0x444654, 0x303540],
  },
  {
    min: 1000,
    name: 'THE BELOW',
    type: 'hard',
    hardness: 1.9,
    colors: [0x273f42, 0x344b4d, 0x24383c],
  },
] as const;
export const bandAt = (depth: number) =>
  [...BANDS].reverse().find((b) => depth >= b.min) ?? BANDS[0];
export const UPGRADES = {
  drill: {
    name: 'Drill',
    description: 'Cut through harder ground.',
    values: [1, 1.5, 2.2, 3.1, 4.3],
    costs: [140, 360, 850, 1800],
    unit: '× cutting speed',
    icon: '↧',
  },
  fuel: {
    name: 'Fuel tank',
    description: 'Stay out a little longer.',
    values: [140, 190, 260, 350, 480],
    costs: [120, 320, 750, 1600],
    unit: ' L capacity',
    icon: '◒',
  },
  cargo: {
    name: 'Cargo bay',
    description: 'Bring more of Mars home.',
    values: [16, 24, 34, 48, 64],
    costs: [150, 380, 900, 1900],
    unit: ' slots',
    icon: '▦',
  },
  hull: {
    name: 'Hull',
    description: 'Take the harder landing.',
    values: [100, 140, 195, 270, 380],
    costs: [130, 340, 800, 1700],
    unit: ' integrity',
    icon: '⬡',
  },
  engine: {
    name: 'Engine',
    description: 'Climb faster. Handle better.',
    values: [1, 1.18, 1.4, 1.65, 1.95],
    costs: [160, 400, 950, 2000],
    unit: '× thrust',
    icon: '↑',
  },
} as const;
export type Upgrade = keyof typeof UPGRADES;
export type Levels = Record<Upgrade, number>;
export const UPGRADE_KEYS = Object.keys(UPGRADES) as Upgrade[];
export const value = (levels: Levels, key: Upgrade) => UPGRADES[key].values[levels[key] - 1];
export const SERVICE = { fuelPrice: 0.3, hullPrice: 0.45 };

export const MINING = { fullCargoWarningSeconds: 0.9 };
