import Phaser from 'phaser';
import { CORE, CORE_FUEL, PLANET_CHART, STARTER_PLANET_CHART, LEGACY_PLANET_CHART, TRADE_NETWORK, SURFACE_RAID, WORLD, FUEL, PHYSICS, ORES, ORE_SILHOUETTES, CORE_RELICS, vesperChapterUnlocked, REGION_FINDS, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, ESCAPE_SUIT, ROCK_SWIMMER, SHARD_MANTA, HULL_SCRAPPER, POD_PAINTS, PILOT_SUITS, POD_DECALS, POD_PROFILES, SPECIALIZATIONS, UNDERGROUND_BUILDING, estimateVerticalReturnFuel, estimateWinchReturnFuel, depthAtWorldY, farHemisphereAfterCoreExit, fallCameraLookAhead, fallMotionCueIntensity, surfaceYAt, surfaceDockYAt, CAMPAIGN_MILESTONES, ROUTE_FRAGMENTS, ROUTE_SHIP_COMPONENTS, ROUTE_PART_RECOVERY_BONUS, SHIP_COMPONENTS, NAVIGATION_HASHES, MAPS, drillPreviewDimensions, drillReachTiles, drillVisualTier, podVisualScale, type MapId, type Ore, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from './config';
import { TileWorld, keyOf, random, type Tile } from './world/TileWorld';
import { PlayerPod, type Controls } from './player/PlayerPod';
import { Progress, emptyCargo, type Cargo } from './economy/Progress';
import { tradeRouteEdges } from './economy/TradeNetwork';
import { transferWarehouseOre, type WarehouseDirection } from './economy/Warehouse';
import { buildSaleReceipt } from './economy/Sale';
import { advanceMarketDemand } from './economy/MarketContracts';
import { contributeCargoTug, contributeSurveyArray, contributeVesperRelay, CARGO_TUG_PROJECT, remoteWarehouseAccess, SURVEY_ARRAY_PROJECT, surveyScannerRadius, VESPER_RELAY_PROJECT } from './economy/SystemProjects';
import { MiningSystem, aimedDrillTarget, effectiveDrillReach, pointerDrillDirection, drillProtection, directionalDrillOrientation, chargeTargets, collectOreDrop, podWithinPickupReach, applySalvageMagnet, hasClearMagnetPath, updateOreDropPhysics, updateChargePhysics } from './mining/MiningSystem';
import { advanceLaserThermal, drillImpactProfile, type DrillParticleKind, type LaserThermalState } from './mining/DrillEffects';
import { SaveManager, type SaveData, type WorldSave, type OreDrop, type ActiveCharge } from './save/SaveManager';
import { AudioSystem } from './audio/AudioSystem';
import { HUD } from './ui/HUD';
import { getDialogFocusables } from './ui/focus';
import { STATIONS, TOWN_TIER_HEIGHTS, MAX_TOWN_ALTITUDE, atSurface, dockedOnSurface, onPlanetSurface, surfaceGroundY, surfaceTownTier } from './surface/SurfaceStation';
import { drawPlanetSurfaceOutpost, drawSurfaceTown } from './surface/SurfaceTown';
import { drawSurfaceLandmarks, surfaceLandmarkColor, surfaceLandmarks, type SurfaceLandmark } from './surface/PlanetScenery';
import { restoreMapState, snapshotMapState } from './campaign/MapState';
import { emergencyRecoveryDock } from './campaign/Recovery';
import { isInOrbit, orbitAltitude, orbitalParkingY } from './campaign/Orbit';
import { findSurfaceWinchRoute, type WinchPoint } from './campaign/WinchRoute';
import { collectCoreRelic, crewArchiveRestored } from './campaign/Records';
import { RockSwimmer } from './world/RockSwimmer';
import { SurfaceRaid } from './world/SurfaceRaid';
import { CaveAtmosphere } from './world/CaveAtmosphere';
import { advanceOrbitalTransition, cameraAngleDelta, cameraFocusY, cameraUnzoomPoint, cameraZoomPoint, crossedPlanetCore, GLOBE_HANDOFF_ZOOM, orbitalOverviewMinZoom, planetCameraFrameAngle } from './world/Projection';
import { planetCartesianToChart, planetCartesianVectorToWorld, planetChartLocalOffset, planetChartToCartesian, planetChartVectorToCartesian, planetTileDecorationScale, wrapPlanetTile } from './world/PlanetChart';
import type { PlanetChartSize } from './world/PlanetChart';
import { canAffordStructure, findBuildSite, findSurfaceBarrierSite, findSurfaceHabitatSite, findSurfaceTradePostSite, findSurfaceTurretSite, findSurfaceWarehouseSite, globeSurfaceDistance, nearbyGlobeSurfaceStructure, nearbyServiceStation, repairSurfaceStructure, surfaceArcCoordinate, surfaceArcPoint, validateSurfaceStructureSite, type StructureKind, type SurfaceStructureKind, type UndergroundStructure } from './building/UndergroundStructures';
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  size: number;
  kind?: DrillParticleKind;
  rotation?: number;
  rotationSpeed?: number;
};
export class MiningScene extends Phaser.Scene {
  world!: TileWorld;
  mapId: MapId = 'cryo-shelf';
  campaignChart: PlanetChartSize = STARTER_PLANET_CHART;
  failureReason: 'fuel' | 'hull' | 'impact' = 'impact';
  stranded = false;
  private winchRouteCache?: { world: TileWorld; x: number; y: number; destroyed: number; structureCount: number; route?: WinchPoint[] };
  private pendingPositionNotice = false;
  private pendingPositionWarning = false;
  campaignSeed = 0;
  mapStates: Partial<Record<MapId, WorldSave>> = {};
  structures: UndergroundStructure[] = [];
  surfaceFeatures: SurfaceLandmark[] = [];
  warehouseCargo: Cargo = emptyCargo();
  oreDrops: OreDrop[] = [];
  activeCharge?: ActiveCharge;
  pod!: PlayerPod;
  progress = new Progress();
  mining!: MiningSystem;
  aimTile?: Tile;
  mouseAimActive = false;
  drillAimX = 0;
  drillAimY = 1;
  drillRecoil = 0;
  laserThermal: LaserThermalState = { heat: 0, vent: 0 };
  rockSwimmer!: RockSwimmer;
  surfaceRaid!: SurfaceRaid;
  surfacePlacement?: { kind: SurfaceStructureKind; x: number; y: number };
  saves = new SaveManager();
  soundFx = new AudioSystem();
  ui!: HUD;
  g!: Phaser.GameObjects.Graphics;
  orbitG!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  labels: Phaser.GameObjects.Text[] = [];
  shipStatusLabel!: Phaser.GameObjects.Text;
  mothershipBoarded = false;
  buildPlacementLabel!: Phaser.GameObjects.Text;
  cameraFlipLabel!: Phaser.GameObjects.Text;
  orbitalLabel!: Phaser.GameObjects.Text;
  landmarkLabels = new Map<string, Phaser.GameObjects.Text>();
  floating: { text: Phaser.GameObjects.Text; x: number; y: number; life: number }[] = [];
  particles: Particle[] = [];
  atmosphere = new CaveAtmosphere();
  camX = 0;
  camY = -300;
  cameraFlip = 0;
  cameraFlipStart = 0;
  cameraFlipTarget = 0;
  cameraFlipElapsed = 0;
  planetFrameRotation = 0;
  cameraTurnLabelRemaining = 0;
  cameraLookAhead = 0;
  cameraZoom = 1;
  cameraZoomTarget = 1;
  orbitalOverviewActive = false;
  orbitalTransition = 0;
  globeViewRequested = false;
  hemisphereFar = false;
  readonly cameraFlipDuration = 1.15;
  tick = 0;
  saveClock = 0;
  uiClock = 0;
  wasSurface = true;
  warned = false;
  shake = 0;
  lastFullWarning = 0;
  landingHintShown = false;
  lastRevealWorld?: TileWorld;
  lastRevealX = -1;
  lastRevealY = -1;
  lastRevealRadius = -1;
  reducedMotion = false;
  motionQuery?: MediaQueryList;
  motionPreferenceChanged = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
    if (event.matches) {
      this.shake = 0;
      this.particles.length = 0;
      this.atmosphere.clear();
      this.cameraZoom = this.cameraZoomTarget;
    }
  };
  syncInput(paused: boolean) {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.resetKeys();
    keyboard.clearCaptures();
    if (!paused) keyboard.addCapture(['W', 'A', 'S', 'D', 'G', 'Q', 'R', 'M', 'UP', 'LEFT', 'DOWN', 'RIGHT', 'SPACE']);
  }
  get surfaceCameraY() {
    const baseView = Math.max(this.scale.height * 0.49, Math.min(365, this.scale.height * 0.67));
    const tier = surfaceTownTier(this.progress.shipComponents, this.progress.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id)));
    return -Math.max(baseView, Math.min(TOWN_TIER_HEIGHTS[tier] + 90, this.scale.height * 0.9));
  }
  get farHemisphere() {
    return this.hemisphereFar;
  }

  get viewRotation() {
    return this.world?.planetChart ? this.planetFrameRotation : this.cameraFlip * Math.PI;
  }

  get minimumCameraZoom() {
    const chart = this.world?.planetChart;
    return chart
      ? orbitalOverviewMinZoom(this.scale.width, this.scale.height, chart.radiusRows * WORLD.tile)
      : 0.018;
  }

  updatePlanetCameraFrame(dt: number) {
    const chart = this.world.planetChart;
    if (!chart) return;
    const target = planetCameraFrameAngle(this.pod.x / WORLD.tile, this.pod.y / WORLD.tile, chart);
    this.cameraTurnLabelRemaining = Math.max(0, this.cameraTurnLabelRemaining - dt);
    if (target === undefined) return;
    if (this.reducedMotion) {
      this.planetFrameRotation = target;
      return;
    }
    const delta = cameraAngleDelta(this.planetFrameRotation, target),
      maxStep = Math.PI * dt / this.cameraFlipDuration;
    this.planetFrameRotation += Math.max(-maxStep, Math.min(maxStep, delta));
  }

  flipCameraForHemisphere(far: boolean) {
    if (this.reducedMotion) {
      this.cameraFlip = this.cameraFlipStart = this.cameraFlipTarget = far ? 1 : 0;
      this.cameraFlipElapsed = this.cameraFlipDuration;
      return;
    }
    this.cameraFlipStart = this.cameraFlip;
    this.cameraFlipTarget = far ? 1 : 0;
    this.cameraFlipElapsed = 0;
  }

  updateCameraFlip(dt: number) {
    if (this.cameraFlip === this.cameraFlipTarget) return;
    this.cameraFlipElapsed = Math.min(this.cameraFlipDuration, this.cameraFlipElapsed + dt);
    const progress = this.cameraFlipElapsed / this.cameraFlipDuration;
    const eased = progress * progress * (3 - 2 * progress);
    this.cameraFlip = Phaser.Math.Linear(this.cameraFlipStart, this.cameraFlipTarget, eased);
    if (this.cameraFlipElapsed >= this.cameraFlipDuration) this.cameraFlip = this.cameraFlipTarget;
  }

  worldPointToScreen(x: number, y: number, width: number, height: number) {
    return cameraZoomPoint(this.worldPointToLocal(x, y, width, height), width, height, this.cameraZoom);
  }

  worldPointToLocal(x: number, y: number, width: number, height: number) {
    const angle = this.viewRotation, cos = Math.cos(angle), sin = Math.sin(angle);
    const cameraY = cameraFocusY(this.pod.y, this.cameraLookAhead, this.viewRotation);
    let dx = x - this.pod.x, dy = y - cameraY;
    if (this.world.planetChart) {
      const chart = this.world.planetChart, size = WORLD.tile;
      const point = planetChartToCartesian({ u: x / size, v: y / size }, chart.columns, chart.radiusRows, size);
      const camera = this.planetCameraFocus();
      dx = point.x - camera.x; dy = point.y - camera.y;
    }
    return {
      x: width / 2 + dx * cos - dy * sin,
      y: height / 2 + dx * sin + dy * cos,
    };
  }

  planetCameraFocus() {
    const chart = this.world.planetChart;
    if (!chart) return { x: this.pod.x, y: cameraFocusY(this.pod.y, this.cameraLookAhead, this.viewRotation) };
    const cameraY = cameraFocusY(this.pod.y, this.cameraLookAhead, this.viewRotation);
    const pod = planetChartToCartesian(
      { u: this.pod.x / WORLD.tile, v: cameraY / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile,
    );
    const orbit = Phaser.Math.SmoothStep(this.orbitalTransition, 0, 1);
    return { x: pod.x * (1 - orbit), y: pod.y * (1 - orbit) };
  }

  screenPointToWorld(x: number, y: number, width: number, height: number) {
    const angle = -this.viewRotation, cos = Math.cos(angle), sin = Math.sin(angle);
    const unzoomed = cameraUnzoomPoint({ x, y }, width, height, this.cameraZoom);
    const dx = unzoomed.x - width / 2, dy = unzoomed.y - height / 2;
    if (this.world.planetChart) {
      const angle = -this.viewRotation, cos = Math.cos(angle), sin = Math.sin(angle);
      const camera = this.planetCameraFocus();
      const chartPoint = planetCartesianToChart({
        x: camera.x + dx * cos - dy * sin,
        y: camera.y + dx * sin + dy * cos,
      }, this.world.planetChart.columns, this.world.planetChart.radiusRows, WORLD.tile);
      return { x: chartPoint.u * WORLD.tile, y: chartPoint.v * WORLD.tile };
    }
    return {
      x: this.pod.x + dx * cos - dy * sin,
      y: cameraFocusY(this.pod.y, this.cameraLookAhead, this.viewRotation) + dx * sin + dy * cos,
    };
  }

  constructor() {
    super('mine');
  }
  create() {
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.motionPreferenceChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.motionQuery?.removeEventListener('change', this.motionPreferenceChanged);
      this.motionQuery = undefined;
    });
    const saved = this.saves.load();
    if (saved) this.saves.restore(this.progress, saved);
    this.progress.pilotEscaping = saved?.pilotEscaping ?? false;
    this.mapId = saved?.activeMap ?? 'cryo-shelf';
    this.mapStates = saved?.maps ?? {};
    this.campaignChart = saved?.planetChart ?? STARTER_PLANET_CHART;
    this.campaignSeed = saved?.campaignSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    const savedMapState = this.mapStates[this.mapId];
    this.mothershipBoarded = saved?.mothershipBoarded ?? false;
    const mapState = restoreMapState(savedMapState, this.mapId, this.seedForMap(this.mapId), this.chartForUnvisitedMap(this.mapId));
    this.structures = mapState.structures;
    this.warehouseCargo = mapState.warehouse;
    this.oreDrops = mapState.drops;
    this.activeCharge = mapState.activeCharge;
    this.world = mapState.world;
    this.surfaceFeatures = surfaceLandmarks(this.world, this.mapId);
    this.rockSwimmer = new RockSwimmer(this.world.seed, this.mapId);
    this.surfaceRaid = new SurfaceRaid(this.world.seed, this.mapId);
    this.pod = new PlayerPod(this.world, this.progress);
    this.pod.structures = this.structures;
    if (savedMapState) {
      this.pod.x = savedMapState.x;
      this.pod.y = savedMapState.y;
      this.pod.docked = dockedOnSurface(savedMapState.x, savedMapState.y, this.world.planetChart);
      if (this.pod.docked) this.pod.y = savedMapState.y < this.world.coreWorldY ? WORLD.spawnY : this.world.farSurfaceY + 22;
      const restoredFrame = this.world.planetChart
        ? planetCameraFrameAngle(savedMapState.x / WORLD.tile, savedMapState.y / WORLD.tile, this.world.planetChart) ?? 0
        : 0;
      if (this.pod.overlaps(savedMapState.x, savedMapState.y, restoredFrame).length) {
        const safe = this.nearestClearPodPosition(savedMapState.x, savedMapState.y, restoredFrame);
        if (safe) {
          this.pod.x = safe.x;
          this.pod.y = safe.y;
          this.pod.docked = false;
          this.pendingPositionNotice = true;
        } else {
          // Never silently discard an underground save by resetting it to the
          // surface. A wide local search normally finds a clear pocket; if an
          // edited save is completely solid, keep its location visible for QA
          // and let the player choose recovery explicitly.
          this.pendingPositionWarning = true;
        }
      }
    }
    this.hemisphereFar = this.pod.y >= this.world.coreWorldY;
    this.cameraFlip = this.hemisphereFar ? 1 : 0;
    this.cameraFlipStart = this.cameraFlipTarget = this.cameraFlip;
    this.planetFrameRotation = this.world.planetChart
      ? planetCameraFrameAngle(this.pod.x / WORLD.tile, this.pod.y / WORLD.tile, this.world.planetChart) ?? (this.hemisphereFar ? Math.PI : 0)
      : this.cameraFlip * Math.PI;
    this.wasSurface = this.surface;
    this.mining = new MiningSystem(this.world, this.progress);
    this.ui = new HUD(
      this.progress,
      {
        start: () => {
          this.soundFx.unlock(this.depth);
          this.save();
          if (this.saves.warning) this.ui.toast(this.saves.warning);
        },
        pause: () => {
          if (this.ui.hasStarted && this.ui.modal) this.ui.close();
          else this.pause();
        },
        modeChanged: (paused) => this.syncInput(paused),
        serviceAll: () => {
          if (!this.canService) return false;
          const ok = this.progress.serviceAll();
          if (ok) {
            if (this.stranded) {
              this.stranded = false;
              this.ui.close();
            }
            this.soundFx.reward();
            this.save();
            this.ui.toast('Refueled and repaired. Ready to depart.');
          }
          return ok;
        },
        recoverStranded: () => {
          if (!this.stranded) return false;
          this.fail(true, this.failureReason);
          this.ui.close();
          return true;
        },
        resume: () => this.ui.close(),
        save: () => {
          this.save();
          this.ui.toast(this.saves.warning || 'Expedition saved. Your tunnels are here to stay.');
        },
        sell: (buyerMapId?: MapId) => {
          if (!this.sellAccess) return undefined;
          const oldCargo = { ...this.progress.cargo }, oldMoney = this.progress.money, oldMilestones = [...this.progress.milestones],
            hasLocalPost = !!nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'trade-post'),
            destination = hasLocalPost && buyerMapId && this.tradePostMaps().includes(buyerMapId) ? buyerMapId : this.mapId,
            localBuyer = hasLocalPost && destination === this.mapId,
            receipt = buildSaleReceipt(oldCargo, this.mapId, destination, oldMilestones, this.tradeNetworkCount(), hasLocalPost,
              hasLocalPost && this.tradePostMaps().includes(destination), oldMilestones.includes(VESPER_RELAY_PROJECT.completionMilestone));
          if (!receipt.total) return undefined;
          this.progress.claimMarketContract(this.mapId, localBuyer);
          this.progress.sell();
          this.progress.money += receipt.networkPremium + receipt.localDemandBonus;
          advanceMarketDemand(this.progress.milestones, destination, hasLocalPost && this.tradePostMaps().includes(destination), receipt.gross);
          if (!this.save()) {
            this.progress.cargo = oldCargo;
            this.progress.money = oldMoney;
            this.progress.milestones = oldMilestones;
            this.rememberCurrentMap();
            this.ui.toast('SALE NOT SAVED · CARGO AND ORDER RESTORED. TRY AGAIN.');
            return undefined;
          }
          {
            this.soundFx.reward();
            this.float(`+$${receipt.total}`, this.pod.x, this.pod.y - 45, '#f5ca78');
            this.burst(this.pod.x, this.pod.y, 0xf5ca78, 28);
            const rewards = [receipt.networkPremium ? `+$${receipt.networkPremium} LINKED-WORLD PREMIUM` : '', receipt.localDemandBonus ? `+$${receipt.localDemandBonus} ${MAPS[destination].shortName} DEMAND` : '', receipt.contractReward ? `+$${receipt.contractReward} PLANETARY ORDER` : ''].filter(Boolean).join(' · ');
            this.ui.toast(rewards ? `+$${receipt.total} banked · ${rewards}.` : `+$${receipt.total} banked. Mine a planetary core to fuel interplanetary jumps.`);
          }
          return receipt;
        },
        service: (k) => {
          if (!this.canService) return false;
          const ok = this.progress.service(k);
          if (ok) {
            this.soundFx.tone(330, 0.2, 'sine', 0.05, 660);
            this.ui.toast(
              k === 'fuel'
                ? 'Tank topped up. The deep is calling.'
                : 'Hull restored. Ready for a hard landing.',
            );
            this.save();
          }
          return ok;
        },
        buy: (k) => {
          if (!this.surface) return false;
          const ok = this.progress.buy(k);
          if (ok) {
            this.soundFx.reward();
            this.ui.toast(
              `${k.toUpperCase()} upgraded to level ${this.progress.levels[k]}. Make it count.`,
            );
            this.save();
          }
          return ok;
        },
        buyCharges: () => {
          if (!this.surface) return false;
          const ok = this.progress.buyCharges();
          if (ok) {
            this.soundFx.reward();
            this.ui.toast('Mining charges packed. Q deploys one below your pod.');
            this.save();
          }
          return ok;
        },
        buyMagnet: () => {
          if (!this.surface) return false;
          const ok = this.progress.buySalvageMagnet();
          if (ok) {
            this.soundFx.reward();
            this.ui.toast('Salvage magnet installed. Charge-freed ore will reel in through open tunnels.');
            this.save();
          }
          return ok;
        },
        buyStasis: () => {
          if (!this.surface) return false;
          const ok = this.progress.buyStasisModule();
          if (ok) {
            this.soundFx.reward();
            this.ui.toast('Stasis module installed. Hold X in the air to cancel gravity; it uses fuel.');
            this.save();
          }
          return ok;
        },
        buyReturnWinch: () => {
          if (!this.surface) return false;
          const ok = this.progress.buyReturnWinch();
          if (ok) {
            this.soundFx.reward();
            this.ui.toast('Surface winch installed. Hold R on a clear tunnel route to reel to the surface yard; watch your fuel.');
            this.save();
          }
          return ok;
        },
        buyEscapeSuit: () => {
          if (!this.surface || this.progress.pilotEscaping) return false;
          const ok = this.progress.buyEscapeSuit();
          if (ok) { this.soundFx.reward(); this.save(); }
          return ok;
        },
        buyPaint: (key: PodPaint) => {
          if (!this.surface) return false;
          const ok = this.progress.buyPaint(key);
          if (ok) { this.soundFx.reward(); this.ui.toast(`${POD_PAINTS[key].name} paint applied.`); this.save(); }
          return ok;
        },
        selectPaint: (key: PodPaint) => {
          if (!this.surface) return false;
          const ok = this.progress.selectPaint(key);
          if (ok) { this.soundFx.tone(520, 0.14, 'sine', 0.04, 760); this.ui.toast(`${POD_PAINTS[key].name} selected.`); this.save(); }
          return ok;
        },
        buySuit: (key: PilotSuit) => {
          if (!this.surface) return false;
          const ok = this.progress.buySuit(key);
          if (ok) { this.soundFx.reward(); this.ui.toast(`${PILOT_SUITS[key].name} equipped.`); this.save(); }
          return ok;
        },
        selectSuit: (key: PilotSuit) => {
          if (!this.surface) return false;
          const ok = this.progress.selectSuit(key);
          if (ok) { this.soundFx.tone(520, 0.14, 'sine', 0.04, 760); this.ui.toast(`${PILOT_SUITS[key].name} equipped.`); this.save(); }
          return ok;
        },
        buyDecal: (key: PodDecal) => {
          if (!this.surface) return false;
          const ok = this.progress.buyDecal(key);
          if (ok) { this.soundFx.reward(); this.ui.toast(`${POD_DECALS[key].name} applied.`); this.save(); }
          return ok;
        },
        selectDecal: (key: PodDecal) => {
          if (!this.surface) return false;
          const ok = this.progress.selectDecal(key);
          if (ok) { this.soundFx.tone(520, 0.14, 'sine', 0.04, 760); this.ui.toast(`${POD_DECALS[key].name} equipped.`); this.save(); }
          return ok;
        },
        buyProfile: (key: PodProfile) => {
          if (!this.surface) return false;
          const ok = this.progress.buyProfile(key);
          if (ok) { this.soundFx.reward(); this.ui.toast(`${POD_PROFILES[key].name} profile fitted.`); this.save(); }
          return ok;
        },
        selectProfile: (key: PodProfile) => {
          if (!this.surface) return false;
          const ok = this.progress.selectProfile(key);
          if (ok) { this.soundFx.tone(520, 0.14, 'sine', 0.04, 760); this.ui.toast(`${POD_PROFILES[key].name} profile fitted.`); this.save(); }
          return ok;
        },
        selectSpecialization: (key: Specialization) => {
          if (!this.surface) return false;
          const ok = this.progress.selectSpecialization(key);
          if (ok) {
            this.save();
            this.ui.toast(`${SPECIALIZATIONS[key].name} path selected for your next run.`);
          } else if (this.progress.count > this.progress.max('cargo')) {
            this.ui.toast('Sell enough cargo to switch to a smaller hold first.');
          }
          return ok;
        },
        buildStructure: (kind: StructureKind) => this.buildUndergroundStructure(kind),
        warehouseStock: (mapId) => ({ ...(mapId && mapId !== this.mapId ? this.mapStates[mapId]?.warehouse ?? emptyCargo() : this.warehouseCargo) }),
        warehouseMaps: () => this.warehouseMaps(),
        transferWarehouse: (ore, direction, units, mapId) => this.transferWarehouse(ore, direction, units, mapId),
        contributeSystemProject: () => this.contributeSystemProject(),
        contributeCargoTug: () => this.contributeCargoTug(),
        contributeSurveyArray: () => this.contributeSurveyArray(),
        atWarehouse: () => !!this.nearbyWarehouse,
        placementActive: () => !!this.surfacePlacement,
        structures: () => this.structures,
        tradeNetworkCount: () => this.tradeNetworkCount(),
        tradePostMaps: () => this.tradePostMaps(),
        hasTradePost: () => this.structures.some((entry) => entry.kind === 'trade-post'),
        atTradePost: () => !!nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'trade-post'),
        habitatCount: () => this.structures.filter((entry) => entry.kind === 'habitat').length,
        repairStructure: (id) => this.repairStructure(id),
        surfaceAccess: () => this.planetSurface,
        planetSurfaceAccess: () => this.planetSurface,
        sellAccess: () => this.sellAccess,
        serviceAccess: () => this.canService,
        failureReason: () => this.failureReason,
        travelMap: (id: MapId) => this.travelToMap(id),
        exportSave: () => this.save(),
        importSave: (data: SaveData) => {
          const ok = this.saves.write(data);
          if (ok) {
            // Prevent this scene's pagehide save from replacing the imported campaign.
            this.ui.hasStarted = false;
            location.reload();
          }
          return ok;
        },
        rescue: () => this.fail(true),
        newGame: () => {
          try {
            localStorage.removeItem('mars-miner.v1');
            // Do not let pagehide autosave overwrite the explicitly cleared expedition.
            this.ui.hasStarted = false;
            location.reload();
          } catch {
            this.ui.toast('Could not replace the save. Browser storage is unavailable.');
          }
        },
        mute: () => this.soundFx.toggleMute(),
        isMuted: () => this.soundFx.muted,
        audioMix: () => ({ ...this.soundFx.mix }),
        setAudioMix: (channel, value) => this.soundFx.setMix(channel, value),
        atmosphereEnabled: () => this.atmosphere.enabled,
        setAtmosphereEnabled: (enabled) => this.atmosphere.setEnabled(enabled),
      },
      !!saved,
      this.mapId,
      () => {
        this.rememberCurrentMap();
        return Object.fromEntries(
          Object.entries(this.mapStates).map(([id, state]) => [id, state.maxDepth]),
        ) as Partial<Record<MapId, number>>;
      },
    );
    this.ui.setMap(this.mapId);
    this.ui.setMothershipBoarded(this.mothershipBoarded);
    this.ui.setInOrbit(this.inOrbit);
    if (this.inOrbit) {
      this.globeViewRequested = true;
      this.cameraZoom = this.cameraZoomTarget = GLOBE_HANDOFF_ZOOM;
      this.orbitalTransition = 1;
    }
    if (this.pendingPositionNotice) {
      this.ui.toast(this.pendingPositionWarning
        ? 'SAVE POSITION IS BLOCKED · USE PAUSE → EMERGENCY RECOVERY TO MOVE THE POD'
        : 'POD REPOSITIONED BESIDE YOUR SAVED TUNNEL · ROCK CLEARED AROUND THE CABIN');
      this.pendingPositionNotice = false;
      this.pendingPositionWarning = false;
    }
    document.querySelector('#game')!.appendChild(this.game.canvas);
    const resize = () => {
      const el = document.querySelector('#viewport')!;
      const previousWidth = this.scale.width, previousHeight = this.scale.height,
        wasFullyZoomedOut = !!this.world.planetChart && previousWidth > 0 && previousHeight > 0 && this.globeViewRequested;
      this.scale.resize(el.clientWidth, el.clientHeight);
      if (wasFullyZoomedOut) this.cameraZoomTarget = GLOBE_HANDOFF_ZOOM;
    };
    resize();
    window.addEventListener('resize', resize);
    this.g = this.add.graphics();
    this.orbitG = this.add.graphics().setDepth(1);
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,G,M,B,UP,LEFT,DOWN,RIGHT,SPACE,ESC,E,X,R',
      false,
    ) as typeof this.keys;
    this.syncInput(this.ui.paused);
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.ui.hasStarted) {
        if (this.surfacePlacement) this.cancelSurfacePlacement();
        else this.ui.modal ? this.ui.close() : this.pause();
      }
    });
    this.input.keyboard!.on('keydown-ENTER', () => this.confirmSurfacePlacement());
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN']) this.input.keyboard!.on(`keydown-${key}`, (event: KeyboardEvent) => {
      if (!this.surfacePlacement || this.ui.modal) return;
      event.preventDefault();
      if (this.surfacePlacement.kind === 'wall' && (key === 'UP' || key === 'DOWN')) {
        this.nudgeSurfaceWallHeight(key === 'UP' ? 1 : -1);
        return;
      }
      const direction = key === 'LEFT' || key === 'UP' ? -1 : 1;
      this.nudgeSurfacePlacement((event.shiftKey ? 5 : 1) * WORLD.tile * direction);
    });
    this.input.keyboard!.on('keydown-E', () => {
      if (!this.ui.hasStarted || this.ui.modal || this.surfacePlacement) return;
      if (this.isNearMothership()) {
        if (!this.progress.shipComplete) {
          this.ui.toast('MOTHERSHIP DRIVE OFFLINE · MINE THIS PLANET’S CORE TO FUEL THE SHIP');
          return;
        }
        const wasBoarded = this.mothershipBoarded;
        this.mothershipBoarded = !wasBoarded;
        this.pod.vx = this.pod.vy = 0;
        this.pod.docked = this.mothershipBoarded;
        if (!this.save()) {
          this.mothershipBoarded = wasBoarded;
          this.ui.setMothershipBoarded(wasBoarded);
          this.pod.docked = wasBoarded;
          return;
        }
        this.ui.setMothershipBoarded(this.mothershipBoarded);
        this.ui.toast(this.mothershipBoarded
          ? `BOARDED THE MOTHERSHIP · W ASCENDS · S LANDS · ${this.progress.coreFuel} CORE-FUEL JUMPS`
          : 'MOTHERSHIP HATCH OPEN · MINER CONTROLS RESTORED');
        return;
      }
      const habitat = this.planetSurface && nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'habitat'),
        post = this.planetSurface && nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'trade-post'),
        warehouse = this.planetSurface && nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'warehouse'),
        nearby = [habitat, post, warehouse].filter((entry): entry is UndergroundStructure => !!entry)
          .sort((a, b) => globeSurfaceDistance(this.world, this.pod.x, this.pod.y, a.x, a.y) - globeSurfaceDistance(this.world, this.pod.x, this.pod.y, b.x, b.y))[0];
      if (nearby?.kind === 'warehouse') this.ui.open('warehouse');
      else if (nearby?.kind === 'habitat') this.ui.open('service');
      else if (nearby?.kind === 'trade-post') this.ui.open('sell');
      else if (this.surface) this.ui.open('sell');
      else if (nearbyServiceStation(this.structures, this.pod.x, this.pod.y)) this.ui.open('service');
    });
    this.input.keyboard!.on('keydown-B', () => {
      if (this.ui.hasStarted && !this.ui.modal && !this.surfacePlacement && (this.planetSurface || this.depth >= UNDERGROUND_BUILDING.minimumDepthMeters && this.depth <= 3400))
        this.ui.open('construction');
    });
    this.input.keyboard!.on('keydown-M', () => {
      if (this.ui.hasStarted && !this.ui.modal && !this.surfacePlacement) this.ui.toggleMap();
    });
    this.input.keyboard!.on('keydown-Q', () => {
      if (this.ui.hasStarted && !this.ui.modal && !this.surfacePlacement) this.deployCharge();
    });
    const handleVisibilityChange = () => {
      if (document.hidden && this.ui.hasStarted) {
        this.pause();
        this.save();
      }
    };
    const handleWindowBlur = () => {
      if (this.ui.hasStarted && !this.ui.modal) this.pause();
    };
    const handlePageHide = () => {
      if (this.ui.hasStarted) this.save();
    };
    const handleDialogTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && this.ui.modal) {
        const dialog = document.querySelector<HTMLElement>('.modal[aria-modal="true"]');
        const focusables = dialog ? getDialogFocusables(dialog) : [];
        const first = focusables[0],
          last = focusables.at(-1);
        if (e.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('keydown', handleDialogTab);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('keydown', handleDialogTab);
    });
    this.labels = STATIONS.map((s) =>
      this.add
        .text(0, 0, `${s.label}\n${s.name}`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#e5cbb0',
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
    this.shipStatusLabel = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#d9f5df',
      backgroundColor: '#142023dd', padding: { x: 6, y: 4 }, align: 'center',
    }).setOrigin(0.5).setVisible(false);
    this.buildPlacementLabel = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#d9f5df',
      backgroundColor: '#142023ee', padding: { x: 10, y: 7 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setVisible(false);
    this.orbitalLabel = this.add.text(0, 0, 'ORBITAL CUTAWAY  ·  WHEEL TO RETURN', {
      fontFamily: 'monospace', fontSize: '10px', color: '#d9f5df',
      backgroundColor: '#142023dd', padding: { x: 9, y: 6 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.cameraFlipLabel = this.add.text(0, 0, 'CAMERA FLIP  ·  UP STAYS UP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#d9f5df',
      backgroundColor: '#142023dd', padding: { x: 9, y: 6 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _currentlyOver: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      if (!this.ui.hasStarted || this.ui.paused || this.ui.modal) return;
      const nextZoom = this.cameraZoomTarget * Math.exp(-deltaY * 0.001);
      if (this.world.planetChart) {
        if (nextZoom < GLOBE_HANDOFF_ZOOM) {
          this.globeViewRequested = true;
          this.cameraZoomTarget = GLOBE_HANDOFF_ZOOM;
        } else {
          this.globeViewRequested = false;
          this.cameraZoomTarget = Phaser.Math.Clamp(nextZoom, GLOBE_HANDOFF_ZOOM, 1.8);
        }
      } else this.cameraZoomTarget = Phaser.Math.Clamp(nextZoom, this.minimumCameraZoom, 1.8);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0 && this.ui.hasStarted && !this.ui.paused && !this.ui.modal && !this.surfacePlacement)
        this.mouseAimActive = true;
      if (!this.surfacePlacement || this.ui.paused || this.ui.modal) return;
      if (pointer.button === 2) {
        this.cancelSurfacePlacement();
        return;
      }
      this.updateSurfacePlacementFromPointer(pointer.x, pointer.y);
      this.confirmSurfacePlacement();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.ui.hasStarted && !this.ui.paused && !this.ui.modal && !this.surfacePlacement) this.mouseAimActive = true;
      if (this.surfacePlacement && !this.ui.paused && !this.ui.modal)
        this.updateSurfacePlacementFromPointer(pointer.x, pointer.y);
    });
    this.scale.on('resize', () => this.updateSurfacePlacementLabel());
    this.game.canvas.addEventListener('contextmenu', (event) => {
      if (this.surfacePlacement) event.preventDefault();
    });
    this.landmarkLabels = new Map(ROUTE_FRAGMENTS.map((fragment) => [
      fragment.id,
      this.add.text(0, 0, fragment.landmark.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '9px', color: '#b7fff0',
        backgroundColor: '#142023cc', padding: { x: 5, y: 3 },
      }).setOrigin(0.5),
    ]));
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = Math.max(
      this.surfaceCameraY,
      this.pod.y -
        Phaser.Math.Linear(
          -this.surfaceCameraY,
          this.scale.height * 0.44,
          Phaser.Math.Clamp(this.pod.y / 400, 0, 1),
        ),
    );
    this.revealAroundPod();
    this.ui.update(this.depth, this.surface, 1, this.pod.docked, 0, this.pod.vy * this.world.gravitySign(this.pod.y), this.farHemisphere, false, this.world.coreDepthMeters,
      false, false, false, 0, 0, false, this.planetSurface, false, this.isNearMothership(), this.mothershipBoarded, this.progress.shipComplete, this.inOrbit);
    if (import.meta.env.DEV)
      Object.defineProperty(window, '__mars', {
        configurable: true,
        get: () => ({
          x: this.pod.x,
          y: this.pod.y,
          vx: this.pod.vx,
          vy: this.pod.vy,
          fallCue: fallMotionCueIntensity(this.pod.vy, this.world.gravitySign(this.pod.y)),
          descentSpeed: this.pod.vy * this.world.gravitySign(this.pod.y),
          depth: this.depth,
          farHemisphere: this.farHemisphere,
          gravitySign: this.world.gravitySign(this.pod.y),
          fuel: this.progress.fuel,
          hull: this.progress.hull,
          coreFuel: this.progress.coreFuel,
          mothershipBoarded: this.mothershipBoarded,
          shipComplete: this.progress.shipComplete,
          milestones: [...this.progress.milestones],
          cargo: { ...this.progress.cargo },
          money: this.progress.money,
          levels: { ...this.progress.levels },
          specialization: this.progress.specialization,
          stasisModule: this.progress.stasisModule,
          stasisActive: this.pod.stasisActive,
          returnWinch: this.progress.returnWinch,
          reeling: this.pod.reeling,
          grappleAnchor: this.pod.grappleAnchor ? { ...this.pod.grappleAnchor } : null,
          rockSwimmer: this.rockSwimmer.active ? { ...this.rockSwimmer.active } : null,
          scannerRadius: surveyScannerRadius(this.progress.max('scanner'), SPECIALIZATIONS[this.progress.specialization].scanRadiusBonus, this.progress.milestones, this.world.widthTiles),
          cargoCapacity: this.progress.max('cargo'),
          surveyedCells: this.world.discovered.size,
          podScale: podVisualScale(this.progress.levels, this.progress.shipComponents.length),
          camera: { x: this.camX, y: this.camY },
          cameraRotation: this.viewRotation,
          cameraTurnLabelRemaining: this.cameraTurnLabelRemaining,
          cameraZoom: this.cameraZoom,
          cameraZoomTarget: this.cameraZoomTarget,
          orbitalTransition: this.orbitalTransition,
          orbitalOverviewActive: this.orbitalOverviewActive,
          inOrbit: this.inOrbit,
          winchCableConnected: !!this.surfaceWinchCable(),
          winchCablePointCount: this.surfaceWinchCable()?.points.length ?? 0,
          snapshot: () => new Promise<string>((resolve) =>
            this.game.renderer.snapshot((image) => resolve(image instanceof HTMLImageElement ? image.src : '')),
          ),
        mapId: this.mapId,
          reducedMotion: this.reducedMotion,
          atmosphere: { enabled: this.atmosphere.enabled, count: this.atmosphere.motes.length,
            wakes: this.atmosphere.motes.filter(p => p.wake).length,
            foreground: this.atmosphere.motes.filter(p => p.foreground).length },
          stationLabels: this.labels.map((label) => ({ visible: label.visible, x: label.x, y: label.y })),
        shipComponents: [...this.progress.shipComponents],
          shipStatus: this.progress.shipComplete ? 'CORE DRIVE ONLINE' : 'MINE PLANET CORE',
          shipStatusLabel: { x: this.shipStatusLabel.x, y: this.shipStatusLabel.y, visible: this.shipStatusLabel.visible, text: this.shipStatusLabel.text },
        routeFragments: [...this.progress.routeFragments],
        audio: {
          muted: this.soundFx.muted,
          mix: { ...this.soundFx.mix },
          contextState: this.soundFx.context?.state ?? 'locked',
          musicGain: this.soundFx.musicBus?.gain.value ?? 0,
          effectsGain: this.soundFx.effectsBus?.gain.value ?? 0,
          phase: this.soundFx.musicPhase ?? 'locked',
          soundtrack: this.soundFx.musicTracks ? Object.fromEntries(Object.entries(this.soundFx.musicTracks).map(([name, track]) =>
            [name, { paused: track.element.paused, time: track.element.currentTime, readyState: track.element.readyState, gain: track.gain.gain.value }])) : null,
        },
        maps: Object.fromEntries(Object.entries(this.mapStates).map(([id, map]) => [id, {
          seed: map?.seed,
          destroyed: map?.destroyed.length ?? 0,
          discovered: map?.discovered.length ?? 0,
          drops: map?.drops.length ?? 0,
          activeCharge: !!map?.activeCharge,
        }])),
          destroyed: [...this.world.destroyed],
          drillTarget: this.mining.target ? { x: this.mining.target.x, y: this.mining.target.y } : null,
          drillProgress: this.mining.ratio,
          laserHeat: this.laserThermal.heat,
          laserVent: this.laserThermal.vent,
          chunks: this.world.chunks.size,
          seed: this.world.seed,
          paused: this.ui.paused,
          docked: this.pod.docked,
          overlaps: this.pod.overlaps(this.pod.x, this.pod.y).length,
          placement: this.surfacePlacement ? { ...this.surfacePlacement, valid: this.surfacePlacementCheck()?.valid ?? false } : null,
        }),
      });
  }
  get depth() {
    return depthAtWorldY(this.pod.y, this.world.planetChart);
  }
  get surface() {
    return atSurface(this.pod.x, this.pod.y, this.world.planetChart);
  }
  get planetSurface() {
    return onPlanetSurface(this.pod.x, this.pod.y, this.world.planetChart);
  }
  get inOrbit() {
    return isInOrbit(this.pod.y, this.world.planetChart);
  }
  isNearMothership() {
    if (!this.planetSurface || !this.world.planetChart) return false;
    return globeSurfaceDistance(this.world, this.pod.x, this.pod.y, 555, surfaceDockYAt(WORLD.spawnY, this.world.planetChart)) < 86;
  }
  get sellAccess() {
    return this.surface || this.planetSurface && !!nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'trade-post');
  }
  get canService() {
    return this.surface || this.planetSurface && !!nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'habitat') ||
      !!nearbyServiceStation(this.structures, this.pod.x, this.pod.y);
  }
  get nearbyWarehouse() {
    return this.planetSurface && nearbyGlobeSurfaceStructure(this.structures, this.pod.x, this.pod.y, this.world, 'warehouse');
  }
  tradeNetworkCount() {
    return this.tradePostMaps().length;
  }
  warehouseMaps() {
    return (Object.keys(MAPS) as MapId[]).filter((id) => {
      const structures = id === this.mapId ? this.structures : this.mapStates[id]?.structures;
      return structures?.some((entry) => entry.kind === 'warehouse') ?? false;
    });
  }
  transferWarehouse(ore: Ore, direction: WarehouseDirection, units: number, selectedMapId?: MapId) {
    if (!this.nearbyWarehouse) return 0;
    const targetMapId = direction === 'withdraw' && selectedMapId ? selectedMapId : this.mapId,
      knownWarehouses = this.warehouseMaps();
    if (!remoteWarehouseAccess(this.progress.milestones, this.mapId, targetMapId, knownWarehouses)) return 0;
    const remoteState = targetMapId === this.mapId ? undefined : this.mapStates[targetMapId];
    if (targetMapId !== this.mapId && !remoteState) return 0;
    const targetWarehouse = targetMapId === this.mapId ? this.warehouseCargo : remoteState!.warehouse,
      transfer = transferWarehouseOre(this.progress.cargo, targetWarehouse, ore, direction, units, this.progress.max('cargo'));
    if (!transfer.moved) return 0;
    const oldCargo = this.progress.cargo, oldWarehouse = targetWarehouse;
    this.progress.cargo = transfer.cargo;
    if (targetMapId === this.mapId) this.warehouseCargo = transfer.warehouse;
    else this.mapStates[targetMapId] = { ...remoteState!, warehouse: transfer.warehouse };
    if (!this.save()) {
      this.progress.cargo = oldCargo;
      if (targetMapId === this.mapId) this.warehouseCargo = oldWarehouse;
      else this.mapStates[targetMapId] = remoteState!;
      this.rememberCurrentMap();
      this.ui.toast('STORAGE FAILED · ORE TRANSFER ROLLED BACK.');
      return 0;
    }
    this.soundFx.tone(direction === 'store' ? 540 : 420, 0.08, 'sine', 0.025, direction === 'store' ? 760 : 620);
    this.ui.toast(`${direction === 'store' ? 'STORED' : 'RETRIEVED'} ${transfer.moved} ${ore.toUpperCase()} · ${MAPS[targetMapId].name.toUpperCase()} WAREHOUSE.`);
    return transfer.moved;
  }
  contributeSystemProject() {
    if (!this.nearbyWarehouse) return false;
    const oldWarehouse = { ...this.warehouseCargo }, oldMilestones = [...this.progress.milestones], oldMoney = this.progress.money,
      result = contributeVesperRelay(this.progress.milestones, this.mapId, this.warehouseCargo);
    if (!result.contributed) return false;
    if (result.completed) this.progress.money += VESPER_RELAY_PROJECT.rewardCredits;
    if (!this.save()) {
      this.warehouseCargo = oldWarehouse;
      this.progress.milestones = oldMilestones;
      this.progress.money = oldMoney;
      this.rememberCurrentMap();
      this.ui.toast('PROJECT SAVE FAILED · MATERIALS RESTORED.');
      return false;
    }
    const stage = result.stage!;
    this.soundFx.reward();
    this.ui.toast(result.completed
      ? `VESPER RELAY ONLINE · +$${VESPER_RELAY_PROJECT.rewardCredits} · LINKED EXCHANGE PREMIUM +5%.`
      : `${MAPS[stage.mapId].name.toUpperCase()} RELAY WORK COMPLETE · ${stage.units} ${stage.ore.toUpperCase()} COMMITTED.`);
    return true;
  }
  contributeCargoTug() {
    if (!this.nearbyWarehouse) return false;
    const oldWarehouse = { ...this.warehouseCargo }, oldMilestones = [...this.progress.milestones], oldMoney = this.progress.money,
      result = contributeCargoTug(this.progress.milestones, this.mapId, this.warehouseCargo);
    if (!result.contributed) return false;
    if (result.completed) this.progress.money += CARGO_TUG_PROJECT.rewardCredits;
    if (!this.save()) {
      this.warehouseCargo = oldWarehouse;
      this.progress.milestones = oldMilestones;
      this.progress.money = oldMoney;
      this.rememberCurrentMap();
      this.ui.toast('PROJECT SAVE FAILED · MATERIALS RESTORED.');
      return false;
    }
    const stage = result.stage!;
    this.soundFx.reward();
    this.ui.toast(result.completed
      ? `CARGO TUG ONLINE · +$${CARGO_TUG_PROJECT.rewardCredits} · REMOTE WAREHOUSE ACCESS UNLOCKED.`
      : `${MAPS[stage.mapId].name.toUpperCase()} CARGO TUG WORK COMPLETE · ${stage.units} ${stage.ore.toUpperCase()} COMMITTED.`);
    return true;
  }
  contributeSurveyArray() {
    if (!this.nearbyWarehouse) return false;
    const oldWarehouse = { ...this.warehouseCargo }, oldMilestones = [...this.progress.milestones], oldMoney = this.progress.money,
      result = contributeSurveyArray(this.progress.milestones, this.mapId, this.warehouseCargo);
    if (!result.contributed) return false;
    if (!this.save()) {
      this.warehouseCargo = oldWarehouse;
      this.progress.milestones = oldMilestones;
      this.progress.money = oldMoney;
      this.rememberCurrentMap();
      this.ui.toast('PROJECT SAVE FAILED · MATERIALS RESTORED.');
      return false;
    }
    const stage = result.stage!;
    this.soundFx.reward();
    this.ui.toast(result.completed
      ? `LONG-RANGE SURVEY ARRAY ONLINE · SCANNER REACH +${SURVEY_ARRAY_PROJECT.scannerRadiusBonus} TILES.`
      : `${MAPS[stage.mapId].name.toUpperCase()} SURVEY ARRAY WORK COMPLETE · ${stage.units} ${stage.ore.toUpperCase()} COMMITTED.`);
    return true;
  }
  tradePostMaps() {
    return (Object.keys(MAPS) as MapId[]).filter((id) => {
      const structures = id === this.mapId ? this.structures : this.mapStates[id]?.structures;
      return structures?.some((entry) => entry.kind === 'trade-post') ?? false;
    });
  }
  beginSurfacePlacement(kind: SurfaceStructureKind) {
    if (!this.planetSurface || !this.world.planetChart) return false;
    const baseArc = surfaceArcCoordinate(this.world, this.pod.x, this.pod.y),
      surfaceY = this.pod.y < this.world.coreWorldY ? 0 : this.world.farSurfaceY,
      obstacles: UndergroundStructure[] = [...this.structures, ...STATIONS.map((station, index) => ({
        id: `station:${index}`, kind: 'platform' as const, x: station.x, y: surfaceY,
      }))];
    let site = surfaceArcPoint(this.world, baseArc + WORLD.tile * 5);
    for (let step = 5; step <= 48; step += 1) {
      const candidate = surfaceArcPoint(this.world, baseArc + WORLD.tile * step),
        check = validateSurfaceStructureSite(this.world, kind, candidate, obstacles, this.progress.cargo, this.progress.money);
      site = candidate;
      if (check.valid || check.reason !== 'OCCUPIED') break;
    }
    this.surfacePlacement = { kind, ...site };
    this.updateSurfacePlacementLabel();
    return true;
  }
  updateSurfacePlacementFromPointer(screenX: number, screenY: number) {
    const placement = this.surfacePlacement, chart = this.world.planetChart;
    if (!placement || !chart) return;
    const oldSurfaceY = placement.y < this.world.coreWorldY ? 0 : this.world.farSurfaceY,
      outwardOffset = placement.kind === 'wall' ? Math.max(0, Math.abs(placement.y - oldSurfaceY)) : 0;
    const point = this.screenPointToWorld(screenX, screenY, this.scale.width, this.scale.height),
      polar = planetChartToCartesian({ u: point.x / WORLD.tile, v: point.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile),
      radius = Math.hypot(polar.x, polar.y);
    if (radius < 1) return;
    const surfacePolar = { x: polar.x * chart.radiusRows * WORLD.tile / radius, y: polar.y * chart.radiusRows * WORLD.tile / radius },
      chartPoint = planetCartesianToChart(surfacePolar, chart.columns, chart.radiusRows, WORLD.tile),
      row = chartPoint.v < chart.radiusRows ? 0 : this.world.farSurfaceY,
      site = surfaceArcPoint(this.world, surfaceArcCoordinate(this.world, chartPoint.u * WORLD.tile, row)),
      gravity = this.world.gravitySign(row);
    this.surfacePlacement = { ...placement, ...site, y: row - gravity * outwardOffset };
    this.updateSurfacePlacementLabel();
  }
  nudgeSurfacePlacement(delta: number) {
    const placement = this.surfacePlacement;
    if (!placement) return;
    const site = surfaceArcPoint(this.world, surfaceArcCoordinate(this.world, placement.x, placement.y) + delta);
    this.surfacePlacement = { ...placement, ...site };
    this.updateSurfacePlacementLabel();
  }
  nudgeSurfaceWallHeight(levelDelta: number) {
    const placement = this.surfacePlacement;
    if (!placement || placement.kind !== 'wall') return;
    const gravity = this.world.gravitySign(placement.y), surfaceY = placement.y < this.world.coreWorldY ? 0 : this.world.farSurfaceY,
      currentOffset = Math.abs(placement.y - surfaceY), nextOffset = Math.max(0, currentOffset + levelDelta * WORLD.tile);
    this.surfacePlacement = { ...placement, y: surfaceY - gravity * nextOffset };
    this.updateSurfacePlacementLabel();
  }
  surfacePlacementCheck() {
    const placement = this.surfacePlacement;
    if (!placement) return undefined;
    const stations: UndergroundStructure[] = STATIONS.map((station, index) => ({
      id: `station:${index}`, kind: 'platform', x: station.x,
      y: placement.y < this.world.coreWorldY ? 0 : this.world.farSurfaceY,
    }));
    return validateSurfaceStructureSite(this.world, placement.kind, placement, [...this.structures, ...stations], this.progress.cargo, this.progress.money);
  }
  updateSurfacePlacementLabel() {
    const placement = this.surfacePlacement;
    if (!placement) {
      this.buildPlacementLabel?.setVisible(false);
      return;
    }
    const check = this.surfacePlacementCheck(), rule = UNDERGROUND_BUILDING[placement.kind],
      resources = Object.entries(rule.materials).map(([ore, count]) => `${count} ${ore.slice(0, 2).toUpperCase()}`).join(' / '),
      status = check?.valid ? 'SITE CLEAR' : check?.reason ?? 'SITE BLOCKED';
    this.buildPlacementLabel.setText(`${placement.kind.replace('-', ' ').toUpperCase()} · ${rule.widthTiles} TILES · $${rule.credits} + ${resources}  |  ${status}  |  ${placement.kind === 'wall' ? '←/→ MOVE · ↑/↓ STACK · ' : ''}CLICK / ENTER · ESC`)
      .setColor(check?.valid ? '#d9f5df' : '#ffc0a8')
      .setPosition(this.scale.width / 2, this.scale.height - 56)
      .setVisible(true);
  }
  cancelSurfacePlacement() {
    if (!this.surfacePlacement) return;
    this.surfacePlacement = undefined;
    this.buildPlacementLabel.setVisible(false);
    this.ui.toast('BUILD CANCELLED · No materials or credits spent.');
  }
  confirmSurfacePlacement() {
    const placement = this.surfacePlacement;
    if (!placement || this.ui.modal || this.ui.paused) return false;
    const check = this.surfacePlacementCheck();
    if (!check?.valid) {
      this.updateSurfacePlacementLabel();
      this.soundFx.tone(170, 0.07, 'square', 0.02, 120);
      return false;
    }
    const cost = UNDERGROUND_BUILDING[placement.kind], oldMoney = this.progress.money, oldCargo = { ...this.progress.cargo },
      structure: UndergroundStructure = {
        id: `${placement.kind}:${Math.round(placement.x)}:${Math.round(placement.y)}`,
        kind: placement.kind, x: placement.x, y: placement.y, integrity: SURFACE_RAID.integrity,
      };
    this.progress.money -= cost.credits;
    for (const [ore, units] of Object.entries(cost.materials)) this.progress.cargo[ore as Ore] -= units;
    this.structures.push(structure);
    if (!this.save()) {
      this.structures.pop();
      this.progress.money = oldMoney;
      Object.assign(this.progress.cargo, oldCargo);
      this.ui.toast('SAVE FAILED · BUILD NOT PLACED · NOTHING SPENT.');
      this.updateSurfacePlacementLabel();
      return false;
    }
    this.surfacePlacement = undefined;
    this.buildPlacementLabel.setVisible(false);
    this.burst(structure.x, structure.y, structure.kind === 'turret' ? 0xf0b779 : 0xa4efd9, 18);
    this.float(`${structure.kind.replace('-', ' ').toUpperCase()} BUILT`, structure.x, structure.y - 42, '#9ce4cf');
    this.soundFx.reward();
    this.ui.toast(`${structure.kind.replace('-', ' ').toUpperCase()} BUILT · PLANETARY SITE SAVED.`);
    return true;
  }
  buildUndergroundStructure(kind: StructureKind) {
    const cost = UNDERGROUND_BUILDING[kind], p = this.progress;
    if (this.planetSurface && this.world.planetChart &&
      (kind === 'habitat' || kind === 'turret' || kind === 'trade-post' || kind === 'warehouse' || kind === 'wall' || kind === 'gate'))
      return this.beginSurfacePlacement(kind);
    if (kind === 'trade-post' || kind === 'habitat' || kind === 'warehouse' || kind === 'wall' || kind === 'gate' || kind === 'turret' && this.surface) {
      const site = this.surface
        ? kind === 'trade-post'
          ? findSurfaceTradePostSite(this.world, this.pod.x, this.pod.y, this.structures)
          : kind === 'habitat'
            ? findSurfaceHabitatSite(this.world, this.pod.x, this.pod.y, this.structures)
            : kind === 'warehouse'
              ? findSurfaceWarehouseSite(this.world, this.pod.x, this.pod.y, this.structures)
              : kind === 'wall' || kind === 'gate'
                ? findSurfaceBarrierSite(this.world, this.pod.x, this.pod.y, this.structures, kind)
              : findSurfaceTurretSite(this.world, this.pod.x, this.pod.y, this.structures)
        : undefined;
      if (!site || !canAffordStructure(kind, p.cargo, p.money)) return false;
      p.money -= cost.credits;
      for (const [ore, units] of Object.entries(cost.materials)) p.cargo[ore as Ore] -= units;
      this.structures.push({ id: `${kind}:${Math.round(site.x)}:${Math.round(site.y)}`, kind, ...site, integrity: SURFACE_RAID.integrity });
      this.soundFx.reward();
      this.float(`${kind.toUpperCase()} ONLINE`, site.x, site.y - 54, '#9ce4cf');
      if (kind === 'trade-post') this.ui.toast('TRADE POST ONLINE · BUILD ON ANOTHER PLANET TO LINK THE NETWORK.');
      else if (kind === 'habitat') this.ui.toast('COLONY HABITAT ONLINE · LOCAL SERVICE BAY READY.');
      else if (kind === 'warehouse') this.ui.toast('ORE WAREHOUSE ONLINE · PRESS E BESIDE IT TO STORE SELECTED ORE.');
      else if (kind === 'wall' || kind === 'gate') this.ui.toast(kind === 'wall' ? 'PERIMETER WALL ONLINE · RAIDERS MUST BREACH IT.' : 'SECURITY GATE ONLINE · IT OPENS FOR YOUR MINER.');
      else this.ui.toast('SURFACE SENTINEL ONLINE · ROCK SWIMMERS IN RANGE WILL BE INTERCEPTED.');
      this.save();
      return true;
    }
    const site = findBuildSite(this.world, this.pod.x, this.pod.y, this.world.gravitySign(this.pod.y), kind, this.structures);
    if (this.planetSurface || this.depth < UNDERGROUND_BUILDING.minimumDepthMeters || this.depth > 3400 || !site || !canAffordStructure(kind, p.cargo, p.money)) return false;
    p.money -= cost.credits;
    for (const [ore, units] of Object.entries(cost.materials)) p.cargo[ore as Ore] -= units;
    const structure: UndergroundStructure = { id: `${kind}:${Math.round(site.x)}:${Math.round(site.y)}`, kind, ...site, integrity: SURFACE_RAID.integrity };
    this.structures.push(structure);
    this.pod.structures = this.structures;
    this.soundFx.reward();
    this.float(kind === 'service' ? 'REFUEL BEACON BUILT' : kind === 'turret' ? 'DEFENSE TURRET BUILT' : 'ANCHOR DECK BUILT', site.x, site.y, '#9ce4cf');
    this.save();
    return true;
  }
  repairStructure(id: string) {
    const structure = this.structures.find((entry) => entry.id === id);
    const repair = structure && repairSurfaceStructure(structure, this.progress.money);
    if (!this.surface || !structure || !repair) return false;
    this.progress.money = repair.credits;
    structure.integrity = repair.integrity;
    this.soundFx.reward();
    this.float('COLONY MODULE REPAIRED', structure.x, structure.y - 45, '#9ce4cf');
    this.save();
    return true;
  }
  estimateReturnFuel() {
    const estimate = estimateVerticalReturnFuel(this.pod.y, this.progress.max('engine'), this.world.planetChart),
      route = this.progress.returnWinch ? this.surfaceWinchCable() : undefined;
    if (!route) return estimate;
    const chart = this.world.planetChart, points = route.points.map((point) => chart
      ? planetChartToCartesian({ u: point.x / WORLD.tile, v: point.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile)
      : point);
    let routeLength = 0;
    for (let i = 1; i < points.length; i++) routeLength += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    const conservativeRise = Math.max(1, PHYSICS.rise * this.progress.max('engine') * 0.55),
      routeEstimate = Math.ceil(routeLength / conservativeRise * FUEL.thrust * 1.45 + 2);
    return Math.max(estimate, routeEstimate);
  }

  surfaceWinchCable() {
    if (!this.progress.returnWinch || this.pod.y <= WORLD.spawnY) return undefined;
    const x = Math.floor(this.pod.x / WORLD.tile), y = Math.floor(this.pod.y / WORLD.tile), destroyed = this.world.destroyed.size,
      structureCount = this.structures.length;
    if (this.winchRouteCache?.world !== this.world || this.winchRouteCache.x !== x || this.winchRouteCache.y !== y ||
        this.winchRouteCache.destroyed !== destroyed || this.winchRouteCache.structureCount !== structureCount) {
      this.winchRouteCache = { world: this.world, x, y, destroyed, structureCount,
        route: findSurfaceWinchRoute(this.world, this.pod.x, this.pod.y, this.structures) };
    }
    const route = this.winchRouteCache.route;
    if (!route) return undefined;
    route[0] = { x: this.pod.x, y: this.pod.y - this.world.gravitySign(this.pod.y) * 10 };
    return { points: route };
  }
  seedForMap(id: MapId) {
    const index = Object.keys(MAPS).indexOf(id) + 1;
    return Math.floor(random(this.campaignSeed, index, 73, 384) * 0xffffffff) >>> 0;
  }
  revealAroundPod() {
    const tx = Math.floor(this.pod.x / WORLD.tile), ty = Math.floor(this.pod.y / WORLD.tile);
    const bonus = SPECIALIZATIONS[this.progress.specialization].scanRadiusBonus,
      baseRadius = this.progress.max('scanner'),
      radius = surveyScannerRadius(baseRadius, bonus, this.progress.milestones, this.world.widthTiles),
      projectBonus = radius - Math.min(this.world.widthTiles, baseRadius + bonus);
    if (this.lastRevealWorld === this.world && this.lastRevealX === tx && this.lastRevealY === ty && this.lastRevealRadius === radius) return;
    this.lastRevealWorld = this.world;
    this.lastRevealX = tx;
    this.lastRevealY = ty;
    this.lastRevealRadius = radius;
    this.world.reveal(this.pod.x, this.pod.y, bonus + projectBonus, baseRadius);
    this.pod.scannerRadius = radius;
  }
  rememberCurrentMap() {
    this.mapStates[this.mapId] = snapshotMapState(
      this.mapStates[this.mapId], this.world, this.pod.x, this.pod.y, this.depth,
      this.oreDrops, this.activeCharge, this.structures, this.warehouseCargo,
    );
  }
  chartForUnvisitedMap(id: MapId): PlanetChartSize {
    if (this.campaignChart.radiusRows === LEGACY_PLANET_CHART.radiusRows) return LEGACY_PLANET_CHART;
    return id === 'cryo-shelf' ? STARTER_PLANET_CHART : PLANET_CHART;
  }
  nearestClearPodPosition(x: number, y: number, frame: number) {
    const chart = this.world.planetChart, maxX = this.world.widthTiles * WORLD.tile - 16,
      maxY = this.world.farSurfaceY - 16;
    for (let radius = 16; radius <= WORLD.tile * 18; radius += 10) {
      for (let i = 0; i < 48; i++) {
        const angle = i * Math.PI / 24, candidateX = x + Math.cos(angle) * radius,
          candidateY = y + Math.sin(angle) * radius;
        if (candidateX < 16 || candidateX > maxX || candidateY < 16 || candidateY > maxY) continue;
        const candidateFrame = chart
          ? planetCameraFrameAngle(candidateX / WORLD.tile, candidateY / WORLD.tile, chart) ?? frame
          : frame;
        if (!this.pod.overlaps(candidateX, candidateY, candidateFrame).length) return { x: candidateX, y: candidateY };
      }
    }
    return undefined;
  }
  travelToMap(id: MapId) {
    if (!this.mothershipBoarded) {
      this.ui.toast('BOARD THE MOTHERSHIP TO TRAVEL BETWEEN PLANETS');
      return false;
    }
    if (!this.inOrbit || id === this.mapId) {
      if (!this.inOrbit && id !== this.mapId) this.ui.toast('HOLD W TO CLIMB ABOVE THE GLOBE · WORLDS OPEN IN ORBIT');
      return false;
    }
    const unlocked = id === this.mapId || this.progress.shipComplete && (id !== 'vesper-9' || vesperChapterUnlocked(this.progress.milestones));
    if (!unlocked) return false;
    if (!this.progress.spendCoreFuelForJump()) {
      this.ui.toast(this.progress.shipComplete
        ? 'CORE FUEL LOW · MINE A PLANETARY CORE TO POWER ANOTHER JUMP'
        : 'CORE DRIVE OFFLINE · MINE THIS PLANET’S CORE TO UNLOCK INTERPLANETARY FLIGHT');
      return false;
    }
    this.rememberCurrentMap();
    this.mapId = id;
    this.mothershipBoarded = true;
    this.ui.setMothershipBoarded(true);
    const state = restoreMapState(this.mapStates[id], id, this.seedForMap(id), this.chartForUnvisitedMap(id));
    this.structures = state.structures;
    this.warehouseCargo = state.warehouse;
    this.world = state.world;
    this.surfaceFeatures = surfaceLandmarks(this.world, id);
    this.rockSwimmer = new RockSwimmer(this.world.seed, id);
    this.surfaceRaid = new SurfaceRaid(this.world.seed, id);
    this.oreDrops = state.drops;
    this.activeCharge = state.activeCharge;
    this.pod.world = this.world;
    this.pod.structures = this.structures;
    this.pod.reset();
    this.pod.x = 555;
    this.pod.y = WORLD.spawnY;
    this.pod.docked = true;
    this.cameraZoom = this.cameraZoomTarget = 1;
    this.orbitalTransition = 0;
    this.globeViewRequested = false;
    this.orbitalOverviewActive = false;
    this.ui.setOrbitalOverview(false);
    this.hemisphereFar = false;
    this.cameraFlip = this.cameraFlipStart = this.cameraFlipTarget = 0;
    this.cameraFlipElapsed = 0;
    this.mining.world = this.world;
    this.mining.target = undefined;
    this.mining.elapsed = this.mining.ratio = 0;
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = this.surfaceCameraY;
    this.revealAroundPod();
    this.ui.setMap(id);
    this.ui.setInOrbit(false);
    this.mothershipBoarded = true;
    this.ui.toast(`MOTHERSHIP ARRIVED · CORE FUEL −${CORE_FUEL.jumpCost} · ${this.progress.coreFuel} JUMPS LEFT · ${MAPS[id].name.toUpperCase()}`);
    this.save();
    return true;
  }
  pause() {
    if (this.ui.hasStarted && !this.ui.modal) {
      this.ui.open('pause');
      this.soundFx.update(false, false, this.depth, true);
    }
  }
  save(): SaveData | null {
    const p = this.progress;
    this.rememberCurrentMap();
    const data: SaveData = {
      version: 26,
      planetChart: { ...(this.world.planetChart ?? this.campaignChart) },
      campaignSeed: this.campaignSeed,
      activeMap: this.mapId,
      maps: this.mapStates,
      money: p.money,
      levels: { ...p.levels },
      fuel: p.fuel,
      hull: p.hull,
      cargo: { ...p.cargo },
      maxDepth: p.maxDepth,
      artifact: p.artifact,
      milestones: [...p.milestones],
      shipComponents: [...p.shipComponents],
      routeFragments: [...p.routeFragments],
      coreFuel: p.coreFuel,
      mothershipBoarded: this.mothershipBoarded,
      charges: p.charges,
      ownedPaints: [...p.ownedPaints],
      selectedPaint: p.selectedPaint,
      salvageMagnet: p.salvageMagnet,
      ownedSuits: [...p.ownedSuits],
      selectedSuit: p.selectedSuit,
      ownedDecals: [...p.ownedDecals],
      selectedDecal: p.selectedDecal,
      ownedProfiles: [...p.ownedProfiles],
      selectedProfile: p.selectedProfile,
      specialization: p.specialization,
      stasisModule: p.stasisModule,
      returnWinch: p.returnWinch,
      escapeSuit: p.escapeSuit,
      pilotEscaping: p.pilotEscaping,
      grappleOwned: p.grappleOwned,
    };
    const ok = this.saves.write(data);
    this.ui.saved(ok);
    if (!ok) this.ui.toast(this.saves.warning);
    return ok ? data : null;
  }
  fail(recovery = false, reason: 'fuel' | 'hull' | 'impact' = 'impact') {
    if (!recovery) {
      this.stranded = true;
      this.failureReason = reason;
      this.mining.target = undefined;
      this.mining.ratio = 0;
      this.ui.open('failure');
      this.ui.toast(reason === 'fuel' ? 'FUEL EMPTY · Miner secured in place. Choose a recovery option.' : 'MINER DISABLED · Choose a recovery option to return to the surface.');
      this.save();
      return;
    }
    const recoveryDock = emergencyRecoveryDock(this.pod.x, this.pod.y, this.world.planetChart);
    this.progress.pilotEscaping = false;
    this.progress.rescue();
    this.pod.reset();
    this.pod.x = recoveryDock.x;
    this.pod.y = recoveryDock.y;
    this.stranded = false;
    this.hemisphereFar = recoveryDock.far;
    this.cameraFlip = this.cameraFlipStart = this.cameraFlipTarget = recoveryDock.far ? 1 : 0;
    this.cameraFlipElapsed = 0;
    this.mining.target = undefined;
    this.mining.ratio = 0;
    this.planetFrameRotation = this.world.planetChart
      ? planetCameraFrameAngle(this.pod.x / WORLD.tile, this.pod.y / WORLD.tile, this.world.planetChart) ?? (recoveryDock.far ? Math.PI : 0)
      : 0;
    this.cameraTurnLabelRemaining = 0;
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = this.surfaceCameraY;
    this.wasSurface = this.surface;
    this.failureReason = recovery ? 'impact' : reason;
    this.ui.open('failure');
    this.ui.toast(
      recovery
        ? 'Recovery complete. Unsold cargo forfeited.'
        : 'Signal lost. Your pod has been recovered.',
    );
    this.soundFx.tone(100, 0.6, 'sawtooth', 0.04, 25);
    this.save();
  }
  beginPilotEscape() {
    this.progress.escapeSuit = false;
    this.progress.pilotEscaping = true;
    this.pod.docked = false;
    this.pod.vx = this.pod.vy = 0;
    this.pod.thrusting = false;
    this.mining.target = undefined;
    this.mining.ratio = 0;
    this.aimTile = undefined;
    this.burst(this.pod.x, this.pod.y, 0xff927d, 28);
    this.float('PILOT EJECTED', this.pod.x, this.pod.y - 35, '#b9f1dc');
    this.ui.toast('MINER DESTROYED · ESCAPE SUIT DEPLOYED · W BOOSTS · Q DROPS A CHARGE · REACH A BASE');
    this.soundFx.tone(180, 0.65, 'sawtooth', 0.045, 520);
    this.save();
  }
  completePilotEscape(atBeacon: boolean) {
    const rescueLongitude = this.pod.x, rescueHemisphereY = this.pod.y,
      dockY = surfaceDockYAt(rescueHemisphereY, this.world.planetChart);
    this.progress.pilotEscaping = false;
    this.progress.rescue();
    this.pod.x = rescueLongitude;
    this.pod.y = dockY;
    this.pod.vx = this.pod.vy = 0;
    this.pod.docked = true;
    this.pod.thrusting = this.pod.stasisActive = this.pod.reeling = false;
    this.pod.grappleAnchor = undefined;
    this.hemisphereFar = dockY >= this.world.coreWorldY;
    this.cameraFlip = this.cameraFlipStart = this.cameraFlipTarget = this.hemisphereFar ? 1 : 0;
    this.cameraFlipElapsed = 0;
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = this.surfaceCameraY;
    this.wasSurface = this.surface;
    this.ui.toast(atBeacon ? 'BEACON RESCUE · RETURNED TO THIS SIDE OF THE PLANET · ORE LOST' : 'SURFACE REACHED · PILOT SAFE · LANDED HERE · MINER AND ORE LOST');
    this.soundFx.reward();
    this.save();
  }
  burst(x: number, y: number, color: number, count = 12) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 130,
        vy: -30 - Math.random() * 130,
        life: 0.4 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 3,
      });
  }
  drillBurst(tile: Tile) {
    if (this.reducedMotion) return;
    const profile = drillImpactProfile(tile, this.mapId),
      drillTier = drillVisualTier(this.progress.levels.drill),
      x = tile.x * WORLD.tile + WORLD.tile / 2,
      y = tile.y * WORLD.tile + WORLD.tile / 2,
      aim = Math.atan2(y - this.pod.y, x - this.pod.x) + Math.PI;
    this.drillRecoil = Math.max(this.drillRecoil, tile.type === 'hard' ? 1 : 0.62);
    for (let i = 0; i < profile.count; i++) {
      const angle = aim + (Math.random() - 0.5) * 2.5,
        speed = 42 + Math.random() * (profile.kind === 'dust' ? 48 : 105);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 5, y: y + (Math.random() - 0.5) * 5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.22 + Math.random() * (profile.kind === 'dust' ? 0.28 : 0.34),
        color: i % 3 === 0 ? profile.accent : profile.color,
        size: profile.kind === 'dust' ? 2 + Math.random() * 3 : 2 + Math.random() * 2.5,
        kind: profile.kind, rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 13,
      });
    }
    if (profile.valuable) {
      for (let i = 0; i < 3; i++) this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 42, vy: -22 - Math.random() * 35,
        life: 0.2 + Math.random() * 0.12, color: 0xffefb2, size: 3 + Math.random() * 2,
        kind: 'glint', rotation: Math.random() * Math.PI,
      });
    }
    if (drillTier >= 3) this.particles.push({
      x, y, vx: 0, vy: 0, life: 0.3,
      color: drillTier === 3 ? 0x91f5e2 : drillTier === 4 ? 0xa2dff5 : 0xffdf91,
      size: 3, kind: 'ring',
    });
    if (drillTier === 5) for (let i = 0; i < 3; i++) {
      const angle = aim + (i - 1) * 0.34;
      this.particles.push({
        x, y, vx: Math.cos(angle) * (88 + i * 8), vy: Math.sin(angle) * (88 + i * 8),
        life: 0.24, color: i === 1 ? 0xffe8ab : 0x9cf3e2, size: 2.5,
        kind: 'spark', rotation: angle, rotationSpeed: 0,
      });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  }
  float(label: string, x: number, y: number, color = '#f0d0a0') {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color,
        backgroundColor: '#172024',
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5);
    this.floating.push({ text, x, y, life: 1.6 });
  }
  spawnOreDrop(tile: Tile, units: number, velocity?: { x: number; y: number }) {
    if (!tile.ore || units <= 0) return false;
    const id = `${this.world.seed}:${tile.x},${tile.y}`;
    if (this.oreDrops.some((drop) => drop.id === id)) return false;
    const angle = random(this.world.seed, tile.x, tile.y, 610) * Math.PI * 2;
    const speed = 45 + random(this.world.seed, tile.x, tile.y, 611) * 85;
    this.oreDrops.push({
      id,
      ore: tile.ore,
      units: Math.round(units * 2) / 2,
      x: tile.x * WORLD.tile + WORLD.tile / 2,
      y: tile.y * WORLD.tile + WORLD.tile / 2,
      vx: velocity?.x ?? Math.cos(angle) * speed,
      vy: velocity?.y ?? -45 - random(this.world.seed, tile.x, tile.y, 612) * 70,
    });
    return true;
  }
  broken(tile: Tile, collected: number, oreDropped = false, silent = false) {
    this.shake = this.reducedMotion ? 0 : 2;
    this.drillBurst(tile);
    if (!silent) {
      if (tile.type === 'hard') this.soundFx.tone(56, 0.18, 'sawtooth', 0.075, 22);
      else this.soundFx.tone(80, 0.12, 'triangle', 0.06, 30);
    }
    if (tile.ore && oreDropped) {
      this.float('ORE DROPPED', tile.x * WORLD.tile + 20, tile.y * WORLD.tile, ORES[tile.ore].hex);
      if (collected > 0) this.float(`+${collected} ${ORES[tile.ore].name.toUpperCase()}`, tile.x * WORLD.tile + 20, tile.y * WORLD.tile - 18, ORES[tile.ore].hex);
      if (this.tick - this.lastFullWarning > 2) {
        this.ui.toast(collected > 0 ? 'Cargo is full. The remaining ore is loose here; return after selling to collect it.' : 'Cargo is full. Ore dropped here; return after selling to collect it.');
        this.lastFullWarning = this.tick;
      }
    } else if (tile.ore && collected > 0) {
      if (!silent) this.soundFx.tone(tile.ore === 'diamond' ? 1100 : 650, 0.1, 'sine', 0.04, 950);
      this.float(
        `+${Number.isInteger(collected) ? collected : collected.toFixed(1)} ${ORES[tile.ore].name.toUpperCase()}`,
        tile.x * 40 + 20,
        tile.y * 40,
        ORES[tile.ore].hex,
      );
    }
  }
  recordFragment(tile: Tile, persist = true) {
    if (!tile.fragmentId || !this.progress.collectRouteFragment(tile.fragmentId)) return false;
    const fragment = ROUTE_FRAGMENTS.find((entry) => entry.id === tile.fragmentId)!;
    const component = SHIP_COMPONENTS[ROUTE_SHIP_COMPONENTS[fragment.id]];
    this.progress.milestones.push(fragment.milestoneId);
    this.soundFx.playLandmarkCue('route');
    this.soundFx.reward();
    this.ui.toast(`PLANETARY SIGNAL RECOVERED · ${component.name.toUpperCase()} SURVEY · +$${ROUTE_PART_RECOVERY_BONUS}`);
    this.float(`SURVEY · +$${ROUTE_PART_RECOVERY_BONUS}`, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, '#9ae8d8');
    if (persist) this.save();
    return true;
  }
  recordNavigationHash(tile: Tile, persist = true) {
    if (!tile.signalHashId || this.progress.milestones.includes(tile.signalHashId)) return false;
    const hash = NAVIGATION_HASHES.find((entry) => entry.id === tile.signalHashId)!;
    this.progress.milestones.push(hash.id);
    this.soundFx.playLandmarkCue('archive');
    this.soundFx.reward();
    this.ui.toast(crewArchiveRestored(this.progress.milestones)
      ? 'CREW ARCHIVE RESTORED · THE mothership SIGNAL IS A RETURN HANDSHAKE'
      : `CREW LOG RECOVERED · ${hash.crew} · ${hash.name} · NO EXCHANGE VALUE`);
    this.float(hash.hash, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, '#91f5e2');
    if (persist) this.save();
    return true;
  }
  recordCoreRelic(tile: Tile, persist = true) {
    if (!tile.coreRelicId) return false;
    const previousCoreCount = CORE_RELICS.filter((entry) => this.progress.milestones.includes(entry.id)).length;
    const relic = collectCoreRelic(this.progress, tile.coreRelicId);
    if (!relic) return false;
    this.soundFx.playLandmarkCue('archive');
    this.soundFx.reward();
    const complete = CORE_RELICS.every((entry) => this.progress.milestones.includes(entry.id));
    const chartedChapter = relic.mapId !== 'vesper-9' && previousCoreCount < CORE_RELICS.length - 1 && vesperChapterUnlocked(this.progress.milestones);
    const milestoneToast = complete
      ? 'LEVEL 16+ UPGRADE MILESTONE UNLOCKED'
      : previousCoreCount < 2 && CORE_RELICS.filter((entry) => this.progress.milestones.includes(entry.id)).length >= 2
        ? 'LEVEL 11+ UPGRADE MILESTONE UNLOCKED'
        : '';
    this.ui.toast(complete
      ? `PLANETARY CORE LEDGER COMPLETE · ${relic.name.toUpperCase()} · +${CORE_FUEL.unitsPerCore} CORE FUEL · ${milestoneToast} · +$${relic.bounty}`
      : chartedChapter
        ? `VESPER-9 CHARTED · NEW PLANET CHAPTER UNLOCKED · ${relic.name.toUpperCase()} · +${CORE_FUEL.unitsPerCore} CORE FUEL · +$${relic.bounty}`
        : milestoneToast
          ? `${relic.name.toUpperCase()} RECOVERED · +${CORE_FUEL.unitsPerCore} CORE FUEL · ${milestoneToast} · +$${relic.bounty}`
          : `${relic.name.toUpperCase()} RECOVERED · +${CORE_FUEL.unitsPerCore} CORE FUEL · +$${relic.bounty} CLAIM`);
    this.float(`+${CORE_FUEL.unitsPerCore} CORE FUEL`, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, `#${relic.tint.toString(16).padStart(6, '0')}`);
    if (persist) this.save();
    return true;
  }
  deployCharge() {
    if (this.world.planetChart && this.orbitalTransition >= 0.5) {
      this.ui.toast('Zoom in to the planet surface before deploying a charge.');
      return;
    }
    if (this.planetSurface) {
      this.ui.toast('Mining charges only arm below the surface.');
      return;
    }
    if (this.activeCharge) {
      this.ui.toast(`Charge fuse · ${this.activeCharge.fuse.toFixed(1)}s`);
      return;
    }
    if (!this.progress.useCharge()) {
      this.ui.toast('No mining charges. Buy a pack at the pod workshop.');
      return;
    }
    const gravity = this.world.gravitySign(this.pod.y);
    this.activeCharge = { x: this.pod.x, y: this.pod.y + gravity * 18, vy: gravity * Math.max(0, this.pod.vy * gravity), fuse: CHARGE.fuseSeconds };
    this.soundFx.tone(470, 0.12, 'square', 0.035, 260);
    this.ui.toast(`Charge armed · ${CHARGE.fuseSeconds.toFixed(1)}s fuse. Move clear or hold W to brake if it opens the floor below you.`);
    this.save();
  }
  detonateCharge() {
    const charge = this.activeCharge;
    if (!charge) return;
    const centerX = Math.floor(charge.x / WORLD.tile),
      centerY = Math.floor(charge.y / WORLD.tile),
      targets = chargeTargets(this.world, centerX, centerY, CHARGE.blastRadius);
    this.activeCharge = undefined;
    for (const tile of targets) {
      this.world.break(tile.x, tile.y);
      if (tile.ore) {
        const angle = random(this.world.seed, tile.x, tile.y, 610) * Math.PI * 2,
          speed = 45 + random(this.world.seed, tile.x, tile.y, 611) * 85;
        this.spawnOreDrop(tile, tile.oreUnits ?? 1, { x: Math.cos(angle) * speed, y: -45 - random(this.world.seed, tile.x, tile.y, 612) * 70 });
      }
      this.broken(tile, 0, !!tile.ore, true);
      this.recordFragment(tile, false);
      this.recordNavigationHash(tile, false);
      this.recordCoreRelic(tile, false);
    }
    this.shake = this.reducedMotion ? 0 : 11;
    this.burst(charge.x, charge.y, 0xffbd76, 42);
    this.soundFx.tone(62, 0.32, 'sawtooth', 0.09, 24);
    this.float('CHARGE DETONATED', charge.x, charge.y - 38, '#ffcf89');
    this.ui.toast(`${targets.length} tiles cleared · ${targets.filter((tile) => tile.ore).length} ore drops in the mine.`);
    this.save();
  }
  updateOreDrops(dt: number) {
    const remaining: OreDrop[] = [];
    let collectedAny = false;
    for (const drop of this.oreDrops) {
      if (this.progress.salvageMagnet) applySalvageMagnet(this.world, drop, this.pod.x, this.pod.y, dt);
      updateOreDropPhysics(this.world, drop, dt, this.world.gravitySign(drop.y));
      if (podWithinPickupReach(this.pod.x, this.pod.y, drop.x, drop.y, this.world)) {
        const gained = collectOreDrop(this.progress, drop);
        if (gained > 0) {
          collectedAny = true;
          this.float(`+${gained} ${ORES[drop.ore].name.toUpperCase()}`, drop.x, drop.y, ORES[drop.ore].hex);
          this.soundFx.tone(drop.ore === 'diamond' ? 1100 : 650, 0.12, 'sine', 0.035, 940);
        }
      }
      if (drop.units > 0) remaining.push(drop);
    }
    if (remaining.length !== this.oreDrops.length) this.oreDrops = remaining;
    if (collectedAny) this.save();
  }
  updateCharge(dt: number) {
    if (!this.activeCharge) return;
    updateChargePhysics(this.world, this.activeCharge, dt, this.world.gravitySign(this.activeCharge.y));
    this.activeCharge.fuse = Math.max(0, this.activeCharge.fuse - dt);
    if (this.activeCharge.fuse === 0) this.detonateCharge();
  }
  update(_time: number, delta: number) {
    if (!this.ui) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.tick += dt;
    if (!this.ui.paused) {
      const previousFarSide = this.farHemisphere, previousPodY = this.pod.y;
      const k = this.keys,
        winchRoute = k.R.isDown ? this.surfaceWinchCable() : undefined,
        input: Controls = {
          left: k.A.isDown || k.LEFT.isDown,
          right: k.D.isDown || k.RIGHT.isDown,
          down: k.S.isDown || k.DOWN.isDown,
          up: k.W.isDown || k.UP.isDown || k.SPACE.isDown,
          releaseGrapple: k.G.isDown,
          stasis: k.X.isDown,
          reel: k.R.isDown && !!winchRoute,
          winchTarget: winchRoute?.points[1],
          escapePack: this.progress.pilotEscaping,
        };
      const wasGrappled = !!this.pod.grappleAnchor, wasDocked = this.pod.docked;
      const previousOrbit = this.inOrbit;
      const orbitalControls = previousOrbit && (input.left || input.right || input.down || input.up);
      // Thrust is still available in orbit so players can leave from either hemisphere.
      const flightInput = this.mothershipBoarded
        ? { ...input, left: false, right: false, down: this.inOrbit && input.down, up: input.up && this.progress.shipComplete, stasis: false, reel: false, mothership: true }
        : input;
      const target = this.stranded || this.surfacePlacement || previousOrbit && !orbitalControls ? undefined : this.pod.update(dt, flightInput, (damage) => {
        if (this.progress.pilotEscaping || this.progress.hull <= 0) return;
        this.progress.hull = Math.max(0, this.progress.hull - damage);
        this.shake = 5;
        if (!this.landingHintShown) {
          this.ui.toast('Hard landing. Hold W before impact to brake your descent.');
          this.landingHintShown = true;
        }
        this.soundFx.tone(55, 0.22, 'sawtooth', 0.07, 20);
        this.float(`−${Math.ceil(damage)} HULL`, this.pod.x, this.pod.y - 25, '#ff927d');
      }, this.viewRotation);
      if (this.world.planetChart) {
        if (this.progress.shipComplete) {
          if (this.inOrbit && !input.down && !input.up) {
            this.pod.y = orbitalParkingY(this.pod.y, this.world.planetChart);
            this.pod.vy = 0;
          }
        } else if (this.pod.y < -MAX_TOWN_ALTITUDE) {
          this.pod.y = -MAX_TOWN_ALTITUDE;
          this.pod.vy = 0;
          if (previousPodY > -MAX_TOWN_ALTITUDE) this.ui.toast('MINE THIS PLANET’S CORE TO POWER INTERPLANETARY FLIGHT');
        }
      }
      const enteredOrbit = !previousOrbit && this.inOrbit;
      if (enteredOrbit) {
        this.pod.vy = 0;
        this.pod.vx = 0;
        this.pod.thrusting = false;
        this.pod.reeling = false;
        this.pod.stasisActive = false;
        this.pod.docked = false;
        this.globeViewRequested = true;
        this.cameraZoomTarget = GLOBE_HANDOFF_ZOOM;
        this.ui.setInOrbit(true);
        this.ui.toast(this.mothershipBoarded ? 'MOTHERSHIP IN ORBIT · OPEN WORLDS TO CHOOSE A PLANET' : 'ORBIT ACHIEVED · OPEN WORLDS TO CHOOSE YOUR NEXT PLANET');
        this.soundFx.tone(520, 0.3, 'sine', 0.05, 1040);
        this.save();
      }
      if (previousOrbit && !this.inOrbit) {
        this.globeViewRequested = false;
        this.cameraZoomTarget = 1;
        this.ui.setInOrbit(false);
        this.ui.toast(this.mothershipBoarded ? 'MOTHERSHIP LANDED · PRESS E TO DISEMBARK' : 'PLANET APPROACH · HOLD W TO BRAKE FOR A SAFE LANDING');
        if (this.mothershipBoarded) {
          this.pod.x = 555;
          this.pod.y = this.hemisphereFar ? this.world.farSurfaceY + WORLD.spawnY * -1 : WORLD.spawnY;
          this.pod.docked = true;
          this.pod.vx = this.pod.vy = 0;
        }
      }
      if (!wasDocked && this.pod.docked && input.reel && this.progress.returnWinch) {
        this.soundFx.tone(520, 0.18, 'sine', 0.05, 780);
        this.soundFx.tone(780, 0.14, 'sine', 0.035, 980);
        this.ui.toast('SURFACE WINCH · DOCKING CLAMP ENGAGED');
        this.float('WINCH RETURN COMPLETE', this.pod.x, this.pod.y - 34, '#9ce4cf');
      }
      if (!wasGrappled && this.pod.grappleAnchor) {
        this.soundFx.tone(620, 0.14, 'sine', 0.045, 1040);
        this.ui.toast('SAFETY GRAPPLE CAUGHT · G RELEASES · W THRUSTS FREE');
      }
      const crossedPlanetSeam = this.pod.planetSeamCrossings !== 0;
      if (Math.abs(this.pod.planetSeamCrossings) % 2 === 1) this.drillAimY *= -1;
      const crossedCoreCenter = crossedPlanetCore(previousPodY, this.pod.y, this.world.coreWorldY, this.pod.planetSeamCrossings);
      if (this.world.planetChart && crossedCoreCenter) this.cameraTurnLabelRemaining = this.cameraFlipDuration;
      this.hemisphereFar = farHemisphereAfterCoreExit(this.hemisphereFar, this.pod.y, this.world.planetChart);
      if (!this.progress.pilotEscaping && this.progress.hull <= 0 && this.progress.escapeSuit) this.beginPilotEscape();
      if (previousFarSide !== this.farHemisphere) {
        if (!this.world.planetChart) this.flipCameraForHemisphere(this.farHemisphere);
        if (crossedPlanetSeam) {
          this.ui.toast(this.farHemisphere ? 'SURFACE LOOP · FAR SIDE · KEEP EXPLORING' : 'SURFACE LOOP · HOME SIDE · KEEP EXPLORING');
        } else if (this.farHemisphere && !this.progress.milestones.includes('core-crossing')) {
          this.progress.milestones.push('core-crossing');
          this.progress.money += CORE.firstCrossingReward;
          this.ui.toast(`CORE CROSSED · GRAVITY REVERSED · +$${CORE.firstCrossingReward} mothership CLAIM · HOLD W TO CLIMB TOWARD THE FAR CRUST`);
          this.soundFx.playLandmarkCue('route');
          this.soundFx.reward();
          this.float('CORE CROSSING · +$2,200', this.pod.x, this.pod.y - 32, '#9ce4cf');
        } else this.ui.toast(this.farHemisphere ? 'FAR HEMISPHERE · GRAVITY PULLS TOWARD THE CORE · W THRUSTS OUTWARD' : 'CORE CROSSED AGAIN · HOMEWARD HEMISPHERE · GRAVITY FLIPPED');
        this.save();
      }
      const lookAheadTarget = fallCameraLookAhead(this.pod.vy, this.world.gravitySign(this.pod.y));
      this.cameraLookAhead += (lookAheadTarget - this.cameraLookAhead) * (1 - Math.exp(-5 * dt));
      const pointer = this.input.activePointer;
      const orbitalView = !!this.world.planetChart && this.orbitalTransition >= 0.5;
      const mouseAimAvailable = !this.mothershipBoarded && !this.surfacePlacement && !orbitalView && !this.progress.pilotEscaping &&
        this.ui.hasStarted && !this.ui.modal && !this.pod.docked && this.pod.y > 0;
      const mouseDrilling = mouseAimAvailable && pointer.leftButtonDown();
      const pointerAiming = mouseAimAvailable && (pointer.leftButtonDown() ||
        this.mouseAimActive && !input.down && !input.left && !input.right);
      const aimWorld = this.screenPointToWorld(pointer.x, pointer.y, this.scale.width, this.scale.height),
        aimWorldX = aimWorld.x,
        aimWorldY = aimWorld.y;
      this.aimTile = this.progress.pilotEscaping || orbitalView ? undefined : aimedDrillTarget(
        this.world, this.pod.x, this.pod.y,
        aimWorldX, aimWorldY,
        effectiveDrillReach(this.world, this.pod.x, this.pod.y, WORLD.tile * drillReachTiles(this.progress.levels.drill)),
      );
      const directionTarget = pointerAiming ? this.aimTile : target ?? this.mining.target;
      if (pointerAiming) {
        const aim = pointerDrillDirection(this.world, this.pod.x, this.pod.y, aimWorldX, aimWorldY);
        if (aim) {
          this.drillAimX = aim.x;
          this.drillAimY = aim.y;
        }
      } else if (directionTarget) {
          const dx = directionTarget.x * WORLD.tile + WORLD.tile / 2 - this.pod.x;
          const dy = directionTarget.y * WORLD.tile + WORLD.tile / 2 - this.pod.y;
          const length = Math.hypot(dx, dy) || 1;
          this.drillAimX = dx / length;
          this.drillAimY = dy / length;
      } else if (input.down) {
        this.drillAimX = 0;
        this.drillAimY = 1;
      } else if (input.left || input.right) {
        this.drillAimX = input.left ? -1 : 1;
        this.drillAimY = 0;
      } else {
        this.drillAimX = 0;
        this.drillAimY = 1;
      }
      const incomingSwimmerKind = this.rockSwimmer.active?.kind ?? 'rock-swimmer';
      if (this.rockSwimmer.update(dt, this.depth, this.pod.x, this.pod.y, this.structures, (x, y) => {
        this.soundFx.tone(620, 0.1, 'square', 0.025, 240);
        this.float('TURRET INTERCEPT', x, y - 38, '#f0b779');
      })) {
        if (this.progress.pilotEscaping) {
          this.fail();
          return;
        }
        const enemyDamage = incomingSwimmerKind === 'shard-manta' ? SHARD_MANTA.hullDamage
          : incomingSwimmerKind === 'hull-scrapper' ? HULL_SCRAPPER.hullDamage : ROCK_SWIMMER.hullDamage;
        this.progress.hull = Math.max(0, this.progress.hull - enemyDamage);
        this.shake = this.reducedMotion ? 0 : 4;
        const enemyName = incomingSwimmerKind === 'shard-manta' ? 'SHARD MANTA'
          : incomingSwimmerKind === 'hull-scrapper' ? 'HULL SCRAPPER' : 'ROCK SWIMMER';
        this.float(`−${enemyDamage} HULL · ${enemyName}`, this.pod.x, this.pod.y - 29, incomingSwimmerKind === 'shard-manta' ? '#e9a0ed' : incomingSwimmerKind === 'hull-scrapper' ? '#e2b483' : '#8fe5d5');
        this.ui.toast(incomingSwimmerKind === 'shard-manta'
          ? 'SHARD MANTA HIT · DODGE ITS WIND-UP OR DRILL IT BEFORE THE CHARGE.'
          : incomingSwimmerKind === 'hull-scrapper'
            ? 'HULL SCRAPPER HIT · ITS PLATED FRONT RESISTS THE DRILL. FLANK IT.'
            : 'ROCK SWIMMER COLLISION · Steer clear when its glow approaches.');
        this.soundFx.tone(160, 0.16, 'sine', 0.04, 80);
        this.save();
      }
      const manta = this.rockSwimmer.active;
      if (manta?.kind === 'shard-manta' && manta.mode === 'windup' && !manta.warningPlayed) {
        manta.warningPlayed = true;
        this.ui.toast('SHARD MANTA WINDING UP · DODGE THE CHARGE OR DRILL IT NOW.');
        this.soundFx.tone(360, 0.1, 'triangle', 0.03, 720);
      }
      const raidEvent = this.surfaceRaid.update(dt, this.surface, this.world, this.structures, (x, y) => {
        this.soundFx.tone(680, 0.11, 'square', 0.03, 220);
        this.float('COLONY DEFENSE FIRE', x, y - 36, '#f0b779');
      }, this.surface ? { x: this.pod.x, y: this.pod.y } : undefined);
      if (raidEvent?.type === 'warning') {
        this.ui.toast('COLONY ALERT · A raider is targeting your outpost. Drill it or let a pylon intercept.');
        this.soundFx.tone(440, 0.12, 'triangle', 0.035, 660);
      } else if (raidEvent?.type === 'intercepted') {
        this.ui.toast('RAIDER REPELLED · DEFENSE PYLON HELD THE COLONY.');
        this.float('RAIDER INTERCEPTED', raidEvent.x, raidEvent.y - 34, '#a4efd9');
      } else if (raidEvent?.type === 'damaged' || raidEvent?.type === 'destroyed') {
        const lost = raidEvent.type === 'destroyed';
        this.float(lost ? 'COLONY MODULE LOST' : 'COLONY MODULE DAMAGED', raidEvent.target.x, raidEvent.target.y - 45, '#ff987e');
        this.ui.toast(lost ? 'COLONY MODULE LOST · Rebuild it from the surface yard.' : 'COLONY MODULE DAMAGED · Repair it from the surface yard for $180.');
        this.save();
      }
      const swimmerPosition = this.rockSwimmer.active ? { x: this.rockSwimmer.active.x, y: this.rockSwimmer.active.y } : undefined,
        swimmerName = this.rockSwimmer.active?.kind === 'shard-manta' ? 'SHARD MANTA'
          : this.rockSwimmer.active?.kind === 'hull-scrapper' ? 'HULL SCRAPPER' : 'ROCK SWIMMER';
      const enemyBeamHeld = mouseDrilling || input.down || input.left || input.right;
      const swimmerHealthBefore = this.rockSwimmer.active?.health;
      const armorFlashBefore = this.rockSwimmer.active?.armorBlockedFlash ?? 0;
      const swimmerDefeated = enemyBeamHeld && this.rockSwimmer.hitByDrill(
        this.world, this.pod.x, this.pod.y, this.drillAimX, this.drillAimY,
        WORLD.tile * drillReachTiles(this.progress.levels.drill),
      );
      const swimmerHealthAfter = this.rockSwimmer.active?.health;
      const armorFlashAfter = this.rockSwimmer.active?.armorBlockedFlash ?? 0;
      if (swimmerDefeated) {
        this.burst(swimmerPosition?.x ?? this.pod.x, swimmerPosition?.y ?? this.pod.y, 0x9ce4cf, 10);
        this.ui.toast(`${swimmerName} DRIVEN OFF · DRILL EFFECTIVE`);
        this.soundFx.tone(520, 0.12, 'triangle', 0.035, 180);
      } else if (swimmerHealthBefore !== undefined && swimmerHealthAfter !== undefined && swimmerHealthAfter < swimmerHealthBefore) {
        this.burst(swimmerPosition?.x ?? this.pod.x, swimmerPosition?.y ?? this.pod.y, swimmerName === 'SHARD MANTA' ? 0xd797e8 : 0x83e5d3, 5);
        this.float(`${swimmerName} HIT · ${swimmerHealthAfter} HIT${swimmerHealthAfter === 1 ? '' : 'S'} LEFT`,
          swimmerPosition?.x ?? this.pod.x, (swimmerPosition?.y ?? this.pod.y) - 26, swimmerName === 'SHARD MANTA' ? '#e9a0ed' : '#8fe5d5');
        this.ui.toast(`${swimmerName} HIT · ${swimmerHealthAfter} MORE DRILL ${swimmerHealthAfter === 1 ? 'HIT' : 'HITS'} TO DRIVE OFF`);
        this.soundFx.tone(410, 0.08, 'triangle', 0.025, 250);
      } else if (armorFlashAfter > armorFlashBefore && swimmerName === 'HULL SCRAPPER') {
        this.burst(swimmerPosition?.x ?? this.pod.x, swimmerPosition?.y ?? this.pod.y, 0xe2b483, 4);
        this.float('ARMOR DEFLECTED · FLANK IT', swimmerPosition?.x ?? this.pod.x, (swimmerPosition?.y ?? this.pod.y) - 26, '#e2b483');
        this.ui.toast('HULL SCRAPPER ARMOR DEFLECTED THE DRILL · AIM FOR ITS SIDE OR REAR.');
        this.soundFx.tone(260, 0.1, 'square', 0.025, 170);
      }
      const raiderPosition = this.surfaceRaid.active ? { x: this.surfaceRaid.active.x, y: this.surfaceRaid.active.y } : undefined;
      if (enemyBeamHeld && this.surfaceRaid.hitByDrill(
        this.world, this.pod.x, this.pod.y, this.drillAimX, this.drillAimY,
        WORLD.tile * drillReachTiles(this.progress.levels.drill),
      )) {
        this.burst(raiderPosition?.x ?? this.pod.x, raiderPosition?.y ?? this.pod.y, 0xf0b779, 12);
        this.ui.toast('SURFACE RAIDER DRIVEN OFF · COLONY SAFE');
        this.soundFx.tone(540, 0.12, 'triangle', 0.035, 200);
      }
      this.updateOreDrops(dt);
      let drillTarget = this.mothershipBoarded || orbitalView ? undefined : mouseDrilling ? this.aimTile : target;
      const laserTier = drillVisualTier(this.progress.levels.drill) === 5;
      let laserVenting = false;
      if (laserTier) {
        const venting = this.laserThermal.vent > 0;
        const drillHeld = (mouseDrilling || input.down) && !this.ui.paused && !this.ui.modal;
        this.laserThermal = advanceLaserThermal(this.laserThermal, dt, !!drillTarget && !venting && drillHeld, drillHeld);
        laserVenting = venting || this.laserThermal.vent > 0;
      } else this.laserThermal = { heat: 0, vent: 0 };
      const mouseOrientation = mouseDrilling
        ? { x: this.drillAimX, y: this.drillAimY }
        : input.down ? 'vertical' as const : input.left || input.right ? 'horizontal' as const : 'vertical' as const;
      const protectedTiles = drillProtection(this.pod.overlaps(this.pod.x, this.pod.y, this.viewRotation), drillTarget);
      if (!this.progress.pilotEscaping && !laserVenting && !this.stranded && !this.surfacePlacement) this.mining.update(dt, drillTarget, (tile, collected, dropped) => {
        if (dropped > 0 && this.spawnOreDrop(tile, dropped)) this.save();
        this.broken(tile, collected, dropped > 0);
        this.recordFragment(tile);
        this.recordNavigationHash(tile);
        this.recordCoreRelic(tile);
      }, mouseDrilling ? mouseOrientation : directionalDrillOrientation(input), protectedTiles);
      this.updateCharge(dt);
      this.progress.maxDepth = Math.max(this.progress.maxDepth, this.depth);
      let newMilestone = false;
      for (const milestone of CAMPAIGN_MILESTONES) {
        if (this.mapId !== 'cryo-shelf' && this.progress.maxDepth >= milestone.depth && !this.progress.milestones.includes(milestone.id)) {
          this.progress.milestones.push(milestone.id);
          this.ui.toast(`ARCHIVE UPDATED · ${milestone.title.toUpperCase()}`);
          newMilestone = true;
        }
      }
      if (newMilestone) this.save();
      if (!this.progress.pilotEscaping && this.progress.hull <= 0) {
        this.fail(false, 'hull');
        return;
      }
      if (!this.progress.pilotEscaping && !this.stranded && this.progress.fuel <= 0 && !this.planetSurface) {
        this.fail(false, 'fuel');
        return;
      }
      if (this.progress.pilotEscaping && (this.planetSurface || nearbyServiceStation(this.structures, this.pod.x, this.pod.y))) {
        this.completePilotEscape(!this.planetSurface);
      }
      if (this.surface && !this.wasSurface) {
        this.save();
        this.ui.toast('Welcome back, prospector. Your haul is ready to sell.');
      }
      this.wasSurface = this.surface;
      if (this.progress.fuel / this.progress.max('fuel') < 0.23 && !this.warned) {
        this.soundFx.tone(330, 0.4, 'square', 0.025, 260);
        this.warned = true;
      }
      if (this.progress.fuel / this.progress.max('fuel') > 0.3) this.warned = false;
      if (this.depth > 1050 && !this.progress.artifact) {
        this.progress.artifact = true;
        this.progress.money += 500;
        this.float('UNKNOWN SIGNAL · +$500', this.pod.x, this.pod.y - 40, '#89e8cf');
        this.ui.toast('A buried transmission. Older than the outpost. Survey bounty: $500.');
        this.save();
      }
      this.saveClock += dt;
      if (this.saveClock > 8) {
        this.saveClock = 0;
        this.save();
      }
      this.revealAroundPod();
    }
    this.soundFx.update(
      this.pod.thrusting || Math.abs(this.pod.vx) > 20,
      !!this.mining.target,
      this.depth,
      this.ui.paused,
    );
    const goalX = Math.max(
        -100,
        Math.min(this.world.widthTiles * WORLD.tile - this.scale.width + 100, this.pod.x - this.scale.width / 2),
      ),
      goalY = Math.max(
        this.surfaceCameraY,
        this.pod.y -
          Phaser.Math.Linear(
            -this.surfaceCameraY,
            this.scale.height * 0.44,
            Phaser.Math.Clamp(this.pod.y / 400, 0, 1),
          ),
      );
    if (this.world.planetChart) this.updatePlanetCameraFrame(dt);
    else this.updateCameraFlip(dt);
      const localZoomFloor = this.world.planetChart ? GLOBE_HANDOFF_ZOOM : this.minimumCameraZoom,
        zoomToGlobe = !!this.world.planetChart && (this.globeViewRequested || this.inOrbit),
        atHandoffZoom = Math.abs(this.cameraZoom - GLOBE_HANDOFF_ZOOM) <= 0.0005;
      this.cameraZoomTarget = Math.max(this.cameraZoomTarget, localZoomFloor);
      if (this.reducedMotion) {
        this.cameraZoom = this.cameraZoomTarget;
        this.orbitalTransition = advanceOrbitalTransition(this.orbitalTransition, dt, zoomToGlobe, true);
      } else if (this.orbitalTransition > 0 && !zoomToGlobe) {
        // Finish the animated return to the local surface before growing its camera again.
        this.cameraZoom = GLOBE_HANDOFF_ZOOM;
        this.orbitalTransition = advanceOrbitalTransition(this.orbitalTransition, dt, false);
      } else {
        this.cameraZoom += (this.cameraZoomTarget - this.cameraZoom) * (1 - Math.exp(-7 * dt));
        this.orbitalTransition = advanceOrbitalTransition(this.orbitalTransition, dt, zoomToGlobe && atHandoffZoom);
      }
    this.camX += (goalX - this.camX) * (1 - Math.exp(-6 * dt));
    this.camY += (goalY - this.camY) * (1 - Math.exp(-6 * dt));
    this.drillRecoil *= Math.exp(-18 * dt);
    this.shake = Math.max(0, this.shake - dt * 15);
    this.world.prune(this.pod.y, this.pod.x);
    this.atmosphere.update(this.world, dt, this.atmosphereView(), this.reducedMotion, this.ui.paused);
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.kind !== 'ring') {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += this.world.gravitySign(particle.y) * 200 * dt;
      }
      particle.rotation = (particle.rotation ?? 0) + (particle.rotationSpeed ?? 0) * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floating) {
      f.life -= dt;
      f.y -= 20 * dt;
      const fp = this.worldPointToScreen(f.x, f.y, this.scale.width, this.scale.height);
      f.text.setPosition(fp.x, fp.y).setAlpha(Math.min(1, f.life * 2));
      if (f.life <= 0) f.text.destroy();
    }
    this.floating = this.floating.filter((f) => f.life > 0);
    this.ui.target(this.mining.target, this.mining.ratio, this.mining.warningRemaining, {
      active: this.mining.cargoOverflow,
      units: this.mining.warningUnits,
      space: this.mining.warningSpace,
    }, this.laserThermal.vent > 0);
    this.uiClock += dt;
    if (this.uiClock > 0.08) {
      const descentSpeed = this.pod.vy * this.world.gravitySign(this.pod.y);
      const coreDrillMode = this.inCoreDrillHalo();
      this.ui.update(this.depth, this.surface, this.uiClock, this.pod.docked, this.estimateReturnFuel(), descentSpeed, this.farHemisphere, this.progress.pilotEscaping, this.world.coreDepthMeters,
        this.progress.returnWinch, this.pod.reeling, !!this.surfaceWinchCable(), this.laserThermal.heat, this.laserThermal.vent,
        drillVisualTier(this.progress.levels.drill) === 5, this.planetSurface, coreDrillMode,
        this.isNearMothership(), this.mothershipBoarded, this.progress.shipComplete, this.inOrbit);
      this.ui.drawMap(this.world, this.pod);
      this.uiClock = 0;
    }
    this.draw();
  }
  atmosphereView() {
    const cameraY = cameraFocusY(this.pod.y, this.cameraLookAhead, this.viewRotation);
    return { x: this.pod.x - this.scale.width / 2, y: cameraY - this.scale.height / 2, width: this.scale.width, height: this.scale.height,
      podX: this.pod.x, podY: this.pod.y, thrusting: this.pod.thrusting,
      drilling: !!this.mining.target, aimX: this.drillAimX, aimY: this.drillAimY };
  }
  private inCoreDrillHalo() {
    const chart = this.world.planetChart;
    if (!chart) return false;
    const point = planetChartToCartesian({ u: this.pod.x / WORLD.tile, v: this.pod.y / WORLD.tile }, chart.columns, chart.radiusRows, WORLD.tile),
      core = planetChartToCartesian({ u: WORLD.homeColumn, v: chart.radiusRows }, chart.columns, chart.radiusRows, WORLD.tile);
    return Math.hypot(point.x - core.x, point.y - core.y) <= CORE.drillAssistRadius;
  }
  drawOrbitalOverview(alpha: number) {
    const g = this.orbitG, chart = this.world.planetChart, w = this.scale.width, h = this.scale.height;
    g.clear().setAlpha(alpha);
    if (!chart) return;
    g.fillStyle(0x071015);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      const x = random(this.world.seed, i, 641) * w, y = random(this.world.seed, i, 642) * h;
      g.fillStyle(0xb2ded5, 0.12 + random(this.world.seed, i, 643) * 0.24);
      g.fillCircle(x, y, 0.7 + random(this.world.seed, i, 644) * 1.1);
    }
    const overviewZoom = this.minimumCameraZoom,
      overviewPoint = (x: number, y: number) => cameraZoomPoint(this.worldPointToLocal(x, y, w, h), w, h, overviewZoom),
      center = overviewPoint(chart.columns / 2 * WORLD.tile, chart.radiusRows * WORLD.tile);
    const radius = chart.radiusRows * WORLD.tile * overviewZoom;
    if (radius < 2) return;
    const surface = MAPS[this.mapId].surface;
    g.fillStyle(surface.ground, 0.95);
    g.fillCircle(center.x, center.y, radius);
    g.fillStyle(surface.mountains[0], 0.98);
    g.fillCircle(center.x, center.y, radius * 0.84);
    g.fillStyle(surface.sky[2], 0.98);
    g.fillCircle(center.x, center.y, radius * 0.66);
    g.fillStyle(MAPS[this.mapId].palette[2], 0.98);
    g.fillCircle(center.x, center.y, radius * 0.47);
    g.fillStyle(MAPS[this.mapId].palette[3], 0.98);
    g.fillCircle(center.x, center.y, radius * 0.27);
    g.fillStyle(0x172a32, 1);
    g.fillCircle(center.x, center.y, Math.max(5, radius * 0.105));
    g.lineStyle(Math.max(1, radius * 0.006), 0xc4e3d5, 0.92);
    g.strokeCircle(center.x, center.y, radius);
    const surfacePoint = (u: number, v: number) => overviewPoint(u * WORLD.tile, v * WORLD.tile);
    for (const feature of this.surfaceFeatures) {
      const point = surfacePoint(feature.x / WORLD.tile, feature.y / WORLD.tile);
      g.fillStyle(surfaceLandmarkColor(this.mapId, feature.kind), 0.96);
      g.fillCircle(point.x, point.y, Math.max(1.5, radius * 0.014 * feature.scale));
    }
    const halves = [0, chart.radiusRows * 2];
    for (const row of halves) {
      let previous: { x: number; y: number } | undefined;
      for (let step = 0; step <= 48; step++) {
        const current = surfacePoint(chart.columns * step / 48, row);
        if (previous) {
          g.lineStyle(Math.max(1, radius * 0.004), 0x9fcbbb, 0.6);
          g.lineBetween(previous.x, previous.y, current.x, current.y);
        }
        previous = current;
      }
    }
    for (let line = 0; line < 24; line++) {
      const u = chart.columns * line / 24;
      for (const row of [0, chart.radiusRows * 2]) {
        const endpoint = surfacePoint(u, row);
        g.lineStyle(1, 0xa7c7bb, 0.16);
        g.lineBetween(center.x, center.y, endpoint.x, endpoint.y);
      }
    }
    const destroyedStride = Math.max(1, Math.ceil(this.world.destroyed.size / 3600));
    let index = 0;
    for (const key of this.world.destroyed) {
      if (index++ % destroyedStride) continue;
      const [tileX, tileY] = key.split(',').map(Number);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) continue;
      const point = surfacePoint(tileX + 0.5, tileY + 0.5);
      if (point.x < 0 || point.x > w || point.y < 0 || point.y > h) continue;
      g.fillStyle(0xc2e7d9, 0.82);
      g.fillCircle(point.x, point.y, Math.max(0.8, WORLD.tile * overviewZoom * 0.3));
    }
    const discoveryStride = Math.max(1, Math.ceil(this.world.discovered.size / 900));
    index = 0;
    for (const key of this.world.discovered) {
      if (index++ % discoveryStride) continue;
      if (this.world.destroyed.has(key)) continue;
      const [tileX, tileY] = key.split(',').map(Number), tile = this.world.generate(tileX, tileY);
      if (!tile.ore && !tile.signalHashId && !tile.coreRelicId && !tile.geode && !tile.regionFind) continue;
      const point = surfacePoint(tileX + 0.5, tileY + 0.5);
      if (point.x < 0 || point.x > w || point.y < 0 || point.y > h) continue;
      const color = tile.signalHashId ? 0x91f5e2 : tile.coreRelicId ? 0xffd78b : tile.geode ? 0xd1b9ff : tile.regionFind ? 0xa6ffe3 : ORES[tile.ore!].color;
      g.fillStyle(color, 0.95);
      g.fillCircle(point.x, point.y, Math.max(1.1, WORLD.tile * overviewZoom * (tile.geode || tile.regionFind || tile.coreRelicId ? 0.38 : 0.24)));
    }
    for (const row of [0, chart.radiusRows * 2]) {
      const hab = surfacePoint(WORLD.homeColumn + 0.5, row);
      g.fillStyle(0xf2c782, 0.25);
      g.fillCircle(hab.x, hab.y, Math.max(6, radius * 0.055));
      g.fillStyle(0xffe2a8, 1);
      g.fillCircle(hab.x, hab.y, Math.max(2, radius * 0.018));
    }
    const coreRelicPoint = surfacePoint(WORLD.homeColumn + 0.5, chart.radiusRows);
    g.lineStyle(2, 0xf3cf8b, 0.95);
    g.strokeCircle(coreRelicPoint.x, coreRelicPoint.y, Math.max(6, radius * 0.045));
    g.fillStyle(0xffd48a, 1);
    g.fillCircle(coreRelicPoint.x, coreRelicPoint.y, Math.max(2, radius * 0.018));
    for (const structure of this.structures) {
      const point = surfacePoint(structure.x / WORLD.tile, structure.y / WORLD.tile);
      g.fillStyle(structure.kind === 'service' ? 0x8be1cf : structure.kind === 'turret' ? 0xf0b779 : 0xd5e3db, 0.95);
      g.fillRect(point.x - 2, point.y - 2, 4, 4);
    }
    const pod = this.worldPointToScreen(this.pod.x, this.pod.y, w, h);
    g.fillStyle(0xffdc95, 0.28);
    g.fillCircle(pod.x, pod.y, Math.max(10, radius * 0.06));
    g.fillStyle(0xffe0a0, 1);
    g.fillTriangle(pod.x, pod.y - 7, pod.x - 5, pod.y + 5, pod.x + 5, pod.y + 5);
  }
  draw() {
    const g = this.g,
      w = this.scale.width,
      h = this.scale.height,
      T = WORLD.tile,
      inverted = this.cameraFlip > 0.5,
      angle = this.viewRotation,
      cos = Math.cos(angle),
      sin = Math.sin(angle),
      viewSign = 1,
      cameraY = cameraFocusY(this.pod.y, this.cameraLookAhead, angle),
      surfaceStyle = MAPS[this.mapId].surface;
    const zoom = Math.max(0.0001, this.cameraZoom),
      expandedViewport = {
        x: -w * (1 - zoom) / (2 * zoom),
        y: -h * (1 - zoom) / (2 * zoom),
        width: w / zoom,
        height: h / zoom,
      };
    const orbitBlend = this.world.planetChart ? Phaser.Math.SmoothStep(this.orbitalTransition, 0, 1) : 0;
    const orbitalView = !!this.world.planetChart && this.orbitalTransition >= 1;
    if (this.orbitalOverviewActive !== orbitalView) {
      this.orbitalOverviewActive = orbitalView;
      this.ui.setOrbitalOverview(orbitalView);
    }
    g.setScale(this.cameraZoom).setPosition(w * (1 - this.cameraZoom) / 2, h * (1 - this.cameraZoom) / 2);
    g.setAlpha(1 - orbitBlend);
    this.orbitG.clear().setAlpha(orbitBlend);
    this.orbitalLabel.setPosition(w / 2, h - 58).setVisible(orbitBlend > 0.25);
    if (this.inOrbit) this.orbitalLabel.setText('ORBIT PARKING  ·  WORLDS TO DEPART  ·  S TO DESCEND');
    else this.orbitalLabel.setText('ORBITAL CUTAWAY  ·  WHEEL TO RETURN');
    const legacyFlipping = !this.world.planetChart && Math.abs(this.cameraFlipTarget - this.cameraFlipStart) > 0.001 && this.cameraFlipElapsed < this.cameraFlipDuration;
    const flipping = this.world.planetChart ? this.cameraTurnLabelRemaining > 0 : legacyFlipping;
    this.cameraFlipLabel.setPosition(w / 2, 34)
      .setAlpha(this.world.planetChart
        ? Math.min(1, (this.cameraFlipDuration - this.cameraTurnLabelRemaining) * 5, this.cameraTurnLabelRemaining * 2)
        : Math.min(1, this.cameraFlipElapsed * 5, (this.cameraFlipDuration - this.cameraFlipElapsed) * 2))
      .setVisible(flipping);
    const project = (x: number, y: number) => {
      const point = this.worldPointToLocal(x, y, w, h);
      return {
        x: Math.round(point.x) + (this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake),
        y: Math.round(point.y),
      };
    };
    const localProject = (x: number, y: number, tangent: number, outward: number) => {
      if (!this.world.planetChart) return project(x + tangent, y - outward);
      const chart = this.world.planetChart;
      const point = planetChartLocalOffset(
        { u: x / T, v: y / T }, tangent, outward, chart.columns, chart.radiusRows, T,
      );
      return project(point.u * T, point.v * T);
    };
    const screenProject = (x: number, y: number) => cameraZoomPoint(project(x, y), w, h, this.cameraZoom);
    const isOnScreen = (x: number, y: number, padding = 0) => {
      const point = screenProject(x, y);
      return point.x >= -padding && point.x <= w + padding && point.y >= -padding && point.y <= h + padding;
    };
    const sx = (x: number) => project(x, this.pod.y).x,
      sy = (y: number) => project(this.pod.x, y).y;
    g.clear();
    g.fillStyle(0x131b20);
    g.fillRect(expandedViewport.x, expandedViewport.y, expandedViewport.width, expandedViewport.height);
    if (orbitalView) {
      this.drawOrbitalOverview(1);
      this.labels.forEach((label) => label.setVisible(false));
      this.shipStatusLabel.setVisible(false);
      return;
    }
    if (orbitBlend > 0) this.drawOrbitalOverview(orbitBlend);
    const ground = sy(surfaceGroundY(this.pod.y, this.world.planetChart));
    if (ground > 0 && this.world.planetChart) {
      const [skyTL, skyTR, skyBL, skyBR] = surfaceStyle.sky;
      g.fillGradientStyle(skyTL, skyTR, skyBL, skyBR);
      g.fillRect(expandedViewport.x, expandedViewport.y, expandedViewport.width, expandedViewport.height);
      const farSurface = this.pod.y >= this.world.coreWorldY;
      const surfaceRow = farSurface ? this.world.farSurfaceRow : 0;
      drawSurfaceLandmarks(g, this.surfaceFeatures, this.mapId, localProject, (x, y) => isOnScreen(x, y, 260));
      for (let i = 0; i < STATIONS.length; i++) {
        const station = STATIONS[i], label = this.labels[i];
        const point = screenProject(station.x, (surfaceRow + (farSurface ? 110 : -110)) * T);
        label.setVisible(h >= 500).setPosition(point.x, point.y);
      }
      const shipLabel = screenProject(700, (surfaceRow + (farSurface ? 157 : -157)) * T);
      this.shipStatusLabel
        .setText(this.progress.shipComplete
          ? this.isNearMothership() ? this.mothershipBoarded ? 'E · DISEMBARK' : 'E · BOARD MOTHERSHIP' : `MOTHERSHIP · ${this.progress.coreFuel} CORE FUEL`
          : 'MINE CORE · POWER MOTHERSHIP')
        .setPosition(shipLabel.x, shipLabel.y)
        .setVisible(h >= 400);
    }
    if (ground > 0 && !this.world.planetChart) {
      const [skyTL, skyTR, skyBL, skyBR] = surfaceStyle.sky;
      g.fillGradientStyle(skyTL, skyTR, skyBL, skyBR);
      g.fillRect(0, 0, w, Math.min(h, ground));
      for (let i = 0; i < 65; i++) {
        const x = random(56, i, 1) * w,
          y = random(56, i, 2) * 220;
        g.fillStyle(0xe8d1ba, 0.15 + random(56, i, 3) * 0.35);
        g.fillRect(x, y, 1.5, 1.5);
      }
      g.fillStyle(surfaceStyle.moon, 0.7);
      g.fillCircle(w * 0.77, ground - 236, 24);
      g.fillStyle(skyTL, 0.92);
      g.fillCircle(w * 0.77 - 9, ground - 241, 22);
      for (let layer = 0; layer < 3; layer++) {
        const pts: Phaser.Types.Math.Vector2Like[] = [{ x: -50, y: ground }];
        for (let x = -80; x <= w + 160; x += 80) {
          const n = Math.floor((x + this.camX * (0.1 + layer * 0.12)) / 80);
          pts.push({ x, y: ground - 40 - (2 - layer) * 26 - random(440, n, layer) * 75 });
        }
        pts.push({ x: w + 160, y: ground });
        g.fillStyle(surfaceStyle.mountains[layer]);
        g.fillPoints(pts, true);
      }
      g.fillStyle(surfaceStyle.ground);
      g.fillRect(0, ground - 8, w, 8);
      g.fillStyle(surfaceStyle.edge);
      g.fillRect(0, ground - 8, w, 2);
      const coreRecords = this.progress.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id));
      drawSurfaceTown(g, ground, sx, surfaceTownTier(this.progress.shipComponents, coreRecords), this.tick, this.reducedMotion);
      for (let i = 0; i < STATIONS.length; i++) {
        const s = STATIONS[i],
          x = sx(s.x),
          y = ground,
          ww = s.width;
        g.fillStyle(0x352e2c);
        g.fillRect(x - ww / 2 - 7, y - 8, ww + 14, 8);
        g.fillStyle(0x39413e);
        g.fillRect(x - ww / 2, y - 57, ww, 49);
        g.fillStyle(0x69736a);
        g.fillRect(x - ww / 2 + 3, y - 61, ww - 6, 6);
        g.fillStyle(0x9b9b80);
        g.fillRect(x - ww / 2 + 8, y - 66, ww - 16, 5);
        g.fillStyle(0x202e30);
        g.fillRect(x - ww / 2 + 8, y - 49, ww - 16, 36);
        g.fillStyle(s.color, 0.9);
        g.fillRect(x - ww / 2 + 10, y - 48, ww - 20, 3);
        if (i === 1) {
          for (let q = 0; q < 3; q++) {
            g.fillStyle(0x82928a);
            g.fillRoundedRect(x - 54 + q * 26, y - 43, 18, 30, 4);
            g.fillStyle(0xb5c6b6);
            g.fillRect(x - 51 + q * 26, y - 40, 3, 22);
          }
          g.lineStyle(2, 0x91c8bb);
          g.strokePoints([
            { x: x + 34, y: y - 37 },
            { x: x + 46, y: y - 37 },
            { x: x + 46, y: y - 13 },
          ]);
        } else {
          for (let q = 0; q < 5; q++) {
            g.fillStyle(s.color, q === 2 ? 0.8 : 0.25);
            g.fillRect(x - 47 + q * 20, y - 39, 12, 11);
          }
          g.fillStyle(0x6c766d);
          g.fillRect(x - 45, y - 21, 90, 4);
        }
        g.fillStyle(0x85917f);
        g.fillRect(x + ww / 2 - 9, y - 103, 3, 39);
        g.fillStyle(s.color, 0.8);
        g.fillRect(x + ww / 2 - 9, y - 101, 21, 10);
        const labelPoint = cameraZoomPoint({ x, y: y - 103 }, w, h, this.cameraZoom);
        this.labels[i].setVisible(h >= 500).setPosition(labelPoint.x, labelPoint.y);
      }
      const ax = sx(490);
      g.lineStyle(3, 0x38413e);
      g.lineBetween(ax, ground - 7, ax, ground - 130);
      g.lineBetween(ax - 22, ground - 7, ax, ground - 90);
      g.lineBetween(ax + 22, ground - 7, ax, ground - 90);
      g.lineStyle(2, 0xabac91);
      g.strokeCircle(ax, ground - 136, 15);
      g.lineBetween(ax - 21, ground - 157, ax + 21, ground - 116);
      g.fillStyle(0xdf9b69, 0.15);
      g.fillEllipse(sx(this.pod.x), ground - 2, 66, 7);
      const shipX = sx(555), hoverBob = this.reducedMotion ? 0 : Math.sin(this.tick * 2.2) * 1.4;
      // Permanent mother ship: it arrives ready to use; planetary cores feed
      // its jump drive, never the miner's local thrust tank.
      g.fillStyle(0x303b38);
      g.fillRoundedRect(shipX - 53, ground - 12, 106, 12, 3);
      g.lineStyle(2, 0x9aab9a, 0.75);
      g.lineBetween(shipX - 35, ground - 12, shipX - 40, ground + 1);
      g.lineBetween(shipX + 35, ground - 12, shipX + 40, ground + 1);
      g.fillStyle(0x71877d);
      g.fillPoints([
        { x: shipX, y: ground - 140 + hoverBob }, { x: shipX + 15, y: ground - 105 + hoverBob },
        { x: shipX + 47, y: ground - 29 + hoverBob }, { x: shipX + 36, y: ground - 18 },
        { x: shipX - 36, y: ground - 18 }, { x: shipX - 47, y: ground - 29 + hoverBob },
        { x: shipX - 15, y: ground - 105 + hoverBob },
      ], true);
      g.fillStyle(0x26383b);
      g.fillPoints([{ x: shipX, y: ground - 114 + hoverBob }, { x: shipX + 10, y: ground - 97 + hoverBob }, { x: shipX - 10, y: ground - 97 + hoverBob }], true);
      g.fillStyle(0x9ce8d7, 0.9);
      g.fillRect(shipX - 6, ground - 87 + hoverBob, 12, 7);
      g.fillStyle(this.mothershipBoarded && this.pod.thrusting ? 0xffc078 : 0x6fdbc4, this.mothershipBoarded && this.pod.thrusting ? 0.9 : 0.35);
      g.fillTriangle(shipX - 13, ground - 18, shipX + 13, ground - 18, shipX, ground - 3 + hoverBob);
      if (this.isNearMothership() && !this.mothershipBoarded) {
        g.lineStyle(2, 0xf2d08c, 0.9);
        g.strokeCircle(shipX, ground - 62 + hoverBob, 58 + (this.reducedMotion ? 0 : Math.sin(this.tick * 3) * 2));
      }
      const shipLabel = cameraZoomPoint({ x: Phaser.Math.Clamp(shipX + 145, 350, w - 110), y: ground - 151 }, w, h, this.cameraZoom);
      this.shipStatusLabel
        .setText(this.progress.shipComplete ? `MOTHERSHIP · ${this.progress.coreFuel} CORE FUEL` : 'MINE CORE · POWER MOTHERSHIP')
        .setPosition(shipLabel.x, shipLabel.y)
        .setVisible(h >= 400);
    } else {
      this.labels.forEach((l) => l.setVisible(false));
      this.shipStatusLabel.setVisible(false);
    }
    let left: number, right: number, top: number, bottom: number;
    if (this.world.planetChart) {
      const span = Math.ceil(Math.max(w, h) / (2 * this.cameraZoom * T)) + 4,
        centerX = Math.floor(this.pod.x / T), centerY = Math.floor(this.pod.y / T);
      left = centerX - span; right = centerX + span;
      top = Math.max(0, centerY - span); bottom = Math.min(this.world.farSurfaceRow - 1, centerY + span);
    } else {
      const corners = [project(0, 0), project(this.world.widthTiles * T, 0), project(0, this.world.farSurfaceY), project(this.world.widthTiles * T, this.world.farSurfaceY)];
      const worldBounds = corners.map((point) => {
        const unzoomed = cameraUnzoomPoint(point, w, h, this.cameraZoom);
        return {
          x: this.pod.x + (unzoomed.x - w / 2) * cos + (unzoomed.y - h / 2) * sin,
          y: cameraY - (unzoomed.x - w / 2) * sin + (unzoomed.y - h / 2) * cos,
        };
      });
      left = Math.max(0, Math.floor(Math.min(...worldBounds.map((point) => point.x)) / T));
      right = Math.min(this.world.widthTiles - 1, Math.ceil(Math.max(...worldBounds.map((point) => point.x)) / T));
      top = Math.max(0, Math.floor(Math.min(...worldBounds.map((point) => point.y)) / T));
      bottom = Math.ceil(Math.max(...worldBounds.map((point) => point.y)) / T);
    }
    const podPolar = this.world.planetChart
        ? planetChartToCartesian({ u: this.pod.x / T, v: this.pod.y / T }, this.world.planetChart.columns, this.world.planetChart.radiusRows, T)
        : { x: this.pod.x, y: this.pod.y },
      aimPolar = this.world.planetChart
        ? planetChartVectorToCartesian({ u: this.pod.x / T, v: this.pod.y / T }, { du: this.drillAimX / T, dv: this.drillAimY / T }, this.world.planetChart.columns, this.world.planetChart.radiusRows, T)
        : { dx: this.drillAimX, dy: this.drillAimY };
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
      const topLeft = project(x * T, y * T),
          topRight = project((x + 1) * T, y * T),
          bottomRight = project((x + 1) * T, (y + 1) * T),
          bottomLeft = project(x * T, (y + 1) * T),
          px = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x),
          py = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y),
          tileWidth = Math.max(1, Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x) - px),
          tileHeight = Math.max(1, Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y) - py),
          tile = this.world.get(x, y),
          tileKey = keyOf(tile.x, tile.y),
          seen = this.world.discovered.has(tileKey);
        const tileCenterX = x * T + 20, tileCenterY = y * T + 20,
          tilePolar = this.world.planetChart
            ? planetChartToCartesian({ u: tileCenterX / T, v: tileCenterY / T }, this.world.planetChart.columns, this.world.planetChart.radiusRows, T)
            : { x: tileCenterX, y: tileCenterY },
          dx = tilePolar.x - podPolar.x, dy = tilePolar.y - podPolar.y,
          distance = Math.hypot(dx / T, dy / T),
          facingDot = distance > 0.01 ? (dx * aimPolar.dx + dy * aimPolar.dy) / Math.max(1, Math.hypot(dx, dy) * Math.hypot(aimPolar.dx, aimPolar.dy)) : 1,
          inLampCone = facingDot > 0.32 && Math.abs(dx * aimPolar.dy - dy * aimPolar.dx) / Math.max(1, Math.hypot(dx, dy) * Math.hypot(aimPolar.dx, aimPolar.dy)) < 0.72,
          beamDistance = Math.max(0, (dx * aimPolar.dx + dy * aimPolar.dy) / Math.max(0.001, Math.hypot(aimPolar.dx, aimPolar.dy))),
          lamp = Math.max(0, 1 - distance / Math.max(1, this.pod.scannerRadius * 1.25)),
          light = Math.max(0.12, inLampCone ? Math.max(lamp, 1 - beamDistance / (this.pod.scannerRadius * T * 1.5)) : lamp * 0.58);
        if (!seen) {
          g.fillStyle(y < 3 ? 0x3e302e : 0x182023);
          g.fillPoints([topLeft, topRight, bottomRight, bottomLeft], true);
          g.lineStyle(1, 0x8c6857, 0.05);
          g.strokePoints([topLeft, topRight, bottomRight, bottomLeft, topLeft], false, false);
          continue;
        }
        if (tile.type === 'empty') {
      g.fillStyle(tile.tint, tile.landmarkId && !this.reducedMotion ? 0.14 + (Math.sin(this.tick * 2 + x) + 1) * 0.035 : 0.16);
          g.fillPoints([topLeft, topRight, bottomRight, bottomLeft], true);
          if (tile.landmarkId) {
            const chamber = ROUTE_FRAGMENTS.find((entry) => entry.id === tile.landmarkId)!;
            const inChamber = (nx: number, ny: number) => this.world.get(nx, ny).landmarkId === tile.landmarkId;
            g.lineStyle(1, 0xa3eee0, 0.45);
            if (!inChamber(x - 1, y)) g.lineBetween(px, py + 3, px, py + T - 3);
            if (!inChamber(x + 1, y)) g.lineBetween(px + T, py + 3, px + T, py + T - 3);
            if (!inChamber(x, y - 1)) g.lineBetween(px + 3, py, px + T - 3, py);
            if (!inChamber(x, y + 1)) g.lineBetween(px + 3, py + T, px + T - 3, py + T);
            const label = this.landmarkLabels.get(tile.landmarkId)!;
            const seen = this.world.discovered.has(keyOf(chamber.x, chamber.row));
            const labelY = sy((chamber.row - chamber.chamber.halfHeight - 0.45) * T),
              screenA = sy((chamber.row - chamber.chamber.halfHeight) * T),
              screenB = sy((chamber.row + chamber.chamber.halfHeight + 1) * T);
            const labelPoint = cameraZoomPoint({ x: sx(chamber.x * T + T / 2), y: labelY }, w, h, this.cameraZoom);
            label.setPosition(labelPoint.x, labelPoint.y)
              .setVisible(seen && Math.min(screenA, screenB) < h + T && Math.max(screenA, screenB) > -T);
          }
          g.fillStyle(0xcdb296, 0.1 * light);
          g.fillRect(px + 7, py + 31, 2, 2);
          continue;
        }
        g.fillStyle(tile.tint);
        g.fillPoints([topLeft, topRight, bottomRight, bottomLeft], true);
        g.fillStyle(0xefd0a0, 0.09);
        g.fillRect(px + 1, py + 1, T - 2, 2);
        g.fillStyle(0x0f181d, 0.3);
        g.fillRect(px, py + T - 3, T, 3);
        g.fillRect(px + T - 2, py, 2, T);
        const n = random(this.world.seed, x, y, 100);
        if (tile.type === 'dirt') {
          g.fillStyle(0x352521, 0.26);
          for (let speck = 0; speck < 5; speck++) {
            const ox = 4 + random(this.world.seed, x + speck, y, 711) * 31;
            const oy = 5 + random(this.world.seed, x, y + speck, 712) * 30;
            const size = 1 + Math.floor(random(this.world.seed, x + speck, y + 9, 713) * 2);
            g.fillRect(px + ox, py + oy, size, size);
          }
          g.lineStyle(1, 0xe4a78a, 0.12);
          g.lineBetween(px + 4 + n * 6, py + 11, px + 15 + n * 8, py + 13);
        } else if (tile.type === 'rock') {
          const stratum = random(this.world.seed, x, y, 714);
          g.fillStyle(0x231f21, 0.24);
          g.fillRect(px + 3 + n * 8, py + 8, 8 + stratum * 10, 2);
          g.fillRect(px + 18, py + 26 - stratum * 6, 8 + n * 6, 2);
          g.lineStyle(1, 0xd9b8a1, 0.17);
          g.lineBetween(px + 5, py + 17 + stratum * 4, px + 16, py + 14 + stratum * 4);
        } else {
          const fracture = random(this.world.seed, x, y, 715);
          g.fillStyle(0x231f21, 0.31);
          g.fillRect(px + 4 + n * 10, py + 8, 11, 3);
          g.fillRect(px + 19, py + 26 - fracture * 5, 10, 2);
          g.lineStyle(1, 0x161b20, 0.48);
          g.lineBetween(px + 6, py + 29, px + 13, py + 23);
          g.lineStyle(1, 0xd2c3d3, 0.27);
          g.lineBetween(px + 4, py + 9 + fracture * 4, px + 27, py + 30);
        }
        // Fade terrain with the local lamp before painting known deposits, so
        // discovered ore silhouettes remain readable in the outer fog.
        g.fillStyle(0x10191f, 1 - light);
        g.fillRect(px, py, T, T);
        if (tile.ore) {
          const color = ORES[tile.ore].color;
          const silhouette = ORE_SILHOUETTES[tile.ore];
          const markerX = px + tileWidth / 2, markerY = py + tileHeight / 2,
            markerScale = this.world.planetChart ? planetTileDecorationScale(tileWidth, tileHeight, T) : 1;
          const markerAlpha = 0.42 + light * 0.58;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            const neighborTile = this.world.get(nx, ny), neighborKey = keyOf(neighborTile.x, neighborTile.y);
            if (!this.world.discovered.has(neighborKey) || this.world.destroyed.has(neighborKey)) continue;
            const neighbor = neighborTile;
            if (neighbor.ore !== tile.ore) continue;
            const neighborCenter = project(nx * T + T / 2, ny * T + T / 2);
            g.lineStyle(Math.max(0.75, 2 * markerScale), color, 0.18 + light * 0.16);
            g.lineBetween(markerX, markerY, neighborCenter.x, neighborCenter.y);
          }
          if (tile.geode || tile.regionFind) {
            const findColor = tile.geode ? 0xb8a8ff : REGION_FINDS[tile.regionFind!].tint;
            g.fillStyle(findColor, (this.reducedMotion ? 0.24 : 0.16 + (Math.sin(this.tick * 3 + x + y) + 1) * 0.06) * (0.45 + light * 0.55));
            g.fillCircle(markerX, markerY, 18 * markerScale);
            g.lineStyle(Math.max(0.5, markerScale), tile.geode ? 0xd1caff : findColor, 0.35 + light * 0.65);
            if (tile.geode) g.strokeRect(markerX - 18 * markerScale, markerY - 18 * markerScale, 36 * markerScale, 36 * markerScale);
            else {
              g.strokeCircle(markerX, markerY, 15 * markerScale);
              g.lineBetween(markerX - 12 * markerScale, markerY, markerX + 12 * markerScale, markerY);
            }
          }
          g.fillStyle(color, 0.18 + light * 0.2);
          g.fillCircle(markerX, markerY, 15 * markerScale);
          const unitAmount = tile.oreUnits ?? 1;
          const crystalCount = unitAmount >= 3 ? 8 : unitAmount >= 2 ? 6 : unitAmount < 1 ? 2 : 4;
          for (let i = 0; i < crystalCount; i++) {
            const ox = 7 + random(43, x + i, y, 3) * 23,
              oy = 7 + random(51, x, y + i, 6) * 23,
              scale = (unitAmount >= 3 ? 1.45 : unitAmount >= 2 ? 1.2 : unitAmount < 1 ? 0.75 : 1) * markerScale,
              crystalX = markerX + (ox - 20) * markerScale, crystalY = markerY + (oy - 20) * markerScale;
            g.fillStyle(color, markerAlpha);
            if (silhouette === 'facets')
              g.fillPoints(
                [
                  { x: crystalX, y: crystalY - 4 * scale },
                  { x: crystalX + 4 * scale, y: crystalY },
                  { x: crystalX, y: crystalY + 5 * scale },
                  { x: crystalX - 4 * scale, y: crystalY },
                ],
                true,
              );
            else if (silhouette === 'spires')
              g.fillTriangle(
                crystalX,
                crystalY - 5 * markerScale,
                crystalX - 3 * scale,
                crystalY + 5 * scale,
                crystalX + 3 * scale,
                crystalY + 5 * scale,
              );
            else if (silhouette === 'bars') {
              g.fillRect(crystalX, crystalY, 8 * markerScale, 3 * markerScale);
              g.fillRect(crystalX + 2 * markerScale, crystalY + 4 * markerScale, 8 * markerScale, 3 * markerScale);
            } else if (silhouette === 'nuggets') g.fillCircle(crystalX, crystalY, 4 * markerScale);
            else g.fillRect(crystalX, crystalY, (5 + (i % 3)) * markerScale, (4 + (i % 2)) * markerScale);
            g.fillStyle(0xffffff, (0.2 + light * 0.4) * markerAlpha);
            g.fillRect(crystalX, crystalY, 2 * scale, Math.max(0.5, scale));
          }
        }
        if (tile.signalHashId) {
          const recovered = this.progress.milestones.includes(tile.signalHashId);
          g.fillStyle(0x91f5e2, 0.12 + light * 0.15);
          g.fillCircle(px + 20, py + 20, this.reducedMotion ? 14 : 14 + Math.sin(this.tick * 2.6 + x) * 1.5);
          g.fillStyle(recovered ? 0x466e6b : 0x91f5e2, 0.3 + light * 0.7);
          g.fillPoints([
            { x: px + 20, y: py + 10 }, { x: px + 30, y: py + 20 },
            { x: px + 20, y: py + 30 }, { x: px + 10, y: py + 20 },
          ], true);
          g.lineStyle(1, 0x193838, 0.9);
          g.lineBetween(px + 16, py + 20, px + 24, py + 20);
        }
        if (tile.coreRelicId) {
          const relic = CORE_RELICS.find((entry) => entry.id === tile.coreRelicId)!;
          const recovered = this.progress.milestones.includes(relic.id);
          g.fillStyle(relic.tint, recovered ? 0.08 : 0.16 + light * 0.2);
          g.fillCircle(px + 20, py + 20, 19);
          g.lineStyle(2, relic.tint, recovered ? 0.38 : 0.72);
          g.strokeCircle(px + 20, py + 20, this.reducedMotion ? 13 : 13 + Math.sin(this.tick * 3 + y) * 1.5);
          g.fillStyle(recovered ? 0x52645f : relic.tint, recovered ? 0.55 : 0.4 + light * 0.6);
          g.fillPoints([
            { x: px + 20, y: py + 8 }, { x: px + 30, y: py + 20 },
            { x: px + 20, y: py + 32 }, { x: px + 10, y: py + 20 },
          ], true);
          g.fillStyle(0xffffff, recovered ? 0.25 : 0.8);
          g.fillRect(px + 19, py + 13, 2, 14);
        }
        if (tile.fragmentId) {
          const recovered = this.progress.routeFragments.includes(tile.fragmentId);
          const component = ROUTE_SHIP_COMPONENTS[tile.fragmentId];
          g.fillStyle(0x8ef1df, 0.17);
          g.fillCircle(px + 20, py + 20, this.reducedMotion ? 16 : 16 + Math.sin(this.tick * 3) * 2);
          const partColor = recovered ? 0x45645e : 0xb1fff0;
          g.fillStyle(partColor);
          g.lineStyle(2, partColor, 0.95);
          if (component === 'frame') {
            g.strokeRect(px + 10, py + 12, 20, 16);
            g.strokeRect(px + 15, py + 16, 10, 8);
            g.fillRect(px + 18, py + 9, 4, 4);
            g.fillRect(px + 18, py + 27, 4, 4);
          } else if (component === 'propulsion') {
            g.fillPoints([
              { x: px + 20, y: py + 9 }, { x: px + 27, y: py + 20 },
              { x: px + 24, y: py + 20 }, { x: px + 24, y: py + 28 },
              { x: px + 16, y: py + 28 }, { x: px + 16, y: py + 20 },
              { x: px + 13, y: py + 20 },
            ], true);
            g.fillStyle(0x18373a);
            g.fillCircle(px + 20, py + 19, 2.5);
            g.fillStyle(partColor);
            g.fillPoints([{ x: px + 17, y: py + 29 }, { x: px + 20, y: py + 35 }, { x: px + 23, y: py + 29 }], true);
          } else if (component === 'navigation') {
            g.fillPoints([
              { x: px + 20, y: py + 9 }, { x: px + 25, y: py + 20 },
              { x: px + 20, y: py + 31 }, { x: px + 15, y: py + 20 },
            ], true);
            g.fillStyle(0x18373a);
            g.fillCircle(px + 20, py + 20, 2.5);
          } else {
            g.fillRoundedRect(px + 14, py + 10, 12, 20, 3);
            g.strokeRoundedRect(px + 14, py + 10, 12, 20, 3);
            g.fillStyle(0x18373a);
            g.fillRect(px + 19, py + 14, 2, 12);
            g.fillRect(px + 16, py + 19, 8, 2);
          }
        }
        if (this.mining.affected.some((target) => target.x === x && target.y === y)) {
          g.lineStyle(1, 0xf5d59b, 0.7);
          g.strokeRect(px + 1, py + 1, T - 2, T - 2);
          g.lineStyle(2, 0x1d2528);
          g.strokePoints([
            { x: px + 7, y: py + 2 },
            { x: px + 21, y: py + 17 },
            { x: px + 13, y: py + 27 },
            { x: px + 24, y: py + 39 },
          ]);
          if (this.mining.ratio > 0.4) g.lineBetween(px + 21, py + 17, px + 39, py + 8);
          g.fillStyle(0xecc281);
          g.fillRect(px + 4, py + 34, (T - 8) * this.mining.ratio, 3);
        }
      }
    if (ground > 0 && this.world.planetChart) {
      const surfaceRow = this.pod.y >= this.world.coreWorldY ? this.world.farSurfaceRow : 0;
      const coreRecords = this.progress.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id));
      drawPlanetSurfaceOutpost(
        g,
        (x, y) => project(x, y),
        surfaceRow,
        surfaceTownTier(this.progress.shipComponents, coreRecords),
        this.tick,
        this.reducedMotion,
        this.mapId,
      );
    }
    if (!this.reducedMotion) this.atmosphere.draw(g, this.world, this.atmosphereView(), (x) => project(x, this.pod.y).x, (y) => project(this.pod.x, y).y, false);
    for (const structure of this.structures) {
      if (!isOnScreen(structure.x, structure.y, 150)) continue;
      if (this.world.planetChart) {
        const pointAt = (tangent: number, outward: number) => localProject(structure.x, structure.y, tangent, outward);
        const polygon = (points: { tangent: number; outward: number }[]) =>
          g.fillPoints(points.map(({ tangent, outward }) => pointAt(tangent, outward)), true);
        const rectangle = (tangent: number, outward: number, width: number, height: number, color: number, alpha = 1) => {
          g.fillStyle(color, alpha);
          polygon([
            { tangent: tangent - width / 2, outward }, { tangent: tangent + width / 2, outward },
            { tangent: tangent + width / 2, outward: outward + height }, { tangent: tangent - width / 2, outward: outward + height },
          ]);
        };
        const ring = (tangent: number, outward: number, radius: number, color: number, alpha: number, lineWidth = 1) => {
          const points = Array.from({ length: 49 }, (_, index) => {
            const angle = Math.PI * 2 * index / 48;
            return pointAt(tangent + Math.cos(angle) * radius, outward + Math.sin(angle) * radius);
          });
          g.lineStyle(lineWidth, color, alpha);
          g.strokePoints(points, true);
        };
        if (structure.kind === 'wall') {
          rectangle(0, 0, 38, 48, 0x59635f);
          rectangle(0, 5, 28, 37, 0x303b39);
          rectangle(0, 7, 7, 33, 0xc0a978);
          rectangle(-15, 0, 5, 12, 0x9faeb5);
          rectangle(15, 0, 5, 12, 0x9faeb5);
          if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
            g.lineStyle(3, 0xff987e, 0.95);
            const a = pointAt(-12, 39), b = pointAt(4, 23), c = pointAt(-3, 8);
            g.lineBetween(a.x, a.y, b.x, b.y); g.lineBetween(b.x, b.y, c.x, c.y);
          }
          continue;
        }
        if (structure.kind === 'gate') {
          const open = this.surface && globeSurfaceDistance(this.world, this.pod.x, this.pod.y, structure.x, structure.y) <= WORLD.tile * 2.5,
            panelOutward = open ? 52 : 5;
          rectangle(-48, 0, 12, 52, 0x4d5855);
          rectangle(48, 0, 12, 52, 0x4d5855);
          rectangle(-48, 0, 18, 6, 0xf0b779);
          rectangle(48, 0, 18, 6, 0xf0b779);
          rectangle(0, panelOutward, 88, 9, open ? 0x8be1cf : 0x9faeb5);
          rectangle(0, panelOutward + 2, 58, 3, 0x263332);
          if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
            g.lineStyle(3, 0xff987e, 0.95);
            const a = pointAt(-48, 43), b = pointAt(-40, 24);
            g.lineBetween(a.x, a.y, b.x, b.y);
          }
          continue;
        }
        if (structure.kind === 'habitat') {
          rectangle(0, 0, 210, 11, 0x263332);
          rectangle(0, 11, 132, 61, 0x475d55);
          rectangle(0, 16, 116, 48, 0x253936);
          rectangle(-42, 25, 24, 20, 0x9bcbbb, 0.86);
          rectangle(0, 25, 24, 20, 0x9bcbbb, 0.86);
          rectangle(42, 25, 24, 20, 0x9bcbbb, 0.86);
          rectangle(0, 48, 30, 15, 0x172526);
          rectangle(0, 62, 180, 5, 0xe4b877);
          rectangle(-87, 15, 15, 45, 0x344540);
          rectangle(87, 15, 15, 45, 0x344540);
          g.lineStyle(2, 0xa4efd9, 0.9);
          const antenna = pointAt(93, 62), antennaTip = pointAt(93, 85);
          g.lineBetween(antenna.x, antenna.y, antennaTip.x, antennaTip.y);
          g.fillStyle(0xa4efd9, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 3) * 0.2);
          g.fillCircle(antennaTip.x, antennaTip.y, 3.5);
          if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
            g.lineStyle(3, 0xff987e, 0.95);
            const crackA = pointAt(-25, 58), crackB = pointAt(-12, 40), crackC = pointAt(-19, 24);
            g.lineBetween(crackA.x, crackA.y, crackB.x, crackB.y);
            g.lineBetween(crackB.x, crackB.y, crackC.x, crackC.y);
          }
          continue;
        }
        if (structure.kind === 'trade-post') {
          rectangle(0, 0, 130, 9, 0x263332);
          rectangle(0, 9, 88, 54, 0x3d625b);
          rectangle(0, 14, 72, 42, 0x273b39);
          rectangle(-23, 22, 19, 18, 0x95d6c5, 0.8);
          rectangle(23, 22, 19, 18, 0x95d6c5, 0.8);
          rectangle(0, 9, 10, 34, 0x182526);
          rectangle(0, 51, 56, 5, 0xf0c47f);
          g.lineStyle(2, 0xa4efd9, 0.9);
          const mast = pointAt(34, 63), mastTop = pointAt(34, 87);
          g.lineBetween(mast.x, mast.y, mastTop.x, mastTop.y);
          g.fillStyle(0xa4efd9, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 4) * 0.2);
          g.fillCircle(mastTop.x, mastTop.y, 4);
          ring(34, 87, this.reducedMotion ? 10 : 10 + Math.sin(this.tick * 4) * 2, 0xa4efd9, 0.6, 1.5);
          continue;
        }
        if (structure.kind === 'warehouse') {
          rectangle(0, 0, 112, 9, 0x263332);
          rectangle(0, 9, 76, 40, 0x756044);
          rectangle(0, 14, 64, 30, 0x3b3930);
          rectangle(-21, 18, 20, 24, 0xc58c4e);
          rectangle(4, 18, 20, 24, 0x8eaa91);
          rectangle(0, 9, 82, 5, 0xe4b877);
          rectangle(-37, 49, 12, 9, 0xc58c4e);
          rectangle(37, 49, 12, 9, 0x8eaa91);
          g.lineStyle(2, 0xf0c47f, 0.9);
          const sign = pointAt(0, 60);
          g.strokeRect(sign.x - 11, sign.y - 7, 22, 14);
          g.lineBetween(sign.x - 5, sign.y, sign.x + 5, sign.y);
          continue;
        }
        const deckTop = [], deckBottom = [];
        for (let index = 0; index <= 16; index++) {
          const tangent = -100 + index * 12.5;
          deckTop.push(pointAt(tangent, 5));
          deckBottom.push(pointAt(tangent, 0));
        }
        g.fillStyle(0x131a1b, 0.94);
        g.fillPoints([...deckTop, ...deckBottom.reverse()], true);
        g.lineStyle(2, structure.kind === 'service' ? 0x8be1cf : structure.kind === 'turret' ? 0xf0b779 : 0x9faeb5, 0.9);
        g.lineBetween(deckTop[0].x, deckTop[0].y, deckTop.at(-1)!.x, deckTop.at(-1)!.y);
        for (let bolt = -84; bolt <= 84; bolt += 24) {
          const point = pointAt(bolt, 2);
          g.fillStyle(0x9faeb5, 0.9);
          g.fillCircle(point.x, point.y, 1.5);
        }
        if (structure.kind === 'service') {
          rectangle(0, 6, 46, 50, 0x263532);
          rectangle(0, 12, 34, 35, 0x52675f);
          rectangle(0, 39, 24, 3, 0xf1c37b);
          const beacon = pointAt(0, 58);
          g.fillStyle(0x8be1cf, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 4) * 0.2);
          g.fillCircle(beacon.x, beacon.y, 5);
          ring(0, 58, this.reducedMotion ? 11 : 11 + Math.sin(this.tick * 4) * 2, 0x8be1cf, 0.65, 2);
        } else if (structure.kind === 'turret') {
          rectangle(0, 4, 30, 24, 0x3d3931);
          rectangle(0, 22, 6, 13, 0xf0b779);
          const muzzle = pointAt(0, 29);
          g.fillStyle(0xf0b779);
          g.fillCircle(muzzle.x, muzzle.y, 5);
          ring(0, 17, UNDERGROUND_BUILDING.turret.range, 0xf0b779, 0.12);
          if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
            g.lineStyle(3, 0xff987e, 0.95);
            const crackA = pointAt(-10, 20), crackB = pointAt(2, 10);
            g.lineBetween(crackA.x, crackA.y, crackB.x, crackB.y);
          }
        }
        continue;
      }
      const gravity = this.world.gravitySign(structure.y), x = sx(structure.x), deckY = sy(structure.y);
      if (structure.kind === 'wall') {
        g.fillStyle(0x303b39, 1);
        g.fillRect(x - 18, deckY - gravity * 48, 36, 48);
        g.fillStyle(0xc0a978, 1);
        g.fillRect(x - 3, deckY - gravity * 41, 6, 33);
        g.fillStyle(0x9faeb5, 1);
        g.fillRect(x - 15, deckY - gravity * 8, 5, 8); g.fillRect(x + 10, deckY - gravity * 8, 5, 8);
        if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
          g.lineStyle(3, 0xff987e, 0.95); g.lineBetween(x - 12, deckY - gravity * 40, x + 4, deckY - gravity * 23);
        }
        continue;
      }
      if (structure.kind === 'gate') {
        const open = this.surface && globeSurfaceDistance(this.world, this.pod.x, this.pod.y, structure.x, structure.y) <= WORLD.tile * 2.5,
          panelY = deckY - gravity * (open ? 52 : 5);
        g.fillStyle(0x4d5855, 1);
        g.fillRect(x - 54, deckY - gravity * 52, 12, 52); g.fillRect(x + 42, deckY - gravity * 52, 12, 52);
        g.fillStyle(0xf0b779, 1);
        g.fillRect(x - 57, deckY - gravity * 6, 18, 6); g.fillRect(x + 39, deckY - gravity * 6, 18, 6);
        g.fillStyle(open ? 0x8be1cf : 0x9faeb5, 1);
        g.fillRect(x - 44, panelY, 88, 9);
        g.fillStyle(0x263332, 1); g.fillRect(x - 29, panelY + 3, 58, 3);
        if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
          g.lineStyle(3, 0xff987e, 0.95); g.lineBetween(x - 48, deckY - gravity * 43, x - 40, deckY - gravity * 24);
        }
        continue;
      }
      if (structure.kind === 'habitat') {
        const top = sy(structure.y - gravity * 76);
        g.fillStyle(0x263332, 1);
        g.fillRect(x - 105, deckY - gravity * 11, 210, 11);
        g.fillStyle(0x475d55, 1);
        g.fillRoundedRect(x - 66, Math.min(top, deckY), 132, Math.max(40, Math.abs(deckY - top)), 5);
        g.fillStyle(0x253936, 1);
        g.fillRoundedRect(x - 58, Math.min(top, deckY) + 7, 116, Math.max(28, Math.abs(deckY - top) - 13), 4);
        g.fillStyle(0x9bcbbb, 0.86);
        for (const offset of [-42, 0, 42]) g.fillRect(x + offset - 12, top + gravity * 20, 24, 20);
        g.fillStyle(0xe4b877, 1);
        g.fillRect(x - 90, deckY - gravity * 25, 180, 5);
        g.lineStyle(2, 0xa4efd9, 0.9);
        g.lineBetween(x + 93, top + gravity * 4, x + 93, top + gravity * 25);
        g.fillStyle(0xa4efd9, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 3) * 0.2);
        g.fillCircle(x + 93, top + gravity * 4, 3.5);
        if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
          g.lineStyle(3, 0xff987e, 0.95);
          g.lineBetween(x - 25, top + gravity * 58, x - 12, top + gravity * 40);
          g.lineBetween(x - 12, top + gravity * 40, x - 19, top + gravity * 24);
        }
        continue;
      }
      if (structure.kind === 'trade-post') {
        const top = sy(structure.y - gravity * 62);
        g.fillStyle(0x263332, 1);
        g.fillRect(x - 65, deckY - gravity * 9, 130, 9);
        g.fillStyle(0x3d625b, 1);
        g.fillRoundedRect(x - 44, Math.min(top, deckY - gravity * 9), 88, Math.abs(deckY - gravity * 9 - top), 4);
        g.fillStyle(0x273b39, 1);
        g.fillRect(x - 36, Math.min(top, deckY - gravity * 9) + 6, 72, Math.max(18, Math.abs(deckY - gravity * 9 - top) - 12));
        g.fillStyle(0x95d6c5, 0.85);
        g.fillRect(x - 32, top + gravity * 17, 18, 18);
        g.fillRect(x + 14, top + gravity * 17, 18, 18);
        g.fillStyle(0xf0c47f, 1);
        g.fillRect(x - 28, deckY - gravity * 22, 56, 5);
        g.lineStyle(2, 0xa4efd9, 0.9);
        g.lineBetween(x + 34, top + gravity * 2, x + 34, top + gravity * 26);
        g.fillStyle(0xa4efd9, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 4) * 0.2);
        g.fillCircle(x + 34, top + gravity * 2, 4);
        g.lineStyle(1, 0xa4efd9, 0.65);
        g.strokeCircle(x + 34, top + gravity * 2, this.reducedMotion ? 10 : 10 + Math.sin(this.tick * 4) * 2);
        continue;
      }
      if (structure.kind === 'warehouse') {
        const top = sy(structure.y - gravity * 48);
        g.fillStyle(0x263332, 1);
        g.fillRect(x - 56, deckY - gravity * 9, 112, 9);
        g.fillStyle(0x756044, 1);
        g.fillRoundedRect(x - 38, Math.min(top, deckY - gravity * 9), 76, Math.abs(deckY - gravity * 9 - top), 4);
        g.fillStyle(0x3b3930, 1);
        g.fillRect(x - 32, Math.min(top, deckY - gravity * 9) + 6, 64, Math.max(16, Math.abs(deckY - gravity * 9 - top) - 12));
        g.fillStyle(0xc58c4e, 1);
        g.fillRect(x - 25, top + gravity * 13, 20, 24);
        g.fillStyle(0x8eaa91, 1);
        g.fillRect(x + 5, top + gravity * 13, 20, 24);
        g.fillStyle(0xe4b877, 1);
        g.fillRect(x - 41, deckY - gravity * 21, 82, 5);
        g.lineStyle(2, 0xf0c47f, 0.9);
        g.strokeRect(x - 11, top + gravity * 38, 22, 14);
        g.lineBetween(x - 5, top + gravity * 45, x + 5, top + gravity * 45);
        continue;
      }
      const deckA = sx(structure.x - 100), deckB = sx(structure.x + 100), deckLeft = Math.min(deckA, deckB), deckWidth = Math.abs(deckB - deckA);
      g.fillStyle(0x131a1b, 0.9);
      g.fillRect(deckLeft, deckY - 4, deckWidth, 8);
      g.fillStyle(structure.kind === 'service' ? 0x8be1cf : structure.kind === 'turret' ? 0xf0b779 : 0x9faeb5, 0.9);
      g.fillRect(deckLeft, deckY - 5, deckWidth, 2);
      for (let bolt = deckLeft + 8; bolt < deckLeft + deckWidth; bolt += 24) g.fillRect(bolt, deckY - 1, 3, 2);
      if (structure.kind === 'service') {
        const farY = sy(structure.y - gravity * 54), top = Math.min(deckY, farY), bodyHeight = Math.max(30, Math.abs(deckY - farY));
        g.fillStyle(0x263532);
        g.fillRoundedRect(x - 23, top, 46, bodyHeight, 4);
        g.fillStyle(0x52675f);
        g.fillRect(x - 17, top + 7, 34, Math.max(14, bodyHeight - 14));
        g.fillStyle(0xf1c37b);
        g.fillRect(x - 12, top + 12, 24, 3);
        g.fillStyle(0x8be1cf, this.reducedMotion ? 0.9 : 0.72 + Math.sin(this.tick * 4) * 0.2);
        g.fillCircle(x, top + 7, 5);
        g.lineStyle(2, 0x8be1cf, 0.65);
        g.strokeCircle(x, top + 7, this.reducedMotion ? 11 : 11 + Math.sin(this.tick * 4) * 2);
      } else if (structure.kind === 'turret') {
        const side = this.world.gravitySign(structure.y), baseY = deckY - side * 4;
        g.fillStyle(0x3d3931);
        g.fillRoundedRect(x - 15, Math.min(baseY, baseY - side * 24), 30, 24, 3);
        g.fillStyle(0xf0b779);
        g.fillRect(x - 3, baseY - side * 21, 6, 13);
        g.fillCircle(x, baseY - side * 21, 5);
        g.lineStyle(1, 0xf0b779, 0.12);
        g.strokeCircle(x, baseY - side * 21, UNDERGROUND_BUILDING.turret.range);
        if ((structure.integrity ?? SURFACE_RAID.integrity) < SURFACE_RAID.integrity) {
          g.lineStyle(3, 0xff987e, 0.95);
          g.lineBetween(x - 10, baseY - side * 20, x + 2, baseY - side * 10);
        }
      }
    }
    if (this.surfacePlacement) {
      const placement = this.surfacePlacement, check = this.surfacePlacementCheck(),
        valid = !!check?.valid, color = valid ? 0x86e0c4 : 0xff987e,
        halfWidth = UNDERGROUND_BUILDING[placement.kind].widthTiles * WORLD.tile / 2,
        pointAt = (tangent: number, outward: number) => localProject(placement.x, placement.y, tangent, outward),
        footprint = [pointAt(-halfWidth, 0), pointAt(halfWidth, 0), pointAt(halfWidth, 8), pointAt(-halfWidth, 8)],
        anchor = pointAt(0, 0);
      g.fillStyle(color, 0.16);
      g.fillPoints(footprint, true);
      g.lineStyle(2, color, 0.95);
      g.strokePoints(footprint, true);
      if (placement.kind === 'turret') {
        const range = Array.from({ length: 49 }, (_, i) => {
          const angle = Math.PI * 2 * i / 48;
          return pointAt(Math.cos(angle) * UNDERGROUND_BUILDING.turret.range, Math.sin(angle) * UNDERGROUND_BUILDING.turret.range);
        });
        g.lineStyle(1, 0xf0b779, 0.48);
        g.strokePoints(range, true);
      }
      const bodyWidth = placement.kind === 'habitat' ? 86 : placement.kind === 'trade-post' ? 62 : placement.kind === 'warehouse' ? 76 : placement.kind === 'gate' ? 120 : placement.kind === 'wall' ? 38 : 26,
        bodyHeight = placement.kind === 'habitat' ? 48 : placement.kind === 'trade-post' ? 42 : placement.kind === 'warehouse' ? 38 : placement.kind === 'gate' || placement.kind === 'wall' ? 48 : 24,
        ghost = [pointAt(-bodyWidth / 2, 8), pointAt(bodyWidth / 2, 8), pointAt(bodyWidth / 2, bodyHeight + 8), pointAt(-bodyWidth / 2, bodyHeight + 8)];
      g.fillStyle(placement.kind === 'turret' || placement.kind === 'gate' ? 0xf0b779 : placement.kind === 'warehouse' ? 0xc58c4e : placement.kind === 'wall' ? 0x9faeb5 : 0xa4efd9, 0.36);
      g.fillPoints(ghost, true);
      g.lineStyle(1, 0xe5f6eb, 0.85);
      g.strokePoints(ghost, true);
      g.lineStyle(3, 0x101b1c, 0.95);
      g.strokeCircle(anchor.x, anchor.y, 9);
      g.lineStyle(1.5, color, 1);
      g.strokeCircle(anchor.x, anchor.y, 7);
      g.lineBetween(anchor.x - 12, anchor.y, anchor.x + 12, anchor.y);
      g.lineBetween(anchor.x, anchor.y - 12, anchor.x, anchor.y + 12);
      this.buildPlacementLabel.setPosition(w / 2, h - 56).setVisible(true);
    } else this.buildPlacementLabel.setVisible(false);
    for (const drop of this.oreDrops) {
      if (!isOnScreen(drop.x, drop.y, 24)) continue;
      const x = sx(drop.x), y = sy(drop.y), color = ORES[drop.ore].color;
      g.fillStyle(color, 0.2);
      g.fillCircle(x, y, 11);
      g.fillStyle(color, 1);
      g.fillPoints([{ x, y: y - 6 }, { x: x + 5, y }, { x, y: y + 6 }, { x: x - 5, y }], true);
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(x - 1, y - 3, 2, 3);
      const magnetDistance = Math.hypot(drop.x - this.pod.x, drop.y - this.pod.y);
      if (this.progress.salvageMagnet && magnetDistance <= SALVAGE_MAGNET.radius &&
        hasClearMagnetPath(this.world, drop.x, drop.y, this.pod.x, this.pod.y)) {
        g.lineStyle(1, 0x81e5d2, this.reducedMotion ? 0.36 : 0.3 + Math.sin(this.tick * 12 + magnetDistance) * 0.12);
        g.lineBetween(x, y, sx(this.pod.x), sy(this.pod.y));
      }
    }
    const raider = this.surfaceRaid.active;
    if (raider && isOnScreen(raider.x, raider.y, 60)) {
      const x = sx(raider.x), y = sy(raider.y), pulse = this.reducedMotion ? 1 : 0.82 + Math.sin(this.tick * 9 + raider.phase) * 0.18;
      const target = this.structures.find((entry) => entry.id === raider.targetId);
      if (target && isOnScreen(target.x, target.y, 140)) {
        const tx = sx(target.x), ty = sy(target.y);
        g.lineStyle(2, 0xf0a477, 0.48);
        g.lineBetween(x, y, tx, ty);
        g.lineStyle(2, 0xff987e, 0.88);
        g.strokeCircle(tx, ty, 30 + (this.reducedMotion ? 0 : Math.sin(this.tick * 8) * 4));
        g.lineBetween(tx - 9, ty - 9, tx + 9, ty + 9);
        g.lineBetween(tx + 9, ty - 9, tx - 9, ty + 9);
      }
      g.fillStyle(0xff987e, 0.22 * pulse);
      g.fillCircle(x, y, 24);
      g.fillStyle(raider.hitFlash > 0 ? 0xffffff : 0xf0b779, 0.96);
      g.fillPoints([{ x: x + 14, y }, { x: x + 6, y: y - 8 }, { x: x - 10, y: y - 6 }, { x: x - 15, y }, { x: x - 7, y: y + 8 }, { x: x + 8, y: y + 7 }], true);
      g.lineStyle(2, 0xff987e, 0.9);
      g.strokeCircle(x, y, 19 + (this.reducedMotion ? 0 : 3 * pulse));
    }
    const swimmer = this.rockSwimmer.active;
    if (swimmer) {
      const tileDistance = Math.hypot((swimmer.x - this.pod.x) / T, (swimmer.y - this.pod.y) / T);
      if (tileDistance <= this.pod.scannerRadius * 1.25 && isOnScreen(swimmer.x, swimmer.y, T)) {
        const sxw = sx(swimmer.x), syw = sy(swimmer.y), angle = Math.atan2(swimmer.vy, swimmer.vx);
        const ux = Math.cos(angle), uy = Math.sin(angle), pulse = this.reducedMotion ? 1 : 0.8 + Math.sin(this.tick * 7 + swimmer.phase) * 0.2;
        if (swimmer.kind === 'shard-manta') {
          const color = swimmer.hitFlash > 0 ? 0xffffff : swimmer.mode === 'windup' ? 0xffc15c : swimmer.mode === 'charge' ? 0xff8277 : 0xd797e8,
            local = (forward: number, side: number) => ({ x: sxw + ux * forward - uy * side, y: syw + uy * forward + ux * side });
          g.fillStyle(color, 0.15 * pulse);
          g.fillCircle(sxw, syw, 34);
          g.fillStyle(color, 0.88);
          g.fillPoints([local(15, 0), local(2, -8), local(-16, -27), local(-8, -2)], true);
          g.fillPoints([local(15, 0), local(2, 8), local(-16, 27), local(-8, 2)], true);
          g.fillStyle(swimmer.hitFlash > 0 ? 0xffffff : 0xf5d8ff, 0.98);
          g.fillPoints([local(18, 0), local(0, 7), local(-12, 0), local(0, -7)], true);
          g.fillStyle(0x38233e, 1);
          g.fillCircle(local(7, 0).x, local(7, 0).y, 2);
          if (swimmer.mode === 'windup') {
            const chargeProgress = 1 - (swimmer.modeTimer ?? 0) / SHARD_MANTA.windupSeconds;
            g.lineStyle(2, 0xffc15c, 0.9);
            g.strokeCircle(sxw, syw, 31 + chargeProgress * 15);
            g.lineStyle(2, 0xffc15c, 0.7);
            g.lineBetween(sxw, syw, sxw + (swimmer.chargeX ?? ux) * 48, syw + (swimmer.chargeY ?? uy) * 48);
          } else if (swimmer.mode === 'charge') {
            g.lineStyle(2, 0xff8277, 0.8);
            g.lineBetween(sxw - ux * 42, syw - uy * 42, sxw - ux * 12, syw - uy * 12);
            g.strokeCircle(sxw, syw, 29 + (this.reducedMotion ? 0 : pulse * 4));
          }
        } else if (swimmer.kind === 'hull-scrapper') {
          const color = swimmer.hitFlash > 0 ? 0xffffff : swimmer.armorBlockedFlash && swimmer.armorBlockedFlash > 0 ? 0xffd38a : 0xb5c4c1,
            local = (forward: number, side: number) => ({ x: sxw + ux * forward - uy * side, y: syw + uy * forward + ux * side });
          g.fillStyle(color, 0.16 * pulse);
          g.fillCircle(sxw, syw, 33);
          g.fillStyle(color, 0.95);
          g.fillPoints([local(17, 0), local(9, -12), local(-11, -15), local(-18, -7), local(-18, 7), local(-11, 15), local(9, 12)], true);
          g.fillStyle(0x66777a, 1);
          g.fillPoints([local(17, 0), local(7, -8), local(2, 0), local(7, 8)], true);
          g.fillStyle(0x243439, 1);
          g.fillCircle(local(-8, -8).x, local(-8, -8).y, 2.5);
          g.fillCircle(local(-8, 8).x, local(-8, 8).y, 2.5);
          g.lineStyle(1.5, color, 0.8);
          g.strokeCircle(sxw, syw, 22 + (this.reducedMotion ? 0 : pulse * 2));
        } else {
          const color = swimmer.hitFlash > 0 ? 0xffffff : tileDistance * T < ROCK_SWIMMER.warningRadius ? 0xf0b779 : 0x83e5d3;
          g.fillStyle(color, 0.16 * pulse);
          g.fillCircle(sxw, syw, 27);
          for (let i = 3; i >= 0; i--) {
            const tailX = sxw - ux * (8 + i * 8), tailY = syw - uy * (8 + i * 8) + Math.sin(this.tick * 8 + i + swimmer.phase) * 2;
            g.fillStyle(color, 0.3 + (3 - i) * 0.11);
            g.fillCircle(tailX, tailY, 2.5 + (3 - i) * 0.55);
          }
          g.fillStyle(color, 0.9);
          g.fillPoints([
            { x: sxw + ux * 12, y: syw + uy * 12 },
            { x: sxw + ux * 2 + uy * 7, y: syw + uy * 2 - ux * 7 },
            { x: sxw - ux * 9, y: syw - uy * 9 },
            { x: sxw + ux * 2 - uy * 7, y: syw + uy * 2 + ux * 7 },
          ], true);
          g.fillStyle(0x173338, 1);
          g.fillCircle(sxw + ux * 5 - uy * 2, syw + uy * 5 + ux * 2, 1.5);
          if (tileDistance * T < ROCK_SWIMMER.warningRadius) {
            g.lineStyle(1, 0xf0b779, 0.4);
            g.lineBetween(sx(this.pod.x), sy(this.pod.y), sxw, syw);
            g.lineStyle(1, 0xf0b779, 0.6);
            g.strokeCircle(sxw, syw, 17 + (this.reducedMotion ? 0 : Math.sin(this.tick * 5) * 2));
          }
        }
        const maxHealth = swimmer.kind === 'shard-manta' ? SHARD_MANTA.drillHitsToDefeat
            : swimmer.kind === 'hull-scrapper' ? HULL_SCRAPPER.drillHitsToDefeat : ROCK_SWIMMER.drillHitsToDefeat,
          healthColor = swimmer.kind === 'shard-manta' ? 0xe9a0ed : swimmer.kind === 'hull-scrapper' ? 0xe2b483 : 0x8fe5d5,
          pipStart = sxw - (maxHealth - 1) * 4;
        g.fillStyle(0x101b24, 0.86);
        g.fillRect(sxw - 16, syw - 40, 32, 9);
        for (let pip = 0; pip < maxHealth; pip++) {
          g.fillStyle(pip < swimmer.health ? healthColor : 0x49545a, 1);
          g.fillCircle(pipStart + pip * 8, syw - 35.5, 2.2);
        }
      }
    }
    if (this.activeCharge) {
      const x = sx(this.activeCharge.x), y = sy(this.activeCharge.y), pulse = this.reducedMotion ? 10 : 10 + Math.sin(this.tick * 18) * 3;
      g.fillStyle(0xffad69, 0.9);
      g.fillCircle(x, y, 6);
      g.lineStyle(2, 0xffd2a1, 0.9);
      g.strokeCircle(x, y, pulse);
      g.fillStyle(0x1b2224, 0.9);
      g.fillRect(x - 14, y + 11, 28, 4);
      g.fillStyle(0xffbd76, 1);
      g.fillRect(x - 13, y + 12, 26 * (1 - this.activeCharge.fuse / CHARGE.fuseSeconds), 2);
    }
    g.lineStyle(1, 0xc8a078, 0.2);
    for (let y = Math.ceil(top / 5) * 5; y <= bottom; y += 5) {
      g.lineBetween(sx(0), sy(y * T), sx(18), sy(y * T));
      g.lineBetween(sx(this.world.widthTiles * T - 18), sy(y * T), sx(this.world.widthTiles * T), sy(y * T));
    }
    const coreScreenY = sy(this.world.coreWorldY);
    if (coreScreenY > -160 && coreScreenY < h + 160) {
      const pulse = 1 + (this.reducedMotion ? 0 : 0.04 * Math.sin(this.tick * 2.5));
      g.lineStyle(3, 0x92e3c8, 0.65);
      g.strokeCircle(sx(WORLD.spawnX), coreScreenY, 76 * pulse);
      g.lineStyle(1, 0xf6d797, 0.85);
      g.strokeCircle(sx(WORLD.spawnX), coreScreenY, 48 * pulse);
      g.fillStyle(0xffd78b, 0.2);
      g.fillCircle(sx(WORLD.spawnX), coreScreenY, 24 * pulse);
      g.lineStyle(1, 0x92e3c8, 0.4);
      g.lineBetween(sx(WORLD.spawnX - 176), coreScreenY, sx(WORLD.spawnX - 120), coreScreenY);
      g.lineBetween(sx(WORLD.spawnX + 120), coreScreenY, sx(WORLD.spawnX + 176), coreScreenY);
    }
    const x = sx(this.pod.x),
      y = sy(this.pod.y),
      f = this.pod.facing,
      vehicleScale = podVisualScale(this.progress.levels, this.progress.shipComponents.length),
      px = (offset: number) => x + offset * vehicleScale * viewSign,
      py = (offset: number) => y + offset * vehicleScale * viewSign;
    const winchCable = this.surfaceWinchCable();
    if (this.mothershipBoarded) {
      g.fillStyle(0x334541, 1);
      g.fillPoints([
        { x: x, y: y - 54 * viewSign }, { x: x + 14, y: y - 31 * viewSign },
        { x: x + 30, y: y + 29 * viewSign }, { x: x + 22, y: y + 43 * viewSign },
        { x: x - 22, y: y + 43 * viewSign }, { x: x - 30, y: y + 29 * viewSign },
        { x: x - 14, y: y - 31 * viewSign },
      ], true);
      g.fillStyle(0x9ce8d7, 0.92);
      g.fillRoundedRect(x - 10, y - 27 * viewSign, 20, 14, 4);
      g.lineStyle(2, 0xe2bd7e, 0.9);
      g.lineBetween(x - 20, y + 28 * viewSign, x - 27, y + 44 * viewSign);
      g.lineBetween(x + 20, y + 28 * viewSign, x + 27, y + 44 * viewSign);
    }
    if (winchCable) {
      const cablePoints = winchCable.points.map((point) => project(point.x, point.y)),
        anchor = cablePoints[cablePoints.length - 1]!,
        reeling = this.pod.reeling && !this.ui.paused;
      g.lineStyle(5, 0x111b1c, 0.96);
      for (let i = 1; i < cablePoints.length; i++)
        g.lineBetween(cablePoints[i - 1]!.x, cablePoints[i - 1]!.y, cablePoints[i]!.x, cablePoints[i]!.y);
      g.lineStyle(reeling ? 2.4 : 1.5, reeling ? 0x8de8d3 : 0xa8b8ad, reeling ? 0.96 : 0.7);
      for (let i = 1; i < cablePoints.length; i++)
        g.lineBetween(cablePoints[i - 1]!.x, cablePoints[i - 1]!.y, cablePoints[i]!.x, cablePoints[i]!.y);
      g.fillStyle(0x172526, 1);
      g.fillCircle(anchor.x, anchor.y, 5);
      g.lineStyle(1.5, reeling ? 0x8de8d3 : 0xf0c887, 0.95);
      g.strokeCircle(anchor.x, anchor.y, 4);
      if (reeling) {
        const segments = cablePoints.slice(1).map((point, index) => ({
          from: cablePoints[index]!, to: point,
          length: Phaser.Math.Distance.Between(cablePoints[index]!.x, cablePoints[index]!.y, point.x, point.y),
        })), totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
        let remaining = Math.max(0, totalLength - (this.tick * 110) % Math.max(1, totalLength)),
          beadX = cablePoints[0]!.x, beadY = cablePoints[0]!.y;
        for (const segment of segments) {
          if (remaining <= segment.length) {
            const t = segment.length > 0 ? remaining / segment.length : 0;
            beadX = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
            beadY = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
            break;
          }
          remaining -= segment.length;
        }
        g.fillStyle(0xb7fff0, 0.95);
        g.fillCircle(beadX, beadY, 2.2);
        g.lineStyle(1.4, 0xb7fff0, 0.6);
        g.strokeCircle(beadX, beadY, 5);
      }
    }
    if (!this.progress.pilotEscaping && this.pod.grappleAnchor) {
      const ax = sx(this.pod.grappleAnchor.x), ay = sy(this.pod.grappleAnchor.y);
      g.lineStyle(4, 0x101b1c, 0.9);
      g.lineBetween(x, y - 8, ax, ay);
      g.lineStyle(2, 0x9ce4cf, 0.95);
      g.lineBetween(x, y - 8, ax, ay);
      g.fillStyle(0x152323, 1);
      g.fillCircle(ax, ay, 8);
      g.lineStyle(2, 0xf4d597, 1);
      g.strokeCircle(ax, ay, 6);
    }
    if (this.pod.thrusting && !this.ui.paused) {
      g.fillStyle(0x9fefe0, 0.12);
      g.fillEllipse(x, py(30), 42 * vehicleScale, 44 * vehicleScale);
      for (const xx of [-10, 10]) {
        g.fillStyle(0xeea95e);
        g.fillTriangle(
          px(xx - 4),
          py(14),
          px(xx + 4),
          py(14),
          px(xx),
          py(27 + (this.reducedMotion ? 0 : Math.sin(this.tick * 47) * 5)),
        );
        g.fillStyle(0xc7f2d9);
        g.fillRect(px(xx - 2), py(14), 4 * vehicleScale, 7 * vehicleScale);
      }
    }
    if (this.progress.pilotEscaping) {
      const side = this.world.gravitySign(this.pod.y), suit = PILOT_SUITS[this.progress.selectedSuit];
      const packY = y - side * 4;
      if (this.pod.thrusting) {
        g.fillStyle(0xf1a56b, 0.9);
        g.fillTriangle(x - 5, packY, x + 5, packY, x, packY + side * 16);
        g.fillStyle(0xa4f0dc, 0.7);
        g.fillTriangle(x - 3, packY, x + 3, packY, x, packY + side * 10);
      }
      g.fillStyle(0x263635);
      g.fillRoundedRect(x - 10, y - 10, 20, 25, 4);
      g.fillStyle(suit.body);
      g.fillRoundedRect(x - 7, y - 5, 14, 17, 4);
      g.fillStyle(suit.trim);
      g.fillRect(x - 5, y - 9, 10, 8);
      g.fillStyle(0x18343a);
      g.fillRect(x - 4, y - 6, 8, 3);
      g.fillStyle(0x798782);
      g.fillRoundedRect(x - 15, y - 6, 5, 14, 2);
      g.fillRect(x - 5, y + 12, 4, 7);
      g.fillRect(x + 1, y + 12, 4, 7);
      g.lineStyle(2, 0x9ce4cf, 0.8);
      g.strokeCircle(x, y, 17);
    } else {
    const beamLength = Math.hypot(aimPolar.dx, aimPolar.dy) || 1,
      beamX = (aimPolar.dx * cos - aimPolar.dy * sin) / beamLength,
      beamY = (aimPolar.dx * sin + aimPolar.dy * cos) / beamLength;
    const drillLevel = this.progress.levels.drill;
    const beamStartX = x + beamX * 12, beamStartY = y + beamY * 4;
    const preview = drillPreviewDimensions(drillLevel),
      visibleBeamLength = Math.max(preview.length, effectiveDrillReach(this.world, this.pod.x, this.pod.y, preview.length));
    const beamEndX = x + beamX * visibleBeamLength, beamEndY = y + beamY * visibleBeamLength;
    const chart = this.world.planetChart,
      cutPreviewTile = this.aimTile ?? this.mining.target,
      localAim = chart && !this.inCoreDrillHalo() ? planetCartesianVectorToWorld(
        { u: this.pod.x / T, v: this.pod.y / T }, { x: aimPolar.dx, y: aimPolar.dy }, chart.columns, chart.radiusRows, T,
      ) : { x: aimPolar.dx, y: aimPolar.dy },
      radialAim = Math.abs(localAim.y) >= Math.abs(localAim.x),
      tangentCellWidth = chart && cutPreviewTile
        ? WORLD.tile * Math.abs(chart.radiusRows - (cutPreviewTile.y + 0.5)) * Math.PI / chart.columns
        : WORLD.tile,
      clearancePreview = chart && radialAim && tangentCellWidth > 0
        ? this.mining.effectiveWidth * tangentCellWidth / 2
        : 0,
      beamHalfWidth = Math.max(preview.halfWidth, clearancePreview);
    g.fillStyle(0xf5dba0, 0.13);
    g.fillTriangle(
      beamStartX, beamStartY,
      beamEndX - beamY * beamHalfWidth, beamEndY + beamX * beamHalfWidth,
      beamEndX + beamY * beamHalfWidth, beamEndY - beamX * beamHalfWidth,
    );
    g.lineStyle(1, 0xf5dba0, 0.3);
    g.lineBetween(beamStartX, beamStartY, beamEndX - beamY * beamHalfWidth, beamEndY + beamX * beamHalfWidth);
    g.lineBetween(beamStartX, beamStartY, beamEndX + beamY * beamHalfWidth, beamEndY - beamX * beamHalfWidth);
    g.lineBetween(beamEndX - beamY * beamHalfWidth, beamEndY + beamX * beamHalfWidth,
      beamEndX + beamY * beamHalfWidth, beamEndY - beamX * beamHalfWidth);
    g.fillStyle(0x121d22);
    g.fillRect(px(-18), py(-9), 36 * vehicleScale, 23 * vehicleScale);
    g.fillStyle(0x6c7c78);
    g.fillRect(px(-18), py(-7), 7 * vehicleScale, 19 * vehicleScale);
    g.fillRect(px(11), py(-7), 7 * vehicleScale, 19 * vehicleScale);
    g.fillStyle(0x24373b);
    g.fillRect(px(-19), py(8), 8 * vehicleScale, 7 * vehicleScale);
    g.fillRect(px(11), py(8), 8 * vehicleScale, 7 * vehicleScale);
    // Earned chassis upgrades add visible hardware without changing the compact collider.
    const hullLevel = this.progress.levels.hull,
      fuelLevel = this.progress.levels.fuel,
      engineLevel = this.progress.levels.engine,
      scannerLevel = this.progress.levels.scanner,
      grappleLevel = this.progress.levels.grapple;
    if (hullLevel > 1) {
      const plateColor = hullLevel >= 4 ? 0x9ba99a : 0x71837c;
      g.fillStyle(0x26383a, 0.96);
      g.fillPoints([
        { x: px(-19), y: py(-8) }, { x: px(-14), y: py(-12) }, { x: px(-11), y: py(9) }, { x: px(-18), y: py(12) },
      ], true);
      g.fillPoints([
        { x: px(19), y: py(-8) }, { x: px(14), y: py(-12) }, { x: px(11), y: py(9) }, { x: px(18), y: py(12) },
      ], true);
      g.fillStyle(plateColor, 1);
      g.fillPoints([
        { x: px(-17), y: py(-7) }, { x: px(-13), y: py(-10) }, { x: px(-11), y: py(8) }, { x: px(-16), y: py(10) },
      ], true);
      g.fillPoints([
        { x: px(17), y: py(-7) }, { x: px(13), y: py(-10) }, { x: px(11), y: py(8) }, { x: px(16), y: py(10) },
      ], true);
      if (hullLevel >= 3) {
        g.lineStyle((hullLevel >= 5 ? 3 : 2) * vehicleScale, 0xc4b58e, 0.95);
        g.lineBetween(px(-17), py(-5), px(-17), py(7));
        g.lineBetween(px(17), py(-5), px(17), py(7));
      }
      if (hullLevel >= 5) {
        g.fillStyle(0xf0ca82, 0.95);
        g.fillCircle(px(-15), py(-7), 1.8 * vehicleScale);
        g.fillCircle(px(15), py(-7), 1.8 * vehicleScale);
      }
    }
    if (fuelLevel > 1) {
      // A separate rear fuel spine keeps the upgrade distinguishable from the cargo hold.
      const tanks = fuelLevel >= 4 ? [-8, 8] : [0];
      for (const offset of tanks) {
        const radius = (fuelLevel >= 3 ? 4.2 : 3.2) * vehicleScale;
        g.fillStyle(0x142326, 1);
        g.fillRoundedRect(px(offset - radius - 1), py(14), (radius + 1) * 2, (fuelLevel >= 4 ? 11 : 9) * vehicleScale, radius);
        g.fillStyle(fuelLevel >= 5 ? 0x91d8c2 : 0x758b7d, 1);
        g.fillRoundedRect(px(offset - radius), py(14), radius * 2, (fuelLevel >= 4 ? 9 : 7) * vehicleScale, radius);
        g.lineStyle(1 * vehicleScale, 0xe4c783, 0.9);
        g.lineBetween(px(offset - radius + 1), py(17), px(offset + radius - 1), py(17));
      }
    }
    if (engineLevel > 1) {
      const nozzleSize = (2.5 + Math.min(2, engineLevel - 2) * 0.6) * vehicleScale;
      for (const side of [-1, 1]) {
        const nx = px(side * (engineLevel >= 4 ? 11 : 8));
        g.fillStyle(0x172326, 1);
        g.fillRoundedRect(nx - nozzleSize - vehicleScale, py(21), (nozzleSize + vehicleScale) * 2, 5 * vehicleScale, 2 * vehicleScale);
        g.fillStyle(engineLevel >= 5 ? 0x91ead4 : 0xeaa15e, 0.95);
        g.fillTriangle(nx - nozzleSize, py(24), nx + nozzleSize, py(24), nx, py(29 + (this.pod.thrusting && !this.reducedMotion ? Math.sin(this.tick * 40) * 2 : 0)));
      }
    }
    if (scannerLevel > 1) {
      const mastTop = py(-13 - Math.min(9, (scannerLevel - 1) * 2.1));
      g.lineStyle((scannerLevel >= 4 ? 2 : 1.4) * vehicleScale, 0x9bb4a9, 0.96);
      g.lineBetween(px(0), py(-13), px(0), mastTop);
      if (scannerLevel === 2) {
        g.lineBetween(px(-5), py(-17), px(5), py(-17));
      } else if (scannerLevel >= 3) {
        g.lineBetween(px(-5 - (scannerLevel - 3)), mastTop + 2 * vehicleScale, px(5 + (scannerLevel - 3)), mastTop + 2 * vehicleScale);
        g.fillStyle(scannerLevel >= 5 ? 0x9bf0dc : 0xeac781, 1);
        g.fillCircle(px(0), mastTop, (2 + (scannerLevel >= 5 ? 0.5 : 0)) * vehicleScale);
      }
      if (scannerLevel >= 4 && !this.reducedMotion && !this.ui.paused) {
        const sweep = (this.tick * 0.9) % (Math.PI * 2), sweepX = Math.cos(sweep) * 11 * vehicleScale,
          sweepY = mastTop + Math.sin(sweep) * 4 * vehicleScale;
        g.lineStyle(1 * vehicleScale, 0x8fe5d0, 0.48);
        g.lineBetween(px(0), mastTop, px(0) + sweepX, sweepY);
      }
    }
    if (grappleLevel > 1) {
      const socketSize = (2 + Math.min(2, grappleLevel - 2) * 0.45) * vehicleScale;
      for (const side of [-1, 1]) {
        const gx = px(side * (grappleLevel >= 4 ? 17 : 14));
        g.fillStyle(0x19282a, 1);
        g.fillCircle(gx, py(5), socketSize + 1.2 * vehicleScale);
        g.lineStyle(1.3 * vehicleScale, grappleLevel >= 5 ? 0xa4ecd9 : 0xb8aa83, 0.95);
        g.strokeCircle(gx, py(5), socketSize);
        if (grappleLevel >= 3) {
          g.lineStyle(1.3 * vehicleScale, 0xd6c89e, 0.9);
          g.lineBetween(gx, py(5), gx + side * (2 + grappleLevel * 0.45) * vehicleScale, py(8));
        }
      }
    }
    if (this.progress.salvageMagnet) {
      g.lineStyle(1.6 * vehicleScale, 0x83d7c5, 0.95);
      g.strokeCircle(px(-15), py(1), 3 * vehicleScale);
      g.strokeCircle(px(15), py(1), 3 * vehicleScale);
      g.lineStyle(2 * vehicleScale, 0xa5e7d6, 0.85);
      g.lineBetween(px(-15), py(1), px(-15), py(-3));
      g.lineBetween(px(15), py(1), px(15), py(-3));
    }
    if (this.progress.stasisModule) {
      g.lineStyle(1.8 * vehicleScale, 0x83c9bc, 0.88);
      g.strokeEllipse(x, py(8), 26 * vehicleScale, 10 * vehicleScale);
      g.fillStyle(0x9ce8d7, 0.9);
      g.fillCircle(px(-12), py(8), 1.5 * vehicleScale);
      g.fillCircle(px(12), py(8), 1.5 * vehicleScale);
    }
    if (this.progress.returnWinch) {
      const spoolY = py(-16);
      g.fillStyle(0x25383a, 1);
      g.fillRoundedRect(px(-5), spoolY - 2 * vehicleScale, 10 * vehicleScale, 5 * vehicleScale, 2 * vehicleScale);
      g.lineStyle(1.3 * vehicleScale, 0xd7c18f, 0.95);
      g.strokeCircle(px(0), spoolY, 3 * vehicleScale);
      g.lineStyle(1 * vehicleScale, 0xa7b5a7, 0.9);
      g.lineBetween(px(-3), spoolY, px(3), spoolY);
    }
    const profile = POD_PROFILES[this.progress.selectedProfile];
    if (profile.style === 'antenna') {
      g.lineStyle(2, 0x9cbdb3, 0.95);
      g.lineBetween(px(0), py(-14), px(0), py(-29));
      g.lineBetween(px(-6), py(-26), px(6), py(-26));
      g.fillStyle(0xeac781);
      g.fillCircle(px(0), py(-30), 2.5 * vehicleScale);
    } else if (profile.style === 'stabilizers') {
      g.fillStyle(0x8fa89c);
      g.fillPoints([{ x: px(-11), y: py(-5) }, { x: px(-19), y: py(-10) }, { x: px(-17), y: py(10) }, { x: px(-10), y: py(8) }], true);
      g.fillPoints([{ x: px(11), y: py(-5) }, { x: px(19), y: py(-10) }, { x: px(17), y: py(10) }, { x: px(10), y: py(8) }], true);
      g.fillStyle(0x334a47);
      g.fillRect(px(-18), py(3), 3 * vehicleScale, 3 * vehicleScale);
      g.fillRect(px(15), py(3), 3 * vehicleScale, 3 * vehicleScale);
    } else if (profile.style === 'armor') {
      g.fillStyle(0x7b8e82);
      g.fillRoundedRect(px(-16), py(-5), 5 * vehicleScale, 17 * vehicleScale, 2 * vehicleScale);
      g.fillRoundedRect(px(11), py(-5), 5 * vehicleScale, 17 * vehicleScale, 2 * vehicleScale);
      g.fillStyle(0xb8c1a2);
      g.fillTriangle(px(-7), py(12), px(7), py(12), px(0), py(20));
    }
    const paint = POD_PAINTS[this.progress.selectedPaint];
    g.fillStyle(paint.hull);
    g.fillRoundedRect(px(-12), py(-16), 24 * vehicleScale, 29 * vehicleScale, 4 * vehicleScale);
    g.fillStyle(paint.trim);
    g.fillRect(px(-9), py(-15), 18 * vehicleScale, 3 * vehicleScale);
    const decal = POD_DECALS[this.progress.selectedDecal];
    g.fillStyle(decal.color);
    if (decal.style === 'stripe') g.fillRect(px(-6), py(5), 12 * vehicleScale, 2 * vehicleScale);
    else if (decal.style === 'arrow') g.fillPoints([
      { x: px(-5), y: py(4) }, { x: px(4), y: py(4) }, { x: px(4), y: py(1) },
      { x: px(8), y: py(6) }, { x: px(4), y: py(10) }, { x: px(4), y: py(7) }, { x: px(-5), y: py(7) },
    ], true);
    else if (decal.style === 'crest') {
      g.fillPoints([{ x: px(0), y: py(1) }, { x: px(6), y: py(6) }, { x: px(0), y: py(11) }, { x: px(-6), y: py(6) }], true);
      g.fillStyle(0x24373b);
      g.fillCircle(px(0), py(6), 1.5 * vehicleScale);
    } else {
      g.fillPoints([{ x: px(-6), y: py(4) }, { x: px(-2), y: py(1) }, { x: px(2), y: py(4) }, { x: px(-2), y: py(7) }], true);
      g.fillPoints([{ x: px(1), y: py(8) }, { x: px(5), y: py(5) }, { x: px(9), y: py(8) }, { x: px(5), y: py(11) }], true);
    }
    g.fillStyle(0x284a50);
    g.fillRoundedRect(px(-9), py(-10), 18 * vehicleScale, 12 * vehicleScale, 3 * vehicleScale);
    g.fillStyle(profile.cabin);
    g.fillRect(px(-7), py(-9), 14 * vehicleScale, 3 * vehicleScale);
    const suit = PILOT_SUITS[this.progress.selectedSuit];
    g.fillStyle(suit.body);
    g.fillRect(px(-4), py(-5), 8 * vehicleScale, 7 * vehicleScale);
    g.fillStyle(suit.trim);
    g.fillRoundedRect(px(-4), py(-9), 8 * vehicleScale, 5 * vehicleScale, 2 * vehicleScale);
    g.fillStyle(0x18343a);
    g.fillRect(px(-2), py(-7), 4 * vehicleScale, 2 * vehicleScale);
    g.fillStyle(0x6d9293);
    g.fillRect(px(-7), py(-5), 5 * vehicleScale, 4 * vehicleScale);
    g.fillStyle(0x715b40);
    g.fillRect(px(-8), py(6), 16 * vehicleScale, 3 * vehicleScale);
    if (this.pod.docked) {
      g.lineStyle(2, 0x95c9b6, 0.9);
      g.lineBetween(px(-26), py(21), px(26), py(21));
      g.lineBetween(px(-26), py(21), px(-26), py(14));
      g.lineBetween(px(26), py(21), px(26), py(14));
    }
    g.lineStyle(1, 0x4b6664);
    g.lineBetween(px(-5), py(16), px(4), py(16));
    g.lineBetween(px(-3), py(19), px(2), py(19));
    g.fillStyle(paint.light);
    g.fillCircle(x + beamX * 13, y + beamY * 5, 2.5 * vehicleScale);
    const drillTier = drillVisualTier(this.progress.levels.drill),
      drillColors = [0xe4c286, 0x9bcfb4, 0x73e1ce, 0x9bd8f0, 0xffd27f],
      drillColor = drillColors[drillTier - 1]!,
      drillBaseX = x + beamX * 11,
      drillBaseY = y + beamY * 11,
      drillActive = !!this.mining.target && !this.ui.paused,
      cutProgress = drillActive ? Phaser.Math.Clamp(this.mining.ratio, 0, 1) : 0,
      drillStroke = drillActive && !this.reducedMotion ? 2 + (Math.sin(this.tick * 26) + 1) * 1.5 + cutProgress * 3.5 : cutProgress * 3,
      drillLength = Math.max(4, [10, 15, 21, 29, 38][drillTier - 1]! * vehicleScale + drillStroke - this.drillRecoil * 8 * vehicleScale),
      drillTipX = drillBaseX + beamX * drillLength,
      drillTipY = drillBaseY + beamY * drillLength,
      drillPerpX = -beamY,
      drillPerpY = beamX,
      drillSpread = (2 + drillTier * 0.75) * vehicleScale,
      drillPulse = drillActive && !this.reducedMotion ? 0.8 + Math.sin(this.tick * 18) * 0.2 : 1;
    // Earned drill hardware pivots toward the actual 360-degree aim vector;
    // the chassis stays upright while the camera turns around the miner.
    g.lineStyle(4.5 * vehicleScale, 0x18272a, 1);
    g.lineBetween(drillBaseX, drillBaseY, drillTipX, drillTipY);
    g.lineStyle(2.2 * vehicleScale, drillColor, 0.95 * drillPulse);
    g.lineBetween(drillBaseX, drillBaseY, drillTipX, drillTipY);
    g.fillStyle(0x263d3d, 1);
    g.fillCircle(drillBaseX, drillBaseY, (3 + drillTier * 0.35) * vehicleScale);
    if (drillTier >= 2) {
      const railStartX = drillBaseX + beamX * 4 * vehicleScale,
        railStartY = drillBaseY + beamY * 4 * vehicleScale,
        railMidX = drillBaseX + beamX * drillLength * 0.66,
        railMidY = drillBaseY + beamY * drillLength * 0.66;
      g.lineStyle((drillTier >= 4 ? 2.4 : 1.6) * vehicleScale, drillTier >= 4 ? 0x425c5b : drillColor, drillPulse);
      for (const side of [-1, 1]) {
        g.lineBetween(railStartX + drillPerpX * drillSpread * side, railStartY + drillPerpY * drillSpread * side,
          railMidX + drillPerpX * drillSpread * side, railMidY + drillPerpY * drillSpread * side);
      }
      g.lineStyle(1.5 * vehicleScale, drillColor, drillPulse);
      g.lineBetween(railMidX + drillPerpX * drillSpread, railMidY + drillPerpY * drillSpread,
        railMidX - drillPerpX * drillSpread, railMidY - drillPerpY * drillSpread);
    }
    if (drillTier === 2) {
      // Short diagonal teeth turn the extended rails into a readable auger.
      g.lineStyle(1.5 * vehicleScale, 0xe1d5aa, 0.95 * drillPulse);
      for (const fraction of [0.34, 0.62]) {
        const cx = drillBaseX + beamX * drillLength * fraction,
          cy = drillBaseY + beamY * drillLength * fraction,
          tooth = drillSpread * 1.3;
        g.lineBetween(cx - beamX * 2 * vehicleScale - drillPerpX * tooth,
          cy - beamY * 2 * vehicleScale - drillPerpY * tooth,
          cx + beamX * 2 * vehicleScale + drillPerpX * tooth,
          cy + beamY * 2 * vehicleScale + drillPerpY * tooth);
      }
    }
    if (drillTier >= 3) {
      g.lineStyle(1.5 * vehicleScale, 0xd5f4d3, 0.92 * drillPulse);
      g.strokeCircle(drillBaseX, drillBaseY, (5 + (drillTier - 3) * 1.4) * vehicleScale);
    }
    if (drillTier === 3) {
      // Twin resonance nodes sit along the lance and pulse with the cutting cycle.
      for (const fraction of [0.38, 0.72]) {
        const cx = drillBaseX + beamX * drillLength * fraction,
          cy = drillBaseY + beamY * drillLength * fraction;
        g.fillStyle(0x183b3c, 0.95);
        g.fillCircle(cx, cy, 3.2 * vehicleScale);
        g.lineStyle(1.5 * vehicleScale, 0xc5fff0, 0.88 * drillPulse);
        g.strokeCircle(cx, cy, 3.5 * vehicleScale);
      }
    }
    if (drillTier >= 4) {
      const finX = drillBaseX + beamX * 5 * vehicleScale,
        finY = drillBaseY + beamY * 5 * vehicleScale;
      g.lineStyle(2 * vehicleScale, 0xa6c3b4, 0.9);
      for (const side of [-1, 1]) {
        g.lineBetween(finX, finY, finX + drillPerpX * drillSpread * 2.3 * side,
          finY + drillPerpY * drillSpread * 2.3 * side);
      }
    }
    if (drillTier === 5) {
      g.lineStyle(2.6 * vehicleScale, 0xffecad, drillPulse);
      g.lineBetween(drillBaseX, drillBaseY, drillTipX, drillTipY);
      g.fillStyle(0xffe9aa, 0.3 * drillPulse);
      g.fillCircle(drillTipX, drillTipY, 5 * vehicleScale * drillPulse);
      const heatX = drillBaseX + beamX * 4 * vehicleScale,
        heatY = drillBaseY + beamY * 4 * vehicleScale;
      g.lineStyle(2 * vehicleScale, 0xffd27f, 0.86 * drillPulse);
      for (const side of [-1, 1]) {
        const finX = heatX + drillPerpX * drillSpread * 1.65 * side,
          finY = heatY + drillPerpY * drillSpread * 1.65 * side;
        g.lineBetween(heatX, heatY, finX, finY);
        g.lineBetween(finX, finY, finX - beamX * 4 * vehicleScale, finY - beamY * 4 * vehicleScale);
      }
      if (drillActive && this.mining.target) {
        const target = this.mining.target,
          hit = project(target.x * T + T / 2, target.y * T + T / 2),
          pulse = drillPulse * (0.88 + cutProgress * 0.12);
        // A dark edge keeps the earned laser legible against every planet palette.
        g.lineStyle(11 * vehicleScale, 0x102529, 0.96);
        g.lineBetween(drillTipX, drillTipY, hit.x, hit.y);
        g.lineStyle(6 * vehicleScale, 0x75e8d2, 0.62 * pulse);
        g.lineBetween(drillTipX, drillTipY, hit.x, hit.y);
        g.lineStyle(2.6 * vehicleScale, 0xe0fff2, pulse);
        g.lineBetween(drillTipX, drillTipY, hit.x, hit.y);
        g.fillStyle(0x73e8d3, 0.34 * pulse);
        g.fillCircle(hit.x, hit.y, 17 * pulse);
        g.lineStyle(2 * vehicleScale, 0xffe3a0, 0.98 * pulse);
        g.strokeCircle(hit.x, hit.y, 8 + cutProgress * 4);
      }
    }
    g.fillStyle(drillColor, 1);
    g.fillTriangle(
      drillTipX + beamX * 4 * vehicleScale, drillTipY + beamY * 4 * vehicleScale,
      drillTipX - beamX * 2 * vehicleScale + drillPerpX * drillSpread,
      drillTipY - beamY * 2 * vehicleScale + drillPerpY * drillSpread,
      drillTipX - beamX * 2 * vehicleScale - drillPerpX * drillSpread,
      drillTipY - beamY * 2 * vehicleScale - drillPerpY * drillSpread,
    );
    }
    if (!this.reducedMotion) this.atmosphere.draw(g, this.world, this.atmosphereView(), sx, sy, true);
    if (this.ui.hasStarted && !this.ui.paused && this.aimTile && this.pod.y > 0) {
      const pointer = this.input.activePointer;
      if (!pointer.leftButtonDown()) {
        const ax = sx(this.aimTile.x * T), ay = sy(this.aimTile.y * T);
        g.lineStyle(2, 0xf5d59b, 0.8);
        g.strokeRect(ax + 4, ay + 4, T - 8, T - 8);
        g.lineStyle(1, 0xf5d59b, 0.45);
        g.lineBetween(sx(this.pod.x), sy(this.pod.y), ax + T / 2, ay + T / 2);
      }
    }
    if (!this.reducedMotion && this.mining.target && !this.ui.paused && Math.random() < 0.6) {
      const target = this.mining.target,
        profile = drillImpactProfile(target, this.mapId),
        targetDx = target.x * T + T / 2 - this.pod.x;
      const sideways = Math.abs(targetDx) > 20;
      const direction = sideways ? Math.sign(targetDx) || f : 0;
      this.particles.push({
        x: this.pod.x + (sideways ? direction * 15 : (Math.random() - 0.5) * 12),
        y: this.pod.y + (sideways ? (Math.random() - 0.5) * 20 : 16),
        vx: sideways ? direction * (45 + Math.random() * 70) : (Math.random() - 0.5) * 90,
        vy: sideways ? (Math.random() - 0.5) * 60 : -20 - Math.random() * 60,
        life: 0.2,
        color: profile.color,
        size: 2,
        kind: profile.kind,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
    for (const p of this.particles) {
      const screen = screenProject(p.x, p.y), alpha = Math.min(1, p.life * 2), size = p.size,
        rotation = p.rotation ?? 0,
        dx = Math.cos(rotation) * size, dy = Math.sin(rotation) * size;
      g.fillStyle(p.color, alpha);
      if (p.kind === 'dust') {
        g.fillCircle(screen.x, screen.y, size * 0.55);
      } else if (p.kind === 'spark') {
        g.lineStyle(Math.max(1, size * 0.45), p.color, alpha);
        g.lineBetween(screen.x - dx, screen.y - dy, screen.x + dx * 1.5, screen.y + dy * 1.5);
      } else if (p.kind === 'glint') {
        g.lineStyle(Math.max(1, size * 0.3), p.color, alpha);
        g.lineBetween(screen.x - dx * 1.8, screen.y - dy * 1.8, screen.x + dx * 1.8, screen.y + dy * 1.8);
        g.lineBetween(screen.x + dy * 1.8, screen.y - dx * 1.8, screen.x - dy * 1.8, screen.y + dx * 1.8);
      } else if (p.kind === 'frost') {
        g.fillPoints([
          { x: screen.x + dx, y: screen.y + dy }, { x: screen.x - dy * 0.55, y: screen.y + dx * 0.55 },
          { x: screen.x - dx, y: screen.y - dy }, { x: screen.x + dy * 0.55, y: screen.y - dx * 0.55 },
        ], true);
      } else if (p.kind === 'chip' || p.kind === 'shard') {
        const tip = p.kind === 'shard' ? 1.8 : 1.3;
        g.fillPoints([
          { x: screen.x + dx * tip, y: screen.y + dy * tip },
          { x: screen.x - dx + dy * 0.65, y: screen.y - dy - dx * 0.65 },
          { x: screen.x - dx - dy * 0.65, y: screen.y - dy + dx * 0.65 },
        ], true);
      } else if (p.kind === 'ring') {
        const radius = size + (0.3 - p.life) * 42;
        g.lineStyle(Math.max(1, 1.5 * alpha), p.color, alpha);
        g.strokeCircle(screen.x, screen.y, radius);
      } else {
        g.fillRect(screen.x - size / 2, screen.y - size / 2, size, size);
      }
    }
    const fallSpeed = this.pod.vy * this.world.gravitySign(this.pod.y),
      fallCue = fallMotionCueIntensity(this.pod.vy, this.world.gravitySign(this.pod.y));
    if (!this.reducedMotion && !this.ui.paused && fallCue > 0) {
      const flow = this.tick * (90 + fallSpeed * 0.32), span = h + 70;
      g.lineStyle(1 + fallCue * 0.6, 0x9ce4cf, 0.22 + fallCue * 0.18);
      for (let i = 0; i < 8; i++) {
        const lane = Math.floor(i / 2), side = i % 2 === 0 ? 0.24 : 0.76,
          x = w * side + (random(71, lane, i) - 0.5) * w * 0.08,
          y = ((lane * 117 - flow) % span + span) % span - 35,
          from = cameraUnzoomPoint({ x, y }, w, h, this.cameraZoom),
          to = cameraUnzoomPoint({ x, y: y - (12 + fallCue * 20) }, w, h, this.cameraZoom);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
    if (ground > 0)
      for (let i = 0; i < 18; i++) {
        g.fillStyle(0xecc799, 0.18);
        g.fillRect(
          (random(22, i, 0) * w + this.tick * (7 + (i % 4))) % w,
          ground - 14 - random(22, i, 1) * 110,
          2,
          1,
        );
      }
  }
}
