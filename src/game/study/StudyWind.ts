import { UNIFORM_PLANET_STUDY as C } from '../config';

/** Deterministic upper-air weather. Calm near the ground and throughout caves. */
export function studyWind(altitude: number, time: number) {
  const t = Math.max(0, Math.min(1, (altitude - C.windStart) / (C.windFull - C.windStart)));
  const strength = t * t * (3 - 2 * t);
  const gust = 0.9 + 0.1 * Math.sin(time * 1.7);
  return {
    strength,
    cross: strength * C.windDrift * (0.65 * Math.sin(time * 0.8) + 0.35 * Math.sin(time * 2.1)),
    down: strength * C.windDowndraft * gust,
  };
}
