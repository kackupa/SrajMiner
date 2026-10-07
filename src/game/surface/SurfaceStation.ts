export const STATIONS = [
  { x: 710, name: 'ORE EXCHANGE', label: '01 / SELL', color: 0xe7b56b, width: 124 },
  { x: 980, name: 'SERVICE BAY', label: '02 / SERVICE', color: 0x91c8bb, width: 144 },
  { x: 1250, name: 'POD WORKSHOP', label: '03 / UPGRADE', color: 0xc5b8d5, width: 124 },
];
import { FAR_SURFACE_Y } from '../config';
export const TOWN_TIER_HEIGHTS = [158, 252, 346, 440, 552] as const;
export function surfaceTownTier(shipComponents: readonly string[], coreRecords: readonly string[]) {
  if (coreRecords.length >= 4) return 4;
  if (coreRecords.length > 0) return 3;
  if (shipComponents.length >= 4) return 2;
  if (shipComponents.length > 0) return 1;
  return 0;
}
// The Hab's elevator towers and one-way decks make the expanded skyline part of the service zone.
export const atSurface = (x: number, y: number) => (y < 0 && y > -650 || y >= FAR_SURFACE_Y && y <= FAR_SURFACE_Y + 650) && x > 560 && x < 1410;
export const dockedOnSurface = (x: number, y: number) => x > 560 && x < 1410 &&
  (y >= -30 && y <= 10 || y >= FAR_SURFACE_Y - 10 && y <= FAR_SURFACE_Y + 30);
export const surfaceGroundY = (y: number) => y >= FAR_SURFACE_Y - 180 ? FAR_SURFACE_Y : 0;
