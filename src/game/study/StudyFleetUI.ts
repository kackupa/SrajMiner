import type { ForgeSpriteRig } from '../player/ForgeSpriteRig';
import { forgeMiner } from '../player/ForgeMiner';
import { FLEET_STUDY as F, STUDY_WEAPONS } from '../config';
import { Progress } from '../economy/Progress';
import { podPortrait } from '../ui/PodPortrait';
import { weaponSVG } from './StudyWeaponArt';
import {
  cargoTotal,
  fleetOres,
  type FleetModule,
  type FleetSale,
  type StudyFleet,
} from './StudyFleet';
import './StudyFleet.css';

const money = (n: number) => `₭${n.toLocaleString('en-GB')}`;
const name = (s: string) => s[0].toUpperCase() + s.slice(1);
function illustration(id: FleetModule) {
  const content =
    id === 'rack'
      ? '<path d="M53 31h54v62H53z" fill="#294853"/><path d="M20 42h30v45H20zm90 0h30v45h-30z" fill="#d0a05c"/><path d="M29 42v45m90-45v45" stroke="#f3d39a" stroke-width="4"/><path d="m58 31 9-9h40l10 9" fill="#779193"/><path d="M64 45h32v25H64z" fill="#91c5c6"/>'
      : id === 'drill'
        ? '<path d="M20 48h39v27H20z" fill="#c89951"/><path d="M28 44h12v35H28z" fill="#efd09a"/><path d="M58 49h13v25H58z" fill="#314a56"/><path d="m71 38 69 23-69 24z" fill="#adc4c2"/><path d="m71 61 69 0-69 24z" fill="#55727e"/><path d="m82 43 9 35m5-30 8 26m4-22 7 17" stroke="#263d49" stroke-width="4"/>'
        : '<path d="m30 37 66-8 24 16v36l-24 16-66-9z" fill="#58727b"/><path d="m30 37 66-8 24 16-66 8z" fill="#aec3b8"/><path d="M39 53h62v25H39z" fill="#152b38"/><path d="M45 56h51v18H45z" fill="#85d4c9"/><path d="m117 48 25-8v43l-25-6z" fill="#d0a05c"/><path d="m141 49 15 14-15 13z" fill="#9ce9df"/>';
  return `<svg viewBox="0 0 160 120" aria-hidden="true">${content}</svg>`;
}

export class StudyFleetUI {
  readonly root = document.createElement('section');
  private page: 'cargo' | 'equipment' | 'weapons' = 'cargo';
  private slot: 'primary' | 'secondary' = 'primary';
  private weaponIndex = 0;
  private item = 0;
  private sale?: FleetSale;
  private status = 'Ore from your miner and ship is available for every purchase.';
  get open() {
    return !this.root.hidden;
  }
  constructor(
    private fleet: StudyFleet,
    private actions: {
      close: () => void;
      unload: () => void;
      sold: () => void;
      bought: () => void;
      relocate: () => void;
    },
    private forge = false,
    private art?: ForgeSpriteRig,
  ) {
    this.root.className = 'fleet-console';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Mothership operations');
    document.querySelector('#app')!.append(this.root);
    this.root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-close')) {
        actions.close();
        return;
      }
      if (button.hasAttribute('data-tab')) {
        this.page = button.dataset.tab as typeof this.page;
        this.sale = undefined;
      }
      if (button.dataset.slot) {
        this.slot = button.dataset.slot as typeof this.slot;
        this.weaponIndex = 0;
      }
      if (button.dataset.selectWeapon !== undefined)
        this.weaponIndex = Number(button.dataset.selectWeapon);
      if (button.dataset.selectModule !== undefined)
        this.item = Number(button.dataset.selectModule);
      if (button.dataset.weaponPage)
        this.weaponIndex =
          (this.weaponIndex +
            Number(button.dataset.weaponPage) +
            STUDY_WEAPONS.filter((w) => w.slot === this.slot).length) %
          STUDY_WEAPONS.filter((w) => w.slot === this.slot).length;
      if (button.dataset.weapon) {
        const id = button.dataset.weapon;
        if (fleet.weapons.has(id) ? fleet.equipWeapon(id) : fleet.buyWeapon(id)) {
          this.status = `${STUDY_WEAPONS.find((w) => w.id === id)!.name} fitted. Owned weapons can be swapped for free.`;
          actions.bought();
        }
      }
      if (button.hasAttribute('data-unload')) {
        actions.unload();
        this.sale = undefined;
        this.status = 'All carried ore is now aboard the mothership.';
      }
      if (button.hasAttribute('data-sell')) {
        this.sale = fleet.quote(button.dataset.sell as (typeof fleetOres)[number]);
      }
      if (button.hasAttribute('data-cancel')) this.sale = undefined;
      if (button.hasAttribute('data-confirm') && this.sale) {
        const q = this.sale;
        this.sale = undefined;
        if (fleet.sell(q)) {
          this.status = `Sold ${q.units} ${q.ore} for ${money(q.value)}.`;
          actions.sold();
        } else this.status = 'Cargo changed. Review the sale again.';
      }
      if (button.hasAttribute('data-item'))
        this.item = (this.item + Number(button.dataset.item) + F.modules.length) % F.modules.length;
      if (button.hasAttribute('data-buy')) {
        const id = button.dataset.buy as FleetModule;
        if (fleet.buy(id)) {
          this.status = `${F.modules.find((m) => m.id === id)!.name} fitted.`;
          actions.bought();
        }
      }
      if (button.hasAttribute('data-relocate')) {
        actions.relocate();
        return;
      }
      if (button.hasAttribute('data-supplies')) {
        fleet.loadTestSupplies();
        this.status = 'Prototype supplies added once. Nothing transfers to your campaign.';
      }
      const focusAttribute = Array.from(button.attributes).find(
        (a) => a.name.startsWith('data-') && a.name !== 'data-button',
      );
      this.render();
      if (focusAttribute) {
        const next = this.root.querySelector<HTMLButtonElement>(
          `[${focusAttribute.name}="${focusAttribute.value}"]`,
        );
        (next && !next.disabled
          ? next
          : this.root.querySelector<HTMLButtonElement>('[data-close]')
        )?.focus();
      }
    });
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
          this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ),
        first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }
  show() {
    this.sale = undefined;
    this.root.hidden = false;
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-close]')!.focus();
  }
  hide() {
    this.root.hidden = true;
    this.sale = undefined;
  }
  destroy() {
    this.root.remove();
  }
  private weaponArt(id: string) {
    return this.art?.thumbnail(id) ?? weaponSVG(id);
  }
  private moduleArt(id: FleetModule) {
    return this.art?.thumbnail(id) ?? illustration(id);
  }
  private bay() {
    const f = this.fleet,
      p = new Progress();
    p.loadout.fitted.weapon = f.primary;
    if (f.modules.has('rack')) p.loadout.fitted.hull = 'hauler';
    if (f.modules.has('drill')) p.loadout.fitted.drill = 'excavator';
    return `<aside class="fleet-bay" aria-label="Equipped miner"><div class="bay-label"><span class="fleet-live"></span> REFIT BAY <span>01</span></div><div class="bay-rig">${this.art?.portrait(p) ?? podPortrait(p, this.forge ? forgeMiner : undefined)}<div class="bay-platform"></div></div><div class="bay-caption"><small>${this.forge ? 'FORGE / COMBAT MINER' : 'YOUR MINER'}</small><h2>Ready for the frontier.</h2><p>${f.capacity} ore capacity · ${f.modules.has('drill') ? 'Excavator' : 'Standard drill'}</p></div><div class="bay-loadout">${(['primary', 'secondary'] as const).map((slot) => `<div>${this.weaponArt(f[slot])}<span><small>${slot.toUpperCase()}</small><b>${STUDY_WEAPONS.find((w) => w.id === f[slot])!.name}</b></span></div>`).join('')}</div><div class="bay-foot">ORE FRONTIER <span>EXPEDITION / LOCAL</span></div></aside>`;
  }
  private render() {
    const f = this.fleet;
    const titles = {
      cargo: ['Cargo hold', 'Offload. Trade. Head back out.'],
      equipment: ['Refit bay', 'Make room for a bigger expedition.'],
      weapons: ['Armoury', 'Choose what you take into the fight.'],
    };
    this.root.innerHTML = `<header class="fleet-header"><div class="fleet-brand"><span class="fleet-emblem" aria-hidden="true">⌁</span><div><small>ORE FRONTIER</small><h1>Mothership</h1></div></div><div class="fleet-balance"><small>AVAILABLE KREDITS</small><strong>${money(f.credits)}</strong></div><button data-close class="fleet-return">Return to miner <kbd>Esc</kbd></button></header>
    <div class="fleet-shell"><nav aria-label="Mothership sections">${(
      [
        ['cargo', '01', 'Cargo', 'Store & sell ore'],
        ['equipment', '02', 'Equipment', 'Improve your rig'],
        ['weapons', '03', 'Weapons', 'Choose your loadout'],
      ] as const
    )
      .map(
        ([id, n, label, sub]) =>
          `<button data-tab="${id}" aria-pressed="${this.page === id}"><small>${n}</small><span><b>${label}</b><em>${sub}</em></span><i aria-hidden="true">›</i></button>`,
      )
      .join(
        '',
      )}<button data-relocate class="fleet-move"><small>↗</small><span><b>Move ship</b><em>Choose a landing site</em></span></button><p class="nav-note"><span class="fleet-live"></span> EXPEDITION PAUSED</p></nav>
    ${this.bay()}<main class="fleet-content" data-page="${this.page}"><div class="fleet-heading"><small>SHIP OPERATIONS / ${this.page.toUpperCase()}</small><h2>${titles[this.page][0]}</h2><p>${titles[this.page][1]}</p></div>${this.page === 'cargo' ? this.cargoPanel() : this.page === 'equipment' ? this.equipmentPanel() : this.weaponPanel()}</main></div>
    <footer><p role="status">${this.status}</p><span class="fleet-prototype">TEST EXPEDITION · RELOAD RESETS</span><button data-supplies ${f.testSuppliesUsed ? 'disabled' : ''}>${f.testSuppliesUsed ? 'Test supplies used' : 'Load test supplies'}</button></footer>`;
  }
  private cargoPanel() {
    const f = this.fleet,
      carried = cargoTotal(f.miner);
    return `<div class="fleet-summary"><div><small>IN YOUR MINER</small><b>${carried}<span> / ${f.capacity}</span></b><div class="fleet-meter"><i style="width:${Math.min(100, (carried / f.capacity) * 100)}%"></i></div></div><div><small>ABOARD THE SHIP</small><b>${cargoTotal(f.storage)}<span> ore</span></b><span class="fleet-muted">Unlimited storage</span></div><button class="primary" data-unload ${!carried ? 'disabled' : ''}>Unload all <span>↗</span></button></div>
    <div class="fleet-ore-heading"><span>MATERIAL</span><span>MINER / SHIP</span><span>SELL ALL</span></div><div class="fleet-ores">${fleetOres.map((ore) => `<article><span class="fleet-ore-icon ${ore}" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="m6 30 6-20 18-5 12 18-9 19-20-2Z" fill="currentColor"/><path d="m12 10 13 12 5-17M6 30l19-8 8 20m-8-20 17 1" fill="none" stroke="#07121b" stroke-opacity=".4" stroke-width="2"/></svg></span><div><h3>${name(ore)}</h3><small>${money(F.prices[ore])} / UNIT</small></div><p class="ore-quantities"><b>${f.miner[ore]}</b><span> / </span><b>${f.storage[ore]}</b></p><button data-sell="${ore}" ${!f.available(ore) ? 'disabled' : ''}><span>Sell ${f.available(ore)}</span><b>${money(f.available(ore) * F.prices[ore])}</b></button></article>`).join('')}</div>
    ${this.sale ? `<div class="fleet-sale"><p>Sell <b>${this.sale.units} ${this.sale.ore}</b> for <b>${money(this.sale.value)}</b>?<small>Ore is taken from your miner, then the ship.</small></p><button data-cancel>Keep ore</button><button class="primary" data-confirm>Confirm sale</button></div>` : '<p class="fleet-help">Keep materials for upgrades. Sell what you can spare.</p>'}`;
  }
  private equipmentPanel() {
    const f = this.fleet,
      m = F.modules[this.item],
      fitted = f.modules.has(m.id);
    return `<div class="fleet-catalogue" aria-label="Equipment catalogue">${F.modules.map((entry, i) => `<button data-select-module="${i}" aria-pressed="${this.item === i}">${this.moduleArt(entry.id)}<span>${entry.name}</span><small>${f.modules.has(entry.id) ? 'FITTED' : 'UPGRADE'}</small></button>`).join('')}</div><div class="fleet-equipment"><div class="fleet-module-art">${this.moduleArt(m.id)}<small>${m.id === 'thrusters' ? 'MOTHERSHIP SYSTEM' : 'MINER SYSTEM'}</small></div><div class="fleet-detail"><small class="fleet-item-state">${fitted ? 'FITTED TO YOUR ' + (m.id === 'thrusters' ? 'SHIP' : 'MINER') : 'AVAILABLE UPGRADE'}</small><h2>${m.name}</h2><p>${m.description}</p><div class="fleet-cost">${
      fitted
        ? '<span class="ready">Installed</span>'
        : fleetOres
            .filter((ore) => m.ore[ore])
            .map(
              (ore) =>
                `<span class="${f.available(ore) >= m.ore[ore] ? 'ready' : 'missing'}">${name(ore)} ${f.available(ore)} / ${m.ore[ore]}</span>`,
            )
            .join('') +
          `<span class="${f.credits >= m.credits ? 'ready' : 'missing'}">${money(m.credits)}</span>`
    }</div><button class="primary" data-buy="${m.id}" ${!f.canBuy(m.id) ? 'disabled' : ''}>${fitted ? 'Fitted' : f.canBuy(m.id) ? 'Buy & fit' : 'More materials needed'}</button></div></div><div class="fleet-page"><button data-item="-1" aria-label="Previous equipment">←</button><span>${this.item + 1} / ${F.modules.length} EQUIPMENT</span><button data-item="1" aria-label="Next equipment">→</button></div>`;
  }
  private weaponPanel() {
    const f = this.fleet,
      items = STUDY_WEAPONS.filter((w) => w.slot === this.slot),
      w = items[this.weaponIndex],
      owned = f.weapons.has(w.id),
      fitted = f[this.slot] === w.id;
    return `<div class="fleet-slots">${(['primary', 'secondary'] as const).map((slot) => `<button data-slot="${slot}" aria-pressed="${this.slot === slot}"><span><small>${slot.toUpperCase()} · ${slot === 'primary' ? 'RIGHT CLICK' : 'SHIFT'}</small><b>${STUDY_WEAPONS.find((w) => w.id === f[slot])!.name}</b></span>${this.weaponArt(f[slot])}</button>`).join('')}</div>
    <div class="fleet-catalogue" aria-label="Weapon catalogue">${items.map((entry, i) => `<button data-select-weapon="${i}" aria-pressed="${i === this.weaponIndex}">${this.weaponArt(entry.id)}<span>${entry.name}</span><small>${f[this.slot] === entry.id ? 'EQUIPPED' : f.weapons.has(entry.id) ? 'OWNED' : money(entry.credits)}</small></button>`).join('')}</div>
    <div class="fleet-equipment fleet-weapon"><div class="fleet-module-art">${this.weaponArt(w.id)}<small>${w.role}</small></div><div class="fleet-detail"><small class="fleet-item-state">${fitted ? 'EQUIPPED' : owned ? 'OWNED · FREE TO SWAP' : 'AVAILABLE TO BUILD'}</small><h2>${w.name}</h2><p>${w.description}</p><div class="fleet-weapon-stats"><span><b>${w.damage}</b> damage</span><span><b>${w.cooldown}s</b> fire interval</span><span><b>${Math.round(w.armor * 100)}%</b> vs armour</span></div><div class="fleet-cost">${
      owned
        ? '<span class="ready">Free to equip</span>'
        : fleetOres
            .filter((o) => w[o])
            .map(
              (o) =>
                `<span class="${f.available(o) >= w[o] ? 'ready' : 'missing'}">${name(o)} ${f.available(o)} / ${w[o]}</span>`,
            )
            .join('') +
          `<span class="${f.credits >= w.credits ? 'ready' : 'missing'}">${money(w.credits)}</span>`
    }</div><button class="primary" data-weapon="${w.id}" ${fitted || (!owned && !f.canBuyWeapon(w.id)) ? 'disabled' : ''}>${fitted ? 'Equipped' : owned ? 'Equip weapon' : f.canBuyWeapon(w.id) ? 'Buy & equip' : 'More materials needed'}</button></div></div><div class="fleet-page"><button data-weapon-page="-1" aria-label="Previous weapon">←</button><span>${this.weaponIndex + 1} / ${items.length} ${this.slot.toUpperCase()}</span><button data-weapon-page="1" aria-label="Next weapon">→</button></div>`;
  }
}
