import { ONLINE_RULESET } from '../config';
import type { InputSegment, SubmitGameCommands } from './GameProtocol';
import {
  claimVerifiedSession, readVerifiedGameState, submitVerifiedControls,
  transferVerifiedOre, buildVerifiedMarketUplink,
  quoteVerifiedCivilianSale, sellVerifiedOreToCivilian,
  serviceVerifiedPod,
  installVerifiedRigUpgrade,
  recoverVerifiedStrandedPod,
  travelVerifiedCampaign,
  type OnlineGameState, type OnlineTransferReceipt, type OnlineBuildReceipt,
  type OnlineCivilianQuote, type OnlineCivilianSaleReceipt, type OnlinePodServiceReceipt,
  type OnlineUpgradeReceipt, type OnlineRecoveryReceipt, type OnlineTravelReceipt,
} from './VerifiedGameApi';
import type { CivilisationId, OnlineBasicUpgrade, Ore } from '../config';

export type OnlineControls = Pick<InputSegment, 'left' | 'right' | 'up' | 'down' | 'drill'>;
export type VerifiedGameTransport = {
  claim: typeof claimVerifiedSession;
  read: typeof readVerifiedGameState;
  submit: typeof submitVerifiedControls;
  transfer: typeof transferVerifiedOre;
  buildUplink: typeof buildVerifiedMarketUplink;
  quoteCivilian: typeof quoteVerifiedCivilianSale;
  sellCivilian: typeof sellVerifiedOreToCivilian;
  servicePod: typeof serviceVerifiedPod;
  installUpgrade: typeof installVerifiedRigUpgrade;
  recoverPod: typeof recoverVerifiedStrandedPod;
  travel?: typeof travelVerifiedCampaign;
};

const defaultTransport: VerifiedGameTransport = {
  claim: claimVerifiedSession,
  read: readVerifiedGameState,
  submit: submitVerifiedControls,
  transfer: transferVerifiedOre,
  buildUplink: buildVerifiedMarketUplink,
  quoteCivilian: quoteVerifiedCivilianSale,
  sellCivilian: sellVerifiedOreToCivilian,
  servicePod: serviceVerifiedPod,
  installUpgrade: installVerifiedRigUpgrade,
  recoverPod: recoverVerifiedStrandedPod,
  travel: travelVerifiedCampaign,
};

type TransferRequest = Parameters<typeof transferVerifiedOre>[0];
type BuildRequest = Parameters<typeof buildVerifiedMarketUplink>[0];
type CivilianSaleRequest = Parameters<typeof sellVerifiedOreToCivilian>[0];
type PodServiceRequest = Parameters<typeof serviceVerifiedPod>[0];
type UpgradeRequest = Parameters<typeof installVerifiedRigUpgrade>[0];
type RecoveryRequest = Parameters<typeof recoverVerifiedStrandedPod>[0];
type TravelRequest = Parameters<typeof travelVerifiedCampaign>[0];
const rejectedWithoutCommit = (error: unknown) => error instanceof Error &&
  ['INSUFFICIENT_ORE', 'HOLD_FULL', 'ACCESS_REQUIRED', 'ALREADY_BUILT',
    'INVALID_COMMAND', 'OPERATION_CONFLICT', 'RULESET_MISMATCH', 'SESSION_CONFLICT',
    'INSUFFICIENT_CREDITS', 'NO_SERVICE_NEEDED', 'UPGRADE_MAXED',
    'RECOVERY_NOT_NEEDED', 'ROUTE_UNAVAILABLE', 'TRAVEL_ACCESS_REQUIRED',
    'INSUFFICIENT_CORE_FUEL']
    .some(code => error.message.includes(code));

/** One in-flight economic command. Never queue offline inputs or expose predicted ore. */
export class VerifiedGameController {
  readonly sessionId = crypto.randomUUID();
  state: OnlineGameState | null = null;
  pending: SubmitGameCommands | null = null;
  pendingTransfer: TransferRequest | null = null;
  pendingBuild: BuildRequest | null = null;
  pendingSale: CivilianSaleRequest | null = null;
  pendingService: PodServiceRequest | null = null;
  pendingUpgrade: UpgradeRequest | null = null;
  pendingRecovery: RecoveryRequest | null = null;
  pendingTravel: TravelRequest | null = null;
  lastSaleReceipt: OnlineCivilianSaleReceipt | null = null;
  lastServiceReceipt: OnlinePodServiceReceipt | null = null;
  lastUpgradeReceipt: OnlineUpgradeReceipt | null = null;
  lastRecoveryReceipt: OnlineRecoveryReceipt | null = null;
  stale = false;
  private campaignId: string | null = null;

  constructor(private readonly transport = defaultTransport) {}

  async open(campaignId: string, takeover = false): Promise<OnlineGameState> {
    await this.transport.claim(campaignId, this.sessionId, takeover);
    const state = await this.transport.read(campaignId);
    if (state.campaign_id !== campaignId || state.ruleset_version !== ONLINE_RULESET)
      throw new Error('INVALID_STATE');
    this.campaignId = campaignId;
    this.state = state;
    this.pending = null;
    this.pendingTransfer = null;
    this.pendingBuild = null;
    this.pendingSale = null;
    this.pendingService = null;
    this.pendingUpgrade = null;
    this.pendingRecovery = null;
    this.pendingTravel = null;
    this.lastSaleReceipt = null;
    this.lastServiceReceipt = null;
    this.lastUpgradeReceipt = null;
    this.lastRecoveryReceipt = null;
    this.stale = false;
    return state;
  }

  async submit(controls: OnlineControls, durationMs = 200): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingTransfer || this.pendingBuild || this.pendingSale || this.pendingService || this.pendingUpgrade || this.pendingRecovery)
      throw new Error('OPERATION_PENDING');
    if (this.pending) return this.retry();
    if (!this.state || !this.campaignId) throw new Error('INVALID_STATE');
    const segment: InputSegment = {
      sequence: this.state.snapshot.last_sequence + 1,
      duration_ms: durationMs,
      ...controls,
      aim_cell: null,
    };
    this.pending = {
      campaign_id: this.campaignId,
      ruleset_version: ONLINE_RULESET,
      expected_revision: this.state.revision,
      operation_id: crypto.randomUUID(),
      session_id: this.sessionId,
      segments: [segment],
    };
    return this.retry();
  }

  async transfer(source: 'miner' | 'ship', ore: Ore, quantityHalfUnits: number): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingTransfer) return this.retryTransfer();
    if (this.pending || this.pendingBuild || this.pendingSale || this.pendingService || this.pendingUpgrade || this.pendingRecovery || !this.state || !this.campaignId)
      throw new Error('OPERATION_PENDING');
    if (!Number.isSafeInteger(quantityHalfUnits) || quantityHalfUnits < 1 || quantityHalfUnits > 100)
      throw new Error('INVALID_COMMAND');
    this.pendingTransfer = {
      campaign_id: this.campaignId,
      expected_revision: this.state.revision,
      operation_id: crypto.randomUUID(),
      session_id: this.sessionId,
      source,
      target: source === 'miner' ? 'ship' : 'miner',
      ore,
      quantity_half_units: quantityHalfUnits,
    };
    return this.retryTransfer();
  }

  async retryTransfer(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingTransfer;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlineTransferReceipt;
    try {
      receipt = await this.transport.transfer(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingTransfer = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'transfer_ore' ||
      receipt.revision !== command.expected_revision + 1 ||
      receipt.source !== command.source || receipt.target !== command.target ||
      receipt.ore !== command.ore || receipt.quantity_half_units !== command.quantity_half_units)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision)
      throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingTransfer = null;
    return state;
  }

  async buildUplink(): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingBuild) return this.retryBuildUplink();
    if (this.pending || this.pendingTransfer || this.pendingSale || this.pendingService || this.pendingUpgrade || this.pendingRecovery || !this.state || !this.campaignId)
      throw new Error('OPERATION_PENDING');
    this.pendingBuild = {
      campaign_id: this.campaignId,
      expected_revision: this.state.revision,
      operation_id: crypto.randomUUID(),
      session_id: this.sessionId,
    };
    return this.retryBuildUplink();
  }

  async retryBuildUplink(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingBuild;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlineBuildReceipt;
    try {
      receipt = await this.transport.buildUplink(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingBuild = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'build_market_uplink' ||
      receipt.revision !== command.expected_revision + 1)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      !state.market_uplink_online) throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingBuild = null;
    return state;
  }

  async quoteCivilian(source: 'miner' | 'ship', buyer: CivilisationId, ore: Ore,
    quantityHalfUnits: number): Promise<OnlineCivilianQuote> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale || this.pending || this.pendingTransfer || this.pendingBuild || this.pendingSale || this.pendingService || this.pendingUpgrade || this.pendingRecovery ||
      !this.state || !this.campaignId) throw new Error('OPERATION_PENDING');
    if (!Number.isSafeInteger(quantityHalfUnits) || quantityHalfUnits < 1 || quantityHalfUnits > 100)
      throw new Error('INVALID_COMMAND');
    const offer = await this.transport.quoteCivilian({ campaign_id: this.campaignId,
      source, buyer, ore, quantity_half_units: quantityHalfUnits });
    if (!offer || offer.campaign_id !== this.campaignId || offer.revision !== this.state.revision ||
      offer.source !== source || offer.buyer !== buyer || offer.ore !== ore ||
      offer.quantity_half_units !== quantityHalfUnits ||
      !Number.isSafeInteger(offer.total_credit_minor) || offer.total_credit_minor <= 0)
      throw new Error('STALE_REVISION');
    return offer;
  }

  async sellCivilian(source: 'miner' | 'ship', buyer: CivilisationId, ore: Ore,
    quantityHalfUnits: number): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingSale) return this.retrySale();
    if (this.pending || this.pendingTransfer || this.pendingBuild || this.pendingService || this.pendingUpgrade || this.pendingRecovery || !this.state || !this.campaignId)
      throw new Error('OPERATION_PENDING');
    if (!Number.isSafeInteger(quantityHalfUnits) || quantityHalfUnits < 1 || quantityHalfUnits > 100)
      throw new Error('INVALID_COMMAND');
    this.pendingSale = { campaign_id: this.campaignId,
      expected_revision: this.state.revision,
      operation_id: crypto.randomUUID(), session_id: this.sessionId,
      source, buyer, ore, quantity_half_units: quantityHalfUnits };
    return this.retrySale();
  }

  async retrySale(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingSale;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlineCivilianSaleReceipt;
    try {
      receipt = await this.transport.sellCivilian(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error) || error instanceof Error && error.message.includes('CREDIT_LIMIT'))
        this.pendingSale = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'sell_to_civilian' ||
      receipt.revision !== command.expected_revision + 1 ||
      receipt.source !== command.source || receipt.buyer !== command.buyer ||
      receipt.ore !== command.ore || receipt.quantity_half_units !== command.quantity_half_units ||
      !Number.isSafeInteger(receipt.total_credit_minor) || receipt.total_credit_minor <= 0)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision)
      throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingSale = null;
    this.lastSaleReceipt = receipt;
    return state;
  }

  async servicePod(serviceKind: 'fuel' | 'hull' | 'both'): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingService) return this.retryService();
    if (this.pending || this.pendingTransfer || this.pendingBuild || this.pendingSale || this.pendingUpgrade || this.pendingRecovery ||
      !this.state || !this.campaignId) throw new Error('OPERATION_PENDING');
    this.pendingService = { campaign_id: this.campaignId,
      expected_revision: this.state.revision, operation_id: crypto.randomUUID(),
      session_id: this.sessionId, service_kind: serviceKind };
    return this.retryService();
  }

  async retryService(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingService;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlinePodServiceReceipt;
    try {
      receipt = await this.transport.servicePod(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingService = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'service_pod' ||
      receipt.service_kind !== command.service_kind ||
      receipt.revision !== command.expected_revision + 1 ||
      !Number.isSafeInteger(receipt.cost_minor) || receipt.cost_minor < 0)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      (state.revision === receipt.revision &&
        (state.credit_minor !== receipt.wallet_after_minor ||
         state.snapshot.fuel_milli !== receipt.fuel_after_milli ||
         state.snapshot.hull_milli !== receipt.hull_after_milli))) throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingService = null;
    this.lastServiceReceipt = receipt;
    return state;
  }

  async installUpgrade(key: OnlineBasicUpgrade): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingUpgrade) return this.retryUpgrade();
    if (this.pending || this.pendingTransfer || this.pendingBuild || this.pendingSale ||
      this.pendingService || this.pendingRecovery || !this.state || !this.campaignId) throw new Error('OPERATION_PENDING');
    this.pendingUpgrade = { campaign_id: this.campaignId,
      expected_revision: this.state.revision, operation_id: crypto.randomUUID(),
      session_id: this.sessionId, upgrade_key: key };
    return this.retryUpgrade();
  }

  async retryUpgrade(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingUpgrade;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlineUpgradeReceipt;
    try {
      receipt = await this.transport.installUpgrade(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingUpgrade = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id ||
      receipt.kind !== 'install_rig_upgrade' ||
      receipt.upgrade_key !== command.upgrade_key ||
      receipt.revision !== command.expected_revision+1 ||
      receipt.level_after !== receipt.level_before+1)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      (state.revision === receipt.revision &&
        (state.snapshot.levels[command.upgrade_key] !== receipt.level_after ||
         state.snapshot.fuel_milli !== receipt.fuel_after_milli ||
         state.snapshot.hull_milli !== receipt.hull_after_milli))) throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingUpgrade = null;
    this.lastUpgradeReceipt = receipt;
    return state;
  }

  async recoverStrandedPod(): Promise<OnlineGameState> {
    if (this.pendingTravel) throw new Error('OPERATION_PENDING');
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingRecovery) return this.retryRecovery();
    if (this.pending || this.pendingTransfer || this.pendingBuild || this.pendingSale ||
      this.pendingService || this.pendingUpgrade || !this.state || !this.campaignId)
      throw new Error('OPERATION_PENDING');
    if (this.state.snapshot.fuel_milli > 0 && this.state.snapshot.hull_milli > 0)
      throw new Error('RECOVERY_NOT_NEEDED');
    this.pendingRecovery = { campaign_id: this.campaignId,
      expected_revision: this.state.revision, operation_id: crypto.randomUUID(),
      session_id: this.sessionId };
    return this.retryRecovery();
  }

  async retryRecovery(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingRecovery;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: OnlineRecoveryReceipt;
    try {
      receipt = await this.transport.recoverPod(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingRecovery = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'recover_stranded_pod' ||
      receipt.revision !== command.expected_revision + 1 ||
      !Number.isSafeInteger(receipt.wallet_after_minor) || receipt.wallet_after_minor < 0)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      (state.revision === receipt.revision &&
        (state.credit_minor !== receipt.wallet_after_minor ||
         state.snapshot.fuel_milli !== receipt.fuel_after_milli ||
         state.snapshot.hull_milli !== receipt.hull_after_milli ||
         Object.values(state.snapshot.cargo_half_units).some(amount => Number(amount) > 0))))
      throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingRecovery = null;
    this.lastRecoveryReceipt = receipt;
    return state;
  }

  async travel(destination: 'cryo-shelf' | 'mars-frontier'): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    if (this.pendingTravel) return this.retryTravel();
    if (this.pending || this.pendingTransfer || this.pendingBuild || this.pendingSale ||
      this.pendingService || this.pendingUpgrade || this.pendingRecovery ||
      !this.state || !this.campaignId) throw new Error('OPERATION_PENDING');
    if (destination === this.state.active_planet) throw new Error('ROUTE_UNAVAILABLE');
    this.pendingTravel = {
      campaign_id: this.campaignId, expected_revision: this.state.revision,
      operation_id: crypto.randomUUID(), session_id: this.sessionId, destination,
    };
    return this.retryTravel();
  }

  async retryTravel(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pendingTravel;
    if (!command || !this.transport.travel) throw new Error('INVALID_STATE');
    let receipt: OnlineTravelReceipt;
    try {
      receipt = await this.transport.travel(command);
    } catch (error) {
      if (error instanceof Error && error.message.includes('STALE_REVISION')) this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pendingTravel = null;
      throw error;
    }
    if (!receipt || receipt.operation_id !== command.operation_id ||
      receipt.campaign_id !== command.campaign_id || receipt.kind !== 'travel' ||
      receipt.revision !== command.expected_revision + 1 ||
      receipt.destination !== command.destination ||
      !Number.isSafeInteger(receipt.core_fuel_after) || receipt.core_fuel_after < 0)
      throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      (state.revision === receipt.revision &&
        (state.active_planet !== receipt.destination ||
         state.snapshot.core_fuel !== receipt.core_fuel_after))) throw new Error('INVALID_STATE');
    this.state = state;
    this.pendingTravel = null;
    return state;
  }

  async retry(): Promise<OnlineGameState> {
    if (this.stale) throw new Error('STALE_REVISION');
    const command = this.pending;
    if (!command) throw new Error('INVALID_STATE');
    let receipt: { revision?: unknown; last_sequence?: unknown };
    try {
      receipt = await this.transport.submit(command) as { revision?: unknown; last_sequence?: unknown };
    } catch (error) {
      if (error instanceof Error && error.message === 'STALE_REVISION') this.stale = true;
      else if (rejectedWithoutCommit(error)) this.pending = null;
      throw error;
    }
    if (!receipt || receipt.revision !== command.expected_revision + 1 ||
      receipt.last_sequence !== command.segments[0].sequence) throw new Error('INVALID_STATE');
    const state = await this.transport.read(command.campaign_id);
    if (state.campaign_id !== command.campaign_id || state.revision < receipt.revision ||
      state.snapshot.last_sequence < receipt.last_sequence) throw new Error('INVALID_STATE');
    this.state = state;
    this.pending = null;
    this.pendingTransfer = null;
    this.pendingBuild = null;
    this.pendingSale = null;
    this.pendingService = null;
    this.pendingUpgrade = null;
    this.pendingRecovery = null;
    this.pendingTravel = null;
    this.stale = false;
    return state;
  }

  /** Only a definitive stale rejection proves the pending operation did not commit. */
  async refreshAfterStale(): Promise<OnlineGameState> {
    if (!this.stale || !this.campaignId) throw new Error('INVALID_STATE');
    await this.transport.claim(this.campaignId, this.sessionId, false);
    const state = await this.transport.read(this.campaignId);
    if (state.campaign_id !== this.campaignId || state.ruleset_version !== ONLINE_RULESET)
      throw new Error('INVALID_STATE');
    this.state = state;
    this.pending = null;
    this.pendingTransfer = null;
    this.pendingBuild = null;
    this.pendingSale = null;
    this.pendingService = null;
    this.pendingUpgrade = null;
    this.pendingRecovery = null;
    this.pendingTravel = null;
    this.stale = false;
    return state;
  }
}
