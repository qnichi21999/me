// Coordinates and behavior of the hospital moon vista in Psychopomp GOLD.
// This is renderer-independent reference math, not a complete website.
export const VIEWPORT = Object.freeze([960, 540]);
export const EXAMPLE_CAMERA = Object.freeze({
  position: [-31.5, -1.629, 0.5], yaw: Math.PI / 2,
  verticalFovDegrees: 70, near: 0.05, far: 700,
  note: 'Selected example pose near overlook. Original camera is player-controlled.'
});
const TAU = 2 * Math.PI;
export function panoramaUV(direction) {
  const len = Math.hypot(...direction);
  const [x, y, z] = direction.map(v => v / len);
  let longitude = Math.atan2(x, -z);
  if (longitude < 0) longitude += TAU;
  return [longitude / TAU, Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI];
}
// pixel x/y are integer coordinates with TOP-LEFT origin; sample at center.
export function worldRay(x, y, yaw = EXAMPLE_CAMERA.yaw, width = 960, height = 540, fovY = 70) {
  const k = Math.tan(fovY * Math.PI / 360);
  const localX = (2 * (x + 0.5) / width - 1) * (width / height) * k;
  const localY = (1 - 2 * (y + 0.5) / height) * k;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ray = [c * localX - s, localY, -s * localX - c];
  const length = Math.hypot(...ray);
  return ray.map(v => v / length);
}
export function quadInOut(u) {
  return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2;
}
export function bobWeight(t) {
  const p = ((t % 20) + 20) % 20;
  return p <= 10 ? quadInOut(p / 10) : 1 - quadInOut((p - 10) / 10);
}
export const moonY = t => 39.6128 + 10 * bobWeight(t);
export const reflectionY = t => -63.5427 - 10 * bobWeight(t);
export function srgbToLinear(x) {
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}
// The reflection is blended with the 3D background BEFORE sRGB encoding.
export function overLinear(foregroundRGB, backgroundRGB, textureAlpha = 1, modulateAlpha = 0.0235294) {
  const a = textureAlpha * modulateAlpha;
  return foregroundRGB.map((v, i) => v * a + backgroundRGB[i] * (1 - a));
}
export const DITHER = Object.freeze([
  [0.00, 0.50, 0.10, 0.65],
  [0.75, 0.25, 0.90, 0.35],
  [0.20, 0.70, 0.05, 0.50],
  [0.95, 0.40, 0.80, 0.30]
]);
export function reduceColor(raw, threshold, depth = 7) {
  const div = 1 / depth;
  for (let i = 0; i <= 16; i++) {
    if (raw > div * (i + 1)) continue;
    return raw * depth - i <= threshold * 0.999 ? div * i : div * (i + 1);
  }
  return 0;
}
export function psxChannel(raw, x, y) {
  const p = DITHER[Math.floor(y) % 4][Math.floor(x) % 4];
  return reduceColor(raw, (p - 0.5) * p + 0.5, 7);
}
