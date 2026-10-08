import Phaser from 'phaser';
import { CORE, CORE_WORLD_Y, FAR_SURFACE_ROW, FAR_SURFACE_Y, WORLD, ORES, ORE_SILHOUETTES, CORE_RELICS, REGION_FINDS, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, ESCAPE_SUIT, ROCK_SWIMMER, POD_PAINTS, PILOT_SUITS, POD_DECALS, POD_PROFILES, SPECIALIZATIONS, UNDERGROUND_BUILDING, estimateVerticalReturnFuel, depthAtWorldY, CAMPAIGN_MILESTONES, ROUTE_FRAGMENTS, ROUTE_SURVEY_REWARDS, NAVIGATION_HASHES, MAPS, drillWidth, podVisualScale, type MapId, type ShipComponent, type Ore, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from './config';
import { TileWorld, keyOf, random, type Tile } from './world/TileWorld';
import { PlayerPod, type Controls } from './player/PlayerPod';
import { Progress } from './economy/Progress';
import { MiningSystem, aimedDrillTarget, chargeTargets, collectOreDrop, podWithinPickupReach, applySalvageMagnet, hasClearMagnetPath, updateOreDropPhysics, updateChargePhysics } from './mining/MiningSystem';
import { SaveManager, type SaveData, type WorldSave, type OreDrop, type ActiveCharge } from './save/SaveManager';
import { AudioSystem } from './audio/AudioSystem';
import { HUD } from './ui/HUD';
import { getDialogFocusables } from './ui/focus';
import { STATIONS, TOWN_TIER_HEIGHTS, atSurface, dockedOnSurface, surfaceGroundY, surfaceTownTier } from './surface/SurfaceStation';
import { drawSurfaceTown } from './surface/SurfaceTown';
import { restoreMapState, snapshotMapState } from './campaign/MapState';
import { collectCoreRelic, crewArchiveRestored } from './campaign/Records';
import { RockSwimmer } from './world/RockSwimmer';
import { CaveAtmosphere } from './world/CaveAtmosphere';
import { screenToWorld, worldToScreen } from './world/Projection';
import { canAffordStructure, findBuildSite, nearbyServiceStation, type StructureKind, type UndergroundStructure } from './building/UndergroundStructures';
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  size: number;
};
export class MiningScene extends Phaser.Scene {
  world!: TileWorld;
  mapId: MapId = 'cryo-shelf';
  campaignSeed = 0;
  mapStates: Partial<Record<MapId, WorldSave>> = {};
  structures: UndergroundStructure[] = [];
  oreDrops: OreDrop[] = [];
  activeCharge?: ActiveCharge;
  pod!: PlayerPod;
  progress = new Progress();
  mining!: MiningSystem;
  aimTile?: Tile;
  drillAimX = 0;
  drillAimY = 1;
  rockSwimmer!: RockSwimmer;
  saves = new SaveManager();
  soundFx = new AudioSystem();
  ui!: HUD;
  g!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  labels: Phaser.GameObjects.Text[] = [];
  shipStatusLabel!: Phaser.GameObjects.Text;
  landmarkLabels = new Map<string, Phaser.GameObjects.Text>();
  floating: { text: Phaser.GameObjects.Text; x: number; y: number; life: number }[] = [];
  particles: Particle[] = [];
  atmosphere = new CaveAtmosphere();
  camX = 0;
  camY = -300;
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
    }
  };
  syncInput(paused: boolean) {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.resetKeys();
    keyboard.clearCaptures();
    if (!paused) keyboard.addCapture(['W', 'A', 'S', 'D', 'Q', 'R', 'M', 'UP', 'LEFT', 'DOWN', 'RIGHT', 'SPACE']);
  }
  get surfaceCameraY() {
    const baseView = Math.max(this.scale.height * 0.49, Math.min(365, this.scale.height * 0.67));
    const tier = surfaceTownTier(this.progress.shipComponents, this.progress.milestones.filter((id) => CORE_RELICS.some((relic) => relic.id === id)));
    return -Math.max(baseView, Math.min(TOWN_TIER_HEIGHTS[tier] + 90, this.scale.height * 0.9));
  }
  get farHemisphere() {
    return !!this.pod && this.pod.y >= CORE_WORLD_Y;
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
    this.campaignSeed = saved?.campaignSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    const savedMapState = this.mapStates[this.mapId];
    const mapState = restoreMapState(savedMapState, this.mapId, this.seedForMap(this.mapId));
    this.structures = mapState.structures;
    this.oreDrops = mapState.drops;
    this.activeCharge = mapState.activeCharge;
    this.world = mapState.world;
    this.rockSwimmer = new RockSwimmer(this.world.seed, this.mapId);
    this.pod = new PlayerPod(this.world, this.progress);
    this.pod.structures = this.structures;
    if (savedMapState) {
      this.pod.x = savedMapState.x;
      this.pod.y = savedMapState.y;
      this.pod.docked = dockedOnSurface(savedMapState.x, savedMapState.y);
      if (this.pod.docked) this.pod.y = savedMapState.y < CORE_WORLD_Y ? WORLD.spawnY : FAR_SURFACE_Y + 22;
      if (this.pod.overlaps(savedMapState.x, savedMapState.y).length) this.pod.reset();
    }
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
            this.soundFx.reward();
            this.save();
            this.ui.toast('Refueled and repaired. Ready to depart.');
          }
          return ok;
        },
        resume: () => this.ui.close(),
        save: () => {
          this.save();
          this.ui.toast(this.saves.warning || 'Expedition saved. Your tunnels are here to stay.');
        },
        sell: () => {
          if (!this.surface) return 0;
          const n = this.progress.sell();
          if (n) {
            this.soundFx.reward();
            this.float(`+$${n}`, this.pod.x, this.pod.y - 45, '#f5ca78');
            this.burst(this.pod.x, this.pod.y, 0xf5ca78, 28);
            this.ui.toast(`+$${n} banked. Another piece of the Faraday recovered.`);
            this.save();
          }
          return n;
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
            this.ui.toast('Surface winch installed. Hold R in an open shaft to reel upward faster; watch your fuel.');
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
        buildShipComponent: (key: ShipComponent) => {
          if (!this.surface) return false;
          const ok = this.progress.buyShipComponent(key);
          if (ok) {
            this.soundFx.reward();
            this.ui.toast(`${key.toUpperCase()} installed at the shipyard.`);
            this.save();
          }
          return ok;
        },
        buildStructure: (kind: StructureKind) => this.buildUndergroundStructure(kind),
        structures: () => this.structures,
        surfaceAccess: () => this.surface,
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
    document.querySelector('#game')!.appendChild(this.game.canvas);
    const resize = () => {
      const el = document.querySelector('#viewport')!;
      this.scale.resize(el.clientWidth, el.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    this.g = this.add.graphics();
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,M,B,UP,LEFT,DOWN,RIGHT,SPACE,ESC,E,X,R',
      false,
    ) as typeof this.keys;
    this.syncInput(this.ui.paused);
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.ui.hasStarted) {
        this.ui.modal ? this.ui.close() : this.pause();
      }
    });
    this.input.keyboard!.on('keydown-E', () => {
      if (!this.ui.hasStarted || this.ui.modal) return;
      if (this.surface) this.ui.open('sell');
      else if (nearbyServiceStation(this.structures, this.pod.x, this.pod.y)) this.ui.open('service');
    });
    this.input.keyboard!.on('keydown-B', () => {
      if (this.ui.hasStarted && !this.ui.modal && !this.surface && this.depth >= UNDERGROUND_BUILDING.minimumDepthMeters && this.depth <= 3400)
        this.ui.open('construction');
    });
    this.input.keyboard!.on('keydown-M', () => {
      if (this.ui.hasStarted && !this.ui.modal) this.ui.toggleMap();
    });
    this.input.keyboard!.on('keydown-Q', () => {
      if (this.ui.hasStarted && !this.ui.modal) this.deployCharge();
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
    this.ui.update(this.depth, this.surface, 1, this.pod.docked, 0, this.pod.vy, this.farHemisphere);
    if (import.meta.env.DEV)
      Object.defineProperty(window, '__mars', {
        configurable: true,
        get: () => ({
          x: this.pod.x,
          y: this.pod.y,
          vx: this.pod.vx,
          vy: this.pod.vy,
          depth: this.depth,
          farHemisphere: this.farHemisphere,
          gravitySign: this.world.gravitySign(this.pod.y),
          fuel: this.progress.fuel,
          hull: this.progress.hull,
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
          scannerRadius: Math.min(WORLD.width, this.progress.max('scanner') + SPECIALIZATIONS[this.progress.specialization].scanRadiusBonus),
          cargoCapacity: this.progress.max('cargo'),
          surveyedCells: this.world.discovered.size,
          podScale: podVisualScale(this.progress.levels.drill, this.progress.levels.cargo),
          camera: { x: this.camX, y: this.camY },
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
          shipStatus: this.progress.shipComplete ? 'FLIGHT READY' : `${this.progress.shipComponents.length} / 4 SYSTEMS`,
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
          chunks: this.world.chunks.size,
          seed: this.world.seed,
          paused: this.ui.paused,
          docked: this.pod.docked,
          overlaps: this.pod.overlaps(this.pod.x, this.pod.y).length,
        }),
      });
  }
  get depth() {
    return depthAtWorldY(this.pod.y);
  }
  get surface() {
    return atSurface(this.pod.x, this.pod.y);
  }
  get canService() {
    return this.surface || !!nearbyServiceStation(this.structures, this.pod.x, this.pod.y);
  }
  buildUndergroundStructure(kind: StructureKind) {
    const cost = UNDERGROUND_BUILDING[kind], p = this.progress;
    const site = findBuildSite(this.world, this.pod.x, this.pod.y, this.world.gravitySign(this.pod.y), kind, this.structures);
    if (this.surface || this.depth < UNDERGROUND_BUILDING.minimumDepthMeters || this.depth > 3400 || !site || !canAffordStructure(kind, p.cargo, p.money)) return false;
    p.money -= cost.credits;
    for (const [ore, units] of Object.entries(cost.materials)) p.cargo[ore as Ore] -= units;
    const structure: UndergroundStructure = { id: `${kind}:${Math.round(site.x)}:${Math.round(site.y)}`, kind, ...site };
    this.structures.push(structure);
    this.pod.structures = this.structures;
    this.soundFx.reward();
    this.float(kind === 'service' ? 'REFUEL BEACON BUILT' : kind === 'turret' ? 'DEFENSE TURRET BUILT' : 'ANCHOR DECK BUILT', site.x, site.y, '#9ce4cf');
    this.save();
    return true;
  }
  estimateReturnFuel() {
    return estimateVerticalReturnFuel(this.pod.y, this.progress.max('engine'));
  }
  seedForMap(id: MapId) {
    const index = Object.keys(MAPS).indexOf(id) + 1;
    return Math.floor(random(this.campaignSeed, index, 73, 384) * 0xffffffff) >>> 0;
  }
  revealAroundPod() {
    const tx = Math.floor(this.pod.x / WORLD.tile), ty = Math.floor(this.pod.y / WORLD.tile);
    const bonus = SPECIALIZATIONS[this.progress.specialization].scanRadiusBonus;
    const radius = Math.min(WORLD.width, this.progress.max('scanner') + bonus);
    if (this.lastRevealWorld === this.world && this.lastRevealX === tx && this.lastRevealY === ty && this.lastRevealRadius === radius) return;
    this.lastRevealWorld = this.world;
    this.lastRevealX = tx;
    this.lastRevealY = ty;
    this.lastRevealRadius = radius;
    this.world.reveal(this.pod.x, this.pod.y, bonus, this.progress.max('scanner'));
    this.pod.scannerRadius = radius;
  }
  rememberCurrentMap() {
    this.mapStates[this.mapId] = snapshotMapState(
      this.mapStates[this.mapId], this.world, this.pod.x, this.pod.y, this.depth,
      this.oreDrops, this.activeCharge, this.structures,
    );
  }
  travelToMap(id: MapId) {
    if (!this.surface || id === this.mapId) return false;
    const unlocked = id === 'cryo-shelf' || id === this.mapId || this.progress.shipComplete;
    if (!unlocked) return false;
    this.rememberCurrentMap();
    this.mapId = id;
    const state = restoreMapState(this.mapStates[id], id, this.seedForMap(id));
    this.structures = state.structures;
    this.world = state.world;
    this.rockSwimmer = new RockSwimmer(this.world.seed, id);
    this.oreDrops = state.drops;
    this.activeCharge = state.activeCharge;
    this.pod.world = this.world;
    this.pod.structures = this.structures;
    this.pod.reset();
    this.mining.world = this.world;
    this.mining.target = undefined;
    this.mining.elapsed = this.mining.ratio = 0;
    this.camX = this.pod.x - this.scale.width / 2;
    this.camY = this.surfaceCameraY;
    this.revealAroundPod();
    this.ui.setMap(id);
    this.ui.toast(`Destination reached · ${MAPS[id].name.toUpperCase()}`);
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
      version: 17,
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
    };
    const ok = this.saves.write(data);
    this.ui.saved(ok);
    if (!ok) this.ui.toast(this.saves.warning);
    return ok ? data : null;
  }
  fail(recovery = false) {
    this.progress.pilotEscaping = false;
    this.progress.rescue();
    this.pod.reset();
    this.mining.target = undefined;
    this.mining.ratio = 0;
    this.camY = this.surfaceCameraY;
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
    this.progress.pilotEscaping = false;
    this.progress.rescue();
    this.pod.reset();
    this.camY = this.surfaceCameraY;
    this.wasSurface = this.surface;
    this.ui.toast(atBeacon ? 'BEACON REACHED · RESCUE CREW DISPATCHED · ORE LOST' : 'SURFACE REACHED · PILOT SAFE · MINER AND ORE LOST');
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
    this.burst(tile.x * 40 + 20, tile.y * 40 + 20, tile.ore ? ORES[tile.ore].color : tile.tint);
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
    const claim = ROUTE_SURVEY_REWARDS[fragment.id];
    this.progress.milestones.push(fragment.milestoneId);
    this.soundFx.playLandmarkCue('route');
    this.soundFx.reward();
    this.ui.toast(`ROUTE DATA RECOVERED · +$${claim} FARADAY SALVAGE CLAIM`);
    this.float(`+$${claim} CLAIM`, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, '#9ae8d8');
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
      ? 'CREW ARCHIVE RESTORED · THE FARADAY SIGNAL IS A RETURN HANDSHAKE'
      : `CREW LOG RECOVERED · ${hash.crew} · ${hash.name} · NO EXCHANGE VALUE`);
    this.float(hash.hash, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, '#91f5e2');
    if (persist) this.save();
    return true;
  }
  recordCoreRelic(tile: Tile, persist = true) {
    if (!tile.coreRelicId) return false;
    const relic = collectCoreRelic(this.progress, tile.coreRelicId);
    if (!relic) return false;
    this.soundFx.playLandmarkCue('archive');
    this.soundFx.reward();
    const complete = CORE_RELICS.every((entry) => this.progress.milestones.includes(entry.id));
    this.ui.toast(complete
      ? `PLANETARY CORE LEDGER COMPLETE · ${relic.name.toUpperCase()} RECOVERED · +$${relic.bounty} CLAIM`
      : `${relic.name.toUpperCase()} RECOVERED · +$${relic.bounty} ARCHIVE CLAIM`);
    this.float(`+$${relic.bounty} CORE CLAIM`, tile.x * WORLD.tile + 20, tile.y * WORLD.tile, `#${relic.tint.toString(16).padStart(6, '0')}`);
    if (persist) this.save();
    return true;
  }
  deployCharge() {
    if (this.surface) {
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
      if (podWithinPickupReach(this.pod.x, this.pod.y, drop.x, drop.y)) {
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
      const previousFarSide = this.farHemisphere;
      const k = this.keys,
        input: Controls = {
          left: k.A.isDown || k.LEFT.isDown,
          right: k.D.isDown || k.RIGHT.isDown,
          down: k.S.isDown || k.DOWN.isDown,
          up: k.W.isDown || k.UP.isDown || k.SPACE.isDown,
          stasis: k.X.isDown,
          reel: k.R.isDown,
          escapePack: this.progress.pilotEscaping,
        };
      const target = this.pod.update(dt, input, (damage) => {
        if (this.progress.pilotEscaping || this.progress.hull <= 0) return;
        this.progress.hull = Math.max(0, this.progress.hull - damage);
        this.shake = 5;
        if (!this.landingHintShown) {
          this.ui.toast('Hard landing. Hold W before impact to brake your descent.');
          this.landingHintShown = true;
        }
        this.soundFx.tone(55, 0.22, 'sawtooth', 0.07, 20);
        this.float(`−${Math.ceil(damage)} HULL`, this.pod.x, this.pod.y - 25, '#ff927d');
      });
      if (!this.progress.pilotEscaping && this.progress.hull <= 0 && this.progress.escapeSuit) this.beginPilotEscape();
      if (previousFarSide !== this.farHemisphere) {
        if (this.farHemisphere && !this.progress.milestones.includes('core-crossing')) {
          this.progress.milestones.push('core-crossing');
          this.progress.money += CORE.firstCrossingReward;
          this.ui.toast(`CORE CROSSED · GRAVITY REVERSED · +$${CORE.firstCrossingReward} FARADAY CLAIM · HOLD W TO CLIMB TOWARD THE FAR CRUST`);
          this.soundFx.playLandmarkCue('route');
          this.soundFx.reward();
          this.float('CORE CROSSING · +$2,200', this.pod.x, this.pod.y - 32, '#9ce4cf');
        } else this.ui.toast(this.farHemisphere ? 'FAR HEMISPHERE · GRAVITY PULLS TOWARD THE CORE · W THRUSTS OUTWARD' : 'CORE CROSSED AGAIN · HOMEWARD HEMISPHERE · GRAVITY FLIPPED');
        this.save();
      }
      const pointer = this.input.activePointer;
      const mouseDrilling = !this.progress.pilotEscaping && pointer.leftButtonDown() && this.ui.hasStarted && !this.ui.modal && !this.pod.docked && this.pod.y > 0;
      const aimWorld = screenToWorld(pointer.x, pointer.y, this.camX, this.camY, this.scale.width, this.scale.height, this.farHemisphere),
        aimWorldX = aimWorld.x,
        aimWorldY = aimWorld.y;
      this.aimTile = this.progress.pilotEscaping ? undefined : aimedDrillTarget(
        this.world, this.pod.x, this.pod.y,
        aimWorldX, aimWorldY,
      );
      const previewingMouseAim = !!this.aimTile && !input.down && !input.left && !input.right && !input.up;
      const directionTarget = mouseDrilling || previewingMouseAim ? this.aimTile : target ?? this.mining.target;
      if (directionTarget) {
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
      if (this.rockSwimmer.update(dt, this.depth, this.pod.x, this.pod.y, this.structures, (x, y) => {
        this.soundFx.tone(620, 0.1, 'square', 0.025, 240);
        this.float('TURRET INTERCEPT', x, y - 38, '#f0b779');
      })) {
        if (this.progress.pilotEscaping) {
          this.fail();
          return;
        }
        this.progress.hull = Math.max(0, this.progress.hull - ROCK_SWIMMER.hullDamage);
        this.shake = this.reducedMotion ? 0 : 4;
        this.float(`−${ROCK_SWIMMER.hullDamage} HULL · ROCK SWIMMER`, this.pod.x, this.pod.y - 29, '#8fe5d5');
        this.ui.toast('ROCK SWIMMER COLLISION · Steer clear when its glow approaches.');
        this.soundFx.tone(160, 0.16, 'sine', 0.04, 80);
        this.save();
      }
      this.updateOreDrops(dt);
      const horizontalCut = input.down || !input.left && !input.right;
      const drillTarget = mouseDrilling ? this.aimTile : target;
      const drillVectorX = aimWorldX - this.pod.x;
      const drillVectorY = aimWorldY - this.pod.y;
      const mouseOrientation = mouseDrilling
        ? { x: drillVectorX, y: drillVectorY }
        : input.down ? 'vertical' as const : input.left || input.right ? 'horizontal' as const : 'vertical' as const;
      const protectedTiles = new Set(this.pod.overlaps(this.pod.x, this.pod.y).map((cell) => keyOf(cell.x, cell.y)));
      if (!this.progress.pilotEscaping) this.mining.update(dt, drillTarget, (tile, collected, dropped) => {
        if (dropped > 0 && this.spawnOreDrop(tile, dropped)) this.save();
        this.broken(tile, collected, dropped > 0);
        this.recordFragment(tile);
        this.recordNavigationHash(tile);
        this.recordCoreRelic(tile);
      }, mouseDrilling ? mouseOrientation : horizontalCut ? 'horizontal' : 'vertical', protectedTiles);
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
      if (!this.progress.pilotEscaping && (this.progress.hull <= 0 || (this.progress.fuel <= 0 && this.pod.y >= 0))) {
        this.fail();
        return;
      }
      if (!this.progress.pilotEscaping && this.progress.fuel <= 0 && this.pod.y < 0) {
        this.progress.rescue();
        this.pod.reset();
        this.ui.toast('Outpost recovery: fresh fuel, cargo forfeited.');
        this.save();
      }
      if (this.progress.pilotEscaping && (this.surface || nearbyServiceStation(this.structures, this.pod.x, this.pod.y))) {
        this.completePilotEscape(!this.surface);
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
        Math.min(WORLD.width * 40 - this.scale.width + 100, this.pod.x - this.scale.width / 2),
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
    this.camX += (goalX - this.camX) * (1 - Math.exp(-6 * dt));
    this.camY += (goalY - this.camY) * (1 - Math.exp(-6 * dt));
    this.shake = Math.max(0, this.shake - dt * 15);
    this.world.prune(this.pod.y);
    this.atmosphere.update(this.world, dt, this.atmosphereView(), this.reducedMotion, this.ui.paused);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += this.world.gravitySign(particle.y) * 200 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floating) {
      f.life -= dt;
      f.y -= 20 * dt;
      f.text.setPosition(
        this.farHemisphere ? this.scale.width - (f.x - this.camX) : f.x - this.camX,
        this.farHemisphere ? this.scale.height - (f.y - this.camY) : f.y - this.camY,
      ).setAlpha(Math.min(1, f.life * 2));
      if (f.life <= 0) f.text.destroy();
    }
    this.floating = this.floating.filter((f) => f.life > 0);
    this.ui.target(this.mining.target, this.mining.ratio, this.mining.warningRemaining, {
      active: this.mining.cargoOverflow,
      units: this.mining.warningUnits,
      space: this.mining.warningSpace,
    });
    this.uiClock += dt;
    if (this.uiClock > 0.08) {
      this.ui.update(this.depth, this.surface, this.uiClock, this.pod.docked, this.estimateReturnFuel(), this.pod.vy, this.farHemisphere, this.progress.pilotEscaping);
      this.ui.drawMap(this.world, this.pod);
      this.uiClock = 0;
    }
    this.draw();
  }
  atmosphereView() {
    return { x: this.camX, y: this.camY, width: this.scale.width, height: this.scale.height,
      podX: this.pod.x, podY: this.pod.y, thrusting: this.pod.thrusting,
      drilling: !!this.mining.target, aimX: this.drillAimX, aimY: this.drillAimY };
  }
  draw() {
    const g = this.g,
      w = this.scale.width,
      h = this.scale.height,
      T = WORLD.tile,
      inverted = this.farHemisphere,
      viewSign = inverted ? -1 : 1,
      surfaceStyle = MAPS[this.mapId].surface;
    const sx = (x: number) =>
        Math.round(worldToScreen(x, this.pod.y, this.camX, this.camY, w, h, inverted).x) + (this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake),
      sy = (y: number) => Math.round(worldToScreen(this.pod.x, y, this.camX, this.camY, w, h, inverted).y);
    g.clear();
    g.fillStyle(0x131b20);
    g.fillRect(0, 0, w, h);
    const ground = sy(surfaceGroundY(this.pod.y));
    if (ground > 0) {
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
        this.labels[i].setVisible(h >= 500).setPosition(x, y - 103);
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
      const shipX = sx(555),
        installed = this.progress.shipComponents;
      g.fillStyle(0x303b38);
      g.fillRect(shipX - 43, ground - 9, 86, 9);
      g.lineStyle(2, 0x9aab9a, 0.55);
      g.lineBetween(shipX - 39, ground - 11, shipX - 39, ground - 47);
      g.lineBetween(shipX + 39, ground - 11, shipX + 39, ground - 47);
      g.lineBetween(shipX - 39, ground - 47, shipX + 39, ground - 47);
      if (installed.includes('frame')) {
        g.fillStyle(0x98a79a);
        g.fillPoints([
          { x: shipX, y: ground - 128 }, { x: shipX + 15, y: ground - 101 },
          { x: shipX + 12, y: ground - 26 }, { x: shipX - 12, y: ground - 26 },
          { x: shipX - 15, y: ground - 101 },
        ], true);
        g.fillStyle(0x203239);
        g.fillRect(shipX - 9, ground - 96, 18, 18);
      }
      if (installed.includes('propulsion')) {
        g.fillStyle(0x7c958b);
        g.fillRect(shipX - 19, ground - 37, 38, 11);
        g.fillStyle(0xe3a86f, 0.65);
        g.fillTriangle(shipX - 9, ground - 25, shipX + 9, ground - 25, shipX, ground - 8);
      }
      if (installed.includes('navigation')) {
        g.lineStyle(2, 0x8ce1cf, 0.8);
        g.strokeCircle(shipX, ground - 119, 7);
      }
      if (installed.includes('life-support')) {
        g.fillStyle(0x9bd5be, 0.9);
        g.fillRect(shipX - 4, ground - 73, 8, 5);
      }
      this.shipStatusLabel
        .setText(this.progress.shipComplete ? 'FARADAY · FLIGHT READY' : `FARADAY · ${installed.length} / 4 SYSTEMS`)
        .setPosition(Phaser.Math.Clamp(shipX + 145, 350, w - 110), ground - 151)
        .setVisible(h >= 400);
    } else {
      this.labels.forEach((l) => l.setVisible(false));
      this.shipStatusLabel.setVisible(false);
    }
    const left = Math.max(0, Math.floor(this.camX / T)),
      right = Math.min(WORLD.width - 1, Math.ceil((this.camX + w) / T)),
      top = Math.max(0, Math.floor(this.camY / T)),
      bottom = Math.ceil((this.camY + h) / T);
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const px = sx(inverted ? (x + 1) * T : x * T),
          py = sy(inverted ? (y + 1) * T : y * T),
          tile = this.world.get(x, y),
          seen = this.world.discovered.has(keyOf(x, y));
        const tileCenterX = x * T + 20, tileCenterY = y * T + 20,
          dx = tileCenterX - this.pod.x, dy = tileCenterY - this.pod.y,
          distance = Math.hypot(dx / T, dy / T),
          facingDot = distance > 0.01 ? (dx * this.drillAimX + dy * this.drillAimY) / Math.hypot(dx, dy) : 1,
          inLampCone = facingDot > 0.32 && Math.abs(dx * this.drillAimY - dy * this.drillAimX) / Math.max(1, Math.hypot(dx, dy)) < 0.72,
          beamDistance = Math.max(0, dx * this.drillAimX + dy * this.drillAimY),
          lamp = Math.max(0, 1 - distance / Math.max(1, this.pod.scannerRadius * 1.25)),
          light = Math.max(0.12, inLampCone ? Math.max(lamp, 1 - beamDistance / (this.pod.scannerRadius * T * 1.5)) : lamp * 0.58);
        if (!seen) {
          g.fillStyle(y < 3 ? 0x3e302e : 0x182023);
          g.fillRect(px, py, T, T);
          g.lineStyle(1, 0x8c6857, 0.05);
          g.strokeRect(px, py, T, T);
          continue;
        }
        if (tile.type === 'empty') {
      g.fillStyle(tile.tint, tile.landmarkId && !this.reducedMotion ? 0.14 + (Math.sin(this.tick * 2 + x) + 1) * 0.035 : 0.16);
          g.fillRect(px, py, T, T);
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
            label.setPosition(sx(chamber.x * T + T / 2), labelY)
              .setVisible(seen && Math.min(screenA, screenB) < h + T && Math.max(screenA, screenB) > -T);
          }
          g.fillStyle(0xcdb296, 0.1 * light);
          g.fillRect(px + 7, py + 31, 2, 2);
          continue;
        }
        g.fillStyle(tile.tint);
        g.fillRect(px, py, T, T);
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
          const markerAlpha = 0.42 + light * 0.58;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            const neighborKey = keyOf(nx, ny);
            if (!this.world.discovered.has(neighborKey) || this.world.destroyed.has(neighborKey)) continue;
            const neighbor = this.world.get(nx, ny);
            if (neighbor.ore !== tile.ore) continue;
            g.lineStyle(2, color, 0.18 + light * 0.16);
            g.lineBetween(px + 20, py + 20, sx(nx * T + 20), sy(ny * T + 20));
          }
          if (tile.geode || tile.regionFind) {
            const findColor = tile.geode ? 0xb8a8ff : REGION_FINDS[tile.regionFind!].tint;
            g.fillStyle(findColor, (this.reducedMotion ? 0.24 : 0.16 + (Math.sin(this.tick * 3 + x + y) + 1) * 0.06) * (0.45 + light * 0.55));
            g.fillCircle(px + 20, py + 20, 18);
            g.lineStyle(1, tile.geode ? 0xd1caff : findColor, 0.35 + light * 0.65);
            if (tile.geode) g.strokeRect(px + 2, py + 2, T - 4, T - 4);
            else {
              g.strokeCircle(px + 20, py + 20, 15);
              g.lineBetween(px + 8, py + 20, px + 32, py + 20);
            }
          }
          g.fillStyle(color, 0.18 + light * 0.2);
          g.fillCircle(px + 20, py + 20, 15);
          const unitAmount = tile.oreUnits ?? 1;
          const crystalCount = unitAmount >= 3 ? 8 : unitAmount >= 2 ? 6 : unitAmount < 1 ? 2 : 4;
          for (let i = 0; i < crystalCount; i++) {
            const ox = 7 + random(43, x + i, y, 3) * 23,
              oy = 7 + random(51, x, y + i, 6) * 23,
              scale = unitAmount >= 3 ? 1.45 : unitAmount >= 2 ? 1.2 : unitAmount < 1 ? 0.75 : 1;
            g.fillStyle(color, markerAlpha);
            if (silhouette === 'facets')
              g.fillPoints(
                [
                  { x: px + ox, y: py + oy - 4 * scale },
                  { x: px + ox + 4 * scale, y: py + oy },
                  { x: px + ox, y: py + oy + 5 * scale },
                  { x: px + ox - 4 * scale, y: py + oy },
                ],
                true,
              );
            else if (silhouette === 'spires')
              g.fillTriangle(
                px + ox,
                py + oy - 5,
                  px + ox - 3 * scale,
                  py + oy + 5 * scale,
                  px + ox + 3 * scale,
                  py + oy + 5 * scale,
              );
            else if (silhouette === 'bars') {
              g.fillRect(px + ox, py + oy, 8, 3);
              g.fillRect(px + ox + 2, py + oy + 4, 8, 3);
            } else if (silhouette === 'nuggets') g.fillCircle(px + ox, py + oy, 4);
            else g.fillRect(px + ox, py + oy, 5 + (i % 3), 4 + (i % 2));
            g.fillStyle(0xffffff, (0.2 + light * 0.4) * markerAlpha);
              g.fillRect(px + ox, py + oy, 2 * scale, Math.max(1, scale));
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
          g.fillStyle(0x8ef1df, 0.17);
          g.fillCircle(px + 20, py + 20, this.reducedMotion ? 16 : 16 + Math.sin(this.tick * 3) * 2);
          g.fillStyle(recovered ? 0x45645e : 0xb1fff0);
          g.fillPoints([
            { x: px + 20, y: py + 7 }, { x: px + 29, y: py + 20 },
            { x: px + 20, y: py + 33 }, { x: px + 11, y: py + 20 },
          ], true);
          g.fillStyle(0x18373a);
          g.fillRect(px + 18, py + 15, 4, 10);
          g.fillRect(px + 15, py + 18, 10, 4);
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
    if (!this.reducedMotion) this.atmosphere.draw(g, this.world, this.atmosphereView(), sx, sy, false);
    for (const structure of this.structures) {
      if (structure.y < this.camY - 100 || structure.y > this.camY + h + 100 || structure.x < this.camX - 130 || structure.x > this.camX + w + 130) continue;
      const gravity = this.world.gravitySign(structure.y), x = sx(structure.x), deckY = sy(structure.y);
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
      }
    }
    for (const drop of this.oreDrops) {
      if (drop.x < this.camX - 24 || drop.x > this.camX + w + 24 || drop.y < this.camY - 24 || drop.y > this.camY + h + 24) continue;
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
    const swimmer = this.rockSwimmer.active;
    if (swimmer) {
      const tileDistance = Math.hypot((swimmer.x - this.pod.x) / T, (swimmer.y - this.pod.y) / T);
      if (tileDistance <= this.pod.scannerRadius * 1.25 && swimmer.x > this.camX - T && swimmer.x < this.camX + w + T && swimmer.y > this.camY - T && swimmer.y < this.camY + h + T) {
        const sxw = sx(swimmer.x), syw = sy(swimmer.y), angle = Math.atan2(swimmer.vy, swimmer.vx);
        const ux = Math.cos(angle), uy = Math.sin(angle), pulse = this.reducedMotion ? 1 : 0.8 + Math.sin(this.tick * 7 + swimmer.phase) * 0.2;
        const color = tileDistance * T < ROCK_SWIMMER.warningRadius ? 0xf0b779 : 0x83e5d3;
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
      g.lineBetween(sx(WORLD.width * T - 18), sy(y * T), sx(WORLD.width * T), sy(y * T));
    }
    const coreScreenY = sy(CORE_WORLD_Y);
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
      vehicleScale = podVisualScale(this.progress.levels.drill, this.progress.levels.cargo),
      px = (offset: number) => x + offset * vehicleScale * viewSign,
      py = (offset: number) => y + offset * vehicleScale * viewSign;
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
    const beamX = this.drillAimX * viewSign, beamY = this.drillAimY * viewSign;
    const beamStartX = x + beamX * 12, beamStartY = y + beamY * 4;
    const beamEndX = x + beamX * 115, beamEndY = y + beamY * 115;
    const beamHalfWidth = 34 + drillWidth(this.progress.levels.drill) * 3;
    g.fillStyle(0xf5dba0, 0.09);
    g.fillTriangle(
      beamStartX, beamStartY,
      beamEndX - beamY * beamHalfWidth, beamEndY + beamX * beamHalfWidth,
      beamEndX + beamY * beamHalfWidth, beamEndY - beamX * beamHalfWidth,
    );
    g.fillStyle(0x121d22);
    g.fillRect(px(-18), py(-9), 36 * vehicleScale, 23 * vehicleScale);
    g.fillStyle(0x6c7c78);
    g.fillRect(px(-18), py(-7), 7 * vehicleScale, 19 * vehicleScale);
    g.fillRect(px(11), py(-7), 7 * vehicleScale, 19 * vehicleScale);
    g.fillStyle(0x24373b);
    g.fillRect(px(-19), py(8), 8 * vehicleScale, 7 * vehicleScale);
    g.fillRect(px(11), py(8), 8 * vehicleScale, 7 * vehicleScale);
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
    g.fillStyle(0xb1bdb2);
    const sideways =
      this.mining.target && Math.abs(this.mining.target.x * 40 + 20 - this.pod.x) > 20;
    if (sideways) g.fillTriangle(px(f * 16), py(-7), px(f * 16), py(7), px(f * 27), py(0));
    else g.fillTriangle(px(-8), py(14), px(8), py(14), px(0), py(22));
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
      const targetDx = this.mining.target.x * T + T / 2 - this.pod.x;
      const sideways = Math.abs(targetDx) > 20;
      const direction = sideways ? Math.sign(targetDx) || f : 0;
      this.particles.push({
        x: this.pod.x + (sideways ? direction * 15 : (Math.random() - 0.5) * 12),
        y: this.pod.y + (sideways ? (Math.random() - 0.5) * 20 : 16),
        vx: sideways ? direction * (45 + Math.random() * 70) : (Math.random() - 0.5) * 90,
        vy: sideways ? (Math.random() - 0.5) * 60 : -20 - Math.random() * 60,
        life: 0.2,
        color: this.mining.target.type === 'hard' ? 0xcbbcd1 : 0xffd383,
        size: 2,
      });
    }
    for (const p of this.particles) {
      g.fillStyle(p.color, Math.min(1, p.life * 2));
      g.fillRect(sx(p.x), sy(p.y), p.size, p.size);
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
