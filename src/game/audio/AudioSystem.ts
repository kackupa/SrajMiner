// Original synthesized effects and locally bundled, original music.
import { MUSIC_DEPTH } from '../config';
const signalRunUrl = new URL('../../../music-prototypes/signal-run.mp3', import.meta.url).href;
const descentTransitionUrl = new URL('../../../music-prototypes/descent-transition.mp3', import.meta.url).href;
const deepPressureUrl = new URL('../../../music-prototypes/deep-pressure.mp3', import.meta.url).href;

export type MusicPhase = 'signal' | 'transition' | 'deep';
type MusicTrack = { element: HTMLAudioElement; gain: GainNode };
export function startingMusicPhase(depth: number): MusicPhase {
  return depth >= MUSIC_DEPTH.deepOnLoad ? 'deep' :
    depth >= MUSIC_DEPTH.transition ? 'transition' : 'signal';
}
export type AudioMix = { music: number; effects: number };
export const DEFAULT_AUDIO_MIX: AudioMix = { music: 70, effects: 80 };
export const LANDMARK_CUE_NOTES = {
  route: [220, 329.63, 440, 659.25],
  archive: [659.25, 523.25, 392, 329.63],
} as const;
export type LandmarkCue = keyof typeof LANDMARK_CUE_NOTES;
export function normalizeAudioVolume(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}
export function parseAudioMix(raw: string | null): AudioMix {
  if (!raw) return { ...DEFAULT_AUDIO_MIX };
  try {
    const parsed = JSON.parse(raw) as Partial<AudioMix>;
    if (typeof parsed.music !== 'number' || typeof parsed.effects !== 'number') return { ...DEFAULT_AUDIO_MIX };
    return { music: normalizeAudioVolume(parsed.music), effects: normalizeAudioVolume(parsed.effects) };
  } catch {
    return { ...DEFAULT_AUDIO_MIX };
  }
}
export class AudioSystem {
  context?: AudioContext;
  musicBus?: GainNode;
  effectsBus?: GainNode;
  mix: AudioMix = { ...DEFAULT_AUDIO_MIX };
  muted = false;
  engine?: OscillatorNode;
  engineGain?: GainNode;
  ambience?: OscillatorNode;
  ambienceGain?: GainNode;
  nextBeat = 0;
  beat = 0;
  moving = false;
  drilling = false;
  musicPhase?: MusicPhase;
  musicTracks?: Record<MusicPhase, MusicTrack>;
  musicUnavailable = false;
  paused = false;
  lastDepth = 0;
  constructor() {
    try {
      this.muted = localStorage.getItem('mars-miner.settings.v1') === 'muted';
      this.mix = parseAudioMix(localStorage.getItem('mars-miner.audio-mix.v1'));
    } catch {
      this.muted = false;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('mars-miner.settings.v1', this.muted ? 'muted' : 'on');
    } catch {
      // Audio preference is optional if browser storage is unavailable.
    }
    this.applyMix();
    return this.muted;
  }
  setMix(channel: keyof AudioMix, value: number) {
    this.mix[channel] = normalizeAudioVolume(value);
    try {
      localStorage.setItem('mars-miner.audio-mix.v1', JSON.stringify(this.mix));
    } catch {
      // Audio preference is optional if browser storage is unavailable.
    }
    this.applyMix();
  }
  private applyMix() {
    if (!this.context || !this.musicBus || !this.effectsBus) return;
    const now = this.context.currentTime;
    this.musicBus.gain.setTargetAtTime(this.muted || this.paused ? 0 : this.mix.music / 100, now, 0.04);
    this.effectsBus.gain.setTargetAtTime(this.muted ? 0 : this.mix.effects / 100, now, 0.04);
  }
  unlock(depth = 0) {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicBus = this.context.createGain();
      this.effectsBus = this.context.createGain();
      this.musicBus.connect(this.context.destination);
      this.effectsBus.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 48;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain).connect(this.effectsBus);
      this.engine.start();
      this.ambience = this.context.createOscillator();
      this.ambience.type = 'sine';
      this.ambience.frequency.value = 65;
      this.ambienceGain = this.context.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambience.connect(this.ambienceGain).connect(this.effectsBus);
      this.ambience.start();
      this.nextBeat = this.context.currentTime + 0.12;
    }
    this.applyMix();
    void this.context.resume();
    this.startSoundtrack(depth);
  }
  private startSoundtrack(depth: number) {
    if (!this.context || this.musicTracks || this.musicUnavailable) return;
    try {
      const make = (url: string, loop: boolean): MusicTrack => {
        const element = new Audio(url);
        element.loop = loop;
        element.preload = 'auto';
        const gain = this.context!.createGain();
        gain.gain.value = 0;
        this.context!.createMediaElementSource(element).connect(gain).connect(this.musicBus!);
        return { element, gain };
      };
      this.musicTracks = {
        signal: make(signalRunUrl, true),
        transition: make(descentTransitionUrl, false),
        deep: make(deepPressureUrl, true),
      };
      this.musicTracks.transition.element.addEventListener('ended', () => {
        if (this.musicPhase === 'transition')
          this.changeMusic(this.lastDepth < MUSIC_DEPTH.returnToSignal ? 'signal' : 'deep');
      });
      this.changeMusic(startingMusicPhase(depth));
    } catch {
      this.musicUnavailable = true;
      this.musicTracks = undefined;
    }
  }
  private changeMusic(phase: MusicPhase) {
    if (!this.context || !this.musicTracks || this.musicUnavailable || this.musicPhase === phase) return;
    if (phase === 'transition') this.musicTracks.transition.element.currentTime = 0;
    if (phase === 'signal' && this.musicPhase === 'deep') this.musicTracks.signal.element.currentTime = 0;
    this.musicPhase = phase;
    const now = this.context.currentTime;
    for (const [name, track] of Object.entries(this.musicTracks) as [MusicPhase, MusicTrack][]) {
      track.gain.gain.setTargetAtTime(name === phase ? 0.78 : 0, now, 0.65);
    }
    if (!this.paused) {
      const element = this.musicTracks[phase].element;
      void element.play().catch(() => this.disableSoundtrack());
    }
  }
  private disableSoundtrack() {
    this.musicUnavailable = true;
    const now = this.context?.currentTime ?? 0;
    for (const track of Object.values(this.musicTracks ?? {})) {
      track.element.pause();
      track.gain.gain.cancelScheduledValues(now);
      track.gain.gain.setValueAtTime(0, now);
    }
  }
  private syncSoundtrackPause(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.musicTracks || this.musicUnavailable) return;
    for (const track of Object.values(this.musicTracks)) {
      if (paused) track.element.pause();
      else if (track.element.currentTime > 0 || track === this.musicTracks[this.musicPhase!])
        void track.element.play().catch(() => this.disableSoundtrack());
    }
  }
  tone(
    frequency: number,
    duration = 0.1,
    type: OscillatorType = 'triangle',
    volume = 0.05,
    finish = frequency * 0.6,
  ) {
    if (!this.context || this.muted) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, finish), c.currentTime + duration);
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect(this.effectsBus ?? c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  update(thrust: boolean, drill: boolean, depth: number, paused: boolean) {
    if (!this.context) return;
    this.lastDepth = depth;
    this.syncSoundtrackPause(paused);
    if (this.musicTracks && !this.musicUnavailable && !paused) {
      if (depth < MUSIC_DEPTH.returnToSignal && this.musicPhase !== 'signal') this.changeMusic('signal');
      else if (depth >= MUSIC_DEPTH.transition && this.musicPhase === 'signal') this.changeMusic('transition');
    }
    const time = this.context.currentTime;
    this.applyMix();
    this.moving = thrust;
    this.drilling = drill;
    this.engineGain!.gain.setTargetAtTime(thrust && !this.muted && !paused ? 0.018 : 0, time, 0.06);
    this.ambienceGain!.gain.setTargetAtTime(!this.muted && !paused ? 0.008 : 0, time, 0.2);
    this.ambience!.frequency.setTargetAtTime(depth > 0 ? 42 : 65, time, 0.6);
    if (this.muted || paused || (this.musicTracks && !this.musicUnavailable)) {
      this.nextBeat = time + 0.12;
      return;
    }
    // An original, low-density 120 BPM synth groove. Actions add quantized layers
    // on eighth notes rather than firing an unsynchronized sound every frame.
    while (time >= this.nextBeat) {
      const step = this.beat % 8;
      const quarter = step % 2 === 0;
      if (quarter && (this.moving || this.drilling)) this.kick(this.nextBeat, this.drilling ? 0.052 : 0.035);
      if (this.drilling && step === 2) this.snare(this.nextBeat, 0.018);
      if (this.drilling && (step === 1 || step === 5)) this.hat(this.nextBeat, 0.008);
      if (this.moving && quarter) {
        const notes = [55, 65.41, 73.42, 82.41];
        this.note(this.nextBeat, notes[Math.floor(this.beat / 2) % notes.length], 0.12, 0.012);
      }
      this.beat++;
      this.nextBeat += 0.25;
    }
  }
  kick(at: number, volume: number) {
    if (!this.context) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
    osc.connect(gain).connect(this.musicBus ?? this.context.destination);
    osc.start(at); osc.stop(at + 0.16);
  }
  snare(at: number, volume: number) {
    this.note(at, 185, 0.075, volume, 'triangle');
    this.hat(at, volume * 0.65);
  }
  hat(at: number, volume: number) {
    this.note(at, 1300, 0.025, volume, 'square');
  }
  note(at: number, frequency: number, duration: number, volume: number, type: OscillatorType = 'sawtooth') {
    if (!this.context) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain).connect(this.musicBus ?? this.context.destination);
    osc.start(at); osc.stop(at + duration + 0.01);
  }
  playLandmarkCue(kind: LandmarkCue) {
    if (!this.context || this.muted) return false;
    // Begin on the next groove beat and let the short melodic hook ring over the drill loop.
    const start = this.musicTracks && !this.musicUnavailable ?
      this.context.currentTime + 0.12 : Math.max(this.context.currentTime + 0.02, this.nextBeat);
    LANDMARK_CUE_NOTES[kind].forEach((frequency, index, notes) =>
      this.note(start + index * 0.25, frequency, index === notes.length - 1 ? 0.48 : 0.28, 0.026, 'sine'),
    );
    return true;
  }
  reward() {
    this.tone(520, 0.13, 'sine', 0.07, 780);
    setTimeout(() => this.tone(780, 0.18, 'sine', 0.06, 1040), 110);
  }
}
