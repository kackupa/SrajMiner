import { ORES, ORE_KEYS, UPGRADES, UPGRADE_KEYS, bandAt, type Upgrade } from '../config';
import { Progress } from '../economy/Progress';
export type UIActions = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  save: () => void;
  sell: () => number;
  service: (key: 'fuel' | 'hull') => boolean;
  buy: (key: Upgrade) => boolean;
  rescue: () => void;
  newGame: () => void;
  mute: () => boolean;
};
export class HUD {
  modal = 'intro';
  hasStarted = false;
  paused = true;
  nearSurface = true;
  toastTimer = 0;
  displayedMoney = 80;
  constructor(
    public p: Progress,
    public actions: UIActions,
    public loaded: boolean,
  ) {
    document.querySelector('#app')!.innerHTML = `
      <header class="topbar"><a class="brand" href="#" aria-label="Mars Miner"><span class="brand-mark">M<span>↧</span></span><span>MARS<span class="brand-light">MINER</span><small>THE RED FRONTIER</small></span></a><div class="expedition"><i></i> EXPEDITION 01 <span>/</span> <b id="zone">RUST FIELDS</b></div><div class="top-actions"><button id="audio" aria-label="Toggle sound" title="Toggle sound">SOUND ON</button><button id="pause" aria-label="Pause game">Ⅱ</button></div></header>
      <main id="viewport"><div id="game" aria-label="Mars mining game. Use WASD or arrow keys to fly and drill." role="application" tabindex="0"></div>
      <aside class="telemetry"><div class="eyebrow">POD TELEMETRY <span class="status-dot"></span></div><div class="meter-head"><span>FUEL</span><strong id="fuel-label"></strong></div><div class="meter"><i id="fuel-bar"></i></div><div class="meter-head"><span>HULL</span><strong id="hull-label"></strong></div><div class="meter hull"><i id="hull-bar"></i></div><div class="cargo-line"><span>▦ &nbsp;CARGO</span><strong id="cargo-label"></strong></div><div class="cargo-blocks" id="cargo-blocks"></div><div class="cargo-worth" id="cargo-worth"></div></aside>
      <aside class="depth-panel"><div class="eyebrow">CURRENT DEPTH</div><div class="depth-value"><span id="depth">0</span><small>m</small></div><div class="record">DEEPEST <span id="record">0m</span></div><div class="depth-rule"></div><div id="depth-note">SURFACE OPERATIONS</div></aside>
      <div class="location-label"><span class="eyebrow">MARS / ELYSIUM PLANITIA</span><span>25.3° N &nbsp; 147.0° E</span></div>
      <div id="tip" class="mission-tip"><span class="tip-icon">↧</span><div><b>A little deeper. A little richer.</b><span>Hold S to drill. Hold W to come home.</span></div></div>
      <div id="toast" role="status" aria-live="polite"></div><div id="low-warning" role="status"></div>
      <div class="station-dock" id="station-dock"><div class="dock-label"><i></i><div><b>OUTPOST 07</b><span>Surface services online</span></div></div><button id="open-sell"><span>01</span> SELL ORE <b>↗</b></button><button id="open-service"><span>02</span> SERVICE <b>＋</b></button><button id="open-upgrades"><span>03</span> UPGRADES <b>↑</b></button></div>
      <div id="modal-layer" class="modal-layer"></div></main>
      <footer><div class="controls"><kbd>A</kbd><kbd>D</kbd> MOVE <span></span><kbd>S</kbd> DRILL <span></span><kbd>W</kbd> THRUST <span></span><kbd>ESC</kbd> PAUSE</div><div class="bank"><span>BANKED CREDITS</span><b id="money">$80</b></div><div class="save-status" id="save-status">LOCAL SAVE · READY</div></footer>`;
    this.on('pause', () => actions.pause());
    this.on('audio', () => {
      document.querySelector('#audio')!.textContent = actions.mute() ? 'SOUND OFF' : 'SOUND ON';
    });
    this.on('open-sell', () => this.open('sell'));
    this.on('open-service', () => this.open('service'));
    this.on('open-upgrades', () => this.open('upgrades'));
    document.querySelector('.brand')!.addEventListener('click', (e) => e.preventDefault());
    this.showIntro();
  }
  on(id: string, fn: () => void) {
    document.getElementById(id)?.addEventListener('click', fn);
  }
  open(name: string) {
    if (!this.nearSurface && ['sell', 'service', 'upgrades'].includes(name)) return;
    this.modal = name;
    this.paused = true;
    this.renderModal();
  }
  close() {
    this.modal = '';
    this.paused = false;
    document.querySelector('#modal-layer')!.innerHTML = '';
    (document.querySelector('#game') as HTMLElement).focus();
  }
  showIntro() {
    this.modal = 'intro';
    this.paused = true;
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal intro" role="dialog" aria-modal="true" aria-label="Expedition briefing"><div class="eyebrow">INDEPENDENT PROSPECTOR PROGRAM / V0.1</div><div class="intro-symbol">✦</div><h1>FORTUNE FAVORS<br>THE <em>DEEP.</em></h1><p>A small pod. A red planet. A whole lot beneath it.</p><div class="intro-loop"><span>01 <b>DIG</b></span><i>→</i><span>02 <b>HAUL</b></span><i>→</i><span>03 <b>UPGRADE</b></span></div><p class="briefing">Drill for ore. Watch your fuel. Fly home to sell your haul and build a better machine. Your tunnels stay yours.</p><button class="primary" id="launch">${this.loaded ? 'CONTINUE EXPEDITION' : 'BEGIN EXPEDITION'} <span>↗</span></button><small class="intro-note">WASD / ARROW KEYS &nbsp; · &nbsp; HEADPHONES RECOMMENDED</small></section>`;
    this.on('launch', () => {
      this.hasStarted = true;
      this.close();
      this.actions.start();
    });
    document.getElementById('launch')?.focus();
  }
  renderModal() {
    const name = this.modal,
      p = this.p;
    let title = '',
      sub = '',
      content = '';
    if (name === 'sell') {
      title = 'A good day’s haul.';
      sub = 'ORE EXCHANGE / OUTPOST 07';
      content = `<div class="ore-list">${ORE_KEYS.map((k) => `<div><span><i style="background:${ORES[k].hex}"></i>${ORES[k].name}</span><span>× ${p.cargo[k]}</span><b>$${p.cargo[k] * ORES[k].value}</b></div>`).join('')}</div><div class="sale-total"><span>ESTIMATED PAYOUT</span><b>$${p.cargoValue}</b></div><button id="sell" class="primary" ${p.count ? '' : 'disabled'}>SELL CARGO <span>↗</span></button>`;
    } else if (name === 'service') {
      title = 'Ready for another run.';
      sub = 'FUEL & REPAIR / OUTPOST 07';
      content = `<p>Top up before you head back into the dark.</p>${(['fuel', 'hull'] as const).map((k) => `<div class="service-row"><div><b>${k === 'fuel' ? 'REFUEL TANK' : 'REPAIR HULL'}</b><small>${Math.ceil(p[k])} / ${p.max(k)} ${k === 'fuel' ? 'L' : 'integrity'}</small></div><button id="service-${k}" ${p.serviceCost(k) === 0 || p.serviceCost(k) > p.money ? 'disabled' : ''}>${p.serviceCost(k) === 0 ? 'FULL' : `$${p.serviceCost(k)} →`}</button></div>`).join('')}<p class="fine">Emergency recovery is available in the pause menu. It restores your pod, but forfeits unsold cargo.</p>`;
    } else if (name === 'upgrades') {
      title = 'Make the next run count.';
      sub = 'POD WORKSHOP / OUTPOST 07';
      content = `<div class="upgrade-list">${UPGRADE_KEYS.map((k) => {
        const u = UPGRADES[k],
          lv = p.levels[k];
        return `<div class="upgrade-row"><span class="upgrade-icon">${u.icon}</span><div><b>${u.name.toUpperCase()} <small>LV ${lv}${lv < 5 ? ` → ${lv + 1}` : ' · MAX'}</small></b><p>${lv < 5 ? `${u.values[lv - 1]} → ${u.values[lv]}${u.unit}` : u.description}</p><div class="level-pips">${u.values.map((_, i) => `<i class="${i < lv ? 'filled' : ''}"></i>`).join('')}</div></div><button id="buy-${k}" ${lv === 5 || p.money < p.cost(k) ? 'disabled' : ''}>${lv === 5 ? 'MAX' : `$${p.cost(k)} ↑`}</button></div>`;
      }).join('')}</div>`;
    } else if (name === 'pause') {
      title = 'Take a breath.';
      sub = 'EXPEDITION PAUSED';
      content = `<p>The mine will be here when you get back.</p><button id="resume" class="primary">RESUME EXPEDITION <span>→</span></button><div class="pause-actions"><button id="save">SAVE EXPEDITION</button><button id="rescue">EMERGENCY RECOVERY</button><button id="new">NEW EXPEDITION</button></div><p class="fine">Recovery loses your unsold ore. Banked credits, upgrades, and excavated tunnels are kept.</p>`;
    } else if (name === 'rescue') {
      title = 'Leave the haul behind?';
      sub = 'EMERGENCY RECOVERY';
      content =
        '<p>Return to the surface with full fuel and hull. All unsold cargo is lost. Your money, upgrades, and mine are kept.</p><button id="confirm-rescue" class="primary">RECOVER POD →</button>';
    } else if (name === 'new') {
      title = 'Start a new frontier?';
      sub = 'REPLACE SAVED EXPEDITION';
      content =
        '<p>This replaces your current mine, credits, and upgrades with a new world seed. This cannot be undone.</p><button id="confirm-new" class="primary danger">START NEW EXPEDITION →</button>';
    } else if (name === 'failure') {
      title = 'The planet keeps its share.';
      sub = 'POD RECOVERED / CARGO LOST';
      content =
        '<p>Your unsold ore was lost. Your banked credits, upgrades, and excavated tunnels are safe. A refueled, repaired pod is waiting at the outpost.</p><button id="resume" class="primary">BACK TO THE SURFACE <span>↑</span></button>';
    }
    document.querySelector('#modal-layer')!.innerHTML =
      `<section class="modal ${name === 'upgrades' ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${sub}"><button class="close" id="close" aria-label="Close panel">×</button><div class="eyebrow">${sub}</div><h2>${title}</h2>${content}<div class="modal-bank">AVAILABLE CREDIT <b>$${p.money.toLocaleString()}</b></div></section>`;
    this.on('close', () => this.close());
    this.on('resume', () => this.actions.resume());
    this.on('save', () => this.actions.save());
    this.on('rescue', () => this.open('rescue'));
    this.on('new', () => this.open('new'));
    this.on('confirm-rescue', () => this.actions.rescue());
    this.on('confirm-new', () => this.actions.newGame());
    this.on('sell', () => {
      const n = this.actions.sell();
      this.renderModal();
      if (n) {
        document.querySelector('.sale-total span')!.textContent = 'CREDITS BANKED';
        const total = document.querySelector('.sale-total b')!;
        let start = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / 650);
          if (this.modal === 'sell') total.textContent = `+$${Math.round(n * (1 - (1 - t) ** 3))}`;
          if (t < 1) requestAnimationFrame(tick);
        };
        tick();
      }
    });
    for (const k of ['fuel', 'hull'] as const)
      this.on(`service-${k}`, () => {
        this.actions.service(k);
        this.renderModal();
      });
    for (const k of UPGRADE_KEYS)
      this.on(`buy-${k}`, () => {
        this.actions.buy(k);
        this.renderModal();
      });
    (
      (document.querySelector('.modal .primary:not(:disabled)') ??
        document.querySelector('.modal button:not(.close):not(:disabled)') ??
        document.querySelector('.close')) as HTMLElement
    )?.focus();
  }
  toast(text: string) {
    const el = document.querySelector('#toast')!;
    el.textContent = text;
    el.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('visible'), 3500);
  }
  saved(ok: boolean) {
    document.querySelector('#save-status')!.textContent = ok
      ? 'LOCAL SAVE · JUST SAVED'
      : 'LOCAL SAVE · FAILED';
  }
  update(depth: number, surface: boolean, dt: number) {
    const p = this.p;
    this.nearSurface = surface;
    for (const k of ['fuel', 'hull'] as const) {
      const ratio = p[k] / p.max(k);
      document.querySelector(`#${k}-label`)!.textContent = `${Math.ceil(ratio * 100)}%`;
      const bar = document.querySelector(`#${k}-bar`) as HTMLElement;
      bar.style.width = `${ratio * 100}%`;
      bar.classList.toggle('low', ratio < 0.25);
    }
    document.querySelector('#cargo-label')!.textContent = `${p.count} / ${p.max('cargo')}`;
    document.querySelector('#cargo-blocks')!.innerHTML = Array.from(
      { length: 16 },
      (_, i) => `<i class="${i < Math.ceil((p.count / p.max('cargo')) * 16) ? 'filled' : ''}"></i>`,
    ).join('');
    document.querySelector('#cargo-worth')!.textContent = p.count
      ? `HAUL VALUE  $${p.cargoValue}`
      : 'CARGO BAY EMPTY';
    document.querySelector('#depth')!.textContent = String(depth);
    document.querySelector('#record')!.textContent = `${Math.floor(p.maxDepth)}m`;
    document.querySelector('#zone')!.textContent = bandAt(depth).name;
    document.querySelector('#depth-note')!.textContent = surface
      ? 'SURFACE OPERATIONS'
      : bandAt(depth).name;
    this.displayedMoney += (p.money - this.displayedMoney) * Math.min(1, dt * 9);
    if (Math.abs(p.money - this.displayedMoney) < 1) this.displayedMoney = p.money;
    document.querySelector('#money')!.textContent =
      `$${Math.round(this.displayedMoney).toLocaleString()}`;
    document.querySelector('#station-dock')!.classList.toggle('hidden', !surface);
    document.querySelector('#tip')!.classList.toggle('hidden', !surface || p.maxDepth > 36);
    const warning = document.querySelector('#low-warning')!;
    warning.textContent = surface
      ? ''
      : p.fuel / p.max('fuel') < 0.23
        ? 'LOW FUEL — RETURN TO SURFACE'
        : p.count >= p.max('cargo')
          ? 'CARGO FULL — RETURN TO SELL'
          : '';
  }
}
