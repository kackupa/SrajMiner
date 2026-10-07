// Original synthesized effects; no external audio assets or network calls.
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
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : this.mix.music / 100, now, 0.04);
    this.effectsBus.gain.setTargetAtTime(this.muted ? 0 : this.mix.effects / 100, now, 0.04);
  }
  unlock() {
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
    const time = this.context.currentTime;
    this.applyMix();
    this.moving = thrust;
    this.drilling = drill;
    this.engineGain!.gain.setTargetAtTime(thrust && !this.muted && !paused ? 0.018 : 0, time, 0.06);
    this.ambienceGain!.gain.setTargetAtTime(!this.muted && !paused ? 0.008 : 0, time, 0.2);
    this.ambience!.frequency.setTargetAtTime(depth > 0 ? 42 : 65, time, 0.6);
    if (this.muted || paused) {
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
    const start = Math.max(this.context.currentTime + 0.02, this.nextBeat);
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
