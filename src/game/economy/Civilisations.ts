import { CIVILISATIONS, CIVILIAN_DEMAND, ORES, ORE_KEYS, type CivilisationId } from '../config';
import { emptyCargo, type Cargo } from './Progress';

export function civilisationProject(id: CivilisationId, deliveries: Record<string, number>) {
  const projects = CIVILISATIONS[id].projects;
  const index = projects.findIndex(p => (deliveries[`${id}:${p.ore}`] ?? 0) < p.units);
  const complete = index < 0;
  const project = projects[complete ? projects.length - 1 : index];
  return { ...project, index: complete ? projects.length : index, complete,
    delivered: Math.min(project.units, deliveries[`${id}:${project.ore}`] ?? 0) };
}

export function quoteCivilianShipment(cargo: Cargo, requested: Cargo, buyer: CivilisationId, deliveries: Record<string, number>) {
  const shipment = emptyCargo(), project = civilisationProject(buyer, deliveries);
  for (const ore of ORE_KEYS) {
    const n = requested[ore];
    shipment[ore] = Number.isFinite(n) && n > 0 ? Math.floor(Math.min(cargo[ore] ?? 0, n) * 2) / 2 : 0;
  }
  const gross = ORE_KEYS.reduce((sum, ore) => sum + shipment[ore] * ORES[ore].value, 0);
  const qualifying = project.complete ? 0 : Math.min(shipment[project.ore], Math.max(0, project.units - project.delivered));
  const bonus = Math.floor(qualifying * ORES[project.ore].value * CIVILIAN_DEMAND.premium);
  return { shipment, gross, bonus, total: gross + bonus, buyer, project: project.name };
}

/** Pure settlement, committed by the scene only when storage succeeds. */
export function settleCivilianShipment(cargo: Cargo, requested: Cargo, buyer: CivilisationId, deliveries: Record<string, number>) {
  const quote = quoteCivilianShipment(cargo, requested, buyer, deliveries);
  const remaining = { ...emptyCargo(), ...cargo }, nextDeliveries = { ...deliveries };
  for (const ore of ORE_KEYS) {
    remaining[ore] -= quote.shipment[ore];
    if (quote.shipment[ore]) nextDeliveries[`${buyer}:${ore}`] = (nextDeliveries[`${buyer}:${ore}`] ?? 0) + quote.shipment[ore];
  }
  return { ...quote, remaining, deliveries: nextDeliveries };
}
