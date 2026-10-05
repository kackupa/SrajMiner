// Original synthesized effects; no external audio assets or network calls.
export class AudioSystem {
  context?: AudioContext;
  muted = false;
  engine?: OscillatorNode;
  engineGain?: GainNode;
  ambience?: OscillatorNode;
  ambienceGain?: GainNode;
  lastDrill = 0;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.engine = this.context.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 48;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain).connect(this.context.destination);
      this.engine.start();
      this.ambience = this.context.createOscillator();
      this.ambience.type = 'sine';
      this.ambience.frequency.value = 65;
      this.ambienceGain = this.context.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambience.connect(this.ambienceGain).connect(this.context.destination);
      this.ambience.start();
    }
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
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  update(thrust: boolean, drill: boolean, depth: number, paused: boolean) {
    if (!this.context) return;
    const time = this.context.currentTime;
    this.engineGain!.gain.setTargetAtTime(thrust && !this.muted && !paused ? 0.018 : 0, time, 0.06);
    this.ambienceGain!.gain.setTargetAtTime(!this.muted && !paused ? 0.008 : 0, time, 0.2);
    this.ambience!.frequency.setTargetAtTime(depth > 0 ? 42 : 65, time, 0.6);
    if (drill && !paused && time - this.lastDrill > 0.09) {
      this.tone(65 + Math.random() * 55, 0.07, 'sawtooth', 0.024);
      this.lastDrill = time;
    }
  }
  reward() {
    this.tone(520, 0.13, 'sine', 0.07, 780);
    setTimeout(() => this.tone(780, 0.18, 'sine', 0.06, 1040), 110);
  }
}
