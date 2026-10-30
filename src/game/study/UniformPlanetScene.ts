import { ForgeSpriteRig } from '../player/ForgeSpriteRig';
import { advanceForgeMotion, type ForgeMotion } from '../player/ForgeMotion';
import Phaser from 'phaser';
import {
  UNIFORM_PLANET_STUDY as C,
  FLEET_STUDY,
  WORLD,
  STUDY_WEAPONS,
  UNIFORM_COMBAT,
  SURFACE_EXPEDITION as E,
} from '../config';
import { Progress } from '../economy/Progress';
import { drawMiner, minerLampPoint, minerPoint } from '../player/MinerArt';
import { StudyGun } from './StudyGun';
import { aimStudyGun } from './StudyGunAim';
import { advanceVehiclePose, restingVehiclePose } from '../player/VehiclePose';
import { drawMothership } from '../surface/MothershipArt';
import { drawSalvageWreck } from './ExpeditionArt';
import { studyOreVeins } from './StudyOreVeins';
import { studyRockLayers } from './StudyRock';
import { studyFractures } from './StudyFractures';
import { studyContourGeometry, type StudyEdge } from './StudyContours';
import {
  UniformPlanet,
  UniformMiner,
  type Point,
  type UniformCell,
  type StudyMaterial,
} from './UniformPlanet';
import { StudyFleet, cargoTotal, fleetOres, type FleetCargo } from './StudyFleet';
import { StudyFleetUI } from './StudyFleetUI';
import { drawCargoPickup, PICKUP_SECONDS } from '../surface/CargoPickup';
import { UNLOAD_DURATION, captureCargoSources } from '../surface/CargoHandling';
import { minerBodyOffset } from '../player/ConceptMiner';
import { UniformDrill } from './UniformDrill';
import { UniformCombat } from './UniformCombat';
import { drawUniformCombat } from './UniformCombatArt';
import { StudyOrdnance } from './StudyOrdnance';
import { weaponPlates } from './StudyWeaponArt';
import './UniformPlanet.css';

const COLORS: Record<StudyMaterial, number> = {
  rock: 0x526673,
  copper: 0xd3a073,
  iron: 0x9db9be,
  silver: 0xc6d5ed,
};
type Fragment = Point & { vx: number; vy: number; life: number; size: number; color: number };
/** Disposable expedition. No SaveManager, accounts or campaign terrain conversion. */
export class UniformPlanetScene extends Phaser.Scene {
  private planet = new UniformPlanet(true);
  private miner = new UniformMiner();
  private progress = new Progress();
  private forge = new URLSearchParams(location.search).get('miner') !== 'legacy';
  private pose = restingVehiclePose();
  private gfx!: Phaser.GameObjects.Graphics;
  private forgeArt?: ForgeSpriteRig;
  private forgeMotion?: ForgeMotion;
  private ui!: HTMLElement;
  private held = new Set<string>();
  private keys = new Set<string>();
  private pointer?: Point;
  private pressing = false;
  private firing = false;
  private gun = new StudyGun();
  private missiles = new StudyOrdnance();
  private combat = new UniformCombat(this.planet);
  private spin = 0;
  private rescueFlash = 0;
  private drops: { point: Point; cargo: FleetCargo }[] = [];
  private secondaryRequested = false;
  private missileTouch?: Point;
  private fireTouch?: Point;
  private missileMount?: { base: Point; muzzle: Point; direction: Point };
  private explosions: { point: Point; age: number; radius: number }[] = [];
  private blasted = 0;
  private gunAim?: { muzzle: Point; direction: Point; target: Point };
  private clock = 0;
  private angle = 0;
  private zoom = 1.2;
  private guide = false;
  private overview = false;
  private paused = false;
  private target?: UniformCell;
  private face: UniformCell[] = [];
  private drilling = 0;
  private cutter = new UniformDrill();
  private fragments: Fragment[] = [];
  private fleet = new StudyFleet(this.planet);
  private salvageKredits: number = E.salvageKredits;
  private salvageIron: number = E.salvageIron;
  private wreck = this.planet.surfacePoint(E.wreckAngle, 11);
  private fleetUI!: StudyFleetUI;
  private cargo = this.fleet.miner;
  private relocating = false;
  private landingAngle?: number;
  private unloading?: { at: number; sources: Point[]; count: number };
  private sellingAt = -100;
  private coreImpact?: Point;
  private coreSparkTimer = 0;
  private contourRevision = -1;
  private contours = studyContourGeometry([]);
  private veinCache = new Map<string, ReturnType<typeof studyOreVeins>>();
  private rockCache = new Map<string, ReturnType<typeof studyRockLayers>>();
  private message =
    'A wreck lies beyond the ridge to your right. Salvage it, explore the cave, or head underground. F unloads at your ship.';
  private abort = new AbortController();
  private staticFrame = '';
  private get stored() {
    return cargoTotal(this.fleet.storage);
  }
  private get primarySpec() {
    return STUDY_WEAPONS.find((w) => w.id === this.fleet.primary)!;
  }
  private get secondarySpec() {
    return STUDY_WEAPONS.find((w) => w.id === this.fleet.secondary)!;
  }
  constructor() {
    super('UniformPlanetStudy');
  }
  private el<T extends HTMLElement = HTMLElement>(selector: string) {
    return this.ui.querySelector<T>(selector)!;
  }
  preload() {
    if (this.forge) ForgeSpriteRig.preload(this);
  }
  create() {
    this.progress.loadout.owned.push('machine-gun');
    this.progress.loadout.fitted.weapon = 'machine-gun';
    document.body.classList.add('uniform-planet-study');
    this.gfx = this.add.graphics();
    if (this.forge) this.forgeArt = new ForgeSpriteRig(this);
    this.ui = document.createElement('section');
    this.ui.className = 'uniform-console';
    this.ui.innerHTML = `<header><div><b>ORE FRONTIER</b><span>COMBAT EXPEDITION / TEST PLANET</span></div><a href="game.html?art-test=1&combat-test=1">Back to art test</a></header>
   <nav aria-label="Test stations">${C.stations.map((s, i) => `<button data-station="${i}">${s.name}</button>`).join('')}<button data-map aria-pressed="false">Planet view</button><button data-grid aria-pressed="false">Cell guide</button><button data-pause>Pause</button></nav>
   <div class="uniform-telemetry"><span data-depth></span><span data-cargo></span><span data-fuel></span><span data-hull></span></div>
   <div class="uniform-combat-status"><span data-loadout></span><span data-threat></span></div>
   <aside class="uniform-survey" hidden aria-label="Planet map legend"><div><b>Planet survey</b><small>Ore, threats, wreck and dropped cargo</small></div><ul>${fleetOres.map((ore) => `<li><i style="--map-color:#${COLORS[ore].toString(16)}"></i>${ore}</li>`).join('')}<li><i class="survey-core"></i>Core fuel</li><li><i class="survey-miner"></i>Your miner</li><li><i class="survey-ship"></i>Mothership</li></ul></aside>
   <aside class="uniform-core" hidden><div><b>Planetary core</b><span data-core-remaining></span></div><p data-core-hint></p><div class="uniform-core-progress" role="progressbar" aria-label="Core fuel extraction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><button data-core-revisit hidden>Test leave &amp; return</button></aside>
   <div class="uniform-notice" role="status"></div><div class="uniform-instructions"><b>Explore. Equip. Clear a path.</b><span>Left click drill · Right click fire · Shift secondary · A D move · W rise · S dive / drill</span><small>Blasts destroy ore. Return to your ship to repair. Touch: hold and drag to aim; release secondary to launch.</small></div>
   <div class="uniform-touch" aria-label="Movement"><button data-hold="w" aria-label="Fly">W</button><button data-hold="a" aria-label="Move left">A</button><button data-hold="s" aria-label="Dive in air or drill on rock">S</button><button data-hold="d" aria-label="Move right">D</button></div>
   <button class="uniform-operations" data-operations>E · Mothership</button><button class="uniform-fire" data-fire aria-label="Fire primary weapon">Fire</button><button class="uniform-missile" data-missile aria-label="Aim and launch secondary weapon">Rocket</button><button class="uniform-unload" data-unload>F · Unload ore</button>
   <section class="uniform-pause" hidden><div><small>ORE FRONTIER / RIG CONSOLE</small><h1>Expedition paused</h1><p>Your rig is standing by.</p><div class="pause-keys"><span><kbd>A D</kbd> Move</span><span><kbd>W / S</kbd> Rise / Dive</span><span><kbd>Click / grounded S</kbd> Drill</span><span><kbd>Right click</kbd> Primary</span><span><kbd>Shift</kbd> Secondary</span><span><kbd>F / E</kbd> Unload / Ship</span></div><button data-resume>Resume expedition</button><small>Test planet only. Reloading resets this expedition.</small></div></section><aside class="uniform-placement" hidden><p data-landing-hint></p><button data-cancel-landing>Cancel</button><button data-land disabled>Land here</button></aside>`;
    document.querySelector('#app')!.append(this.ui);
    this.fleetUI = new StudyFleetUI(
      this.fleet,
      {
        close: () => this.closeFleet(),
        unload: () => this.unload(),
        sold: () => {
          this.sellingAt = this.clock;
        },
        bought: () => {
          if (this.fleet.modules.has('rack')) this.progress.loadout.fitted.hull = 'hauler';
          if (this.fleet.modules.has('drill')) this.progress.loadout.fitted.drill = 'excavator';
          this.progress.loadout.fitted.weapon = this.fleet.primary;
          this.gun.configure(this.primarySpec);
          this.spin = 0;
          this.clearControls();
        },
        relocate: () => this.beginRelocation(),
      },
      this.forge,
      this.forgeArt,
    );
    this.miner.teleport(this.shipPoint(90, -35));
    this.bindInput();
    const resize = () => {
      this.scale.resize(window.innerWidth, window.innerHeight);
      this.zoom = window.innerWidth < 600 ? 0.95 : 1.2;
    };
    window.addEventListener('resize', resize, { signal: this.abort.signal });
    resize();
    Object.defineProperty(window, '__uniformStudy', {
      configurable: true,
      get: () => this.snapshot(),
    });
    this.events.once('shutdown', () => {
      this.abort.abort();
      this.ui.remove();
      this.fleetUI.destroy();
      this.forgeArt?.destroy();
      document.body.classList.remove('uniform-planet-study');
      delete (window as unknown as Record<string, unknown>).__uniformStudy;
    });
  }
  private bindInput() {
    const listen = { signal: this.abort.signal };
    const click = (selector: string, action: () => void) =>
      this.el(selector).addEventListener('click', action, listen);
    this.ui.querySelectorAll<HTMLButtonElement>('[data-station]').forEach((button) =>
      button.addEventListener(
        'click',
        () => {
          if (this.relocating) this.cancelRelocation();
          this.clearControls();
          const index = Number(button.dataset.station);
          this.miner.teleport(index === 0 ? this.shipPoint(90, -35) : C.stations[index]);
          this.angle = Math.atan2(this.miner.outward.x, -this.miner.outward.y);
          this.overview = false;
          this.face = [];
          this.target = undefined;
          this.pointer = undefined;
          this.coreImpact = undefined;
          this.syncMap();
          this.message = `${button.textContent}. Hold W to fly outward. Creatures remain in their own territory.`;
        },
        listen,
      ),
    );
    click('[data-grid]', () => {
      this.guide = !this.guide;
      this.el('[data-grid]').setAttribute('aria-pressed', String(this.guide));
    });
    click('[data-resume]', () => this.togglePause());
    click('[data-map]', () => this.toggleMap());
    click('[data-pause]', () => this.togglePause());
    click('[data-unload]', () => this.unload());
    click('[data-operations]', () => (this.nearWreck() ? this.claimSalvage() : this.openFleet()));
    click('[data-cancel-landing]', () => this.cancelRelocation());
    click('[data-land]', () => {
      if (this.landingAngle !== undefined && this.fleet.relocate(this.planet, this.landingAngle)) {
        this.cancelRelocation();
        this.message = 'Mothership relocating. Storage and equipment stay aboard.';
      }
    });
    click('[data-core-revisit]', () => {
      if (this.planet.core.remaining) return;
      this.planet.core.beginVisit();
      this.miner.teleport(this.shipPoint(90, -35));
      this.angle = Math.atan2(this.miner.outward.x, -this.miner.outward.y);
      this.clearControls();
      this.paused = false;
      this.overview = false;
      this.pointer = undefined;
      this.face = [];
      this.target = undefined;
      this.coreImpact = undefined;
      this.syncMap();
      this.el('[data-pause]').textContent = 'Pause';
      this.message =
        'New visit simulated. Core fuel restored; tunnels and cleared nests stay cleared.';
    });
    for (const button of Array.from(this.ui.querySelectorAll<HTMLButtonElement>('[data-hold]'))) {
      button.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          this.held.add(button.dataset.hold!);
        },
        listen,
      );
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        button.addEventListener(event, () => this.held.delete(button.dataset.hold!), listen);
    }
    for (const secondary of [false, true]) {
      const button = this.el<HTMLButtonElement>(secondary ? '[data-missile]' : '[data-fire]');
      button.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          const p = { x: e.clientX, y: e.clientY };
          if (secondary) this.missileTouch = p;
          else {
            this.fireTouch = p;
            this.held.add('fire');
          }
        },
        listen,
      );
      button.addEventListener(
        'pointermove',
        (e) => {
          const p = secondary ? this.missileTouch : this.fireTouch;
          if (!p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          if (Math.hypot(dx, dy) > 8)
            this.pointer = {
              x: this.scale.width / 2 + dx * 4,
              y: this.scale.height * 0.52 + dy * 4,
            };
        },
        listen,
      );
      button.addEventListener(
        'pointerup',
        () => {
          if (secondary) {
            if (this.missileTouch) this.secondaryRequested = true;
            this.missileTouch = undefined;
          } else {
            this.fireTouch = undefined;
            this.held.delete('fire');
          }
        },
        listen,
      );
      for (const event of ['pointercancel', 'lostpointercapture'])
        button.addEventListener(
          event,
          () => {
            if (secondary) this.missileTouch = undefined;
            else {
              this.fireTouch = undefined;
              this.held.delete('fire');
            }
          },
          listen,
        );
    }
    window.addEventListener(
      'keydown',
      (e) => {
        const key = e.key.toLowerCase();
        if (
          [
            'w',
            'a',
            's',
            'd',
            'e',
            'f',
            'm',
            'escape',
            'shift',
            'arrowup',
            'arrowleft',
            'arrowdown',
            'arrowright',
          ].includes(key)
        )
          e.preventDefault();
        if (this.fleetUI.open) {
          if (!e.repeat && (key === 'escape' || key === 'e')) this.closeFleet();
          return;
        }
        if (this.relocating) {
          if (key === 'escape') this.cancelRelocation();
          return;
        }
        this.keys.add(key);
        if (e.repeat) return;
        if (key === 'e') this.nearWreck() ? this.claimSalvage() : this.openFleet();
        if (key === 'f') this.unload();
        if (key === 'm') this.toggleMap();
        if (key === 'escape') this.togglePause();
        if (key === 'shift' && !this.paused && !this.overview) this.secondaryRequested = true;
      },
      listen,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), listen);
    window.addEventListener('blur', () => this.clearControls(), listen);
    const canvas = this.game.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), listen);
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        if (this.relocating) {
          if (e.button === 0) this.chooseLanding(e.clientX, e.clientY);
          return;
        }
        if (this.paused || this.overview || this.fleetUI.open) return;
        canvas.setPointerCapture(e.pointerId);
        if (e.button === 2) this.firing = true;
        else this.pressing = true;
        this.pointer = { x: e.clientX, y: e.clientY };
      },
      listen,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.relocating) {
          if (e.pointerType === 'mouse' || e.buttons) this.chooseLanding(e.clientX, e.clientY);
          return;
        }
        this.pointer = { x: e.clientX, y: e.clientY };
      },
      listen,
    );
    canvas.addEventListener(
      'pointerup',
      (e) => {
        if (e.button === 0) this.pressing = false;
        if (e.button === 2) this.firing = false;
      },
      listen,
    );
    for (const event of ['pointercancel', 'lostpointercapture'])
      canvas.addEventListener(
        event,
        () => {
          this.pressing = false;
          this.firing = false;
        },
        listen,
      );
  }
  private snapshot() {
    return {
      x: this.miner.x,
      y: this.miner.y,
      cellSize: C.tile,
      surfaceRadius: this.planet.surfaceRadiusAt(this.miner),
      expedition: {
        wreck: { ...this.wreck },
        credits: this.salvageKredits,
        iron: this.salvageIron,
      },
      radius: C.radius,
      zoom: this.zoom,
      depth: Math.max(
        0,
        this.planet.surfaceRadiusAt(this.miner) - Math.hypot(this.miner.x, this.miner.y),
      ),
      angle: this.angle,
      cargo: { ...this.cargo },
      stored: this.stored,
      excavated: this.planet.excavated.size,
      fleet: {
        storage: { ...this.fleet.storage },
        credits: this.fleet.credits,
        modules: [...this.fleet.modules],
        capacity: this.fleet.capacity,
        position: { ...this.fleet.position },
        flight: this.fleet.flight ? { ...this.fleet.flight } : null,
        open: this.fleetUI.open,
        relocating: this.relocating,
        landingAngle: this.landingAngle,
        landingValid: this.validLanding(),
      },
      cargoAnimation: this.unloading
        ? {
            age: this.clock - this.unloading.at,
            sources: this.unloading.sources.map((p) => ({ ...p })),
            count: this.unloading.count,
          }
        : null,
      walk: { phase: this.pose.walkPhase, stride: this.pose.stride, bank: this.pose.bank,
        yaw:this.pose.yaw, hipsYaw:this.forgeMotion?.hipsYaw, pivot:this.forgeMotion?.pivot },
      drillProgress: this.drilling,
      grounded: this.miner.grounded,
      collision: this.planet.collides(this.miner),
      paused: this.paused,
      thrustAssists: this.miner.thrustAssists,
      diving: this.miner.diving,
      fallSpeed: this.miner.fallSpeed,
      diveFlame: this.pose.dive,
      weapon: {
        id: this.fleet.primary,
        shots: this.gun.shots,
        hits: this.gun.hits,
        bullets: this.gun.bullets.length,
        firing: this.firing || this.held.has('fire'),
        aim: this.gunAim,
      },
      loadout: {
        primary: this.fleet.primary,
        secondary: this.fleet.secondary,
        owned: [...this.fleet.weapons],
      },
      combat: {
        hull: this.combat.hull,
        kills: this.combat.kills,
        bodies: this.combat.bodies.map((b) => ({ ...b })),
        drops: this.drops.map((d) => ({ point: { ...d.point }, cargo: { ...d.cargo } })),
      },
      terrainDamage: {
        fractures: [...this.planet.fractures].map(([cell, amount]) => ({ cell, amount })),
        blasted: this.blasted,
        missiles: this.missiles.shots,
      },
      core: {
        remaining: this.planet.core.remaining,
        fuel: this.progress.coreFuel,
        extraction: this.planet.core.extraction,
        landed: this.onCore(),
      },
      overview: this.overview,
      target: this.target
        ? { x: this.target.x, y: this.target.y, material: this.target.material }
        : null,
    };
  }
  private down(key: string) {
    return this.keys.has(key) || this.held.has(key);
  }
  private clearControls() {
    this.keys.clear();
    this.held.clear();
    this.pressing = false;
    this.firing = false;
    this.fireTouch = undefined;
    this.missileTouch = undefined;
    this.secondaryRequested = false;
    this.drilling = 0;
    this.cutter.reset();
    this.planet.core.extraction = 0;
    this.spin = 0;
  }
  private togglePause() {
    if (this.relocating) this.cancelRelocation();
    this.paused = !this.paused;
    this.clearControls();
    this.el('[data-pause]').textContent = this.paused ? 'Resume' : 'Pause';
  }
  private toggleMap() {
    if (this.relocating) {
      this.cancelRelocation();
      return;
    }
    this.overview = !this.overview;
    this.clearControls();
    this.syncMap();
  }
  private syncMap() {
    this.el('[data-map]').setAttribute('aria-pressed', String(this.overview));
    this.el('[data-map]').textContent = this.overview ? 'Return to miner' : 'Planet view';
    this.ui.classList.toggle('survey-open', this.overview);
    this.el('.uniform-survey').hidden = !this.overview;
  }
  private total() {
    return cargoTotal(this.cargo);
  }
  private onCore() {
    return (
      this.miner.grounded &&
      Math.hypot(this.miner.x, this.miner.y) < C.coreSurfaceRadius + C.bodyRadius + 3
    );
  }
  private nearWreck() {
    return (
      Math.hypot(this.miner.x - this.wreck.x, this.miner.y - this.wreck.y) < 100 &&
      (this.salvageKredits > 0 || this.salvageIron > 0)
    );
  }
  private claimSalvage() {
    if (!this.nearWreck() || this.paused || this.overview || this.fleetUI.open) return;
    const credits = this.salvageKredits;
    this.fleet.credits += credits;
    this.salvageKredits = 0;
    let iron = 0;
    while (this.salvageIron > 0 && this.fleet.collect('iron')) {
      this.salvageIron--;
      iron++;
    }
    this.message =
      credits || iron
        ? `Recovered ₭${credits} and ${iron} iron. ${this.salvageIron ? 'Cargo full; remaining iron stays here.' : 'The cave west of the wreck leads under the ridge.'}`
        : 'Cargo full. Unload before recovering the remaining iron.';
  }
  private landingSurface(shipRadius: number) {
    const angle = this.fleet.angle,
      ox = Math.sin(angle),
      oy = -Math.cos(angle);
    return {
      contact: this.fleet.flight ? 0 : 1,
      height: (x: number) => {
        const u = x * 1.5;
        let lo = -300,
          hi = 450;
        for (let i = 0; i < 22; i++) {
          const d = (lo + hi) / 2,
            p = { x: ox * (shipRadius - d) - oy * u, y: oy * (shipRadius - d) + ox * u };
          if (Math.hypot(p.x, p.y) > this.planet.surfaceRadiusAt(p)) lo = d;
          else hi = d;
        }
        return (lo + hi) / 3;
      },
    };
  }
  private nearShip() {
    return this.fleet.near(this.miner);
  }
  private shipPoint(x: number, y: number) {
    const p = this.fleet.position,
      r = Math.hypot(p.x, p.y),
      u = { x: p.x / r, y: p.y / r };
    return { x: p.x - u.y * x - u.x * y, y: p.y + u.x * x - u.y * y };
  }
  private openFleet() {
    if (!this.nearShip() || this.paused || this.overview) return;
    this.clearControls();
    this.ui.inert = true;
    this.fleetUI.show();
  }
  private closeFleet() {
    this.fleetUI.hide();
    this.ui.inert = false;
    this.clearControls();
    this.el('[data-operations]').focus();
  }
  private beginRelocation() {
    this.closeFleet();
    this.relocating = true;
    this.overview = true;
    this.landingAngle = undefined;
    this.clearControls();
    this.syncMap();
    this.ui.classList.add('relocating');
    this.el('.uniform-placement').hidden = false;
  }
  private cancelRelocation() {
    this.relocating = false;
    this.overview = false;
    this.landingAngle = undefined;
    this.clearControls();
    this.syncMap();
    this.ui.classList.remove('relocating');
    this.el('.uniform-placement').hidden = true;
  }
  private chooseLanding(x: number, y: number) {
    const scale = Math.min(this.scale.width - 44, this.scale.height - 260) / ((C.radius + 240) * 2),
      dx = x - this.scale.width / 2,
      dy = y - (this.scale.height + 30) / 2;
    this.landingAngle =
      Math.abs(Math.hypot(dx, dy) - C.radius * scale) < Math.max(32, scale * 150)
        ? Math.atan2(dx, -dy)
        : undefined;
  }
  private validLanding() {
    if (this.landingAngle === undefined) return false;
    const d = this.landingAngle - this.fleet.angle;
    return (
      Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * C.radius >= 280 &&
      this.fleet.landing(this.planet, this.landingAngle)
    );
  }
  private unload() {
    if (this.paused || this.overview || !this.nearShip()) return;
    const units = this.fleet.unload();
    if (units)
      this.unloading = {
        at: this.clock,
        sources: [],
        count: Math.min(6, units),
      };
    this.message = `${units} ore unloaded. ${this.stored} aboard the mothership.`;
  }
  update(_time: number, delta: number) {
    // Paused/menu views have no simulation to animate. Redraw only when their view changes.
    const staticFrame =
      this.paused || this.overview || this.fleetUI.open
        ? `${this.paused}/${this.overview}/${this.fleetUI.open}/${this.relocating}/${this.landingAngle}/${this.guide}/${this.scale.width}/${this.scale.height}`
        : '';
    if (staticFrame && staticFrame === this.staticFrame) return;
    this.staticFrame = staticFrame;
    const dt = Math.min(0.05, delta / 1000);
    if (!this.paused && !this.overview && !this.fleetUI.open) {
      this.clock += dt;
      if (this.fleet.update(dt))
        this.message = 'Mothership landed. Unload and access equipment at its new location.';
      const side =
          Number(this.down('d') || this.down('arrowright')) -
          Number(this.down('a') || this.down('arrowleft')),
        flying = this.down('w') || this.down('arrowup'),
        descending = this.down('s') || this.down('arrowdown');
      const previous = { x: this.miner.x, y: this.miner.y };
      this.miner.step(this.planet, side, flying, dt, descending);
      const actualWalk =
        ((this.miner.x - previous.x) * -this.miner.outward.y +
          (this.miner.y - previous.y) * this.miner.outward.x) /
        Math.max(dt, 0.001);
      const theta = Math.atan2(this.miner.outward.x, -this.miner.outward.y);
      this.angle +=
        Math.atan2(Math.sin(theta - this.angle), Math.cos(theta - this.angle)) *
        (1 - Math.exp(-dt * 9));
      this.combat.update(this.planet, dt, this.miner, this.fleet.position, !this.fleet.flight);
      this.recoverMiner(dt);
      const trigger = this.firing || this.held.has('fire');
      this.spin = trigger
        ? Math.min(UNIFORM_COMBAT.minigunSpinup, this.spin + dt)
        : Math.max(0, this.spin - dt * 2);
      const shooting =
        trigger && (this.fleet.primary !== 'minigun' || this.spin >= UNIFORM_COMBAT.minigunSpinup);
      const aim = this.pointer
        ? this.fromScreen(this.pointer)
        : trigger || this.secondaryRequested || this.missileTouch
          ? this.fromScreen({
              x: this.scale.width / 2 + (this.pose.turn < 0 ? -200 : 200),
              y: this.scale.height * 0.52 - 30,
            })
          : {
              x: this.miner.x - this.miner.outward.x * 100,
              y: this.miner.y - this.miner.outward.y * 100,
            };
      const useDown = this.down('s') || this.down('arrowdown'),
        direction = useDown
          ? { x: -this.miner.outward.x, y: -this.miner.outward.y }
          : { x: aim.x - this.miner.x, y: aim.y - this.miner.y },
        active = (useDown && !flying && this.miner.grounded) || this.pressing;
      this.mine(dt, direction, active);
      const c = Math.cos(this.angle),
        s = Math.sin(this.angle),
        looking = { x: aim.x - this.miner.x, y: aim.y - this.miner.y };
      const facing =
        side ||
        (shooting ? Math.sign(looking.x * c + looking.y * s) || 1
          : this.forgeMotion ? (this.forgeMotion.target === 0 ? 1 : -1)
          : this.pose.turn < 0 ? -1 : 1);
      this.pose = advanceVehiclePose(
        this.pose,
        {
          sideSpeed: actualWalk,
          verticalSpeed: this.miner.fallSpeed,
          facing,
          thrust: flying,
          downThrust: this.miner.diving,
          grounded: this.miner.grounded,
          drilling:
            (active && !!this.target) ||
            (active && !!this.coreImpact && this.planet.core.remaining > 0),
          paused: false,
          reducedMotion: false,
          mechanicalTurn: true,
          lookingX: looking.x * c + looking.y * s,
          lookingY: -looking.x * s + looking.y * c,
        },
        dt,
      );
      if (this.forge) {
        this.forgeMotion = advanceForgeMotion(this.forgeMotion, this.pose, facing, actualWalk, dt);
        this.pose = { ...this.pose, yaw: this.forgeMotion.yaw, forge: this.forgeMotion };
      }
      this.fireWeapons(dt, shooting, aim);
      if (this.unloading) {
        const age = this.clock - this.unloading.at;
        if (age >= UNLOAD_DURATION) this.unloading = undefined;
        else {
          const origin = this.project(this.miner);
          const socket = minerPoint(
            origin.x,
            origin.y,
            0.68 * this.zoom,
            this.pose,
            false,
            16,
            -15 + minerBodyOffset(this.progress, this.pose),
          );
          captureCargoSources(
            this.unloading.sources,
            age,
            this.unloading.count,
            this.fromScreen(socket),
          );
        }
      }
      if (this.combat.reward) {
        this.fleet.credits += this.combat.reward;
        this.message = `Salvage recovered: +₭${this.combat.reward}.`;
        this.combat.reward = 0;
      }
      this.explosions = this.explosions.filter((e) => (e.age += dt) < 0.6);
      for (const p of this.fragments) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      this.fragments = this.fragments.filter((p) => p.life > 0);
    }
    this.updateHUD();
    this.draw();
  }
  private mine(dt: number, direction: Point, active: boolean) {
    const core = this.planet.core,
      downward = this.planet.drillDirectionAllowed(this.miner, direction);
    this.coreImpact = downward ? this.planet.coreHit(this.miner, direction) : undefined;
    const extracting = active && !!this.coreImpact && this.onCore(),
      fuel = core.mine(dt, extracting);
    if (fuel) {
      this.progress.coreFuel += fuel;
      this.message = core.remaining
        ? `+1 core fuel. ${core.remaining} left.`
        : 'Core depleted. Leave the planet and return to replenish it.';
      this.coreSparks(true);
    }
    this.coreSparkTimer -= dt;
    if (extracting && core.remaining && this.coreSparkTimer <= 0) {
      this.coreSparks(false);
      this.coreSparkTimer = 0.1;
    }
    this.face = downward && !this.coreImpact ? this.planet.drillFace(this.miner, direction) : [];
    const cut = this.cutter.step(
      this.face,
      active,
      dt,
      this.fleet.drillSeconds,
      (cell) => this.planet.weakening(cell),
      (cell) => cell.material === 'rock' || this.total() < this.fleet.capacity,
    );
    this.target = this.cutter.target;
    this.drilling = this.cutter.elapsed;
    if (active && this.target?.material !== 'rock' && this.total() >= this.fleet.capacity)
      this.message = 'Cargo full. Return to your ship and press F to unload.';
    if (cut && this.planet.remove(cut)) {
      if (cut.material !== 'rock') this.fleet.collect(cut.material);
      this.burst(cut);
    }
  }

  private fireWeapons(dt: number, shooting: boolean, aim: Point) {
    const c = Math.cos(this.angle),
      s = Math.sin(this.angle),
      screen = this.project(aim);
    if (shooting && this.gun.ready(dt)) this.pose.fire = 1;
    const aimed = aimStudyGun(
      this.project(this.miner),
      0.68 * this.zoom,
      this.progress,
      this.pose,
      screen,
    );
    this.pose = aimed.pose;
    this.gunAim = { muzzle: aimed.muzzle, direction: aimed.direction, target: screen };
    const shot = this.gun.step(
      dt,
      shooting,
      this.fromScreen(aimed.muzzle),
      {
        x: aimed.direction.x * c - aimed.direction.y * s,
        y: aimed.direction.x * s + aimed.direction.y * c,
      },
      (p) => this.planet.solidAt(p) || !!this.combat.target(p),
      this.miner,
    );
    if (shot.fired) {
      this.pose.fire = 1;
      if (this.fleet.primary === 'beam-laser' || this.fleet.primary === 'arc') {
        const end =
          shot.impacts[0] ??
          this.fromScreen({
            x: aimed.muzzle.x + aimed.direction.x * this.primarySpec.range * this.zoom,
            y: aimed.muzzle.y + aimed.direction.y * this.primarySpec.range * this.zoom,
          });
        this.combat.beams.push({
          a: this.fromScreen(aimed.muzzle),
          b: end,
          life: this.fleet.primary === 'arc' ? 0.17 : 0.08,
          color: this.primarySpec.color,
        });
      }
    }
    for (const point of shot.impacts) {
      if (!this.combat.impact(this.planet, point, this.primarySpec)) {
        if (this.fleet.primary === 'autocannon') {
          const cell = this.planet.at(point);
          if (cell && this.planet.remove(cell)) {
            this.blasted++;
            this.burst(cell);
          }
        } else this.planet.weaken(point);
      }
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + this.clock;
        this.fragments.push({
          ...point,
          vx: Math.cos(a) * (25 + i * 6),
          vy: Math.sin(a) * (25 + i * 6),
          life: 0.12 + i * 0.025,
          size: i % 3 ? 1.3 : 2,
          color: this.primarySpec.color,
        });
      }
    }
    const rig = this.project(this.miner),
      base = minerPoint(rig.x, rig.y, 0.68 * this.zoom, this.pose, false, -12, -22),
      dx = screen.x - base.x,
      dy = screen.y - base.y,
      len = Math.hypot(dx, dy) || 1,
      d = { x: dx / len, y: dy / len };
    const muzzle = {
      x: base.x + d.x * this.secondarySpec.length * this.zoom,
      y: base.y + d.y * this.secondarySpec.length * this.zoom,
    };
    this.missileMount = { base, muzzle, direction: d };
    const impacts = this.missiles.step(
      dt,
      this.secondaryRequested,
      this.fromScreen(muzzle),
      { x: d.x * c - d.y * s, y: d.x * s + d.y * c },
      this.secondarySpec,
      this.planet,
      this.combat,
      this.miner,
    );
    this.secondaryRequested = false;
    for (const { point, spec } of impacts) {
      this.combat.blast(this.planet, point, spec, this.miner);
      const removed = this.planet.blast(point, spec.blast);
      this.blasted += removed.length;
      for (const cell of removed) this.burst(cell);
      this.explosions.push({ point, age: 0, radius: spec.blast });
      if (removed.length)
        this.message = `Blast cleared ${removed.length} blocks. Ore destroyed, none collected.`;
    }
  }
  private recoverMiner(dt: number) {
    this.rescueFlash = Math.max(0, this.rescueFlash - dt);
    if (this.combat.hull <= 0) {
      if (this.total())
        this.drops.push({ point: { x: this.miner.x, y: this.miner.y }, cargo: { ...this.cargo } });
      for (const ore of fleetOres) this.cargo[ore] = 0;
      // Prefer intact ground beside the ship, not the shaft the player just mined.
      const offset =
        [0, -60, 60, -120, 120, -180, 180].find(
          (x) =>
            this.planet.solidAt(this.shipPoint(x, 16)) &&
            !this.planet.collides(this.shipPoint(x, -35)),
        ) ?? 0;
      this.miner.teleport(this.shipPoint(offset, -35));
      this.combat.hull = UNIFORM_COMBAT.hull;
      this.combat.grace = UNIFORM_COMBAT.rescueGrace;
      this.rescueFlash = 1;
      this.clearControls();
      this.message =
        'Rig lost. Rescue returned you to the ship. Recover your dropped ore at the map marker.';
    }
    this.drops = this.drops.filter((d) => {
      if (Math.hypot(d.point.x - this.miner.x, d.point.y - this.miner.y) < 55)
        for (const ore of fleetOres)
          while (d.cargo[ore] > 0 && this.fleet.collect(ore)) d.cargo[ore]--;
      return cargoTotal(d.cargo) > 0;
    });
  }
  private updateHUD() {
    this.el('.uniform-pause').hidden = !this.paused;
    const core = this.planet.core,
      metres = Math.round(
        (Math.max(0, C.radius - Math.hypot(this.miner.x, this.miner.y)) / C.tile) * WORLD.meters,
      );
    this.el('[data-depth]').textContent = `${metres} m depth`;
    this.el('[data-cargo]').textContent =
      `Miner ${this.total()} / ${this.fleet.capacity} · Ship ${this.stored} / ∞ · ₭${this.fleet.credits}`;
    this.el('[data-fuel]').textContent = `Core fuel ${this.progress.coreFuel}`;
    this.ui.classList.toggle('hull-critical', this.combat.hull < 30);
    this.el('[data-hull]').textContent =
      `Hull ${Math.ceil(this.combat.hull)}%${this.nearShip() && this.combat.hull < 100 ? ' · Repairing' : ''}`;
    this.el('[data-loadout]').textContent = `${this.primarySpec.name} / ${this.secondarySpec.name}`;
    const nearest = this.combat.bodies
      .filter((b) => b.hp > 0 && b.seen && Math.hypot(b.x - this.miner.x, b.y - this.miner.y) < 450)
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.miner.x, a.y - this.miner.y) -
          Math.hypot(b.x - this.miner.x, b.y - this.miner.y),
      )[0];
    this.el('[data-threat]').textContent = nearest
      ? `${nearest.gunship ? 'Raider patrol' : (UNIFORM_COMBAT.sites[nearest.site]?.name ?? 'Crater cave')} · ${nearest.gunship ? 'Gunship' : nearest.kind === 'armored' ? 'Armoured scrapper' : nearest.kind === 'flyer' ? 'Crystal skimmer' : nearest.kind === 'nest' ? 'Nest' : 'Cave mauler'}${nearest.phase === 'windup' ? ' · Incoming attack' : ''}`
      : this.salvageKredits
        ? `Salvage wreck · ${Math.round((Math.hypot(this.miner.x - this.wreck.x, this.miner.y - this.wreck.y) / C.tile) * WORLD.meters)} m · Follow the ridge right`
        : '';
    const panel = this.el('.uniform-core');
    panel.hidden = this.overview || Math.hypot(this.miner.x, this.miner.y) > 400;
    this.ui.classList.toggle('near-core', !panel.hidden);
    this.el('[data-core-remaining]').textContent = `${core.remaining} / ${C.coreFuelPerCycle} fuel`;
    this.el('[data-core-hint]').textContent = !core.remaining
      ? 'Depleted for this visit. Leave the planet and return to replenish it.'
      : this.onCore()
        ? `Hold S or aim and drill into the core. ${C.coreSecondsPerUnit}s per fuel unit.`
        : 'Land on the core, then drill. W lifts you off.';
    const percent = Math.min(100, Math.round((core.extraction / C.coreSecondsPerUnit) * 100));
    this.el('.uniform-core-progress i').style.width = `${percent}%`;
    this.el('.uniform-core-progress').setAttribute('aria-valuenow', String(percent));
    this.el('[data-core-revisit]').hidden = core.remaining > 0;
    this.el('.uniform-notice').textContent = this.paused
      ? 'Paused. This test expedition resets on reload.'
      : this.overview
        ? 'Ore is shown in colour. Red markers are discovered threats. Mint squares mark dropped ore.'
        : this.message;
    this.el('.uniform-instructions').hidden = this.clock > 8;
    const unload = this.el<HTMLButtonElement>('[data-unload]');
    unload.hidden = !this.nearShip() || this.overview;
    unload.disabled = !this.total() || this.paused;
    this.el('[data-operations]').hidden = (!this.nearShip() && !this.nearWreck()) || this.overview;
    this.el('[data-operations]').textContent = this.nearWreck()
      ? `E · Salvage: ₭${this.salvageKredits} + ${this.salvageIron} iron`
      : 'E · Mothership';
    this.el('[data-fire]').hidden = this.overview || this.paused;
    const secondary = this.el<HTMLButtonElement>('[data-missile]');
    secondary.hidden = this.overview || this.paused;
    secondary.disabled = !this.missiles.ready();
    secondary.textContent =
      this.fleet.secondary === 'missile'
        ? 'Missile'
        : this.fleet.secondary === 'grenade'
          ? 'Grenade'
          : 'Rocket';
    if (this.relocating) {
      this.el<HTMLButtonElement>('[data-land]').disabled = !this.validLanding();
      this.el('[data-landing-hint]').textContent =
        this.landingAngle === undefined
          ? 'Tap the planet rim to choose a landing site.'
          : this.validLanding()
            ? 'Clear landing site. Your cargo and equipment travel with the ship.'
            : 'Choose intact ground away from your current landing site.';
    }
  }
  private project(p: Point): Point {
    if (this.overview) {
      const scale =
        Math.min(this.scale.width - 44, this.scale.height - 260) / ((C.radius + 100) * 2);
      return {
        x: this.scale.width / 2 + p.x * scale,
        y: (this.scale.height + 30) / 2 + p.y * scale,
      };
    }
    const dx = p.x - this.miner.x,
      dy = p.y - this.miner.y,
      c = Math.cos(this.angle),
      s = Math.sin(this.angle);
    return {
      x: this.scale.width / 2 + (dx * c + dy * s) * this.zoom,
      y: this.scale.height * 0.52 + (-dx * s + dy * c) * this.zoom,
    };
  }
  private fromScreen(p: Point): Point {
    const x = (p.x - this.scale.width / 2) / this.zoom,
      y = (p.y - this.scale.height * 0.52) / this.zoom,
      c = Math.cos(this.angle),
      s = Math.sin(this.angle);
    return { x: this.miner.x + x * c - y * s, y: this.miner.y + x * s + y * c };
  }
  private burst(cell: UniformCell) {
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4 + this.clock,
        speed = 20 + i * 5;
      this.fragments.push({
        x: (cell.x + 0.5) * C.tile,
        y: (cell.y + 0.5) * C.tile,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.25 + i * 0.025,
        size: 2 + (i % 4),
        color: i % 4 ? 0x536d79 : COLORS[cell.material],
      });
    }
    this.fragments = this.fragments.slice(-100);
  }
  private coreSparks(reward: boolean) {
    const at = this.coreImpact ?? { x: 0, y: -C.coreSurfaceRadius },
      normal = { x: at.x / C.coreSurfaceRadius, y: at.y / C.coreSurfaceRadius };
    for (let i = 0; i < (reward ? 18 : 4); i++) {
      const spread = Math.sin(i * 2.4 + this.clock * 8),
        speed = reward ? 80 : 40;
      this.fragments.push({
        ...at,
        vx: (normal.x + normal.y * spread) * speed,
        vy: (normal.y - normal.x * spread) * speed,
        life: reward ? 0.7 : 0.3,
        size: reward ? 2 + (i % 3) : 1.5,
        color: i % 2 ? 0xf4c888 : 0xff9763,
      });
    }
    this.fragments = this.fragments.slice(-100);
  }
  private drawRig(
    x: number,
    y: number,
    scale: number,
    aim: Point,
    unload?: { age: number; count: number },
  ) {
    if (this.forgeArt) this.forgeArt.draw(x, y, scale, this.progress, this.pose, aim, unload);
    else drawMiner(this.gfx, x, y, scale, this.progress, this.pose, false, aim, unload);
  }
  draw() {
    this.forgeArt?.hide();
    const t = this.gfx,
      s = this.scale.width,
      a = this.scale.height;
    (t.clear(), t.fillStyle(594460), t.fillRect(0, 0, s, a));
    for (let c = 0; c < 85; c++)
      (t.fillStyle(10601423, 0.14 + (c % 4) * 0.08),
        t.fillCircle(
          (((c * 613) % 1291) / 1291) * s,
          (((c * 367) % 997) / 997) * a,
          c % 5 ? 0.7 : 1.2,
        ));
    const n = this.project({ x: 0, y: 0 }),
      o = this.overview ? Math.min(s - 44, a - 260) / ((C.radius + 100) * 2) : this.zoom;
    for (let c = 4; c > 0; c--)
      (t.lineStyle((7 + c * 4) * o, 7585740, 0.025),
        t.strokePoints(
          this.planet.outline.map((p) => {
            const r = Math.hypot(p.x, p.y);
            return this.project({ x: (p.x * (r + c * 12)) / r, y: (p.y * (r + c * 12)) / r });
          }),
          true,
        ));
    (t.fillStyle(1056554),
      t.fillPoints(
        this.planet.outline.map((p) => this.project(p)),
        true,
      ));
    const i = (Math.hypot(s, a) / this.zoom) * 0.6 + C.tile;
    for (const c of this.planet.cells.values()) {
      const m = (c.x + 0.5) * C.tile,
        v = (c.y + 0.5) * C.tile;
      if (!this.overview && Math.hypot(m - this.miner.x, v - this.miner.y) > i) continue;
      const S = c.polygon.map((L) => this.project(L)),
        $ = C.radius - Math.hypot(m, v),
        T = Math.max(0, Math.min(1, $ / C.radius)),
        P =
          (Math.round(45 - T * 8) << 16) | (Math.round(66 - T * 14) << 8) | Math.round(78 - T * 12);
      if ((t.fillStyle(P), t.fillPoints(S, !0), this.overview)) {
        (c.material !== 'rock' && (t.fillStyle(COLORS[c.material], 0.9), t.fillPoints(S, !0)),
          this.guide && (t.lineStyle(0.3, 10533571, 0.2), t.strokePoints(S, !0)));
        continue;
      }
      const z = `${c.x},${c.y}`;
      let U = this.rockCache.get(z);
      U || ((U = studyRockLayers(c)), this.rockCache.set(z, U));
      for (const L of U)
        (t.fillStyle(L.color, L.alpha),
          t.fillPoints(
            L.points.map((I) => this.project(I)),
            !0,
          ));
      if (c.polygon.length === 4 && Math.hypot(m, v) < C.radius - C.tile && c.material !== 'rock') {
        const L = `${c.x},${c.y}`;
        let I = this.veinCache.get(L);
        I ||
          ((I = studyOreVeins(81, c.x, c.y, c.material, (E, F) => {
            var O;
            const D = (O = this.planet.get(E, F)) == null ? void 0 : O.material;
            return D === 'rock' ? void 0 : D;
          })),
          this.veinCache.set(L, I));
        for (const E of I)
          for (let F = 1; F < E.length; F++) {
            const D = E[F - 1],
              O = E[F],
              j = [
                this.project({
                  x: (c.x + D.x) * C.tile,
                  y: (c.y + D.y) * C.tile,
                }),
                this.project({
                  x: (c.x + O.x) * C.tile,
                  y: (c.y + O.y) * C.tile,
                }),
              ],
              Y = Math.max(1.1, D.width * C.tile * o);
            (t.lineStyle(Y + 1.6 * o, 1320497, 0.8),
              t.strokePoints(j),
              t.lineStyle(Y, COLORS[c.material], 0.94),
              t.strokePoints(j));
          }
      }
      this.guide && (t.lineStyle(1, 10211805, 0.23), t.strokePoints(S, !0));
      for (const L of studyFractures(c, this.planet.weakening(c))) {
        const I = L.map((E) => this.project(E));
        (t.lineStyle(2.5 * o, 661024, 0.95),
          t.strokePoints(I),
          t.lineStyle(0.7 * o, 10200740, 0.7),
          t.strokePoints(I));
      }
    }
    (this.drawEdges(o),
      t.lineStyle(1.5 * o, 10140352, 0.55),
      t.strokePoints(
        this.planet.outline.map((p) => this.project(p)),
        true,
      ),
      this.drawCore(o));
    if (this.overview) {
      const q = this.project(this.wreck);
      t.lineStyle(2, 0x99dfcc);
      t.strokeRect(q.x - 5, q.y - 5, 10, 10);
    } else
      drawSalvageWreck(
        t,
        this.wreck,
        (p) => this.project(p),
        o,
        this.clock,
        !this.salvageKredits && !this.salvageIron,
      );
    drawUniformCombat(t, this.combat, (p) => this.project(p), o, this.clock, this.overview);
    for (const drop of this.drops) {
      const q = this.project(drop.point);
      t.lineStyle(2, 0x93e3d2);
      t.strokeRect(q.x - 6, q.y - 6, 12, 12);
      t.fillStyle(0xcba76c);
      t.fillRect(q.x - 4, q.y - 3, 8, 6);
    }
    const r = this.fleet.position;
    if (this.overview) {
      const c = this.project(r),
        m = this.project(this.miner);
      if (
        (t.fillStyle(15317885),
        t.fillRect(c.x - 4, c.y - 4, 8, 5),
        t.lineStyle(2, 9888986),
        t.strokeCircle(m.x, m.y, 6),
        t.fillStyle(9888986),
        t.fillCircle(m.x, m.y, 2),
        this.relocating && this.landingAngle !== void 0)
      ) {
        const v = this.landingAngle!,
          S = this.validLanding(),
          $ = this.project({
            x: Math.sin(v) * (this.planet.surfaceRadius(v) + 8),
            y: -Math.cos(v) * (this.planet.surfaceRadius(v) + 8),
          });
        (t.lineStyle(3, S ? 9560767 : 15702673),
          t.strokeCircle($.x, $.y, 12),
          t.lineStyle(5, S ? 9560767 : 15702673, 0.65),
          t.strokePoints(
            Array.from({ length: 17 }, (T, P) => {
              const z = v + ((P / 16 - 0.5) * 480) / C.radius;
              return this.project({
                x: Math.sin(z) * this.planet.surfaceRadius(z),
                y: -Math.cos(z) * this.planet.surfaceRadius(z),
              });
            }),
            !1,
          ));
      }
      return;
    }
    const h = Math.hypot(r.x, r.y),
      y = { x: r.x / h, y: r.y / h },
      x = (c: number, m: number) => ({
        x: r.x - y.y * c - y.x * m,
        y: r.y + y.x * c - y.y * m,
      }),
      f = this.fleet.flight,
      p = f ? Math.sin(Math.PI * Math.min(1, f.elapsed / f.duration)) : 0,
      M = (c: number, m: number) => this.project(x(c, m));
    (drawMothership(
      t,
      M,
      !!f,
      { ...restingVehiclePose(), gear: p },
      {
        time: this.clock,
        target: this.combat.shipShot ? this.project(this.combat.shipShot.target) : undefined,
        firing: !!this.combat.shipShot,
        shotAge: this.combat.shipShot?.age,
        dimensional: !0,
        landingSurface: this.landingSurface(h),
        vectorThrusters: this.fleet.modules.has('thrusters'),
        unload:
          this.unloading && this.clock - this.unloading.at < UNLOAD_DURATION
            ? {
                age: this.clock - this.unloading.at,
                source: this.project(this.miner),
                sources: this.unloading.sources.map((point) => this.project(point)),
                count: this.unloading.count,
              }
            : void 0,
      },
    ),
      this.clock - this.sellingAt < PICKUP_SECONDS &&
        drawCargoPickup(
          t,
          (c: number, m: number) => M(c, -m),
          M(60, -65),
          this.clock - this.sellingAt,
          !1,
        ));
    const g = this.project(this.miner),
      b =
        this.down('s') || this.down('arrowdown')
          ? { x: 0, y: 100 }
          : this.pointer
            ? { x: this.pointer.x - g.x, y: this.pointer.y - g.y }
            : { x: 0, y: 100 },
      k = Math.hypot(b.x, b.y) || 1,
      A = minerLampPoint(g.x, g.y, 0.68 * o, this.progress, this.pose, !1),
      q = Math.atan2(b.y, b.x),
      B = [A];
    for (let c = 0; c <= 12; c++) {
      const m = q - 0.35 + (c / 12) * 0.7,
        v = { x: A.x, y: A.y };
      for (let S = 0; S < 230; S += 5) {
        ((v.x = A.x + Math.cos(m) * S * o), (v.y = A.y + Math.sin(m) * S * o));
        const $ = this.fromScreen(v);
        if (this.planet.solidAt($)) break;
      }
      B.push({ ...v });
    }
    if (
      (t.fillStyle(13035981, 0.065),
      t.fillPoints(B, !0),
      this.drawRig(
        g.x,
        g.y,
        0.68 * o,
        {
          x: b.x / k,
          y: b.y / k,
        },
        this.unloading
          ? { age: this.clock - this.unloading.at, count: this.unloading.count }
          : undefined,
      ),
      this.missileMount)
    ) {
      const { base: c, direction: m } = this.missileMount,
        v = (S: number, $: number) => ({
          x: c.x + (m.x * S - m.y * $) * o,
          y: c.y + (m.y * S + m.x * $) * o,
        });
      if (this.forgeArt)
        this.forgeArt.drawSecondary(c, m, o, this.fleet.secondary, this.secondarySpec.length);
      else
        for (const plate of weaponPlates(this.fleet.secondary)) {
          t.fillStyle(plate.color);
          t.fillPoints(
            plate.points.map(([x, y]) => v(x, y)),
            true,
          );
        }
    }
    for (const bullet of this.gun.bullets) {
      const a = this.project(bullet.tail),
        b = this.project(bullet),
        w = this.primarySpec;
      t.lineStyle((w.id === 'autocannon' ? 5 : 3) * o, w.color, 0.3);
      t.strokePoints([a, b]);
      t.lineStyle((w.id === 'beam-laser' ? 2 : 1.2) * o, w.color, 0.95);
      t.strokePoints([a, b]);
      t.fillStyle(0xfff0ce);
      t.fillCircle(b.x, b.y, (w.id === 'autocannon' ? 3 : 1.5) * o);
    }
    for (const c of this.missiles.bullets) {
      const m = this.project(c.tail),
        v = this.project(c),
        S = v.x - m.x,
        $ = v.y - m.y,
        T = Math.hypot(S, $) || 1,
        P = (z: number, U: number) => ({
          x: v.x + ((S * z - $ * U) / T) * o,
          y: v.y + (($ * z + S * U) / T) * o,
        });
      if (c.spec.id === 'grenade') {
        t.fillStyle(0x68865c);
        t.fillCircle(v.x, v.y, 5 * o);
        t.lineStyle(2 * o, 0xd0c18e);
        t.strokeCircle(v.x, v.y, 4 * o);
        t.fillStyle(0xffc783);
        t.fillCircle(v.x, v.y, 1.5 * o);
        continue;
      }
      (t.lineStyle(5 * o, 10203049, 0.18),
        t.strokePoints([m, P(-10, 0)]),
        t.fillStyle(16755299, 0.8),
        t.fillPoints([P(-8, -2), P(-18 - Math.sin(this.clock * 50) * 3, 0), P(-8, 2)], !0),
        t.fillStyle(13818315),
        t.fillPoints([P(4, 0), P(-3, -2.5), P(-10, -2.5), P(-8, 0), P(-10, 2.5), P(-3, 2.5)], !0));
    }
    for (const c of this.explosions) {
      const m = this.project(c.point),
        v = c.age / 0.6,
        S = c.radius * o;
      (t.fillStyle(16102773, (1 - v) * 0.23),
        t.fillCircle(m.x, m.y, S * (0.35 + v * 0.65)),
        t.lineStyle((1 - v) * 4 * o, 16765593, (1 - v) * 0.75),
        t.strokeCircle(m.x, m.y, S * Math.min(1, v * 2)));
    }
    if (this.rescueFlash) {
      t.fillStyle(0xe3bd86, this.rescueFlash * 0.25);
      t.fillRect(0, 0, s, a);
    }
    for (const c of this.target ? [this.target] : [])
      this.planet.get(c.x, c.y) &&
        (t.lineStyle(1.5, 15317885, 0.85),
        t.strokePoints(
          c.polygon.map((m) => this.project(m)),
          !0,
        ),
        this.drilling &&
          (t.fillStyle(
            15317885,
            Math.min(
              1,
              this.drilling / (this.fleet.drillSeconds * (1 - this.planet.weakening(c))),
            ) * 0.2,
          ),
          t.fillPoints(
            c.polygon.map((m) => this.project(m)),
            !0,
          )));
    for (const c of this.fragments) {
      const m = this.project(c);
      (t.fillStyle(c.color, Math.min(1, c.life * 2)),
        t.fillTriangle(m.x - c.size, m.y, m.x + c.size, m.y - c.size, m.x, m.y + c.size));
    }
  }
  drawCore(t: number) {
    const s = this.gfx,
      a = this.project({ x: 0, y: 0 }),
      n = C.coreSurfaceRadius,
      o = this.planet.core,
      i = o.remaining / C.coreFuelPerCycle,
      r =
        o.extraction > 0
          ? 0.12 + Math.sin(this.clock * 18) * 0.05
          : 0.025 * Math.sin(this.clock * 1.8);
    (s.fillStyle(16100713, 0.015 + i * 0.06 + r * i),
      s.fillCircle(a.x, a.y, (n + 23) * t),
      s.fillStyle(1581868),
      s.fillCircle(a.x, a.y, n * t));
    for (let h = 0; h < 16; h++) {
      const y = (h / 16) * Math.PI * 2,
        x = ((h + 1) / 16) * Math.PI * 2,
        f = Array.from({ length: 5 }, (g, b) => ({
          x: Math.cos(y + ((x - y) * b) / 4) * n,
          y: Math.sin(y + ((x - y) * b) / 4) * n,
        })),
        p = {
          x: Math.cos(y + 0.16) * (26 + (h % 3) * 7),
          y: Math.sin(y + 0.16) * (26 + (h % 3) * 7),
        };
      (s.fillStyle([4345946, 3490637, 5792106, 2504772][h % 4]),
        s.fillPoints([...f.map((g) => this.project(g)), this.project(p)], !0));
      const M = [
        { x: Math.cos(y) * (n - 2), y: Math.sin(y) * (n - 2) },
        { x: Math.cos(y + 0.09) * 51, y: Math.sin(y + 0.09) * 51 },
        p,
      ];
      (s.lineStyle(Math.max(1, 2 * t), i ? 15052145 : 8491150, i ? 0.28 + i * 0.55 : 0.2),
        s.strokePoints(
          M.map((g) => this.project(g)),
          !1,
        ));
    }
    (s.lineStyle(Math.max(1, 1.4 * t), 12170913, 0.7), s.strokeCircle(a.x, a.y, n * t));
    for (let h = 0; h < C.coreFuelPerCycle; h++) {
      const y = -Math.PI / 2 + (h * Math.PI) / 2,
        x = this.project({ x: Math.cos(y) * 33, y: Math.sin(y) * 33 });
      (s.fillStyle(1056038),
        s.fillCircle(x.x, x.y, 9 * t),
        h < o.remaining &&
          (s.fillStyle(15050587, 0.18),
          s.fillCircle(x.x, x.y, 13 * t),
          s.fillStyle(15050587),
          s.fillCircle(x.x, x.y, 6 * t),
          s.fillStyle(16769188),
          s.fillCircle(x.x - 1.5 * t, x.y - 1.5 * t, 2.5 * t)));
    }
  }
  drawEdges(t: number) {
    if (this.contourRevision !== this.planet.revision) {
      const n = [];
      for (const { x: o, y: i } of this.planet.cells.values())
        Math.hypot((o + 0.5) * C.tile, (i + 0.5) * C.tile) >
          this.planet.surfaceRadiusAt({ x: (o + 0.5) * C.tile, y: (i + 0.5) * C.tile }) -
            C.tile * 1.5 ||
          (this.planet.get(o, i - 1) || n.push({ a: { x: o, y: i }, b: { x: o + 1, y: i } }),
          this.planet.get(o + 1, i) || n.push({ a: { x: o + 1, y: i }, b: { x: o + 1, y: i + 1 } }),
          this.planet.get(o, i + 1) || n.push({ a: { x: o + 1, y: i + 1 }, b: { x: o, y: i + 1 } }),
          this.planet.get(o - 1, i) || n.push({ a: { x: o, y: i + 1 }, b: { x: o, y: i } }));
      ((this.contours = studyContourGeometry(n)), (this.contourRevision = this.planet.revision));
    }
    const s = (n: Point) => this.project({ x: n.x * C.tile, y: n.y * C.tile }),
      a = this.gfx;
    for (const n of this.contours.corners)
      (n.cut && (a.fillStyle(1056554), a.fillPoints([s(n.vertex), ...n.curve.map(s)], !0)),
        a.lineStyle(Math.max(0.5, t * 1.4), 8297638, 0.5),
        a.strokePoints(n.curve.map(s), !1));
    a.lineStyle(Math.max(0.5, t * 1.4), 8297638, 0.5);
    for (const n of this.contours.segments) a.strokePoints([s(n.a), s(n.b)], !1);
  }
}
