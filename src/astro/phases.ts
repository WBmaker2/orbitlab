import {
  DEG,
  ORIGIN,
  normalize,
  wrapRadians,
  signedAngleAroundY,
  sub,
  clamp,
  type Vec3,
} from './geometry';
import { earthPosition, moonPosition } from './orbits';

export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

const PHASE_NAMES_KO: Record<MoonPhaseName, string> = {
  new: '삭',
  waxingCrescent: '초승달',
  firstQuarter: '상현달',
  waxingGibbous: '차오르는 달',
  full: '보름달',
  waningGibbous: '기우는 달',
  lastQuarter: '하현달',
  waningCrescent: '그믐달',
};

export interface MoonPhase {
  /** 0 = new, π = full, increasing through first quarter (waxing). */
  angleRad: number;
  angleDeg: number;
  illuminatedFraction: number;
  name: MoonPhaseName;
  nameKo: string;
  waxing: boolean;
}

/**
 * Signed elongation: the angle from the Earth→Sun direction to the
 * Earth→Moon direction, positive in the Moon's direction of orbital motion.
 * This is also the phase angle used for the illuminated fraction:
 * f = (1 - cos ψ) / 2.
 */
export function moonPhaseAngle(earthPos: Vec3, moonPos: Vec3, sunPos: Vec3 = ORIGIN): number {
  const sunDir = normalize(sub(sunPos, earthPos));
  const moonDir = normalize(sub(moonPos, earthPos));
  return wrapRadians(signedAngleAroundY(sunDir, moonDir));
}

export function illuminatedFractionFromPhaseAngle(angleRad: number): number {
  return clamp((1 - Math.cos(angleRad)) / 2, 0, 1);
}

export function phaseNameForAngle(angleRad: number): MoonPhaseName {
  const deg = (wrapRadians(angleRad) * 180) / Math.PI;
  if (deg < 22.5 || deg >= 337.5) return 'new';
  if (deg < 67.5) return 'waxingCrescent';
  if (deg < 112.5) return 'firstQuarter';
  if (deg < 157.5) return 'waxingGibbous';
  if (deg < 202.5) return 'full';
  if (deg < 247.5) return 'waningGibbous';
  if (deg < 292.5) return 'lastQuarter';
  return 'waningCrescent';
}

export function phaseNameKo(name: MoonPhaseName): string {
  return PHASE_NAMES_KO[name];
}

export function isWaxing(angleRad: number): boolean {
  const angle = wrapRadians(angleRad);
  return angle < Math.PI;
}

export function moonPhaseAt(days: number): MoonPhase {
  const angle = moonPhaseAngle(earthPosition(days), moonPosition(days));
  const name = phaseNameForAngle(angle);
  return {
    angleRad: angle,
    angleDeg: (angle * 180) / Math.PI,
    illuminatedFraction: illuminatedFractionFromPhaseAngle(angle),
    name,
    nameKo: phaseNameKo(name),
    waxing: isWaxing(angle),
  };
}

export function moonPhaseFromAngle(angleRad: number): MoonPhase {
  const angle = wrapRadians(angleRad);
  const name = phaseNameForAngle(angle);
  return {
    angleRad: angle,
    angleDeg: (angle * 180) / Math.PI,
    illuminatedFraction: illuminatedFractionFromPhaseAngle(angle),
    name,
    nameKo: phaseNameKo(name),
    waxing: isWaxing(angle),
  };
}

/** Convenience constants for cardinal phase tests. */
export const CARDINAL_PHASE_ANGLES = {
  new: 0,
  firstQuarter: Math.PI / 2,
  full: Math.PI,
  lastQuarter: (3 * Math.PI) / 2,
} as const;

/**
 * Angular distance (radians) to the nearest new moon (0) or full moon (π).
 * Used by the eclipse panel to decide whether to evaluate the condition at the
 * nearest syzygy rather than only at the current instant.
 */
export function distanceToSyzygy(angleRad: number): number {
  const angle = wrapRadians(angleRad);
  const toNew = Math.min(angle, 2 * Math.PI - angle);
  const toFull = Math.abs(angle - Math.PI);
  return Math.min(toNew, toFull);
}

export function phaseAngleAtCardinal(kind: keyof typeof CARDINAL_PHASE_ANGLES): number {
  return CARDINAL_PHASE_ANGLES[kind] * DEG;
}
