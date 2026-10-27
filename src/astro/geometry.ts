/**
 * Small, dependency-free 3D vector helpers and angle utilities.
 * The astronomy layer must stay independent from Three.js.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const TWO_PI = Math.PI * 2;

export const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function degToRad(deg: number): number {
  return deg * DEG;
}

export function radToDeg(rad: number): number {
  return rad * RAD;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function wrapRadians(angle: number): number {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

export function wrapDegrees(angle: number): number {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Signed difference b - a wrapped to [-π, π). */
export function shortestAngle(a: number, b: number): number {
  let diff = (b - a) % TWO_PI;
  if (diff >= Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthSq(a: Vec3): number {
  return dot(a, a);
}

export function length(a: Vec3): number {
  return Math.sqrt(lengthSq(a));
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / len);
}

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function angleBetween(a: Vec3, b: Vec3): number {
  const na = normalize(a);
  const nb = normalize(b);
  return Math.acos(clamp(dot(na, nb), -1, 1));
}

/**
 * Signed angle from `from` to `to` measured around the ecliptic north (+Y).
 * Positive values follow the Moon's prograde orbital motion in this model.
 */
export function signedAngleAroundY(from: Vec3, to: Vec3): number {
  const a = normalize(from);
  const b = normalize(to);
  return Math.atan2(-cross(a, b).y, dot(a, b));
}
