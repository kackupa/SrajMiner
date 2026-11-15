import { MAPS, SPECIALIZATIONS } from '../config';
import type { MapId } from '../config';
import type { Progress } from '../economy/Progress';
import { podPortrait } from './PodPortrait';

export function pauseScreen(p: Progress, map: MapId, depth: number, docked: boolean,
  exportControl: string, saveStatus: string, _campBuilt = true, _marketOnline = true) {
  const readout = (name: string, value: string, ratio: number) => `<div><dt>${name}</dt><dd>${value}</dd><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, ratio * 100))}%"></b></i></div>`;
  return `<section class="modal pause-screen console-pause" role="dialog" aria-modal="true" aria-labelledby="console-pause-title">
    <header class="console-header"><div class="console-identity"><span class="console-emblem" aria-hidden="true">OF</span><div><strong>Ore Frontier</strong><small>Miner control system</small></div></div><span class="console-state"><i></i> Simulation paused</span><button id="close" aria-label="Close panel and resume">Esc <span aria-hidden="true">×</span></button></header>
    <div class="console-pause-body">
      <div class="console-actions">
        <div class="console-title"><span class="console-label">${MAPS[map].name} / ${docked ? 'Docked' : Math.round(depth).toLocaleString() + ' m deep'}</span><h2 id="console-pause-title">Expedition paused.</h2><p>Your expedition is paused. Pick up where you left off.</p></div>
        <button id="resume" class="primary console-resume" aria-label="RESUME EXPEDITION"><span>Resume expedition</span><span aria-hidden="true">→</span></button>
        <div class="console-save-actions" aria-label="Expedition saves"><button id="save" aria-label="SAVE EXPEDITION">Save expedition <span aria-hidden="true">↓</span></button>${exportControl}<button id="import-save" aria-label="IMPORT SAVE">Import save <span aria-hidden="true">↑</span></button><button id="account" aria-label="ACCOUNT AND BACKUPS">Account & backups <span aria-hidden="true">↗</span></button></div>
        <p class="console-save-state" id="pause-save-state" role="status">${saveStatus}</p>
        <div class="console-utilities"><button id="open-codex">Field guide <span aria-hidden="true">↗</span></button><button id="rescue">Emergency recovery</button><button id="new">New expedition</button></div>
        <p class="console-recovery-note">Recovery returns you to the surface. Unsold ore is lost; Kredits and tunnels stay.</p>
      </div>
      <aside class="console-rig" aria-label="Rig status">
        <div class="console-rig-heading"><span class="console-label">Your rig</span><span>${SPECIALIZATIONS[p.specialization].name}</span></div>
        <div class="console-rig-display"><span class="console-display-tag">Equipment preview</span>${podPortrait(p)}<span class="console-display-baseline" aria-hidden="true"></span></div>
        <dl class="console-readouts">${readout('Battery',Math.ceil(p.fuel/p.max('fuel')*100)+'<small>%</small>',p.fuel/p.max('fuel'))}${readout('Hull',Math.ceil(p.hull/p.max('hull')*100)+'<small>%</small>',p.hull/p.max('hull'))}${readout('Cargo',p.count+'<small> / '+p.max('cargo')+'</small>',p.count/p.max('cargo'))}</dl>
        <div class="console-wallet"><span>Banked Kredits</span><b>₭${p.money.toLocaleString()}</b></div>
      </aside>
    </div>
    <div class="console-footer"><span>ORE FRONTIER / LOCAL EXPEDITION</span><span>${docked?'Mothership connection active':'Rig telemetry connected'}</span></div>
  </section>`;
}
