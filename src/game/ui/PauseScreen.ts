import { MAPS, SPECIALIZATIONS } from '../config';
import type { MapId } from '../config';
import type { Progress } from '../economy/Progress';
import { podPortrait } from './PodPortrait';

export function pauseScreen(p: Progress, map: MapId, depth: number, docked: boolean,
  exportControl: string, saveStatus: string, campBuilt = true, marketOnline = true) {
  const objective = {title:'Grow your mining operation',text:'Explore caves, fit equipment and build where it helps. Shelters restore your rig underground. Sell surplus ore at a market uplink.',done:0,total:0,unit:''};
  const readout = (name: string, value: string, ratio: number) => `<div><dt>${name}</dt><dd>${value}</dd><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, ratio * 100))}%"></b></i></div>`;
  return `<section class="modal pause-screen" role="dialog" aria-modal="true" aria-label="EXPEDITION PAUSED">
    <button class="close" id="close" aria-label="Close panel">×</button>
    <div class="pause-menu">
      <div class="pause-location"><span aria-hidden="true">Ⅱ</span> ${MAPS[map].name} <span class="pause-location-status">${docked ? 'DOCKED' : `${depth.toLocaleString()} m BELOW SURFACE`}</span></div>
      <h2>Expedition <em>paused.</em></h2>
      <button id="open-codex">Expedition Codex <span>Engineering, resources & civilisations</span></button><button id="resume" class="primary pause-resume" aria-label="RESUME EXPEDITION"><span>Resume expedition</span><span aria-hidden="true">↗</span></button>
      <div class="pause-file-actions" aria-label="Expedition saves">
        <button id="save" aria-label="SAVE EXPEDITION">Save expedition <span aria-hidden="true">↓</span></button>
        ${exportControl}
        <button id="import-save" aria-label="IMPORT SAVE">Import save <span aria-hidden="true">↥</span></button>
        <button id="account" aria-label="ACCOUNT AND BACKUPS">Account <span aria-hidden="true">↗</span></button>
      </div>
      <p class="pause-save-state" id="pause-save-state" role="status">${saveStatus}</p>
      <div class="pause-secondary"><button id="rescue">Emergency recovery</button><button id="new">New expedition</button></div>
      <p class="pause-recovery-note">Recovery lands near your current longitude and planet side. Unsold ore is forfeited; Kredits and tunnels stay.</p>
      <div class="pause-keyhint"><kbd>ESC</kbd> Return to the expedition</div>
    </div>
    <aside class="pause-rig" aria-label="Expedition status">
      <div class="pause-rig-heading"><span>YOUR RIG</span><b>${SPECIALIZATIONS[p.specialization].name}</b></div>
      ${podPortrait(p)}
      <dl class="pause-readouts">
        ${readout('Battery', `${Math.ceil(p.fuel / p.max('fuel') * 100)}<small>%</small>`, p.fuel / p.max('fuel'))}
        ${readout('Hull', `${Math.ceil(p.hull / p.max('hull') * 100)}<small>%</small>`, p.hull / p.max('hull'))}
        ${readout('Cargo', `${p.count}<small> / ${p.max('cargo')}</small>`, p.count / p.max('cargo'))}
      </dl>
      <div class="pause-objective"><span>MOTHERSHIP EXPEDITION</span><h3>${objective.title}</h3><p>${objective.text}</p><div class="pause-progress" aria-hidden="true">${Array.from({ length: objective.total }, (_, i) => `<i class="${i < objective.done ? 'complete' : ''}"></i>`).join('')}</div><small>Choose your next expedition.</small></div>
      <div class="pause-credit"><span>Core fuel · reserved for future travel</span><b>${p.coreFuel}</b></div>
      <div class="pause-credit"><span>Banked Kredits</span><b>K ${p.money.toLocaleString()}</b></div>
    </aside>
  </section>`;
}
