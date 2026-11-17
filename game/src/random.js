// Seeded random numbers (mulberry32) plus the small helpers the game uses
// everywhere. One clear job: deterministic randomness from an integer seed.

// A tiny, fast, seedable PRNG. The same seed always gives the same stream.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A runtime (non-deterministic) RNG for traffic, pedestrians and effects.
export const liveRandom = Math.random;

// Integer in [min, max] from a random function.
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Float in [min, max) from a random function.
export function floatBetween(rng, min, max) {
  return min + rng() * (max - min);
}

// One element of an array, picked by a random function.
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

// Clamp a number into [min, max].
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Linear interpolation between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed turn from angle `from` toward angle `to`.
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance between two points.
export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}
