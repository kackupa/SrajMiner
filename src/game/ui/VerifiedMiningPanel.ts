import { CIVILISATIONS, CIVILISATION_KEYS, ONLINE_BASIC_UPGRADES, ORES, ORE_KEYS, SERVICE, STARTER_PLANET_CHART, UNDERGROUND_BUILDING, UPGRADES, WORLD, rigMaterialCost, upgradeValue, type CivilisationId, type MapId, type OnlineBasicUpgrade, type Ore } from '../config';
import { travelQuote } from '../campaign/Travel';
import { TileWorld } from '../world/TileWorld';
import { VerifiedGameController, type OnlineControls } from '../online/VerifiedGameController';
import type { OnlineCivilianQuote, OnlineGameState } from '../online/VerifiedGameApi';

const keyMap: Record<string, keyof OnlineControls> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
};
const blankControls = (): OnlineControls => ({ left: false, right: false, up: false, down: false, drill: false });

/** M3 mining view: only canonical server state is rendered as earned cargo. */
export class VerifiedMiningPanel {
  private readonly held = new Set<keyof OnlineControls>();
  private timer: number | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private active = false;
  private busy = false;
  private stopped = false;
  private cargoOpen = false;
  private saleOpen = false;
  private serviceOpen = false;
  private recoveryArmed = false;
  private travelArmed = false;
  private upgradeOpen = false;
  private selectedUpgrade: OnlineBasicUpgrade = 'drill';
  private transferSource: 'miner' | 'ship' = 'miner';
  private selectedOre: Ore = 'copper';
  private transferQuantity = 1;
  private saleBuyer: CivilisationId = 'helion';
  private saleQuote: OnlineCivilianQuote | null = null;
  private saleNotice = 'Check a server offer before selling.';
  private campaignId = '';
  private status = 'CONNECTING';
  private readonly onKeyDown = (event: KeyboardEvent) => {
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    this.held.add(control);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => {
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    this.held.delete(control);
  };
  private readonly onBlur = () => { this.held.clear(); };

  constructor(private readonly host: HTMLElement, private readonly exit: () => void,
    private readonly controller = new VerifiedGameController()) {}

  async open(campaignId: string): Promise<void> {
    this.campaignId = campaignId;
    this.active = true;
    this.renderShell();
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    const canvas = this.host.querySelector<HTMLCanvasElement>('#verified-world')!;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    try {
      await this.controller.open(campaignId);
      if (!this.active) return;
      this.status = 'SERVER CONNECTED';
      this.markStranded();
      this.draw();
      this.showStatus();
      this.ensureTimer();
    } catch (error) {
      if (!this.active) return;
      this.stop(error);
    }
  }

  close(): void {
    this.active = false;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
    this.held.clear();
  }

  private ensureTimer(): void {
    if (this.timer === undefined) this.timer = window.setInterval(() => void this.tick(), 220);
  }

  private controls(): OnlineControls {
    const controls = blankControls();
    for (const key of this.held) controls[key] = true;
    controls.drill = controls.down || controls.left || controls.right;
    return controls;
  }

  private async tick(): Promise<void> {
    if (!this.active || this.busy || this.stopped || this.cargoOpen || document.hidden) return;
    this.busy = true;
    this.status = 'CONFIRMING';
    this.showStatus();
    try {
      const priorCoreFuel = this.controller.state?.snapshot.core_fuel ?? 0;
      await this.controller.submit(this.controls());
      if (!this.active) return;
      const coreGain = (this.controller.state?.snapshot.core_fuel ?? 0) - priorCoreFuel;
      this.status = coreGain > 0 ? `CORE +${coreGain} FUEL` : 'SERVER CONNECTED';
      this.markStranded();
      this.draw();
    } catch (error) {
      if (!this.active) return;
      this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private stop(error: unknown): void {
    this.stopped = true;
    this.held.clear();
    if (this.cargoOpen) {
      this.cargoOpen = false;
      this.saleOpen = false;
      this.serviceOpen = false;
      this.upgradeOpen = false;
      this.host.querySelector<HTMLElement>('.verified-modal')?.classList.remove('sale-mode');
      this.host.querySelector<HTMLElement>('#verified-cargo-view')!.hidden = true;
      this.host.querySelector<HTMLElement>('#verified-sale-view')!.hidden = true;
      this.host.querySelector<HTMLElement>('#verified-service-view')!.hidden = true;
      this.host.querySelector<HTMLElement>('#verified-upgrade-view')!.hidden = true;
      this.host.querySelector<HTMLElement>('#verified-world')!.hidden = false;
      this.host.querySelector<HTMLElement>('.verified-controls')!.hidden = false;
      this.host.querySelector<HTMLElement>('.verified-actions')!.hidden = false;
    }
    const message = error instanceof Error ? error.message : '';
    this.status = message.includes('SESSION_CONFLICT') ? 'ANOTHER SESSION IS ACTIVE'
      : message.includes('STALE_REVISION') ? 'STATE CHANGED · REFRESH'
      : message.includes('INVALID_COMMAND') && this.isStranded()
        ? 'POD STRANDED · RECOVERY AVAILABLE' : 'CONNECTION PAUSED';
    this.showStatus();
    const takeover = this.host.querySelector<HTMLButtonElement>('#verified-takeover');
    if (takeover) takeover.hidden = !message.includes('SESSION_CONFLICT');
    const retry = this.host.querySelector<HTMLButtonElement>('#verified-retry');
    if (retry) retry.hidden = message.includes('STALE_REVISION') ||
      (message.includes('INVALID_COMMAND') && this.isStranded() && !this.controller.pending);
    const refresh = this.host.querySelector<HTMLButtonElement>('#verified-refresh');
    if (refresh) refresh.hidden = !message.includes('STALE_REVISION');
  }

  private async retry(): Promise<void> {
    if (!this.active || this.busy) return;
    this.busy = true;
    this.status = 'RECONNECTING';
    this.showStatus();
    try {
      const recoveringSale = !!this.controller.pendingSale;
      const recoveringService = !!this.controller.pendingService;
      const recoveringUpgrade = !!this.controller.pendingUpgrade;
      const recoveringPod = !!this.controller.pendingRecovery;
      const recoveringTravel = !!this.controller.pendingTravel;
      if (this.controller.pendingTravel) await this.controller.retryTravel();
      else if (this.controller.pendingRecovery) await this.controller.retryRecovery();
      else if (this.controller.pendingSale) await this.controller.retrySale();
      else if (this.controller.pendingService) await this.controller.retryService();
      else if (this.controller.pendingUpgrade) await this.controller.retryUpgrade();
      else if (this.controller.pendingBuild) await this.controller.retryBuildUplink();
      else if (this.controller.pendingTransfer) await this.controller.retryTransfer();
      else if (this.controller.pending) await this.controller.retry();
      else await this.controller.open(this.campaignId);
      if (!this.active) return;
      this.stopped = false;
      this.recoveryArmed = false;
      this.status = recoveringSale && this.controller.lastSaleReceipt
        ? `SALE CONFIRMED · +${(this.controller.lastSaleReceipt.total_credit_minor / 100).toFixed(2)} KREDITS`
        : recoveringService && this.controller.lastServiceReceipt
          ? 'SERVICE CONFIRMED'
        : recoveringUpgrade && this.controller.lastUpgradeReceipt
          ? 'RIG UPGRADE INSTALLED'
        : recoveringPod && this.controller.lastRecoveryReceipt
          ? 'RECOVERY COMPLETE · MINER ORE FORFEITED'
        : recoveringTravel ? 'JUMP CONFIRMED' 
        : 'SERVER CONNECTED';
      this.markStranded();
      this.host.querySelector<HTMLButtonElement>('#verified-retry')!.hidden = true;
      this.host.querySelector<HTMLButtonElement>('#verified-takeover')!.hidden = true;
      this.host.querySelector<HTMLButtonElement>('#verified-refresh')!.hidden = true;
      this.draw();
      this.renderCargo();
      this.renderService();
      this.renderUpgrade();
      this.ensureTimer();
    } catch (error) {
      if (this.active) this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private async takeover(): Promise<void> {
    if (!this.active || this.busy) return;
    this.busy = true;
    try {
      await this.controller.open(this.campaignId, true);
      if (!this.active) return;
      this.stopped = false;
      this.status = 'SERVER CONNECTED';
      this.markStranded();
      this.host.querySelector<HTMLButtonElement>('#verified-retry')!.hidden = true;
      this.host.querySelector<HTMLButtonElement>('#verified-takeover')!.hidden = true;
      this.host.querySelector<HTMLButtonElement>('#verified-refresh')!.hidden = true;
      this.draw();
      this.renderCargo();
      this.renderService();
      this.renderUpgrade();
      this.ensureTimer();
    } catch (error) {
      if (this.active) this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private async refreshAfterStale(): Promise<void> {
    if (!this.active || this.busy) return;
    this.busy = true;
    this.status = 'REFRESHING';
    this.showStatus();
    try {
      await this.controller.refreshAfterStale();
      if (!this.active) return;
      this.stopped = false;
      this.status = 'SERVER CONNECTED';
      this.markStranded();
      this.host.querySelector<HTMLButtonElement>('#verified-refresh')!.hidden = true;
      this.draw();
      this.renderCargo();
      this.renderService();
      this.renderUpgrade();
      this.ensureTimer();
    } catch (error) {
      if (this.active) this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private showStatus(): void {
    const state = this.controller.state;
    const status = this.host.querySelector<HTMLElement>('#verified-status');
    if (status) status.textContent = this.status;
    const title = this.host.querySelector<HTMLElement>('#verified-title');
    if (title && state) title.textContent = state.active_planet === 'mars-frontier'
      ? 'Mars expedition' : 'Cryo expedition';
    const cargo = this.host.querySelector<HTMLElement>('#verified-cargo');
    if (cargo && state) {
      const entries = Object.entries(state.snapshot.cargo_half_units)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([ore, amount]) => `${ore.toUpperCase()} ${Number(amount) / 2}`);
      cargo.textContent = entries.length ? entries.join(' · ') : 'EMPTY HOLD';
    }
    const depth = this.host.querySelector<HTMLElement>('#verified-depth');
    if (depth && state) depth.textContent = `${Math.max(0, Math.round(state.snapshot.pod.y / WORLD.tile * WORLD.meters))} M`;
    const ship = this.host.querySelector<HTMLElement>('#verified-ship');
    if (ship && state) {
      const units = Object.values(state.ship_cargo_half_units ?? {}).reduce<number>((sum, amount) => sum + Number(amount ?? 0), 0);
      ship.textContent = `SHIP ${units / 2}/${(state.ship_capacity_half_units ?? 100) / 2}`;
    }
    const credits = this.host.querySelector<HTMLElement>('#verified-credits');
    if (credits && state) credits.textContent = `${(state.credit_minor / 100).toFixed(2)} KREDITS`;
    const stranded = this.isStranded();
    this.host.querySelector<HTMLElement>('.verified-modal')?.classList.toggle('stranded-mode',stranded);
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-control]')))
      button.disabled = stranded;
    const recovery = this.host.querySelector<HTMLButtonElement>('#verified-recover');
    if (recovery) {
      recovery.hidden = !stranded || !!this.controller.pendingRecovery || !!this.controller.pending ||
        this.controller.stale || this.status === 'ANOTHER SESSION IS ACTIVE';
      recovery.disabled = this.busy;
      recovery.textContent = this.recoveryArmed ? 'CONFIRM · LOSE MINER ORE' : 'RECOVER POD';
    }
    const cargoButton = this.host.querySelector<HTMLButtonElement>('#verified-cargo-open');
    if (cargoButton) cargoButton.hidden = stranded;
    const travel = this.host.querySelector<HTMLButtonElement>('#verified-travel');
    if (travel && state) {
      const destination = state.active_planet === 'cryo-shelf' ? 'mars-frontier' : 'cryo-shelf';
      const quote = travelQuote(state.active_planet as MapId,destination,
        state.snapshot.core_fuel,state.snapshot.core_relics);
      travel.hidden = stranded || !state.snapshot.core_relics.includes('core-cryo');
      travel.disabled = this.busy || this.stopped || !quote.canDepart ||
        !state.snapshot.pod.docked || Math.abs(state.snapshot.pod.x-555)>190;
      travel.textContent = this.travelArmed ? 'CONFIRM JUMP' : destination === 'mars-frontier'
        ? 'JUMP TO MARS' : 'RETURN TO CRYO';
    }
    const hint = this.host.querySelector<HTMLElement>('#verified-control-hint');
    if (hint) {
      hint.hidden = stranded;
      const core = state?.snapshot;
      hint.textContent = core?.core_extraction_elapsed_ms
        ? `CORE EXTRACTION ${Math.floor(core.core_extraction_elapsed_ms / 1000)}/10S · FUEL ${core.core_fuel}`
        : core?.core_relics.length
          ? `CORE FUEL ${core.core_fuel} · HOLD S TO DRILL`
          : 'WASD or arrow keys · hold S to drill';
    }
  }

  private isStranded(): boolean {
    const state = this.controller.state;
    return !!state && (state.snapshot.fuel_milli <= 0 || state.snapshot.hull_milli <= 0);
  }

  private markStranded(): void {
    if (!this.isStranded()) return;
    this.stopped = true;
    this.held.clear();
    this.status = 'POD STRANDED · MINER ORE AT RISK';
  }

  private async travel(): Promise<void> {
    const state = this.controller.state;
    const button = this.host.querySelector<HTMLButtonElement>('#verified-travel');
    if (!this.active || this.busy || this.stopped || !state || !button || button.disabled) return;
    if (!this.travelArmed) {
      this.travelArmed = true;
      this.status = 'JUMP COSTS 1 CORE FUEL · CONFIRM';
      this.showStatus();
      return;
    }
    this.busy = true;
    this.held.clear();
    this.status = 'CONFIRMING JUMP';
    this.showStatus();
    try {
      const destination = state.active_planet === 'cryo-shelf' ? 'mars-frontier' : 'cryo-shelf';
      await this.controller.travel(destination);
      if (!this.active) return;
      this.travelArmed = false;
      this.status = 'JUMP CONFIRMED';
      this.draw();
    } catch (error) {
      if (this.active) this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private async recoverPod(): Promise<void> {
    if (!this.active || this.busy || !this.isStranded() || this.controller.pendingRecovery) return;
    if (!this.recoveryArmed) {
      this.recoveryArmed = true;
      this.status = 'RECOVERY FORFEITS ALL MINER ORE';
      this.showStatus();
      return;
    }
    this.busy = true;
    this.status = 'CONFIRMING RECOVERY';
    this.showStatus();
    try {
      await this.controller.recoverStrandedPod();
      if (!this.active) return;
      this.recoveryArmed = false;
      this.stopped = false;
      this.status = 'RECOVERY COMPLETE · MINER ORE FORFEITED';
      this.draw();
    } catch (error) {
      if (this.active) this.stop(error);
    } finally {
      this.busy = false;
      if (this.active) this.showStatus();
    }
  }

  private sourceStock(): number {
    const state = this.controller.state;
    if (!state) return 0;
    return Number((this.transferSource === 'miner'
      ? state.snapshot.cargo_half_units : state.ship_cargo_half_units)?.[this.selectedOre] ?? 0);
  }

  private freeTarget(): number {
    const state = this.controller.state;
    if (!state) return 0;
    if (this.transferSource === 'miner') {
      const used = Object.values(state.ship_cargo_half_units ?? {}).reduce<number>((sum, count) => sum + Number(count ?? 0), 0);
      return Math.max(0, (state.ship_capacity_half_units ?? 100) - used);
    }
    const used = Object.values(state.snapshot.cargo_half_units).reduce<number>((sum, count) => sum + Number(count ?? 0), 0);
    return Math.max(0, upgradeValue('cargo', state.snapshot.levels.cargo) * 2 - used);
  }

  private renderCargo(): void {
    if (!this.cargoOpen) return;
    const source = this.host.querySelector<HTMLElement>('#verified-transfer-source');
    const ore = this.host.querySelector<HTMLElement>('#verified-transfer-ore');
    const amount = this.host.querySelector<HTMLElement>('#verified-transfer-amount');
    const stock = this.host.querySelector<HTMLElement>('#verified-transfer-stock');
    const action = this.host.querySelector<HTMLButtonElement>('#verified-transfer');
    const build = this.host.querySelector<HTMLButtonElement>('#verified-build-uplink');
    const sale = this.host.querySelector<HTMLButtonElement>('#verified-open-sale');
    const service = this.host.querySelector<HTMLButtonElement>('#verified-open-service');
    const upgrade = this.host.querySelector<HTMLButtonElement>('#verified-open-upgrade');
    if (!source || !ore || !amount || !stock || !action || !build || !sale || !service || !upgrade) return;
    const available = this.sourceStock();
    const space = this.freeTarget();
    const max = Math.min(available, space, 100);
    this.transferQuantity = Math.max(1, Math.min(this.transferQuantity, max || 1));
    source.textContent = this.transferSource === 'miner' ? 'MINER → SHIP' : 'SHIP → MINER';
    ore.textContent = ORES[this.selectedOre].name.toUpperCase();
    amount.textContent = `${this.transferQuantity / 2} ORE`;
    stock.textContent = `SOURCE ${available / 2} · ROOM ${space / 2}`;
    action.disabled = this.busy || this.stopped || max < 1 || this.transferQuantity > max;
    const state = this.controller.state;
    build.hidden = !!state?.market_uplink_online;
    sale.hidden = !state?.market_uplink_online;
    sale.disabled = this.busy || this.stopped || available < 1;
    service.disabled = this.busy || this.stopped;
    upgrade.disabled = this.busy || this.stopped;
    build.disabled = this.busy || this.stopped || !state ||
      Object.entries(UNDERGROUND_BUILDING['trade-post'].materials).some(([key, cost]) =>
        Number(state.snapshot.cargo_half_units[key as Ore] ?? 0) +
        Number(state.ship_cargo_half_units?.[key as Ore] ?? 0) < cost * 2);
    this.host.querySelector<HTMLButtonElement>('#verified-transfer-minus')!.disabled = this.transferQuantity <= 1;
    this.host.querySelector<HTMLButtonElement>('#verified-transfer-plus')!.disabled = this.transferQuantity >= max;
  }

  private setCargoOpen(open: boolean): void {
    if (this.busy || this.stopped || !this.controller.state) return;
    this.cargoOpen = open;
    this.saleOpen = false;
    this.serviceOpen = false;
    this.upgradeOpen = false;
    this.host.querySelector<HTMLElement>('.verified-modal')?.classList.remove('sale-mode');
    this.saleQuote = null;
    this.held.clear();
    this.host.querySelector<HTMLElement>('#verified-world')!.hidden = open;
    this.host.querySelector<HTMLElement>('.verified-controls')!.hidden = open;
    this.host.querySelector<HTMLElement>('#verified-cargo-view')!.hidden = !open;
    this.host.querySelector<HTMLElement>('#verified-sale-view')!.hidden = true;
    this.host.querySelector<HTMLElement>('#verified-service-view')!.hidden = true;
    this.host.querySelector<HTMLElement>('#verified-upgrade-view')!.hidden = true;
    this.host.querySelector<HTMLElement>('.verified-actions')!.hidden = open;
    if (open) this.renderCargo(); else this.draw();
  }

  private setSaleOpen(open: boolean): void {
    if (this.busy || this.stopped || !this.cargoOpen) return;
    this.saleOpen = open;
    this.host.querySelector<HTMLElement>('.verified-modal')?.classList.toggle('sale-mode', open);
    this.saleQuote = null;
    this.saleNotice = 'Check a server offer before selling.';
    this.host.querySelector<HTMLElement>('#verified-cargo-view')!.hidden = open;
    this.host.querySelector<HTMLElement>('#verified-sale-view')!.hidden = !open;
    this.host.querySelector<HTMLElement>('#verified-service-view')!.hidden = true;
    this.host.querySelector<HTMLElement>('#verified-upgrade-view')!.hidden = true;
    if (open) this.renderSale(); else this.renderCargo();
  }

  private setServiceOpen(open: boolean): void {
    if (this.busy || this.stopped || !this.cargoOpen) return;
    this.serviceOpen = open;
    this.host.querySelector<HTMLElement>('.verified-modal')?.classList.toggle('sale-mode', open);
    this.host.querySelector<HTMLElement>('#verified-cargo-view')!.hidden = open;
    this.host.querySelector<HTMLElement>('#verified-service-view')!.hidden = !open;
    this.host.querySelector<HTMLElement>('#verified-upgrade-view')!.hidden = true;
    if (open) this.renderService(); else this.renderCargo();
  }

  private setUpgradeOpen(open: boolean): void {
    if (this.busy || this.stopped || !this.cargoOpen) return;
    this.upgradeOpen = open;
    this.host.querySelector<HTMLElement>('.verified-modal')?.classList.toggle('sale-mode', open);
    this.host.querySelector<HTMLElement>('#verified-cargo-view')!.hidden = open;
    this.host.querySelector<HTMLElement>('#verified-upgrade-view')!.hidden = !open;
    if (open) this.renderUpgrade(); else this.renderCargo();
  }

  private renderUpgrade(): void {
    if (!this.upgradeOpen) return;
    const state = this.controller.state;
    if (!state) return;
    const key = this.selectedUpgrade;
    const level = state.snapshot.levels[key];
    const maxed = level >= 5;
    const costs = maxed ? {} : rigMaterialCost(key,level);
    const materialLines = Object.entries(costs).map(([ore,cost]) => {
      const available = (Number(state.snapshot.cargo_half_units[ore as Ore] ?? 0) +
        Number(state.ship_cargo_half_units?.[ore as Ore] ?? 0)) / 2;
      return `${ORES[ore as Ore].name.toUpperCase()} ${available} / ${cost}`;
    });
    const affordable = !maxed && Object.entries(costs).every(([ore,cost]) =>
      Number(state.snapshot.cargo_half_units[ore as Ore] ?? 0) +
      Number(state.ship_cargo_half_units?.[ore as Ore] ?? 0) >= cost * 2);
    this.host.querySelector<HTMLElement>('#verified-upgrade-level')!.textContent =
      `${UPGRADES[key].name.toUpperCase()} · LEVEL ${level} / 5`;
    this.host.querySelector<HTMLElement>('#verified-upgrade-effect')!.textContent = maxed
      ? 'BASIC TRACK COMPLETE'
      : `${Number(upgradeValue(key,level).toFixed(2))} → ${Number(upgradeValue(key,level+1).toFixed(2))} ${UPGRADES[key].unit}`;
    this.host.querySelector<HTMLElement>('#verified-upgrade-cost')!.textContent = maxed
      ? 'NO FURTHER BASIC INSTALLATION'
      : `${materialLines.join(' · ')} · NO KREDITS`;
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-rig-upgrade]')))
      button.setAttribute('aria-pressed',String(button.dataset.rigUpgrade===key));
    const action = this.host.querySelector<HTMLButtonElement>('#verified-upgrade-install')!;
    action.disabled = this.busy || this.stopped || !affordable;
    action.textContent = maxed ? 'TRACK COMPLETE' : affordable ? 'INSTALL UPGRADE' : 'COLLECT MISSING MATERIALS';
  }

  private async installUpgrade(): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.upgradeOpen) return;
    const button = this.host.querySelector<HTMLButtonElement>('#verified-upgrade-install');
    if (!button || button.disabled) return;
    this.busy = true;
    this.status = 'CONFIRMING UPGRADE';
    this.showStatus();
    this.renderUpgrade();
    try {
      await this.controller.installUpgrade(this.selectedUpgrade);
      if (!this.active) return;
      this.status = 'RIG UPGRADE INSTALLED';
      this.showStatus();
    } catch (error) {
      if (!this.active) return;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ACCESS_REQUIRED')) this.status = 'RETURN NEAR SHIP';
      else if (message.includes('INSUFFICIENT_ORE')) {
        await this.reloadAfterRejected('MATERIALS CHANGED · STATE REFRESHED');
        return;
      } else if (message.includes('UPGRADE_MAXED')) {
        await this.reloadAfterRejected('RIG TRACK COMPLETE');
        return;
      } else { this.stop(error); return; }
      this.showStatus();
    } finally {
      this.busy = false;
      if (this.active) this.renderUpgrade();
    }
  }

  private renderService(): void {
    if (!this.serviceOpen) return;
    const state = this.controller.state;
    if (!state) return;
    const maxFuel = upgradeValue('fuel',state.snapshot.levels.fuel) * 1000;
    const maxHull = upgradeValue('hull',state.snapshot.levels.hull) * 1000;
    const missingFuel = Math.max(0,maxFuel-state.snapshot.fuel_milli);
    const missingHull = Math.max(0,maxHull-state.snapshot.hull_milli);
    const repairMinor = Math.ceil(missingHull / 1000 * SERVICE.hullPrice) * 100;
    this.host.querySelector<HTMLElement>('#verified-service-fuel')!.textContent =
      `BATTERY ${(state.snapshot.fuel_milli / 1000).toFixed(1)} / ${maxFuel / 1000} · FREE RECHARGE`;
    this.host.querySelector<HTMLElement>('#verified-service-hull')!.textContent =
      `HULL ${(state.snapshot.hull_milli / 1000).toFixed(1)} / ${maxHull / 1000} · REPAIR ${(repairMinor / 100).toFixed(2)} KREDITS`;
    this.host.querySelector<HTMLElement>('#verified-service-wallet')!.textContent =
      `${(state.credit_minor / 100).toFixed(2)} KREDITS AVAILABLE`;
    this.host.querySelector<HTMLButtonElement>('#verified-service-recharge')!.disabled =
      this.busy || this.stopped || missingFuel === 0;
    this.host.querySelector<HTMLButtonElement>('#verified-service-repair')!.disabled =
      this.busy || this.stopped || missingHull === 0 || state.credit_minor < repairMinor;
    this.host.querySelector<HTMLButtonElement>('#verified-service-both')!.disabled =
      this.busy || this.stopped || missingFuel + missingHull === 0 || state.credit_minor < repairMinor;
  }

  private async servicePod(kind: 'fuel' | 'hull' | 'both'): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.serviceOpen) return;
    this.busy = true;
    this.status = 'CONFIRMING SERVICE';
    this.showStatus();
    this.renderService();
    try {
      await this.controller.servicePod(kind);
      if (!this.active) return;
      this.status = 'SERVICE CONFIRMED';
      this.showStatus();
    } catch (error) {
      if (!this.active) return;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ACCESS_REQUIRED')) this.status = 'RETURN NEAR SHIP';
      else if (message.includes('INSUFFICIENT_CREDITS')) {
        await this.reloadAfterRejected('KREDITS CHANGED · STATE REFRESHED');
        return;
      } else if (message.includes('NO_SERVICE_NEEDED')) {
        await this.reloadAfterRejected('RIG ALREADY SERVICED');
        return;
      } else { this.stop(error); return; }
      this.showStatus();
    } finally {
      this.busy = false;
      if (this.active) this.renderService();
    }
  }

  private renderSale(): void {
    if (!this.saleOpen) return;
    const stock = this.sourceStock();
    const amount = Math.min(this.transferQuantity, stock || 1);
    this.transferQuantity = Math.max(1, amount);
    this.host.querySelector<HTMLElement>('#verified-sale-source')!.textContent =
      `${this.transferSource.toUpperCase()} · ${ORES[this.selectedOre].name.toUpperCase()} · ${stock / 2} AVAILABLE`;
    this.host.querySelector<HTMLElement>('#verified-sale-amount')!.textContent = `${this.transferQuantity / 2} ORE`;
    this.host.querySelector<HTMLElement>('#verified-sale-wallet')!.textContent =
      `KREDITS ${(this.controller.state?.credit_minor ?? 0) / 100}`;
    this.host.querySelector<HTMLElement>('#verified-sale-notice')!.textContent = this.saleNotice;
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-civilian-buyer]')))
      button.setAttribute('aria-pressed', String(button.dataset.civilianBuyer === this.saleBuyer));
    this.host.querySelector<HTMLButtonElement>('#verified-sale-minus')!.disabled = this.busy || this.transferQuantity <= 1;
    this.host.querySelector<HTMLButtonElement>('#verified-sale-plus')!.disabled =
      this.busy || this.transferQuantity >= Math.min(stock, 100);
    this.host.querySelector<HTMLButtonElement>('#verified-sale-quote')!.disabled =
      this.busy || this.stopped || stock < this.transferQuantity;
    const offer = this.saleQuote;
    const matches = offer && offer.revision === this.controller.state?.revision &&
      offer.source === this.transferSource && offer.buyer === this.saleBuyer &&
      offer.ore === this.selectedOre && offer.quantity_half_units === this.transferQuantity;
    this.host.querySelector<HTMLElement>('#verified-sale-offer')!.textContent = matches
      ? `${offer.project ?? 'NO ACTIVE PROJECT'} · BASE ${(offer.gross_credit_minor / 100).toFixed(2)} + BONUS ${(offer.bonus_credit_minor / 100).toFixed(2)} = ${(offer.total_credit_minor / 100).toFixed(2)} KREDITS`
      : 'NO CONFIRMED OFFER';
    this.host.querySelector<HTMLButtonElement>('#verified-sale-confirm')!.disabled =
      this.busy || this.stopped || !matches;
  }

  private async checkCivilianOffer(): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.saleOpen ||
      this.sourceStock() < this.transferQuantity) return;
    this.busy = true;
    this.saleNotice = 'CHECKING SERVER OFFER';
    this.renderSale();
    try {
      this.saleQuote = await this.controller.quoteCivilian(this.transferSource,
        this.saleBuyer, this.selectedOre, this.transferQuantity);
      if (!this.active) return;
      this.saleNotice = 'Offer checked against current server stock. Confirm to sell.';
    } catch (error) {
      if (!this.active) return;
      this.saleQuote = null;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ACCESS_REQUIRED')) this.saleNotice = 'Return near the Market uplink.';
      else if (message.includes('INSUFFICIENT_ORE')) this.saleNotice = 'Stock changed. Return to mining and check again.';
      else if (message.includes('STALE_REVISION')) this.saleNotice = 'State changed. Return to mining and check again.';
      else this.saleNotice = 'Offer unavailable. Try again.';
    } finally {
      this.busy = false;
      if (this.active) this.renderSale();
    }
  }

  private async confirmCivilianSale(): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.saleOpen || !this.saleQuote ||
      this.saleQuote.revision !== this.controller.state?.revision) return;
    this.busy = true;
    this.saleNotice = 'CONFIRMING SERVER SALE';
    this.renderSale();
    try {
      await this.controller.sellCivilian(this.transferSource,this.saleBuyer,
        this.selectedOre,this.transferQuantity);
      if (!this.active) return;
      const receipt = this.controller.lastSaleReceipt;
      this.saleQuote = null;
      this.saleNotice = receipt
        ? `SALE CONFIRMED · +${(receipt.total_credit_minor / 100).toFixed(2)} KREDITS`
        : 'SALE CONFIRMED';
      this.status = 'SERVER CONNECTED';
      this.showStatus();
    } catch (error) {
      if (!this.active) return;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ACCESS_REQUIRED')) this.saleNotice = 'Return near the Market uplink.';
      else if (message.includes('INSUFFICIENT_ORE')) {
        this.saleQuote = null;
        await this.reloadAfterRejected('ORE CHANGED · STATE REFRESHED');
        this.saleNotice = 'Stock changed. Check a new offer.';
      } else if (message.includes('CREDIT_LIMIT')) this.saleNotice = 'Credit limit reached.';
      else { this.stop(error); return; }
    } finally {
      this.busy = false;
      if (this.active) this.renderSale();
    }
  }

  private async reloadAfterRejected(status: string): Promise<void> {
    try {
      await this.controller.open(this.campaignId);
      if (!this.active) return;
      this.status = status;
      this.showStatus();
    } catch (error) {
      if (this.active) this.stop(error);
    }
  }

  private async transferOre(): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.cargoOpen ||
      this.sourceStock() < this.transferQuantity || this.freeTarget() < this.transferQuantity) return;
    this.busy = true;
    this.status = 'CONFIRMING TRANSFER';
    this.showStatus();
    this.renderCargo();
    try {
      await this.controller.transfer(this.transferSource, this.selectedOre, this.transferQuantity);
      if (!this.active) return;
      this.status = 'TRANSFER CONFIRMED';
      this.showStatus();
    } catch (error) {
      if (this.active) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('ACCESS_REQUIRED')) this.status = 'RETURN NEAR SHIP';
        else if (message.includes('INSUFFICIENT_ORE')) { await this.reloadAfterRejected('ORE CHANGED · STATE REFRESHED'); return; }
        else if (message.includes('HOLD_FULL')) { await this.reloadAfterRejected('DESTINATION FULL · STATE REFRESHED'); return; }
        else { this.stop(error); return; }
        this.showStatus();
      }
    } finally {
      this.busy = false;
      if (this.active) this.renderCargo();
    }
  }

  private async buildUplink(): Promise<void> {
    if (!this.active || this.busy || this.stopped || !this.cargoOpen ||
      this.controller.state?.market_uplink_online) return;
    const button = this.host.querySelector<HTMLButtonElement>('#verified-build-uplink');
    if (!button || button.disabled) return;
    this.busy = true;
    this.status = 'CONFIRMING BUILD';
    this.showStatus();
    this.renderCargo();
    try {
      await this.controller.buildUplink();
      if (!this.active) return;
      this.status = 'MARKET UPLINK ONLINE';
      this.showStatus();
    } catch (error) {
      if (this.active) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('ACCESS_REQUIRED')) this.status = 'RETURN NEAR SHIP';
        else if (message.includes('INSUFFICIENT_ORE')) { await this.reloadAfterRejected('MATERIALS CHANGED · STATE REFRESHED'); return; }
        else { this.stop(error); return; }
        this.showStatus();
      }
    } finally {
      this.busy = false;
      if (this.active) this.renderCargo();
    }
  }

  private renderShell(): void {
    this.host.innerHTML = `<section class="modal verified-modal" role="dialog" aria-modal="true" aria-label="Verified Online mining">
      <div class="verified-top"><div><span class="eyebrow">ORE FRONTIER / VERIFIED ONLINE</span><h2 id="verified-title">Mining expedition</h2></div><button id="verified-exit">RETURN TO LOCAL</button></div>
      <div class="verified-readouts"><span id="verified-status" role="status">CONNECTING</span><span id="verified-depth">0 M</span><span id="verified-ship">SHIP 0/50</span><span id="verified-Kredits">0.00 KREDITS</span><span id="verified-cargo">EMPTY HOLD</span></div>
      <canvas id="verified-world" aria-label="Canonical online mining world"></canvas>
      <div class="verified-controls" aria-label="Mining controls"><button data-control="left">◀ LEFT</button><button data-control="down">▼ DRILL</button><button data-control="right">RIGHT ▶</button><button data-control="up">▲ UP</button></div>
      <div id="verified-cargo-view" class="verified-cargo-view" hidden><div class="verified-cargo-title"><b>MOVE EARNED ORE</b><button id="verified-cargo-back">BACK TO MINING</button></div><div class="verified-cargo-choice"><button id="verified-transfer-source">MINER → SHIP</button><div><button id="verified-ore-prev" aria-label="Previous ore">◀</button><strong id="verified-transfer-ore">COPPER</strong><button id="verified-ore-next" aria-label="Next ore">▶</button></div></div><div class="verified-cargo-quantity"><span id="verified-transfer-stock">SOURCE 0 · ROOM 0</span><div><button id="verified-transfer-minus" aria-label="Remove half ore">−</button><b id="verified-transfer-amount">0.5 ORE</b><button id="verified-transfer-plus" aria-label="Add half ore">+</button></div></div><button id="verified-transfer" class="primary">TRANSFER ORE</button><button id="verified-build-uplink">BUILD MARKET UPLINK · 4 CU / 4 FE / 2 AG</button><button id="verified-open-sale" hidden>SELL TO CIVILIANS</button><button id="verified-open-service">RECHARGE & REPAIR</button><button id="verified-open-upgrade">RIG UPGRADES</button></div>
      <div id="verified-sale-view" class="verified-sale-view" hidden><div class="verified-sale-title"><b>SELL TO CIVILIANS</b><button id="verified-sale-back">BACK TO CARGO</button></div><div class="verified-sale-summary"><span id="verified-sale-source">MINER · COPPER</span><span id="verified-sale-wallet">KREDITS 0</span></div><div class="verified-sale-buyers" role="group" aria-label="Civilian buyer">${CIVILISATION_KEYS.map(buyer => `<button data-civilian-buyer="${buyer}" aria-pressed="${buyer === this.saleBuyer}">${CIVILISATIONS[buyer].name}</button>`).join('')}</div><div class="verified-sale-quantity"><button id="verified-sale-minus" aria-label="Remove half ore from sale">−</button><b id="verified-sale-amount">0.5 ORE</b><button id="verified-sale-plus" aria-label="Add half ore to sale">+</button></div><div class="verified-sale-offer"><output id="verified-sale-offer">NO CONFIRMED OFFER</output><small id="verified-sale-notice" role="status">Check a server offer before selling.</small></div><div class="verified-sale-actions"><button id="verified-sale-quote">CHECK SERVER OFFER</button><button id="verified-sale-confirm" class="primary" disabled>CONFIRM CIVILIAN SALE</button></div></div>
      <div id="verified-service-view" class="verified-service-view" hidden><div class="verified-service-title"><b>SHIP SERVICE BAY</b><button id="verified-service-back">BACK TO CARGO</button></div><div class="verified-service-items"><article><b id="verified-service-fuel">BATTERY</b><button id="verified-service-recharge">RECHARGE · FREE</button></article><article><b id="verified-service-hull">HULL</b><button id="verified-service-repair">REPAIR HULL</button></article></div><div class="verified-service-bottom"><span id="verified-service-wallet">0.00 KREDITS AVAILABLE</span><button id="verified-service-both" class="primary">RECHARGE & REPAIR</button><small>Dock near the landed ship. The server checks condition and cost at confirmation.</small></div></div>
      <div id="verified-upgrade-view" class="verified-upgrade-view" hidden><div class="verified-upgrade-title"><b>RIG WORKSHOP</b><button id="verified-upgrade-back">BACK TO CARGO</button></div><div class="verified-upgrade-keys" role="group" aria-label="Basic rig upgrades">${ONLINE_BASIC_UPGRADES.map(key => `<button data-rig-upgrade="${key}" aria-pressed="${key===this.selectedUpgrade}">${UPGRADES[key].name}</button>`).join('')}</div><div class="verified-upgrade-detail"><b id="verified-upgrade-level">DRILL · LEVEL 1 / 5</b><span id="verified-upgrade-effect">1 → 1.5</span><span id="verified-upgrade-cost">MINER + SHIP MATERIALS</span></div><button id="verified-upgrade-install" class="primary">INSTALL UPGRADE</button></div>
      <div class="verified-actions"><span id="verified-control-hint">WASD or arrow keys · hold S to drill</span><button id="verified-cargo-open">CARGO</button><button id="verified-travel" hidden>JUMP TO MARS</button><button id="verified-recover" hidden>RECOVER POD</button><button id="verified-retry" hidden>RETRY</button><button id="verified-refresh" hidden>REFRESH STATE</button><button id="verified-takeover" hidden>TAKE OVER SESSION</button></div>
    </section>`;
    this.host.querySelector<HTMLButtonElement>('#verified-exit')!.onclick = this.exit;
    this.host.querySelector<HTMLButtonElement>('#verified-retry')!.onclick = () => void this.retry();
    this.host.querySelector<HTMLButtonElement>('#verified-refresh')!.onclick = () => void this.refreshAfterStale();
    this.host.querySelector<HTMLButtonElement>('#verified-takeover')!.onclick = () => void this.takeover();
    this.host.querySelector<HTMLButtonElement>('#verified-recover')!.onclick = () => void this.recoverPod();
    this.host.querySelector<HTMLButtonElement>('#verified-cargo-open')!.onclick = () => this.setCargoOpen(true);
    this.host.querySelector<HTMLButtonElement>('#verified-travel')!.onclick = () => void this.travel();
    this.host.querySelector<HTMLButtonElement>('#verified-cargo-back')!.onclick = () => this.setCargoOpen(false);
    this.host.querySelector<HTMLButtonElement>('#verified-open-sale')!.onclick = () => this.setSaleOpen(true);
    this.host.querySelector<HTMLButtonElement>('#verified-sale-back')!.onclick = () => this.setSaleOpen(false);
    this.host.querySelector<HTMLButtonElement>('#verified-open-service')!.onclick = () => this.setServiceOpen(true);
    this.host.querySelector<HTMLButtonElement>('#verified-service-back')!.onclick = () => this.setServiceOpen(false);
    this.host.querySelector<HTMLButtonElement>('#verified-service-recharge')!.onclick = () => void this.servicePod('fuel');
    this.host.querySelector<HTMLButtonElement>('#verified-service-repair')!.onclick = () => void this.servicePod('hull');
    this.host.querySelector<HTMLButtonElement>('#verified-service-both')!.onclick = () => void this.servicePod('both');
    this.host.querySelector<HTMLButtonElement>('#verified-open-upgrade')!.onclick = () => this.setUpgradeOpen(true);
    this.host.querySelector<HTMLButtonElement>('#verified-upgrade-back')!.onclick = () => this.setUpgradeOpen(false);
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-rig-upgrade]')))
      button.onclick = () => { this.selectedUpgrade = button.dataset.rigUpgrade as OnlineBasicUpgrade;
        this.renderUpgrade(); };
    this.host.querySelector<HTMLButtonElement>('#verified-upgrade-install')!.onclick = () => void this.installUpgrade();
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-civilian-buyer]')))
      button.onclick = () => { this.saleBuyer = button.dataset.civilianBuyer as CivilisationId;
        this.saleQuote = null; this.renderSale(); };
    this.host.querySelector<HTMLButtonElement>('#verified-sale-minus')!.onclick = () => {
      this.transferQuantity--; this.saleQuote = null; this.renderSale();
    };
    this.host.querySelector<HTMLButtonElement>('#verified-sale-plus')!.onclick = () => {
      this.transferQuantity++; this.saleQuote = null; this.renderSale();
    };
    this.host.querySelector<HTMLButtonElement>('#verified-sale-quote')!.onclick = () => void this.checkCivilianOffer();
    this.host.querySelector<HTMLButtonElement>('#verified-sale-confirm')!.onclick = () => void this.confirmCivilianSale();
    this.host.querySelector<HTMLButtonElement>('#verified-transfer-source')!.onclick = () => {
      this.transferSource = this.transferSource === 'miner' ? 'ship' : 'miner';
      this.transferQuantity = 1;
      this.renderCargo();
    };
    for (const [id, step] of [['verified-ore-prev', -1], ['verified-ore-next', 1]] as const)
      this.host.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => {
        this.selectedOre = ORE_KEYS[(ORE_KEYS.indexOf(this.selectedOre) + step + ORE_KEYS.length) % ORE_KEYS.length];
        this.transferQuantity = 1;
        this.renderCargo();
      };
    this.host.querySelector<HTMLButtonElement>('#verified-transfer-minus')!.onclick = () => { this.transferQuantity--; this.renderCargo(); };
    this.host.querySelector<HTMLButtonElement>('#verified-transfer-plus')!.onclick = () => { this.transferQuantity++; this.renderCargo(); };
    this.host.querySelector<HTMLButtonElement>('#verified-transfer')!.onclick = () => void this.transferOre();
    this.host.querySelector<HTMLButtonElement>('#verified-build-uplink')!.onclick = () => void this.buildUplink();
    for (const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-control]'))) {
      const control = button.dataset.control as keyof OnlineControls;
      button.onpointerdown = (event: PointerEvent) => { event.preventDefault(); button.setPointerCapture(event.pointerId); this.held.add(control); };
      button.onpointerup = () => { this.held.delete(control); };
      button.onpointercancel = () => { this.held.delete(control); };
      button.onlostpointercapture = () => { this.held.delete(control); };
    }
  }

  private draw(): void {
    const state: OnlineGameState | null = this.controller.state;
    const canvas = this.host.querySelector<HTMLCanvasElement>('#verified-world');
    if (!state || !canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#09161b';
    context.fillRect(0, 0, width, height);
    const snapshot = state.snapshot;
    const world = new TileWorld(snapshot.world_seed, snapshot.destroyed_cells, [],
      state.active_planet as MapId, STARTER_PLANET_CHART);
    world.miningOnly = true;
    const tilePx = Math.max(19, Math.min(34, width / 10));
    const midX = width / 2, midY = height * 0.38;
    const left = Math.floor(snapshot.pod.x / WORLD.tile - midX / tilePx) - 1;
    const right = Math.ceil(snapshot.pod.x / WORLD.tile + midX / tilePx) + 1;
    const top = Math.floor(snapshot.pod.y / WORLD.tile - midY / tilePx) - 1;
    const bottom = Math.ceil(snapshot.pod.y / WORLD.tile + (height - midY) / tilePx) + 1;
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const tile = world.get(col, row);
      if (tile.type === 'empty') continue;
      const x = midX + (col * WORLD.tile - snapshot.pod.x) / WORLD.tile * tilePx;
      const y = midY + (row * WORLD.tile - snapshot.pod.y) / WORLD.tile * tilePx;
      context.fillStyle = tile.ore ? '#b77445' : tile.type === 'hard' ? '#606971' : '#35545a';
      context.fillRect(x, y, tilePx + 0.5, tilePx + 0.5);
      context.strokeStyle = '#142b2f';
      context.strokeRect(x, y, tilePx, tilePx);
    }
    context.fillStyle = '#f4cc7b';
    context.beginPath();
    context.moveTo(midX, midY - 11);
    context.lineTo(midX - 9, midY + 9);
    context.lineTo(midX + 9, midY + 9);
    context.closePath();
    context.fill();
    this.showStatus();
  }
}
