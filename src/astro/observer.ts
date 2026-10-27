import { OBSERVER_SEOUL } from './constants';
import { clamp, dot, normalize, radToDeg, sub, wrapDegrees, type Vec3 } from './geometry';
import {
  earthPosition,
  earthSurfacePosition,
  localSolarTimeHours,
  moonPosition,
  sunDirectionFromEarth,
} from './orbits';
import { moonPhaseAt, type MoonPhase } from './phases';

export interface ObserverConfig {
  nameKo: string;
  latitudeDeg: number;
  longitudeDeg: number;
}

export const DEFAULT_OBSERVER: ObserverConfig = OBSERVER_SEOUL;

export interface AltAz {
  altitudeDeg: number;
  azimuthDeg: number;
}

export function directionToAltAz(
  direction: Vec3,
  up: Vec3,
  east: Vec3,
  north: Vec3,
): AltAz {
  const dir = normalize(direction);
  const altitude = Math.asin(clamp(dot(dir, up), -1, 1));
  const azimuth = Math.atan2(dot(dir, east), dot(dir, north));
  return {
    altitudeDeg: radToDeg(altitude),
    azimuthDeg: wrapDegrees(radToDeg(azimuth)),
  };
}

export interface BodySkyPosition extends AltAz {
  distanceKm: number;
  visible: boolean;
}

export interface ObserverSky {
  days: number;
  observer: ObserverConfig;
  localSolarTimeHours: number;
  sun: BodySkyPosition;
  moon: BodySkyPosition;
  moonPhase: MoonPhase;
  observerPositionKm: Vec3;
  sunPositionKm: Vec3;
  earthPositionKm: Vec3;
  moonPositionKm: Vec3;
  sunDirectionFromEarth: Vec3;
  daylight: number;
}

export function observerSkyAt(
  days: number,
  observer: ObserverConfig = DEFAULT_OBSERVER,
): ObserverSky {
  const earth = earthPosition(days);
  const sun = { x: 0, y: 0, z: 0 };
  const moon = moonPosition(days);
  const { position: observerPosition, up, north, east } = earthSurfacePosition(
    days,
    observer.latitudeDeg,
    observer.longitudeDeg,
  );

  const sunOffset = sub(sun, observerPosition);
  const moonOffset = sub(moon, observerPosition);
  const sunAltAz = directionToAltAz(sunOffset, up, east, north);
  const moonAltAz = directionToAltAz(moonOffset, up, east, north);
  const sunDist = Math.hypot(sunOffset.x, sunOffset.y, sunOffset.z);
  const moonDist = Math.hypot(moonOffset.x, moonOffset.y, moonOffset.z);

  const sunAltitude = sunAltAz.altitudeDeg;
  const daylight = clamp((sunAltitude + 6) / 12, 0, 1);

  return {
    days,
    observer,
    localSolarTimeHours: localSolarTimeHours(days, observer.longitudeDeg),
    sun: { ...sunAltAz, distanceKm: sunDist, visible: sunAltitude > 0 },
    moon: { ...moonAltAz, distanceKm: moonDist, visible: moonAltAz.altitudeDeg > 0 },
    moonPhase: moonPhaseAt(days),
    observerPositionKm: observerPosition,
    sunPositionKm: sun,
    earthPositionKm: earth,
    moonPositionKm: moon,
    sunDirectionFromEarth: sunDirectionFromEarth(days),
    daylight,
  };
}

export function formatAltitude(altitudeDeg: number): string {
  const rounded = Math.abs(altitudeDeg) < 0.05 ? 0 : altitudeDeg;
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}°`;
}

export function formatAzimuth(azimuthDeg: number): string {
  const normalized = wrapDegrees(azimuthDeg);
  return `${normalized.toFixed(0)}°`;
}

export function azimuthCompassKo(azimuthDeg: number): string {
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const index = Math.round(wrapDegrees(azimuthDeg) / 45) % 8;
  return names[index];
}
