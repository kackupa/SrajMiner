import { LASER_THERMAL, ORES, type MapId } from '../config';
import type { Tile } from '../world/TileWorld';

export type DrillParticleKind = 'dust' | 'chip' | 'spark' | 'shard' | 'frost' | 'glint' | 'ring';
export type DrillImpactProfile = {
  kind: DrillParticleKind;
  color: number;
  accent: number;
  count: number;
  valuable: boolean;
};

export type LaserThermalState = { heat: number; vent: number };

/** The top-tier emitter builds heat only while cutting; releasing the drill cools it. */
export function advanceLaserThermal(state: LaserThermalState, dt: number, cutting: boolean, drillHeld = cutting): LaserThermalState {
  if (state.vent > 0) return { heat: 0, vent: Math.max(0, state.vent - dt) };
  const heat = cutting
    ? Math.min(1, state.heat + dt / LASER_THERMAL.heatSeconds)
    : drillHeld ? state.heat : Math.max(0, state.heat - dt * LASER_THERMAL.coolPerSecond);
  return heat >= 1 ? { heat: 0, vent: LASER_THERMAL.ventSeconds } : { heat, vent: 0 };
}

export function drillImpactProfile(tile: Pick<Tile, 'type' | 'ore' | 'oreUnits' | 'geode' | 'regionFind' | 'fragmentId' | 'signalHashId' | 'coreRelicId' | 'tint'>, mapId: MapId): DrillImpactProfile {
  const valuable = !!(tile.geode || tile.regionFind || tile.fragmentId || tile.signalHashId || tile.coreRelicId ||
    tile.oreUnits && tile.oreUnits >= 2);
  if (tile.geode || tile.ore === 'diamond')
    return { kind: 'shard', color: tile.geode ? 0xc7b9ff : ORES.diamond.color, accent: 0xf5ecff, count: 12, valuable };
  if (tile.fragmentId || tile.signalHashId || tile.coreRelicId)
    return { kind: 'glint', color: tile.tint, accent: 0xffe7a2, count: 10, valuable: true };
  if (tile.ore)
    return { kind: 'shard', color: ORES[tile.ore].color, accent: tile.tint, count: 9, valuable };
  if (mapId === 'cryo-shelf')
    return { kind: 'frost', color: 0x9fe9e2, accent: 0xe3ffff, count: 9, valuable };
  if (tile.type === 'hard')
    return { kind: 'spark', color: 0xf2bc82, accent: 0xffe7ae, count: 10, valuable };
  if (tile.type === 'rock')
    return { kind: 'chip', color: tile.tint, accent: 0xdfc1a2, count: 8, valuable };
  return { kind: 'dust', color: tile.tint, accent: 0xe1b28f, count: 7, valuable };
}
