/**
 * Orbital model for OrbitLab.
 *
 * Frames:
 *  - Heliocentric/ecliptic: Sun at origin, ecliptic is the XZ plane, +Y is
 *    ecliptic north, and day 0 puts Earth on the +X axis.
 *  - Earth-fixed: +X = 0° longitude, +Y = north pole, +Z = 90°E.
 *
 * The Earth's orbit is intentionally circular. Seasons therefore cannot be
 * explained by changing distance in this model. The axial tilt is fixed in
 * inertial space; the Earth spins about that axis.
 */

import {
  AU_KM,
  EARTH_AXIAL_TILT_DEG,
  EARTH_MOON_DISTANCE_KM,
  EARTH_RADIUS_KM,
  EARTH_ROTATION_HOURS,
  EARTH_YEAR_DAYS,
  MOON_INITIAL_ARGUMENT_DEG,
  MOON_NODE_LONGITUDE_DEG,
  MOON_ORBIT_INCLINATION_DEG,
  MOON_SIDEREAL_DAYS,
} from './constants';
import {
  add,
  clamp,
  cross,
  degToRad,
  dot,
  length,
  normalize,
  radToDeg,
  scale,
  sub,
  TWO_PI,
  type Vec3,
} from './geometry';

export interface EarthOrientation {
  /** Earth-fixed +X (Greenwich / 0° longitude) in heliocentric coordinates. */
  xAxis: Vec3;
  /** Earth-fixed +Y (north pole) in heliocentric coordinates. */
  yAxis: Vec3;
  /** Earth-fixed +Z (90°E) in heliocentric coordinates. */
  zAxis: Vec3;
}

export function earthOrbitalAngle(days: number): number {
  return (TWO_PI * days) / EARTH_YEAR_DAYS;
}

/** Earth's center in heliocentric coordinates, in km. */
export function earthPosition(days: number): Vec3 {
  const angle = earthOrbitalAngle(days);
  return {
    x: Math.cos(angle) * AU_KM,
    y: 0,
    z: Math.sin(angle) * AU_KM,
  };
}

/** Unit direction from Earth toward the Sun. */
export function sunDirectionFromEarth(days: number): Vec3 {
  const position = earthPosition(days);
  return normalize(scale(position, -1));
}

/** Unit tangent in the direction of Earth's orbital motion. */
export function earthVelocityDirection(days: number): Vec3 {
  const angle = earthOrbitalAngle(days);
  return { x: -Math.sin(angle), y: 0, z: Math.cos(angle) };
}

/**
 * Fixed north pole direction in the ecliptic frame.
 * At the June solstice Earth sits at +Z and the Sun direction is -Z, so the
 * pole has a positive dot product with the Sun direction: north is tilted
 * toward the Sun.
 */
export function earthNorthPoleDirection(): Vec3 {
  const tilt = degToRad(EARTH_AXIAL_TILT_DEG);
  return { x: 0, y: Math.cos(tilt), z: -Math.sin(tilt) };
}

/**
 * Earth orientation basis for a simulation day. The spin is measured against
 * the sidereal day. At day 0, the Sun is over 180°E (00:00 UTC at Greenwich).
 */
export function earthOrientation(days: number): EarthOrientation {
  const tilt = degToRad(EARTH_AXIAL_TILT_DEG);
  const yAxis = earthNorthPoleDirection();
  const x0: Vec3 = { x: 1, y: 0, z: 0 };
  const z0: Vec3 = { x: 0, y: Math.sin(tilt), z: Math.cos(tilt) };

  const spin = (TWO_PI * days) / (EARTH_ROTATION_HOURS / 24);
  const c = Math.cos(spin);
  const s = Math.sin(spin);

  const xAxis = add(scale(x0, c), scale(z0, s));
  const zAxis = add(scale(x0, -s), scale(z0, c));
  return { xAxis, yAxis, zAxis };
}

/** Convert a heliocentric direction/vector into the Earth-fixed frame. */
export function helioToEarthLocal(days: number, helio: Vec3): Vec3 {
  const { xAxis, yAxis, zAxis } = earthOrientation(days);
  return {
    x: dot(helio, xAxis),
    y: dot(helio, yAxis),
    z: dot(helio, zAxis),
  };
}

/** Convert an Earth-fixed direction/vector into heliocentric coordinates. */
export function earthLocalToHelio(days: number, local: Vec3): Vec3 {
  const { xAxis, yAxis, zAxis } = earthOrientation(days);
  return add(add(scale(xAxis, local.x), scale(yAxis, local.y)), scale(zAxis, local.z));
}

/** Unit direction on the Earth's surface in the Earth-fixed frame. */
export function earthSurfaceLocalDirection(latitudeDeg: number, longitudeDeg: number): Vec3 {
  const lat = degToRad(latitudeDeg);
  const lon = degToRad(longitudeDeg);
  return {
    x: Math.cos(lat) * Math.cos(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.sin(lon),
  };
}

/** Observer position on the Earth's surface and local up direction, in km. */
export function earthSurfacePosition(
  days: number,
  latitudeDeg: number,
  longitudeDeg: number,
): { position: Vec3; up: Vec3; north: Vec3; east: Vec3 } {
  const lat = degToRad(latitudeDeg);
  const lon = degToRad(longitudeDeg);
  const localUp = earthSurfaceLocalDirection(latitudeDeg, longitudeDeg);
  const localNorth: Vec3 = {
    x: -Math.sin(lat) * Math.cos(lon),
    y: Math.cos(lat),
    z: -Math.sin(lat) * Math.sin(lon),
  };
  const localEast: Vec3 = { x: -Math.sin(lon), y: 0, z: Math.cos(lon) };

  const up = earthLocalToHelio(days, localUp);
  const north = earthLocalToHelio(days, localNorth);
  const east = earthLocalToHelio(days, localEast);
  const position = add(earthPosition(days), scale(up, EARTH_RADIUS_KM));
  return { position, up, north, east };
}

export interface MoonOrbitBasis {
  /** Unit vector along the ascending node line (±). */
  node: Vec3;
  /** Unit vector 90° along the orbit from the node, lifted by inclination. */
  inclinedPerp: Vec3;
}

export function moonOrbitBasis(): MoonOrbitBasis {
  const inc = degToRad(MOON_ORBIT_INCLINATION_DEG);
  const nodeLon = degToRad(MOON_NODE_LONGITUDE_DEG);
  const node: Vec3 = { x: Math.cos(nodeLon), y: 0, z: Math.sin(nodeLon) };
  const inPlanePerp: Vec3 = { x: -Math.sin(nodeLon), y: 0, z: Math.cos(nodeLon) };
  const inclinedPerp: Vec3 = {
    x: inPlanePerp.x * Math.cos(inc),
    y: Math.sin(inc),
    z: inPlanePerp.z * Math.cos(inc),
  };
  return { node, inclinedPerp };
}

/** Moon position relative to Earth at a given argument of latitude, in km. */
export function moonRelativePositionAtArgument(argumentRad: number): Vec3 {
  const { node, inclinedPerp } = moonOrbitBasis();
  return scale(
    add(scale(node, Math.cos(argumentRad)), scale(inclinedPerp, Math.sin(argumentRad))),
    EARTH_MOON_DISTANCE_KM,
  );
}

/** Argument of latitude increases once per sidereal month. */
export function moonArgument(days: number): number {
  return degToRad(MOON_INITIAL_ARGUMENT_DEG) + (TWO_PI * days) / MOON_SIDEREAL_DAYS;
}

/** Moon position relative to Earth in the ecliptic frame, in km. */
export function moonRelativePosition(days: number): Vec3 {
  return moonRelativePositionAtArgument(moonArgument(days));
}

/** Moon center in heliocentric coordinates, in km. */
export function moonPosition(days: number): Vec3 {
  return add(earthPosition(days), moonRelativePosition(days));
}

export function moonEclipticLatitudeRad(days: number): number {
  const relative = moonRelativePosition(days);
  return Math.asin(clamp(relative.y / length(relative), -1, 1));
}

export function moonEclipticLatitudeDeg(days: number): number {
  return radToDeg(moonEclipticLatitudeRad(days));
}

/** Unit direction of the Moon as seen from Earth. */
export function moonDirectionFromEarth(days: number): Vec3 {
  return normalize(moonRelativePosition(days));
}

/**
 * Angular distance along the Moon's orbit from the nearest node.
 * 0° means the Moon is exactly on the line of nodes.
 */
export function moonNodeDistanceDeg(days: number): number {
  const u = moonArgument(days) % TWO_PI;
  const normalized = u < 0 ? u + TWO_PI : u;
  const toAscending = Math.min(normalized, TWO_PI - normalized);
  const toDescending = Math.abs(normalized - Math.PI);
  return radToDeg(Math.min(toAscending, toDescending));
}

/** Sun's geocentric ecliptic longitude in radians. */
export function sunEclipticLongitudeRad(days: number): number {
  const position = earthPosition(days);
  return Math.atan2(-position.z, -position.x);
}

/** Moon's geocentric ecliptic longitude in radians. */
export function moonEclipticLongitudeRad(days: number): number {
  const relative = moonRelativePosition(days);
  return Math.atan2(relative.z, relative.x);
}

/** Sub-solar point in Earth-fixed coordinates. */
export function subSolarPoint(days: number): { latitudeDeg: number; longitudeDeg: number } {
  const localSun = helioToEarthLocal(days, sunDirectionFromEarth(days));
  return {
    latitudeDeg: radToDeg(Math.asin(clamp(localSun.y, -1, 1))),
    longitudeDeg: radToDeg(Math.atan2(localSun.z, localSun.x)),
  };
}

/** Mean solar time at a given Earth-fixed longitude, in hours [0, 24). */
export function localSolarTimeHours(days: number, longitudeDeg: number): number {
  const subsolar = subSolarPoint(days).longitudeDeg;
  let hours = 12 + (longitudeDeg - subsolar) / 15;
  hours %= 24;
  if (hours < 0) hours += 24;
  return hours;
}

/**
 * A few geometric helpers used by tests and by the renderer.
 */
export function isNorthPoleTiltedTowardSun(days: number): boolean {
  return dot(earthNorthPoleDirection(), sunDirectionFromEarth(days)) > 0;
}

export function earthSunDistanceKm(days: number): number {
  return length(earthPosition(days));
}

export function earthMoonDistanceKm(days: number): number {
  return length(moonRelativePosition(days));
}

export function moonOrbitTangent(days: number): Vec3 {
  const u = moonArgument(days);
  const { node, inclinedPerp } = moonOrbitBasis();
  return normalize(
    add(scale(node, -Math.sin(u)), scale(inclinedPerp, Math.cos(u))),
  );
}

export function projectOntoEcliptic(v: Vec3): Vec3 {
  return normalize({ x: v.x, y: 0, z: v.z });
}

export function crossEclipticNorth(v: Vec3): Vec3 {
  return cross({ x: 0, y: 1, z: 0 }, v);
}

export { dot, cross, sub };
