export const STATIONS = [
  { x: 710, name: 'ORE EXCHANGE', label: '01 / SELL', color: 0xe7b56b, width: 124 },
  { x: 980, name: 'SERVICE BAY', label: '02 / SERVICE', color: 0x91c8bb, width: 144 },
  { x: 1250, name: 'POD WORKSHOP', label: '03 / UPGRADE', color: 0xc5b8d5, width: 124 },
];
export const atSurface = (x: number, y: number) => y < 0 && x > 560 && x < 1410;
