import { CORE_RELICS, MAPS, SPECIALIZATIONS } from '../config';
import type { MapId } from '../config';
import type { Progress } from '../economy/Progress';
import { podPortrait } from './PodPortrait';

export function pauseScreen(p: Progress, map: MapId, depth: number, docked: boolean,
  exportControl: string, saveStatus: string) {
  const cores = CORE_RELICS.filter(relic => p.milestones.includes(relic.id)).length;
  const objective = !p.shipComplete
    ? { title: 'Mine a planetary core', text: 'The core unlocks mothership flight and adds interplanetary fuel. Local miner fuel is separate.', done: 0, total: 1, unit: 'core recovered' }
      : cores < 5
      ? { title: 'Reach the planetary cores', text: `Recover cores to replenish core fuel. ${p.coreFuel} interplanetary jumps remain; local pod fuel is separate.`, done: cores, total: 5, unit: 'core records' }
      : { title: 'Chart the final world', text: 'Five planetary cores have revealed Vesper-9. Recover its Return Bloom.', done: cores, total: 6, unit: 'core records' };
  const readout = (name: string, value: string, ratio: number) => `<div><dt>${name}</dt><dd>${value}</dd><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, ratio * 100))}%"></b></i></div>`;
  return `<section class="modal pause-screen" role="dialog" aria-modal="true" aria-label="EXPEDITION PAUSED">
    <button class="close" id="close" aria-label="Close panel">×</button>
    <div class="pause-menu">
      <div class="pause-location"><span aria-hidden="true">Ⅱ</span> ${MAPS[map].name} <span class="pause-location-status">${docked ? 'DOCKED' : `${depth.toLocaleString()} m BELOW SURFACE`}</span></div>
      <h2>Expedition<br><em>paused.</em></h2>
      <button id="resume" class="primary pause-resume" aria-label="RESUME EXPEDITION"><span>Resume expedition</span><span aria-hidden="true">↗</span></button>
      <div class="pause-file-actions" aria-label="Expedition saves">
        <button id="save" aria-label="SAVE EXPEDITION">Save expedition <span aria-hidden="true">↓</span></button>
        ${exportControl}
        <button id="import-save" aria-label="IMPORT SAVE">Import save <span aria-hidden="true">↥</span></button>
      </div>
      <p class="pause-save-state" id="pause-save-state" role="status">${saveStatus}</p>
      <div class="pause-secondary"><button id="rescue">Emergency recovery</button><button id="new">New expedition</button></div>
      <p class="pause-recovery-note">Recovery lands near your current longitude and planet side. Unsold ore is forfeited; credits and tunnels stay.</p>
      <div class="pause-keyhint"><kbd>ESC</kbd> Return to the expedition</div>
    </div>
    <aside class="pause-rig" aria-label="Expedition status">
      <div class="pause-rig-heading"><span>YOUR RIG</span><b>${SPECIALIZATIONS[p.specialization].name}</b></div>
      ${podPortrait(p)}
      <dl class="pause-readouts">
        ${readout('Fuel', `${Math.ceil(p.fuel)}<small> L</small>`, p.fuel / p.max('fuel'))}
        ${readout('Hull', `${Math.ceil(p.hull / p.max('hull') * 100)}<small>%</small>`, p.hull / p.max('hull'))}
        ${readout('Cargo', `${p.count}<small> / ${p.max('cargo')}</small>`, p.count / p.max('cargo'))}
      </dl>
      <div class="pause-objective"><span>THE mothership EXPEDITION</span><h3>${objective.title}</h3><p>${objective.text}</p><div class="pause-progress" aria-hidden="true">${Array.from({ length: objective.total }, (_, i) => `<i class="${i < objective.done ? 'complete' : ''}"></i>`).join('')}</div><small>${objective.done} / ${objective.total} ${objective.unit}</small></div>
      <div class="pause-credit"><span>Core fuel · interplanetary jumps</span><b>${p.coreFuel}</b></div>
      <div class="pause-credit"><span>Banked credits</span><b>$${p.money.toLocaleString()}</b></div>
    </aside>
  </section>`;
}
