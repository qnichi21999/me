// Extracted behavior of Psychopomp GOLD's Elevator.tscn.
// Units: seconds, stage pixels, radians. No DOM, renderer, or dependencies.
export const mod = (x, n) => { const r = x % n; return r < 0 ? r + n : r; };
export const clamp01 = x => Math.max(0, Math.min(1, x));
export function quadInOut(u) {
  u = clamp01(u);
  return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2;
}
export function pingPongWeight(t, oneLegSeconds) {
  const p = mod(t, 2 * oneLegSeconds);
  return p <= oneLegSeconds
    ? quadInOut(p / oneLegSeconds)
    : 1 - quadInOut((p - oneLegSeconds) / oneLegSeconds);
}
export const sideGearRotation = t => 2 * pingPongWeight(t, 1);
export const sideGearLocalX = (t, sign = 1) => sign * 200 * pingPongWeight(t, 1);
export const blackGearRotation = t => 2 * pingPongWeight(t, 2);
export const sidePlateRotation = t => 0.16057 - 0.261 * pingPongWeight(t, 5);
export const cameraTarget = t => -0.0802851 + 0.2 * pingPongWeight(t, 2);

// Godot 4.3 Math::ease; used by AnimationPlayer key transitions.
export function godotEase(x, curve) {
  x = clamp01(x);
  if (curve > 0) return curve < 1 ? 1 - (1 - x) ** (1 / curve) : x ** curve;
  if (curve < 0) return x < 0.5 ? (2 * x) ** (-curve) * 0.5 : (1 - (1 - 2 * (x - 0.5)) ** (-curve)) * 0.5 + 0.5;
  return 0;
}
export function glowStrength(t) {
  const p = mod(t, 5);
  if (p < 2) return 0;
  if (p < 2.6) return 1.5 * godotEase((p - 2) / 0.6, 0.258816);
  if (p < 3.6) return 1.5;
  if (p < 4.2) return 1.5 * (1 - godotEase((p - 3.6) / 0.6, 0.392292));
  return 0;
}
export function blinkFrame(t) {
  // Avoid e.g. 5.8 % 4 evaluating a few ulps below the 1.8 s key.
  const p = mod(t, 4) + 1e-8;
  if (p < 1.7) return 0;
  if (p < 1.8) return 1;
  if (p < 1.9) return 2;
  if (p < 2) return 1;
  return 0;
}
export const openingShutterY = t => 275.75 + (-346 - 275.75) * clamp01(t / 2);
export const closingShutterY = t => 1100 + (276 - 1100) * clamp01((t - 5) / 2);
export const musicDb = t => -26.38 + (-13.9 + 26.38) * clamp01(t / 4.2);
export const dbToGain = db => 10 ** (db / 20);

// SlidingUp.gd resets to 600 and discards overshoot. Parent shake must be
// applied before calling this function; y is GLOBAL stage y, not local y.
export function slideGlobalY(y, speed, delta) {
  y -= speed * delta;
  return y < -100 ? 600 : y;
}
// Per-node fresh samples EACH frame. Supply your own RNG. Godot randomizes
// each RandomNumberGenerator at construction, so no original seed is known.
export const shakeOffset = (power, random = Math.random) => [
  (random() * 2 - 1) * power, (random() * 2 - 1) * power
];

export function lerpAngle(from, to, weight) {
  let d = mod(to - from + Math.PI, 2 * Math.PI) - Math.PI;
  return from + d * weight;
}
export const newCameraState = () => ({ angle: 0, previousTarget: -0.0802851 });
// Matches the inspected 60 Hz run: internal process, then transform change.
// For deterministic reference reproduction, advance simulation at 1/60 s.
export function stepCamera(state, t, delta = 1 / 60) {
  const target = cameraTarget(t);
  state.angle = lerpAngle(state.angle, state.previousTarget, 5 * delta);
  state.angle = lerpAngle(state.angle, target, 5 * delta);
  state.previousTarget = target;
  return state.angle;
}
export function worldToScreen(x, y, cameraAngle) {
  const dx = x - 480, dy = y - 269;
  const c = Math.cos(cameraAngle), s = Math.sin(cameraAngle);
  return [480 + c * dx + s * dy, 270 - s * dx + c * dy];
}

export const DITHER_MATRIX = Object.freeze([
  [0.00, 0.50, 0.10, 0.65],
  [0.75, 0.25, 0.90, 0.35],
  [0.20, 0.70, 0.05, 0.50],
  [0.95, 0.40, 0.80, 0.30]
]);
// Literal equivalent of PSX.gdshader reduce_color, including its 0.999.
export function reduceColor(raw, dither, depth = 7) {
  const div = 1 / depth;
  for (let i = 0; i <= 16; i++) {
    if (raw > div * (i + 1)) continue;
    return raw * depth - i <= dither * 0.999 ? div * i : div * (i + 1);
  }
  return 0;
}
export function psxChannel(raw, xTopLeft, yTopLeft) {
  const p = DITHER_MATRIX[mod(Math.floor(yTopLeft), 4)][mod(Math.floor(xTopLeft), 4)];
  return reduceColor(raw, (p - 0.5) * p + 0.5, 7);
}
export const crossfadeOpacity = secondsAfterLoad => 1 - clamp01(secondsAfterLoad / 2);
export function crossfadeMask(patternRed, opacity) {
  return clamp01(Math.ceil(patternRed + opacity * 1.00001 - 1));
}
