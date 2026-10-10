import type { MapId, Ore } from '../config';
import type { Cargo } from './Progress';

export const VESPER_RELAY_PROJECT = {
  id: 'project-vesper-relay',
  completionMilestone: 'project-vesper-relay-online',
  rewardCredits: 1200,
  relaySaleBonus: 0.05,
  stages: [
    { milestone: 'project-relay-cryo', mapId: 'cryo-shelf', ore: 'iron', units: 2, label: 'CALIBRATE THE CRYO BEACON' },
    { milestone: 'project-relay-hull', mapId: 'hull-graveyard', ore: 'iron', units: 3, label: 'REBUILD THE RELAY FRAME' },
    { milestone: 'project-relay-prism', mapId: 'prism-fault', ore: 'silver', units: 2, label: 'ALIGN THE PRISM ARRAY' },
  ],
} as const satisfies {
  id: string;
  completionMilestone: string;
  rewardCredits: number;
  relaySaleBonus: number;
  stages: readonly { milestone: string; mapId: MapId; ore: Ore; units: number; label: string }[];
};

export function vesperRelayProgress(milestones: readonly string[]) {
  const completedStages = VESPER_RELAY_PROJECT.stages.filter((stage) => milestones.includes(stage.milestone)).length,
    complete = milestones.includes(VESPER_RELAY_PROJECT.completionMilestone);
  return { completedStages, totalStages: VESPER_RELAY_PROJECT.stages.length, complete,
    next: complete ? undefined : VESPER_RELAY_PROJECT.stages.find((stage) => !milestones.includes(stage.milestone)) };
}

/** A contribution consumes only ore already secured in that planet's warehouse. */
export function contributeVesperRelay(milestones: string[], mapId: MapId, warehouse: Cargo) {
  const project = vesperRelayProgress(milestones), stage = project.next;
  if (!stage || stage.mapId !== mapId || warehouse[stage.ore] < stage.units) return { contributed: false, completed: false, stage };
  warehouse[stage.ore] -= stage.units;
  milestones.push(stage.milestone);
  const completed = vesperRelayProgress(milestones).completedStages === VESPER_RELAY_PROJECT.stages.length;
  if (completed) milestones.push(VESPER_RELAY_PROJECT.completionMilestone);
  return { contributed: true, completed, stage };
}

export const CARGO_TUG_PROJECT = {
  id: 'project-cargo-tug',
  completionMilestone: 'project-cargo-tug-online',
  rewardCredits: 900,
  stages: [
    { milestone: 'project-tug-cryo', mapId: 'cryo-shelf', ore: 'copper', units: 3, label: 'FABRICATE THE DOCKING CRADLE' },
    { milestone: 'project-tug-hull', mapId: 'hull-graveyard', ore: 'iron', units: 3, label: 'REINFORCE THE CARGO FRAME' },
    { milestone: 'project-tug-vesper', mapId: 'vesper-9', ore: 'diamond', units: 2, label: 'POWER THE REMOTE-HANDLING ARRAY' },
  ],
} as const satisfies {
  id: string;
  completionMilestone: string;
  rewardCredits: number;
  stages: readonly { milestone: string; mapId: MapId; ore: Ore; units: number; label: string }[];
};

export const SYSTEM_PROJECT_MILESTONES = [
  ...VESPER_RELAY_PROJECT.stages.map((stage) => stage.milestone),
  VESPER_RELAY_PROJECT.completionMilestone,
  ...CARGO_TUG_PROJECT.stages.map((stage) => stage.milestone),
  CARGO_TUG_PROJECT.completionMilestone,
];

export function cargoTugProgress(milestones: readonly string[]) {
  const completedStages = CARGO_TUG_PROJECT.stages.filter((stage) => milestones.includes(stage.milestone)).length,
    complete = milestones.includes(CARGO_TUG_PROJECT.completionMilestone);
  return { completedStages, totalStages: CARGO_TUG_PROJECT.stages.length, complete,
    next: complete ? undefined : CARGO_TUG_PROJECT.stages.find((stage) => !milestones.includes(stage.milestone)) };
}

/** A contribution consumes only the requested stock from the current planet's warehouse. */
export function contributeCargoTug(milestones: string[], mapId: MapId, warehouse: Cargo) {
  const project = cargoTugProgress(milestones), stage = project.next;
  if (!stage || stage.mapId !== mapId || warehouse[stage.ore] < stage.units) return { contributed: false, completed: false, stage };
  warehouse[stage.ore] -= stage.units;
  milestones.push(stage.milestone);
  const completed = cargoTugProgress(milestones).completedStages === CARGO_TUG_PROJECT.stages.length;
  if (completed) milestones.push(CARGO_TUG_PROJECT.completionMilestone);
  return { contributed: true, completed, stage };
}

export function remoteWarehouseAccess(milestones: readonly string[], currentMap: MapId, selectedMap: MapId, warehouseMaps: readonly MapId[]) {
  return selectedMap === currentMap || milestones.includes(CARGO_TUG_PROJECT.completionMilestone) && warehouseMaps.includes(selectedMap);
}
