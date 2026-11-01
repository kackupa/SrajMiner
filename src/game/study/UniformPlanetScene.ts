import { StudyPilot, shipDeckPoint } from './StudyPilot';
import { drawSpaceStars,drawSpacePlanet,spaceMap,SpaceCache } from './StudySpace';
import { studyMap } from './StudyMap';
import { ForgeSpriteRig } from '../player/ForgeSpriteRig';
import { forgeFacing,forgeGunFold,advanceForgeGun } from '../player/ForgeArm';
import { advanceForgeMotion, type ForgeMotion } from '../player/ForgeMotion';
import {forgeClawSocket,forgeCargoHatch,CLAW_GRIP,CLAW_CONTACT} from '../player/ForgeClaw';
import {StudyClawBrace} from './StudyClawBrace';
import {StudyClawHandling,handlingGoal} from './StudyClawHandling';
import {StudyCharges,chargeSpec} from './StudyCharges';
import {drawStudyExplosion,drawPlacedCharge,type StudyExplosion} from './StudyExplosions';
import Phaser from 'phaser';
import {
  UNIFORM_PLANET_STUDY as C,
  FLEET_STUDY,
  PILOT_STUDY,
  WORLD,
  STUDY_WEAPONS,
  UNIFORM_COMBAT,
  SURFACE_EXPEDITION as E,
  CLAW_CHARGE_STUDY,
  CLAW_HANDLING_STUDY,
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
  private gunDeployment = 0;
  private firing = false;
  private gun = new StudyGun();
  private missiles = new StudyOrdnance();
  private shipMissiles = new StudyOrdnance();
  private shipLaunchAt = -10;
  private shipAim?:Point;
  private combat = new UniformCombat(this.planet);
  private spin = 0;
  private rescueFlash = 0;
  private drops: { point: Point; cargo: FleetCargo }[] = [];
  private secondaryRequested = false;
  private missileTouch?: Point;
  private fireTouch?: Point;
  private missileMount?: { base: Point; muzzle: Point; direction: Point };
  private explosions: StudyExplosion[] = [];
  private charges=new StudyCharges();
  private clawRelease?:{point:Point;until:number};
  private clawBrace=new StudyClawBrace();
  private clawHandling=new StudyClawHandling();
  private handledRelease?:StudyMaterial;
  private oreStow?:{source:Point;material:StudyMaterial;age:number};
  private thrownSpoil:{point:Point;velocity:Point;age:number;spin:number}[]=[];
  private blasted = 0;
  private gunAim?: { muzzle: Point; direction: Point; target: Point };
  private clock = 0;
  private angle = 0;
  private zoom = 1.2;
  private guide = false;
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
  private pilot?:StudyPilot;
  private worldIndex=0;
  private navWorld=1;
  private spaceCache=new SpaceCache();
  private spaceRecoveryAt=-10;
  private mapHeld=false;
  private mapFrame=0;
  private worlds=new Map<number,{planet:UniformPlanet;combat:UniformCombat;drops:{point:Point;cargo:FleetCargo}[];salvageKredits:number;salvageIron:number;blasted:number}>();
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
   <nav aria-label="Test stations">${C.stations.map((s, i) => `<button data-station="${i}">${s.name}</button>`).join('')}<button data-map aria-pressed="false">Hold M / Map</button><button data-grid aria-pressed="false">Cell guide</button><button data-pause>Pause</button></nav>
   <div class="uniform-telemetry"><span data-depth></span><span data-cargo></span><span data-fuel></span><span data-hull></span></div>
   <div class="uniform-combat-status"><span data-loadout></span><span data-threat></span></div>
   <aside class="uniform-map" hidden aria-label="Planet overlay"><div><small>LOCAL NAVIGATION</small><h2 data-map-title></h2><div data-map-globe></div><p><span class="map-you">You</span><span class="map-ship">Mothership</span></p><small>Release M or the Map button to return</small></div></aside>
   <div class="uniform-flight" hidden><b data-flight-title></b><span data-flight-hint></span><span data-route></span><span data-ship-weapons></span><div class="space-destinations" hidden><button data-destination="0"><i></i>Cryo Shelf</button><button data-destination="1"><i></i>Ember Reach</button></div></div>
   <aside class="uniform-core" hidden><div><b>Planetary core</b><span data-core-remaining></span></div><p data-core-hint></p><div class="uniform-core-progress" role="progressbar" aria-label="Core fuel extraction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><button data-core-revisit hidden>Test leave &amp; return</button></aside>
   <div class="uniform-notice" role="status"></div><div class="uniform-instructions"><b>Explore. Equip. Clear a path.</b><span>Left click drill · Right click fire · Shift secondary · Q charge · A D move · W rise · S dive / drill</span><small>Blasts destroy ore. Return to your ship to repair. Touch: hold and drag to aim; release secondary to launch.</small></div>
   <button class="uniform-charge" data-charge>Q · Place charge</button><div class="uniform-touch" aria-label="Movement"><button data-hold="w" aria-label="Fly">W</button><button data-hold="a" aria-label="Move left">A</button><button data-hold="s" aria-label="Dive in air or drill on rock">S</button><button data-hold="d" aria-label="Move right">D</button></div>
   <button class="uniform-board" data-space-recover hidden>F / Recover cargo</button><button class="uniform-boost" data-boost hidden>Space / Boost</button><button class="uniform-board" data-board>Board &amp; fly</button><button class="uniform-operations" data-operations>E · Mothership</button><button class="uniform-fire" data-fire aria-label="Fire primary weapon">Fire</button><button class="uniform-missile" data-missile aria-label="Aim and launch secondary weapon">Rocket</button><button class="uniform-unload" data-unload>F · Unload ore</button>
   <section class="uniform-pause" hidden><div><small>ORE FRONTIER / RIG CONSOLE</small><h1>Expedition paused</h1><p>Your rig is standing by.</p><div class="pause-keys"><span><kbd>A D</kbd> Move</span><span><kbd>W / S</kbd> Rise / Dive</span><span><kbd>Click / grounded S</kbd> Drill</span><span><kbd>Right click</kbd> Primary</span><span><kbd>Shift</kbd> Secondary</span><span><kbd>Q</kbd> Place charge</span><span><kbd>F / E</kbd> Unload / Ship</span></div><button data-resume>Resume expedition</button><small>Test planet only. Reloading resets this expedition.</small></div></section>`;
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
        board: () => this.board(),
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
          if (this.pilot) return;
          this.clearControls();
          const index = Number(button.dataset.station);
          this.miner.teleport(index === 0 ? this.shipPoint(90, -35) : C.stations[index]);
          this.angle = Math.atan2(this.miner.outward.x, -this.miner.outward.y);
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
    const mapButton=this.el('[data-map]');
    mapButton.addEventListener('pointerdown',e=>{e.preventDefault();mapButton.setPointerCapture(e.pointerId);this.setMap(true);},listen);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])mapButton.addEventListener(event,()=>this.setMap(false),listen);
    for(const button of Array.from(this.ui.querySelectorAll<HTMLButtonElement>('[data-destination]')))button.addEventListener('click',()=>{this.navWorld=Number(button.dataset.destination);},listen);
    click('[data-space-recover]',()=>this.recoverSpaceCargo());
    click('[data-boost]',()=>{if(!this.paused)this.pilot?.boost();});
    click('[data-board]',()=>this.pilot?this.leaveHelm():this.board());
    click('[data-pause]', () => this.togglePause());
    click('[data-unload]', () => this.unload());
    click('[data-charge]',()=>this.placeCharge());
    click('[data-operations]', () => (this.nearWreck() ? this.claimSalvage() : this.openFleet()));
    click('[data-core-revisit]', () => {
      if (this.planet.core.remaining) return;
      this.planet.core.beginVisit();
      this.miner.teleport(this.shipPoint(90, -35));
      this.angle = Math.atan2(this.miner.outward.x, -this.miner.outward.y);
      this.clearControls();
      this.paused = false;
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
            ' ',
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
        if (e.repeat) return;
        this.keys.add(key);
        if (key === 'e') this.pilot?this.leaveHelm():this.nearWreck() ? this.claimSalvage() : this.openFleet();
        if (key === 'f') this.pilot?.inSpace?this.recoverSpaceCargo():this.unload();
        if (key === 'q') this.placeCharge();
        if (key === 'm') this.setMap(true);
        if (key === 'escape') this.togglePause();
        if (key === ' ' && !this.paused) this.pilot?.boost();
        if (key === 'shift' && !this.paused) this.secondaryRequested = true;
      },
      listen,
    );
    window.addEventListener('keyup', (e) => {this.keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='m')this.setMap(false);}, listen);
    window.addEventListener('blur', () => {this.clearControls();this.setMap(false);}, listen);
    const canvas = this.game.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), listen);
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        if (this.paused || this.fleetUI.open) return;
        canvas.setPointerCapture(e.pointerId);
        this.pressing = !!(e.buttons & 1);
        this.firing = !!(e.buttons & 2);
        this.pointer = { x: e.clientX, y: e.clientY };
      },
      listen,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        this.pointer = { x: e.clientX, y: e.clientY };
        // Mouse button chords emit pointermove for intermediate presses/releases.
        if (canvas.hasPointerCapture(e.pointerId)) {
          this.pressing = !!(e.buttons & 1);
          this.firing = !!(e.buttons & 2);
        }
      },
      listen,
    );
    canvas.addEventListener(
      'pointerup',
      (e) => {
        this.pressing = !!(e.buttons & 1);
        this.firing = !!(e.buttons & 2);
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
        piloting:!!this.pilot,
        altitude:this.pilot?.altitude(this.planet)??0,
        grounded:this.pilot?.grounded??true,
        cacheClaimed:this.spaceCache.claimed,space:!!this.pilot?.inSpace,frameAngle:this.pilot?.frameAngle,navWorld:this.navWorld,visited:[...new Set([this.worldIndex,...this.worlds.keys()])],yaw:this.pilot?.yaw??0,speed:this.pilot?Math.hypot(this.pilot.sideSpeed,this.pilot.riseSpeed):0,bank:this.pilot?.bank??0,gear:this.pilot?.gear??0,boost:this.pilot?.boostRemaining??0,boostCooldown:this.pilot?.boostCooldown??0,
        missiles:this.shipMissiles.shots,missileCooldown:this.shipMissiles.cooldown,aim:this.shipAim,
        ordnance:this.shipMissiles.bullets.map(b=>({x:b.x,y:b.y,aimPoint:b.aimPoint})),
        world:this.worldIndex,
        worldName:PILOT_STUDY.worlds[this.worldIndex].name,


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
      toolPose:{drill:this.pose.drill,gunDeployment:this.gunDeployment,gunFold:this.forge?forgeGunFold(this.pose.drill,this.gunDeployment):0},
      charges:{supply:this.charges.supply,pending:this.charges.pending,placed:this.charges.placed,hand:this.clawWorld(),pose:this.pose.clawAction},
      clawBrace:this.clawBrace.contact,
      clawHandling:{current:this.clawHandling.current,pending:this.clawHandling.pending,completed:this.clawHandling.completed,stow:this.oreStow,spoil:this.thrownSpoil,pose:this.pose.clawHandling},
      explosions:this.explosions.map(e=>({...e})),
      grounded: this.miner.grounded,
      wind:{...this.miner.wind,altitude:Math.hypot(this.miner.x,this.miner.y)-this.planet.surfaceRadiusAt(this.miner)},
      motion:this.forgeMotion?{...this.forgeMotion}:null,
      collision: this.planet.collides(this.miner),
      paused: this.paused,
      thrustAssists: this.miner.thrustAssists,
      diving: this.miner.diving,
      fallSpeed: this.miner.fallSpeed,
      diveFlame: this.pose.dive,
      thrusters:{lift:this.pose.lift,strafe:this.pose.strafe,dive:this.pose.dive},
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
        shipShots:this.combat.shipShots,
        shipShot:this.combat.shipShot?{...this.combat.shipShot}:undefined,
        shipTarget:this.combat.shipTarget?{...this.combat.shipTarget}:undefined,
        bodies: this.combat.bodies.map((b) => ({ ...b })),
        drops: this.drops.map((d) => ({ point: { ...d.point }, cargo: { ...d.cargo } })),
      },
      terrainDamage: {
        fractures: [...this.planet.fractures].map(([cell, amount]) => ({ cell, amount })),
        blasted: this.blasted,
        missiles: this.missiles.shots,
        ordnance:this.missiles.bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,age:b.age,aimPoint:b.aimPoint})),
        launcher:this.missileMount,
      },
      core: {
        remaining: this.planet.core.remaining,
        fuel: this.progress.coreFuel,
        extraction: this.planet.core.extraction,
        landed: this.onCore(),
      },
      overview: false,
      mapHeld:this.mapHeld,
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
    this.setMap(false);
    this.paused = !this.paused;
    this.clearControls();
    this.el('[data-pause]').textContent = this.paused ? 'Resume' : 'Pause';
  }
  private setMap(show:boolean){
    this.mapHeld=show&&!this.paused&&!this.fleetUI.open;
    this.el('.uniform-map').hidden=!this.mapHeld;
    this.el('[data-map]').setAttribute('aria-pressed',String(this.mapHeld));
    this.mapFrame=0;
  }
  private syncMap(){this.setMap(false);}
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
    if (!this.nearWreck() || this.paused || this.fleetUI.open) return;
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
  private landingSurface(_shipRadius: number) {
    return {
      contact:this.pilot&&!this.pilot.grounded?0:1,
      height:(x:number)=>{
        let lo=-200,hi=300;
        for(let i=0;i<22;i++){
          const d=(lo+hi)/2,p=shipDeckPoint(this.fleet.position,x*1.5,d*1.5,this.pilot?.bank??0,this.fleet.yaw);
          if(Math.hypot(p.x,p.y)>this.planet.surfaceRadiusAt(p))lo=d;else hi=d;
        }
        return (lo+hi)/2;
      }
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
    if (!this.nearShip() || this.paused || this.pilot) return;
    this.clearControls();
    this.setMap(false);
    this.ui.inert = true;
    this.fleetUI.show();
  }
  private closeFleet() {
    this.fleetUI.hide();
    this.ui.inert = false;
    this.clearControls();
    this.el('[data-operations]').focus();
  }
  private board(){
    this.charges.cancel();this.clawRelease=undefined;
    if(this.pilot||this.paused||!this.nearShip())return;
    this.closeFleet();this.setMap(false);this.clearControls();
    this.pilot=new StudyPilot(this.fleet.position);this.pilot.yaw=this.fleet.yaw??0;this.pilot.facing=Math.cos(this.pilot.yaw)<0?-1:1;this.fleet.pilotedPosition=this.pilot.position;
    this.unloading=undefined;this.message='At the helm. W lifts off; A / D fly around the planet. S descends.';
  }
  private leaveHelm(){
    if(!this.pilot||this.paused)return;
    if(!this.pilot.grounded){
      if(!this.pilot.requestLanding(this.planet,a=>this.fleet.landing(this.planet,a)))this.message='Descend with S. Landing needs intact, fairly level ground beneath the full ship.';
      else {this.clearControls();this.message='Landing. E disembarks after touchdown.';}
      return;
    }
    const offset=[90,-90,180,-180,0].find(x=>!this.planet.collides(this.shipPoint(x,-35)));
    if(offset===undefined){this.message='No clear exit. Fly to another stretch of ground.';return;}
    this.fleet.angle=this.pilot.angle;this.fleet.pilotedPosition=undefined;this.pilot=undefined;
    this.miner.teleport(this.shipPoint(offset,-35));this.clearControls();
    this.zoom=window.innerWidth<600?.95:1.2;
    this.message='Disembarked. Your cargo and equipment are aboard the ship.';
  }
  private flyShip(dt:number,side:number,rise:number){
    const pilot=this.pilot!;
    pilot.step(this.planet,side,rise,dt,a=>this.fleet.landing(this.planet,a),this.fleet.modules.has('thrusters')?PILOT_STUDY.thrusterBoost:1);
    this.fleet.pilotedPosition=pilot.position;this.fleet.angle=pilot.angle;this.fleet.yaw=pilot.yaw;
    const current=PILOT_STUDY.worlds[this.worldIndex];
    const otherIndex=1-this.worldIndex,other=PILOT_STUDY.worlds[otherIndex];
    const rel={x:pilot.position.x+current.x-other.x,y:pilot.position.y+current.y-other.y};
    if(Math.hypot(rel.x,rel.y)<C.radius+PILOT_STUDY.orbitHeight){
      this.worlds.set(this.worldIndex,{planet:this.planet,combat:this.combat,drops:this.drops,salvageKredits:this.salvageKredits,salvageIron:this.salvageIron,blasted:this.blasted});
      let destination=this.worlds.get(otherIndex);
      if(!destination){const planet=new UniformPlanet(true,otherIndex);destination={planet,combat:new UniformCombat(planet),drops:[],salvageKredits:E.salvageKredits,salvageIron:E.salvageIron,blasted:0};}
      this.planet=destination.planet;this.combat=destination.combat;this.drops=destination.drops;
      this.salvageKredits=destination.salvageKredits;this.salvageIron=destination.salvageIron;this.blasted=destination.blasted;
      this.planet.core.beginVisit();this.worldIndex=otherIndex;this.navWorld=1-otherIndex;this.fleet.setWorld(this.planet);
      pilot.rebase({x:current.x-other.x,y:current.y-other.y});this.fleet.pilotedPosition=pilot.position;this.fleet.angle=pilot.angle;this.fleet.yaw=pilot.yaw;
      this.wreck=this.planet.surfacePoint(E.wreckAngle,11);this.contourRevision=-1;this.veinCache.clear();this.rockCache.clear();
      this.gun=new StudyGun(this.primarySpec);this.missiles=new StudyOrdnance();this.shipMissiles=new StudyOrdnance();this.fragments=[];this.explosions=[];this.face=[];this.target=undefined;this.coreImpact=undefined;this.cutter=new UniformDrill();
      this.clearControls();this.message=`${other.name} orbit. Release thrust, then hold S to descend. Your ship retains all cargo and equipment.`;
    }
    this.miner.teleport(pilot.position);
    // The miner is inside the existing protected ship; local patrols and turrets keep moving.
    this.combat.update(this.planet,dt,this.miner,this.fleet.position,pilot.grounded,true,pilot.bank,{aim:this.pointer?this.fromScreen(this.pointer):shipDeckPoint(pilot.position,650,-220,pilot.bank,pilot.yaw,pilot.frameAngle),fire:this.firing||this.held.has('fire'),yaw:pilot.yaw,frameAngle:pilot.frameAngle});
    const theta=pilot.frameAngle;
    this.angle+=Math.atan2(Math.sin(theta-this.angle),Math.cos(theta-this.angle))*(1-Math.exp(-dt*5));
    const desired=pilot.inSpace?(window.innerWidth<600?PILOT_STUDY.spaceZoomMobile:PILOT_STUDY.spaceZoom):(window.innerWidth<600?.48:.65);
    this.zoom+=(desired-this.zoom)*(1-Math.exp(-dt*4));
  }
  private globalShipPosition(){const world=PILOT_STUDY.worlds[this.worldIndex];return {x:this.fleet.position.x+world.x,y:this.fleet.position.y+world.y};}
  private recoverSpaceCargo(){
    if(this.paused||!this.pilot?.inSpace)return;
    const cargo=this.spaceCache.take(this.globalShipPosition());if(!cargo)return;
    for(const ore of fleetOres)this.fleet.storage[ore]+=cargo[ore];
    this.fleet.credits+=cargo.kredits;this.spaceRecoveryAt=this.clock;
    this.message=`Recovered drifting cargo: ${cargo.copper} copper, ${cargo.iron} iron, ${cargo.silver} silver and ₭${cargo.kredits}.`;
  }
  private unload() {
    if (this.paused || this.pilot || !this.nearShip()) return;
    const units = this.fleet.unload();
    if (units)
      this.unloading = {
        at: this.clock,
        sources: [],
        count: Math.min(6, units),
      };
    this.message = `${units} ore unloaded. ${this.stored} aboard the mothership.`;
  }
  private clawWorld(){
    const s=forgeClawSocket(this.progress,{...this.pose,forge:this.forgeMotion,yaw:this.forgeMotion?.yaw??this.pose.yaw}),base=this.project(this.miner),scale=.68*this.zoom;
    const world=(p:Point)=>this.fromScreen({x:base.x+p.x*scale,y:base.y+p.y*scale});
    return {shoulder:world(s.shoulder),grip:world(s.grip),contact:world(s.contact),hatch:world(forgeCargoHatch(this.progress,{...this.pose,forge:this.forgeMotion,yaw:this.forgeMotion?.yaw??this.pose.yaw}))};
  }
  private placeCharge(){
    if(!this.forge||this.paused||this.fleetUI.open||this.pilot||this.charges.pending)return;
    const origin=this.clawWorld().shoulder;
    const aim=this.pointer?this.fromScreen(this.pointer):{x:origin.x-this.miner.outward.x*60,y:origin.y-this.miner.outward.y*60};
    if(!this.charges.begin(this.planet,this.worldIndex,origin,aim)){
      this.message=this.charges.supply?'Aim at nearby rock within claw reach. Q places a charge.':'No charges left in this test supply.';return;
    }
    this.secondaryRequested=false;this.message='Clamping charge onto rock. Move away after release.';
  }
  private poseCharge(){
    if(this.clawRelease&&this.clock>this.clawRelease.until)this.clawRelease=undefined;
    const target=this.charges.pending?.point??this.clawRelease?.point;if(!target)return;
    this.pose.clawAction=this.utilityGoal(target,CLAW_GRIP,!!this.charges.pending);
  }
  private utilityGoal(target:Point,offset:number,holding=false,bracing=false){
    const shoulder=forgeClawSocket(this.progress,{...this.pose,forge:this.forgeMotion,yaw:this.forgeMotion?.yaw??this.pose.yaw}).shoulder,base=this.project(this.miner),screen=this.project(target),scale=.68*this.zoom;
    const x=(screen.x-base.x)/scale-shoulder.x,y=(screen.y-base.y)/scale-shoulder.y,c=Math.cos(this.pose.bank),s=Math.sin(this.pose.bank);
    const dx=x*c+y*s,dy=-x*s+y*c,length=Math.hypot(dx,dy)||1,reach=Math.max(8,Math.min(29,length-offset));
    return {x:dx/length*reach,y:dy/length*reach,angle:Math.atan2(dy,dx),holding,bracing};
  }
  private poseBrace(active:boolean,direction:Point){
    const contact=this.clawBrace.update(this.planet,this.clawWorld().shoulder,direction,active&&!this.pose.clawAction);
    if(contact)this.pose.clawAction=this.utilityGoal(contact.point,CLAW_CONTACT,false,true);
  }
  private poseHandling(dt:number){
    const current=this.clawHandling.current;
    this.handledRelease=this.clawHandling.step(dt,!!this.pose.clawAction||!!current&&Math.hypot(current.source.x-this.miner.x,current.source.y-this.miner.y)>180);
    const h=this.clawHandling.current;if(!h)return;
    const face=Math.cos(this.forgeMotion?.yaw??this.pose.yaw??0)>=0?1:-1;
    const pickup=this.utilityGoal(h.source,CLAW_GRIP);
    this.pose.clawAction=handlingGoal(h,pickup,face);
    const ore=h.material!=='rock',release=ore?CLAW_HANDLING_STUDY.oreRelease:CLAW_HANDLING_STUDY.dirtRelease;
    this.pose.clawHandling={material:h.material,held:h.age>=CLAW_HANDLING_STUDY.scoop&&h.age<release,hatch:ore?Math.max(0,Math.min(1,(h.age-.2)/.15,(.72-h.age)/.12)):0,weight:Math.sin(Math.min(1,h.age/release)*Math.PI)};
  }
  private finishHandling(dt:number){
    if(this.oreStow&&((this.oreStow.age+=dt)>.12||Math.hypot(this.oreStow.source.x-this.miner.x,this.oreStow.source.y-this.miner.y)>100))this.oreStow=undefined;
    const hand=this.clawWorld();
    if(this.handledRelease==='rock'){
      const face=Math.cos(this.pose.yaw??0)>=0?1:-1,out=this.miner.outward,tangent={x:-out.y*face,y:out.x*face};
      for(let i=0;i<4;i++)this.thrownSpoil.push({point:{...hand.grip},velocity:{x:tangent.x*(65+i*12)+out.x*(35+i*6),y:tangent.y*(65+i*12)+out.y*(35+i*6)},age:0,spin:i*2.3});
    }else if(this.handledRelease)this.oreStow={source:{...hand.grip},material:this.handledRelease,age:0};
    this.handledRelease=undefined;
    this.thrownSpoil=this.thrownSpoil.filter(chunk=>{
      chunk.age+=dt;const r=Math.hypot(chunk.point.x,chunk.point.y)||1;
      chunk.velocity.x-=chunk.point.x/r*180*dt;chunk.velocity.y-=chunk.point.y/r*180*dt;
      const next={x:chunk.point.x+chunk.velocity.x*dt,y:chunk.point.y+chunk.velocity.y*dt};
      if(this.planet.solidAt(next)){chunk.velocity.x*=.25;chunk.velocity.y*=.25;chunk.age=Math.max(chunk.age,CLAW_HANDLING_STUDY.fragmentLife-.12);}
      else chunk.point=next;
      return chunk.age<CLAW_HANDLING_STUDY.fragmentLife;
    }).slice(-12);
  }
  private settleBrace(){
    const contact=this.clawBrace.contact;
    if(!contact||!this.pose.clawAction?.bracing||!this.forgeMotion?.cutters)return;
    const hand=this.clawWorld().contact;
    if(Math.hypot(hand.x-contact.point.x,hand.y-contact.point.y)<1.4)contact.latched=true;
    if(contact.latched){
      // Re-solve after chassis suspension: planted fingers stay on the rock
      // while the elbow absorbs the miner's drilling recoil and body lean.
      const goal=this.utilityGoal(contact.point,CLAW_CONTACT,false,true);
      this.forgeMotion.cutters[1]={...goal,vx:0,vy:0};
      this.pose.clawAction=goal;
    }
  }
  private updateCharges(dt:number){
    const before=this.charges.pending?.point,hand=this.clawWorld();
    const result=this.charges.step(this.planet,this.worldIndex,dt,hand.shoulder,hand.grip);
    if(result.released&&before){this.clawRelease={point:before,until:this.clock+.25};this.message=`Charge armed · ${CLAW_CHARGE_STUDY.fuse}s. Move clear. Blasts destroy ore.`;}
    if(result.cancelled)this.message='Placement cancelled. Charge kept in your rig.';
    for(const point of result.blasts){
      this.combat.blast(this.planet,point,chargeSpec,this.miner);
      const removed=this.planet.blast(point,chargeSpec.blast);this.blasted+=removed.length;
      for(const cell of removed)this.burst(cell);
      this.explosions.push({point,age:0,radius:chargeSpec.blast,kind:'charge'});
      this.message=`Charge detonated · ${removed.length} blocks cleared. Ore destroyed.`;
    }
  }
  update(_time: number, delta: number) {
    // Paused/menu views have no simulation to animate. Redraw only when their view changes.
    const staticFrame =
      this.paused || this.fleetUI.open
        ? `${this.paused}/${this.fleetUI.open}/${this.guide}/${this.scale.width}/${this.scale.height}`
        : '';
    if (staticFrame && staticFrame === this.staticFrame) return;
    this.staticFrame = staticFrame;
    const dt = Math.min(0.05, delta / 1000);
    if (!this.paused && !this.fleetUI.open) {
      this.clock += dt;

      const side =
          Number(this.down('d') || this.down('arrowright')) -
          Number(this.down('a') || this.down('arrowleft')),
        flying = this.down('w') || this.down('arrowup'),
        descending = this.down('s') || this.down('arrowdown');
      if(this.pilot){this.clawHandling.step(0,true);this.oreStow=undefined;this.thrownSpoil=[];this.flyShip(dt,side,Number(flying)-Number(descending));}
      else {
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
      this.combat.update(this.planet, dt, this.miner, this.fleet.position, !this.fleet.flight,false,0,{aim:this.fleet.position,fire:false,yaw:this.fleet.yaw});
      this.recoverMiner(dt);
      const trigger = !this.charges.pending&&(this.firing || this.held.has('fire'));
      const drillRequested=!this.charges.pending&&(this.pressing||(descending&&!flying&&this.miner.grounded));
      this.spin = trigger
        ? Math.min(UNIFORM_COMBAT.minigunSpinup, this.spin + dt)
        : Math.max(0, this.spin - dt * 2);
      const shooting =
        trigger && !(this.forge&&drillRequested) && (this.fleet.primary !== 'minigun' || this.spin >= UNIFORM_COMBAT.minigunSpinup);
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
        active = drillRequested;
      this.mine(dt, direction, active);
      const c = Math.cos(this.angle),
        s = Math.sin(this.angle),
        looking = { x: aim.x - this.miner.x, y: aim.y - this.miner.y };
      const currentFacing=this.forgeMotion?(this.forgeMotion.target===0?1:-1):(this.pose.turn<0?-1:1);
      const facing=forgeFacing(currentFacing,looking.x*c+looking.y*s,!!this.pointer||shooting,side);
      this.pose = advanceVehiclePose(
        this.pose,
        {
          sideSpeed: actualWalk,
          verticalSpeed: this.miner.fallSpeed,
          facing,
          thrust: flying,
          downThrust: this.miner.diving,
          sideThrust: side,
          grounded: this.miner.grounded,
          drilling: this.forge ? active :
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
        this.pose.drillAim={x:direction.x*c+direction.y*s,y:-direction.x*s+direction.y*c};
        if(useDown)this.pose.drillAim={x:0,y:60};
        this.poseCharge();
        this.poseHandling(dt);
        this.poseBrace(active&&!!this.target,direction);
        this.gunDeployment=advanceForgeGun(this.gunDeployment,trigger,drillRequested,dt);
        this.forgeMotion = advanceForgeMotion(this.forgeMotion, this.pose, facing, actualWalk, dt, false,this.miner.wind.cross/C.windDrift);
        this.pose = { ...this.pose, gunDeployment:this.gunDeployment, yaw: this.forgeMotion.yaw, forge: this.forgeMotion };
        this.settleBrace();
        this.finishHandling(dt);
      }
      if(this.forge&&drillRequested)this.pose.fire=0;
      if(this.charges.pending)this.secondaryRequested=false;
      this.fireWeapons(dt, shooting&&(!this.forge||forgeGunFold(this.pose.drill,this.gunDeployment)===0), aim);
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
      }
      this.updateShipWeapons(dt);
      this.updateCharges(dt);
      if (this.combat.reward) {
        this.fleet.credits += this.combat.reward;
        this.message = `Salvage recovered: +₭${this.combat.reward}.`;
        this.combat.reward = 0;
      }
      this.explosions = this.explosions.filter((e) => (e.age += dt) < 2).slice(-24);
      for (const p of this.fragments) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      this.fragments = this.fragments.filter((p) => p.life > 0);
    }
    if(this.mapHeld&&this.clock>=this.mapFrame){
      this.el('.map-you').textContent=this.pilot?.inSpace?'Your ship':'You';this.el('.map-ship').textContent=this.pilot?.inSpace?'Destination':'Mothership';
      this.el('[data-map-title]').textContent=this.pilot?.inSpace?'Frontier sector':PILOT_STUDY.worlds[this.worldIndex].name;
      const center=PILOT_STUDY.worlds[this.worldIndex];
      this.el('[data-map-globe]').innerHTML=this.pilot?.inSpace?spaceMap({x:this.miner.x+center.x,y:this.miner.y+center.y},this.navWorld):studyMap(this.planet,this.miner,this.fleet.position,!!this.pilot);
      this.mapFrame=this.clock+.1;
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
      if(this.forge)this.clawHandling.enqueue(cut.material,{x:(cut.x+.5)*C.tile,y:(cut.y+.5)*C.tile});
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
    const verticalLaunch=this.forge&&(this.fleet.secondary==='missile'||this.fleet.secondary==='rocket');
    const rig = this.project(this.miner),
      base = minerPoint(rig.x, rig.y, 0.68 * this.zoom, this.pose, false, verticalLaunch?-4:-12, -22),
      dx = screen.x - base.x,
      dy = screen.y - base.y,
      len = Math.hypot(dx, dy) || 1,
      d = verticalLaunch?{x:Math.sin(this.pose.bank),y:-Math.cos(this.pose.bank)}:{ x: dx / len, y: dy / len };
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
      verticalLaunch?{up:{x:d.x*c-d.y*s,y:d.x*s+d.y*c},target:{...aim}}:undefined,
    );
    this.secondaryRequested = false;
    for (const { point, spec } of impacts) {
      this.combat.blast(this.planet, point, spec, this.miner);
      const removed = this.planet.blast(point, spec.blast);
      this.blasted += removed.length;
      for (const cell of removed) this.burst(cell);
      this.explosions.push({ point, age: 0, radius: spec.blast,kind:spec.id });
      if (removed.length)
        this.message = `Blast cleared ${removed.length} blocks. Ore destroyed, none collected.`;
    }
  }
  private updateShipWeapons(dt:number) {
    const ship=this.fleet.position,bank=this.pilot?.bank??0;
    const muzzle=shipDeckPoint(ship,30,-132,bank,this.pilot?.yaw,this.pilot?.frameAngle),r=Math.hypot(ship.x,ship.y)||1;
    const spec={...STUDY_WEAPONS.find(w=>w.id==='missile')!,...PILOT_STUDY.missile};
    const raw=this.pointer?this.fromScreen(this.pointer):shipDeckPoint(ship,650,-220,bank,this.pilot?.yaw,this.pilot?.frameAngle);
    const dx=raw.x-muzzle.x,dy=raw.y-muzzle.y,d=Math.hypot(dx,dy)||1;
    const target={x:muzzle.x+dx/d*Math.min(d,spec.range*.8),y:muzzle.y+dy/d*Math.min(d,spec.range*.8)};
    if(this.pilot)this.shipAim=target;
    const fire=!!this.pilot&&!this.pilot.grounded&&this.secondaryRequested;
    const before=this.shipMissiles.shots;
    const impacts=this.shipMissiles.step(dt,fire,muzzle,{x:dx/d,y:dy/d},spec,this.planet,this.combat,muzzle,{up:{x:Math.sin(this.pilot?.frameAngle??Math.atan2(ship.x,-ship.y)),y:-Math.cos(this.pilot?.frameAngle??Math.atan2(ship.x,-ship.y))},target});
    if(this.shipMissiles.shots>before)this.shipLaunchAt=this.clock;
    if(this.pilot)this.secondaryRequested=false;
    for(const {point,spec:w} of impacts){
      this.combat.blast(this.planet,point,w,this.miner,!this.pilot);
      const removed=this.planet.blast(point,w.blast);this.blasted+=removed.length;
      for(const cell of removed)this.burst(cell);
      this.explosions.push({point,age:0,radius:w.blast,kind:w.id});
    }
  }
  private recoverMiner(dt: number) {
    this.rescueFlash = Math.max(0, this.rescueFlash - dt);
    if (this.combat.hull <= 0) {
      this.clawHandling.step(0,true);this.oreStow=undefined;this.thrownSpoil=[];
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
    const charge=this.el<HTMLButtonElement>('[data-charge]');charge.hidden=!this.forge||!!this.pilot||this.paused||this.fleetUI.open;
    charge.textContent=this.charges.pending?'Placing charge…':`Q · Charge (${this.charges.supply})`;
    charge.disabled=!!this.charges.pending||this.charges.supply<=0;
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
    this.el('[data-threat]').textContent = this.miner.wind.strength>.08
      ? this.miner.wind.strength>.65 ? 'Heavy winds · Descend with S. Use the mothership to travel.' : 'Winds rising · Miner thrust is weakening'
      : Math.hypot(this.miner.x,this.miner.y)<UNIFORM_COMBAT.coreExclusionRadius
      ? 'Core chamber · No hostiles'
      : nearest
      ? `${nearest.gunship ? 'Raider patrol' : (UNIFORM_COMBAT.sites[nearest.site]?.name ?? 'Crater cave')} · ${nearest.gunship ? 'Gunship' : nearest.kind === 'armored' ? 'Armoured scrapper' : nearest.kind === 'flyer' ? 'Crystal skimmer' : nearest.kind === 'nest' ? 'Nest' : 'Cave mauler'}${nearest.phase === 'windup' ? ' · Incoming attack' : ''}`
      : this.salvageKredits
        ? `Salvage wreck · ${Math.round((Math.hypot(this.miner.x - this.wreck.x, this.miner.y - this.wreck.y) / C.tile) * WORLD.meters)} m · Follow the ridge right`
        : '';
    const panel = this.el('.uniform-core');
    panel.hidden = Math.hypot(this.miner.x, this.miner.y) > 400;
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
      : this.message;
    this.el('.uniform-instructions').hidden = !!this.pilot || this.clock > 8;
    const unload = this.el<HTMLButtonElement>('[data-unload]');
    unload.hidden = !this.nearShip();
    unload.disabled = !this.total() || this.paused;
    this.el('[data-operations]').hidden = (!this.nearShip() && !this.nearWreck());
    this.el('[data-operations]').textContent = this.nearWreck()
      ? `E · Salvage: ₭${this.salvageKredits} + ${this.salvageIron} iron`
      : 'E · Mothership';
    this.el('[data-fire]').hidden = this.paused;
    this.el<HTMLButtonElement>('[data-fire]').disabled=false;this.el('[data-fire]').textContent='Fire';this.el('[data-fire]').setAttribute('aria-label','Fire primary weapon');
    const secondary = this.el<HTMLButtonElement>('[data-missile]');
    secondary.hidden = this.paused;
    secondary.disabled = !this.missiles.ready();
    secondary.textContent =
      this.fleet.secondary === 'missile'
        ? 'Missile'
        : this.fleet.secondary === 'grenade'
          ? 'Grenade'
          : 'Rocket';
    const board=this.el<HTMLButtonElement>('[data-board]');
    this.ui.classList.toggle('piloting',!!this.pilot);
    board.hidden=!!this.pilot?.inSpace||(!this.pilot&&!this.nearShip())||this.paused;
    const lowEnough=!this.pilot||this.pilot.altitude(this.planet)<=PILOT_STUDY.landingHeight;
    const levelGround=!this.pilot||this.fleet.landing(this.planet,this.pilot.angle);
    board.disabled=!!this.pilot&&!this.pilot.grounded&&(!lowEnough||!levelGround);
    board.textContent=this.pilot?(this.pilot.grounded?'E / Disembark':!lowEnough?'Descend to land':!levelGround?'Find level ground':'E / Land'):'Board & fly';
    this.el('.uniform-flight').hidden=!this.pilot;
    this.el('[data-space-recover]').hidden=this.paused||!this.pilot?.inSpace||!this.spaceCache.near(this.globalShipPosition());
    this.el('[data-boost]').hidden=!this.pilot||this.paused;
    for(const button of Array.from(this.ui.querySelectorAll<HTMLButtonElement>('[data-station]')))button.disabled=!!this.pilot;
    if(this.pilot){
      unload.hidden=true;this.el('[data-operations]').hidden=true;
      const boost=this.el<HTMLButtonElement>('[data-boost]');boost.hidden=this.paused;boost.textContent=this.pilot.boostRemaining>0?'Boosting':this.pilot.boostCooldown>0?`Boost ${Math.ceil(this.pilot.boostCooldown)}s`:'Space / Boost';boost.disabled=this.pilot.grounded||this.pilot.boostCooldown>0;boost.setAttribute('aria-label','Engine boost');
      this.el('[data-fire]').textContent='Cannons';this.el('[data-fire]').setAttribute('aria-label','Aim and fire mothership cannons');
      secondary.hidden=this.paused;secondary.disabled=this.pilot.grounded||!this.shipMissiles.ready();secondary.textContent=this.shipMissiles.ready()?'Shift / Missile':`Reload ${this.shipMissiles.cooldown.toFixed(1)}s`;
      this.el('[data-threat]').textContent='';this.el('[data-loadout]').textContent='Mothership / Wind unaffected';
      const altitude=this.pilot.altitude(this.planet),world=PILOT_STUDY.worlds[this.worldIndex];
      this.el('[data-flight-title]').textContent=`${world.name} / ${this.pilot.grounded?'Landed':this.pilot.inSpace?'Open space':`${Math.max(0,Math.round(altitude))} m altitude`}`;
      this.el('[data-flight-hint]').textContent=this.pilot.grounded?'W lift off / E disembark':'W climb to space / S descend / A D turn + fly / Space boost';
      const boostStatus=this.pilot.boostRemaining>0?'Boost active':this.pilot.boostCooldown>0?`Boost ${Math.ceil(this.pilot.boostCooldown)}s`:'Boost ready';
      this.el('[data-ship-weapons]').textContent=`${boostStatus} / ${this.shipMissiles.ready()?'Missile ready':`Reload ${this.shipMissiles.cooldown.toFixed(1)}s`} / ${Math.round(Math.hypot(this.pilot.sideSpeed,this.pilot.riseSpeed))} m/s`;
      if(this.scale.width<=600)this.el('[data-flight-hint]').textContent='A D turn + fly / W leave planet / Drag Cannons to aim + fire / Release Missile to launch';
      else this.el('[data-flight-hint]').textContent+=' / Right click: cannons / Shift: missile';
      const other=PILOT_STUDY.worlds[this.navWorld],destination={x:other.x-world.x,y:other.y-world.y};
      const point=this.project(destination),dx=point.x-this.scale.width/2,dy=point.y-this.scale.height*.52;
      const angle=Math.atan2(dy,dx),arrows=['Right','Down-right','Down','Down-left','Left','Up-left','Up','Up-right'];
      this.el('.space-destinations').hidden=!this.pilot.inSpace;
      for(const button of Array.from(this.ui.querySelectorAll<HTMLButtonElement>('[data-destination]')))button.setAttribute('aria-pressed',String(Number(button.dataset.destination)===this.navWorld));
      if(this.pilot.inSpace)this.el('[data-flight-hint]').textContent=this.spaceCache.near(this.globalShipPosition())?`Cargo signal: ${PILOT_STUDY.spaceCache.copper} copper, ${PILOT_STUDY.spaceCache.iron} iron, ${PILOT_STUDY.spaceCache.silver} silver + ₭${PILOT_STUDY.spaceCache.kredits}`:this.scale.width<=600?'WASD free flight / Release to brake / Hold Map to navigate':'WASD free flight / Release to brake / Space boost / Hold M for sector chart';
      this.el('[data-route]').textContent=`${arrows[(Math.round(angle/(Math.PI/4))+8)%8]}: ${other.name} / ${Math.round(Math.hypot(destination.x-this.miner.x,destination.y-this.miner.y))} m to centre / ${this.navWorld===this.worldIndex||this.worlds.has(this.navWorld)?'Visited':'Unexplored'}`;
    }
  }

  private project(p: Point): Point {
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
  private drawHandling(g:Phaser.GameObjects.Graphics){
    const chunk=(point:Point,material:StudyMaterial,size:number,angle=0,alpha=1)=>{
      const p=this.project(point),s=size*this.zoom,c=Math.cos(angle),n=Math.sin(angle);
      const P=(x:number,y:number)=>({x:p.x+(x*c-y*n)*s,y:p.y+(x*n+y*c)*s});
      if(material!=='rock'){g.fillStyle(COLORS[material],.12*alpha);g.fillCircle(p.x,p.y,s*2.3);}
      g.fillStyle(0x253b44,alpha);g.fillPoints([P(-1,-.3),P(-.4,-1),P(.8,-.6),P(1,.4),P(.2,1),P(-.8,.7)],true);
      g.fillStyle(COLORS[material],alpha);g.fillPoints([P(-1,-.3),P(-.4,-1),P(.8,-.6),P(.3,.2)],true);
      g.lineStyle(.7,material==='rock'?0x8a999c:0xe0ead9,alpha*.8);const a=P(-.4,-1),b=P(.8,-.6);g.lineBetween(a.x,a.y,b.x,b.y);
    };
    const h=this.clawHandling.current,hand=this.clawWorld();
    if(h&&h.age<CLAW_HANDLING_STUDY.scoop){
      const t=Math.min(1,h.age/CLAW_HANDLING_STUDY.scoop),e=t*t*(3-2*t),out=this.miner.outward;
      chunk({x:h.source.x+(hand.grip.x-h.source.x)*e+out.x*Math.sin(t*Math.PI)*6,y:h.source.y+(hand.grip.y-h.source.y)*e+out.y*Math.sin(t*Math.PI)*6},h.material,3.8);
    }
    if(this.oreStow){const t=Math.min(1,this.oreStow.age/.12);chunk({x:this.oreStow.source.x+(hand.hatch.x-this.oreStow.source.x)*t,y:this.oreStow.source.y+(hand.hatch.y-this.oreStow.source.y)*t},this.oreStow.material,3.8*(1-t*.75));}
    for(const c of this.thrownSpoil){const fade=Math.min(1,(CLAW_HANDLING_STUDY.fragmentLife-c.age)*8);chunk(c.point,'rock',2.5+(c.spin%2),c.spin+c.age*8,fade);const p=this.project(c.point);g.fillStyle(0x829498,.08*fade);g.fillCircle(p.x,p.y,(4+c.age*8)*this.zoom);}
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
    if(this.pilot){
      const atmosphere=Math.max(0,1-this.pilot.altitude(this.planet)/PILOT_STUDY.orbitHeight);
      for(let i=0;i<16;i++){t.fillStyle(this.worldIndex?0xa46e45:0x478eac,atmosphere*.16*(i/16));t.fillRect(0,a*i/16,s,a/16+1);}
      if(this.pilot.boostRemaining>0){
        const dx=-this.pilot.sideSpeed,dy=this.pilot.riseSpeed,len=Math.hypot(dx,dy)||1;
        t.lineStyle(1,0x9dd8e8,.22);
        for(let i=0;i<35;i++){const x=(i*173+this.clock*dx*.3)%(s+80),y=(i*263+this.clock*dy*.3)%(a+80);const X=(x+s+80)%(s+80)-40,Y=(y+a+80)%(a+80)-40;t.lineBetween(X,Y,X+dx/len*35,Y+dy/len*35);}
      }
    }
    const home=PILOT_STUDY.worlds[this.worldIndex];
    drawSpaceStars(t,s,a,{x:this.miner.x+home.x,y:this.miner.y+home.y},this.angle);
    if(this.pilot)for(let index=0;index<PILOT_STUDY.worlds.length;index++){
      if(index===this.worldIndex&&!this.pilot.inSpace)continue;
      const world=PILOT_STUDY.worlds[index],q=this.project({x:world.x-home.x,y:world.y-home.y});
      drawSpacePlanet(t,q,C.radius*this.zoom,index,s,a);
    }
    const n = this.project({ x: 0, y: 0 }),
      o = this.zoom;
    if(!this.pilot&&this.miner.wind.strength>.01){
      const w=this.miner.wind, drift=(-.65/.8*Math.cos(this.clock*.8)-.35/2.1*Math.cos(this.clock*2.1))*C.windDrift;
      t.lineStyle(1,0xb3d5dd,w.strength*.2);
      for(let i=0;i<28;i++){
        const x=((i*317+drift*3)%(s+100)+s+100)%(s+100)-50;
        const y=(i*191+this.clock*55)%(a+80)-40;
        t.strokePoints([{x,y},{x:x+w.cross*.6,y:y+9+w.down*.06}],false);
      }
    }
    if(!this.pilot?.inSpace){
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
      if (Math.hypot(m - this.miner.x, v - this.miner.y) > i) continue;
      const S = c.polygon.map((L) => this.project(L)),
        $ = C.radius - Math.hypot(m, v),
        T = Math.max(0, Math.min(1, $ / C.radius)),
        P =
          this.worldIndex===1 ? (Math.round(78-T*14)<<16)|(Math.round(61-T*12)<<8)|Math.round(48-T*8) :
          (Math.round(45 - T * 8) << 16) | (Math.round(66 - T * 14) << 8) | Math.round(78 - T * 12);
      t.fillStyle(P);t.fillPoints(S,true);
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
      drawSalvageWreck(
        t,
        this.wreck,
        (p) => this.project(p),
        o,
        this.clock,
        !this.salvageKredits && !this.salvageIron,
      );
    }
    drawUniformCombat(t, this.combat, (p) => this.project(p), o, this.clock, false);
    for (const drop of this.drops) {
      const q = this.project(drop.point);
      t.lineStyle(2, 0x93e3d2);
      t.strokeRect(q.x - 6, q.y - 6, 12, 12);
      t.fillStyle(0xcba76c);
      t.fillRect(q.x - 4, q.y - 3, 8, 6);
    }
    const r = this.fleet.position;
    const h = Math.hypot(r.x, r.y),
      y = this.pilot?{x:Math.sin(this.pilot.frameAngle),y:-Math.cos(this.pilot.frameAngle)}:{ x: r.x / h, y: r.y / h },
      x = (c: number, m: number) => ({
        x: r.x - y.y * c - y.x * m,
        y: r.y + y.x * c - y.y * m,
      }),
      f = this.pilot&&!this.pilot.grounded,
      p = f ? 1 : 0,
      M = (c: number, m: number) => this.project(x(c, m));
    (drawMothership(
      t,
      M,
      !!f,
      { ...restingVehiclePose(), gear: this.pilot?.gear??p, bank:this.pilot?.bank??0 },
      {
        time: this.clock,
        boost:!!this.pilot?.boostRemaining,
        yaw:this.fleet.yaw,drive:this.pilot?.thrust,
        missileAge:this.clock-this.shipLaunchAt,
        target: this.combat.shipTarget ? this.project(this.combat.shipTarget) : undefined,
        shotTarget: this.combat.shipShot ? this.project(this.combat.shipShot.target) : undefined,
        firingTurret: this.combat.shipShot?.turret,
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
    for (const c of [...this.missiles.bullets,...this.shipMissiles.bullets]) {
      if(c.trail){
        const trail=c.trail.map(p=>this.project(p));
        t.lineStyle(3*o,0x90adb7,.22);t.strokePoints(trail);
      }
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
        const spin=c.age*9,ca=Math.cos(spin),sa=Math.sin(spin),G=(x:number,y:number)=>({x:v.x+(x*ca-y*sa)*o,y:v.y+(x*sa+y*ca)*o});
        t.fillStyle(0x182e2b);t.fillCircle(v.x,v.y,6*o);t.fillStyle(0x77946a);t.fillCircle(v.x-o,v.y-o,4.5*o);
        t.lineStyle(2*o,0xc2c6a0);t.strokePoints([G(-3,-3),G(-1,4)]);t.lineStyle(o,0x314e43);t.strokePoints([G(2,-4),G(3,3)]);
        const light=G(4,-2);t.fillStyle(Math.sin(c.age*(c.age>.8?55:18))>0?0xffdca0:0xad683f);t.fillCircle(light.x,light.y,1.6*o);
        if(c.bounceAt!==undefined&&c.age-c.bounceAt<.12){t.lineStyle(o,0xffca79,.8);for(let i=0;i<4;i++){const b=G((i-2)*5,8);t.lineBetween(v.x,v.y,b.x,b.y);}}
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
      drawStudyExplosion(t,c,p=>this.project(p),o);
    }
    for(const charge of this.charges.placed)if(charge.world===this.worldIndex)drawPlacedCharge(t,charge.point,charge.normal,charge.fuse,p=>this.project(p),o);
    if(this.forge&&!this.pilot)this.drawHandling(t);
    if(this.pilot?.inSpace){
      const world=PILOT_STUDY.worlds[this.worldIndex],cache=PILOT_STUDY.spaceCache;
      const q=this.project({x:cache.x-world.x,y:cache.y-world.y});
      const age=this.clock-this.spaceRecoveryAt,travel=Math.min(1,age/1.2);
      if(!this.spaceCache.claimed||age<1.2){
        const ship=this.project(shipDeckPoint(this.fleet.position,35,-65,this.pilot.bank,this.pilot.yaw,this.pilot.frameAngle));
        const X=this.spaceCache.claimed?q.x+(ship.x-q.x)*travel:q.x,Y=this.spaceCache.claimed?q.y+(ship.y-q.y)*travel:q.y;
        if(!this.spaceCache.claimed){t.lineStyle(1,0x8fdecf,.3);t.strokeCircle(X,Y,21+Math.sin(this.clock*2)*4);}
        t.fillStyle(0x334e59);t.fillPoints([{x:X-12,y:Y-8},{x:X+7,y:Y-13},{x:X+14,y:Y-4},{x:X+10,y:Y+10},{x:X-10,y:Y+10}],true);
        t.fillStyle(0xd2a25d);t.fillRect(X-9,Y-6,18,13);t.fillStyle(0x1c343e);t.fillRect(X-3,Y-6,5,13);t.fillStyle(0x92e5cf);t.fillCircle(X+5,Y-3,2);
      }
    }
    if(this.pilot?.inSpace){
      const home=PILOT_STUDY.worlds[this.worldIndex],other=PILOT_STUDY.worlds[this.navWorld];
      const q=this.project({x:other.x-home.x,y:other.y-home.y}),cx=s/2,cy=a*.52,dx=q.x-cx,dy=q.y-cy,d=Math.hypot(dx,dy)||1;
      const radius=Math.min(s*.34,a*.29),X=cx+dx/d*radius,Y=cy+dy/d*radius;
      if(q.x<0||q.x>s||q.y<0||q.y>a)drawSpacePlanet(t,{x:X-dx/d*29,y:Y-dy/d*29},18,this.navWorld,s,a);
      t.lineStyle(2,0xf3ca85,.9);t.strokePoints([{x:X-dx/d*12-dy/d*7,y:Y-dy/d*12+dx/d*7},{x:X,y:Y},{x:X-dx/d*12+dy/d*7,y:Y-dy/d*12-dx/d*7}]);
    }
    if(this.pilot&&this.shipAim){const q=this.project(this.shipAim);t.lineStyle(1,0xf4cd94,.8);t.strokeCircle(q.x,q.y,11);t.lineBetween(q.x-17,q.y,q.x-7,q.y);t.lineBetween(q.x+7,q.y,q.x+17,q.y);}
    if(this.pilot)return;
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
