// Standalone Cold Signal music sketches. No game imports or borrowed samples.
// Run `node music-prototypes/generate.mjs`; WAV masters are written beside this file.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const TAU = Math.PI * 2;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (x) => Math.max(-1, Math.min(1, x));
let seed = 42169;
function noise() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}

function create(name, bpm, bars, variant) {
  const journey = variant === 'journey';
  const beats = Array.from({ length: bars }, (_, bar) => 60 / (journey ?
    bar < 8 ? 128 : bar < 16 ? 129 + (bar - 8) : 136 : bpm));
  const barStarts = [0];
  for (const localBeat of beats) barStarts.push(barStarts.at(-1) + 4 * localBeat);
  const duration = barStarts.at(-1) + 1.2;
  const length = Math.ceil(duration * SR);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const add = (time, lengthSeconds, generator, pan = 0) => {
    const start = Math.round(time * SR);
    const count = Math.min(Math.round(lengthSeconds * SR), length - start);
    const lGain = Math.sqrt((1 - pan) / 2);
    const rGain = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < count; i++) {
      const value = generator(i / SR, i, count);
      left[start + i] += value * lGain;
      right[start + i] += value * rGain;
    }
  };
  const kick = (time, strength = 1) => add(time, 0.47, (t) => {
    const phase = TAU * (47 * t + 99 * (1 - Math.exp(-t * 27)) / 27);
    const body = Math.sin(phase) * Math.exp(-t * 10);
    const click = noise() * Math.exp(-t * 180) * 0.22;
    return (body + click) * 0.82 * strength;
  });
  const snare = (time, strength = 1) => {
    let lp = 0;
    add(time, 0.27, (t) => {
      const raw = noise();
      lp += (raw - lp) * 0.18;
      return (raw - lp) * Math.exp(-t * 17) * 0.33 * strength +
        Math.sin(TAU * 182 * t) * Math.exp(-t * 23) * 0.14 * strength;
    }, 0.08);
  };
  const hat = (time, open = false, strength = 1, pan = 0) => {
    let lp = 0;
    add(time, open ? 0.34 : 0.085, (t) => {
      const raw = noise();
      lp += (raw - lp) * 0.13;
      return (raw - lp) * Math.exp(-t * (open ? 11 : 55)) * 0.16 * strength;
    }, pan);
  };
  const bass = (time, note, len, strength = 1) => {
    const f = midi(note);
    let filter = 0;
    add(time, len, (t) => {
      const saw = 2 * ((f * t) % 1) - 1;
      const sub = Math.sin(TAU * f * t) * 0.55;
      const cutoff = 0.06 + 0.19 * Math.exp(-t * 14);
      filter += ((saw * 0.68 + sub) - filter) * cutoff;
      const env = Math.min(1, t * 90) * Math.min(1, (len - t) * 17);
      return Math.tanh(filter * 2.5) * env * 0.43 * strength;
    }, -0.04);
  };
  const lead = (time, note, len, strength = 1, pan = 0) => {
    const f = midi(note);
    let filter = 0;
    add(time, len, (t) => {
      const square = Math.sin(TAU * f * t) > 0 ? 1 : -1;
      const detuned = Math.sin(TAU * f * 1.006 * t);
      const pulse = 0.7 * square + 0.3 * detuned;
      filter += (pulse - filter) * (0.045 + 0.17 * Math.exp(-t * 10));
      const env = Math.min(1, t * 65) * Math.exp(-t * 3.4) * Math.min(1, (len - t) * 35);
      return Math.tanh(filter * 2) * env * 0.26 * strength;
    }, pan);
  };
  const pad = (time, notes, len, strength = 1) => {
    for (const [i, note] of notes.entries()) {
      const f = midi(note);
      add(time, len, (t) => {
        const swell = Math.min(1, t / 0.65) * Math.min(1, (len - t) / 0.8);
        const shimmer = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * (f * 2.003) * t);
        return shimmer * swell * 0.07 * strength;
      }, i === 0 ? -0.55 : i === 2 ? 0.55 : 0);
    }
  };

  const pulseRoots = [38, 34, 41, 36];
  const pressureRoots = [33, 36, 31, 38];
  const pulseHooks = [[62, 65, 69, 65, 72, 69, 65, 60], [58, 62, 65, 62, 69, 65, 62, 57],
    [65, 69, 72, 69, 76, 72, 69, 64], [60, 64, 67, 64, 71, 67, 64, 59]];
  const pressureHooks = [[57, 60, 64, 60, 55, 60, 67, 64], [60, 63, 67, 63, 58, 63, 70, 67],
    [55, 58, 62, 58, 53, 58, 65, 62], [62, 65, 69, 65, 60, 65, 72, 69]];
  for (let bar = 0; bar < bars; bar++) {
    const beat = beats[bar];
    const barTime = barStarts[bar];
    if (journey) {
      const deep = Math.max(0, Math.min(1, (bar - 8) / 8));
      const root = bar < 8 ? pulseRoots[Math.floor(bar / 4)] :
        bar < 16 ? 36 : pressureRoots[Math.floor((bar - 16) / 4) % 4];
      const brightPhrase = pulseHooks[bar < 8 ? Math.floor(bar / 4) : 3];
      const darkPhrase = pressureHooks[bar < 16 ? 1 : Math.floor((bar - 16) / 4) % 4];
      const bright = bar < 8 ? 1 : Math.max(0, 1 - (bar - 8) / 5);
      const dark = bar < 8 ? 0 : bar < 16 ? deep : 1;
      const breakdown = bar === 14 || bar === 15;
      const chord = bar < 12 ? [root + 12, root + 19, root + 24] :
        [root + 12, root + 15, root + 19];
      pad(barTime, chord, 4 * beat, breakdown ? 1.25 : 0.8);
      for (let step = 0; step < 16; step++) {
        const t = barTime + step * beat / 4;
        if (step % 4 === 0 && (!breakdown || step === 0)) kick(t, bar === 16 && step === 0 ? 1.25 : 1);
        if (step % 8 === 4 && !breakdown) snare(t, 1 - 0.15 * dark);
        if (step % 2 === 0 && !breakdown) hat(t, step % 4 === 2,
          (step % 4 === 2 ? 0.8 : 0.38) * (0.8 + 0.2 * dark), step % 4 === 2 ? 0.35 : -0.35);
        if (step % 4 === 3 && bar >= 10 && !breakdown) hat(t, false, 0.12 + 0.25 * dark, -0.2);
        if (!breakdown) {
          if ([2, 6, 8, 10, 14].includes(step) && bright > 0)
            bass(t, root + (step === 14 ? 7 : 0), beat * 0.5, bright * (bar >= 8 ? 0.72 : 1));
          if ([0, 3, 7, 10, 14].includes(step) && dark > 0)
            bass(t, root + (step === 14 ? 7 : 0), beat * 0.56, dark * 0.83);
        }
        if (step % 2 === 0 && bright > 0 && (bar < 8 || step % 4 === 0))
          lead(t, brightPhrase[step / 2], beat * 0.42, bright * 0.86, -0.18);
        if (step % 4 === 0 && dark > 0 && (!breakdown || step === 0))
          lead(t, darkPhrase[step / 2], beat * 0.68, dark, 0.2);
      }
      if (bar === 15) for (let s = 0; s < 16; s++)
        hat(barTime + (3 + s / 16) * beat, false, 0.16 + s * 0.055, s % 2 ? 0.5 : -0.5);
      continue;
    }
    const pulse = variant === 'pulse';
    const root = (pulse ? pulseRoots : pressureRoots)[Math.floor(bar / 4) % 4];
    const phrase = (pulse ? pulseHooks : pressureHooks)[Math.floor(bar / 4) % 4];
    const active = bar < 4 || bar >= 8;
    pad(barTime, [root + 12, root + 19, root + 24], 4 * beat, bar >= 8 && bar < 12 ? 1.2 : 0.75);
    for (let step = 0; step < 16; step++) {
      const t = barTime + step * beat / 4;
      if (step % 4 === 0 && (active || step === 0)) kick(t, bar === 15 && step === 12 ? 1.2 : 1);
      if (active && step % 8 === 4) snare(t, pulse ? 1 : 0.85);
      if (active && step % 2 === 0) hat(t, step % 4 === 2, step % 4 === 2 ? 0.9 : 0.45, step % 4 === 2 ? 0.35 : -0.35);
      if (active && step % 4 === 3 && bar % 4 === 3) hat(t, false, 0.32, -0.2);
      const bassSteps = pulse ? [2, 6, 8, 10, 14] : [0, 3, 7, 10, 14];
      if (active && bassSteps.includes(step)) bass(t, root + (step === 14 ? 7 : 0), beat * (step === 8 ? 0.8 : 0.52), step === 8 ? 0.76 : 1);
      const leadStep = step / 2;
      if (bar >= 4 && step % 2 === 0 && (pulse || step % 4 === 0 || bar >= 12)) {
        const note = phrase[leadStep];
        lead(t, note, beat * (pulse ? 0.43 : 0.7), bar >= 8 && bar < 12 ? 0.62 : 1, (leadStep % 2 ? 0.16 : -0.16));
        if (bar >= 12 && step % 4 === 0) lead(t + beat * 0.035, note - 12, beat * 0.6, 0.32, 0.3);
      }
    }
    if (bar % 4 === 3) for (let s = 0; s < 8; s++) hat(barTime + (3 + s / 8) * beat, false, 0.25 + s * 0.08, s % 2 ? 0.5 : -0.5);
  }

  // Gentle saturation, headroom and a short fade. The last bar resolves into a tail.
  const wav = Buffer.alloc(44 + length * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, (duration - i / SR) / 1.1);
    const l = Math.tanh(left[i] * 1.3) * 0.79 * fade;
    const r = Math.tanh(right[i] * 1.3) * 0.79 * fade;
    wav.writeInt16LE(Math.round(clamp(l) * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(clamp(r) * 32767), 46 + i * 4);
  }
  const path = join(out, `${name}.wav`);
  writeFileSync(path, wav);
  console.log(`${path} (${duration.toFixed(1)}s)`);
}

create('signal-run', 128, 16, 'pulse');
create('deep-pressure', 136, 16, 'pressure');
create('descent-transition', 128, 32, 'journey');
