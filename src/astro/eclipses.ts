import {
  LUNAR_ECLIPSE_LATITUDE_LIMIT_DEG,
  SOLAR_ECLIPSE_LATITUDE_LIMIT_DEG,
} from './constants';
import { shortestAngle } from './geometry';
import { moonEclipticLatitudeDeg, moonNodeDistanceDeg } from './orbits';
import { moonPhaseAt } from './phases';

export interface Syzygy {
  kind: 'new' | 'full';
  days: number;
  phaseAngleDeg: number;
  moonLatitudeDeg: number;
  nodeDistanceDeg: number;
  possible: boolean;
}

export interface EclipseStatus {
  currentPhaseAngleDeg: number;
  currentMoonLatitudeDeg: number;
  currentNodeDistanceDeg: number;
  nearestNew: Syzygy;
  nearestFull: Syzygy;
  solarCondition: boolean;
  lunarCondition: boolean;
  headlineKo: string;
  detailKo: string;
}

const NEW_ANGLE = 0;
const FULL_ANGLE = Math.PI;

function angularDistanceTo(angle: number, target: number): number {
  return Math.abs(shortestAngle(target, angle));
}

/**
 * Find the closest new or full moon within ±searchDays of the given day.
 * The model's phase is smooth and the scan is deterministic; no ephemeris
 * tables or network access are involved.
 */
export function findNearestSyzygy(
  days: number,
  kind: 'new' | 'full',
  searchDays = 20,
): { days: number; phaseAngleDeg: number } {
  const target = kind === 'new' ? NEW_ANGLE : FULL_ANGLE;
  const step = 0.1;
  const start = days - searchDays;
  const end = days + searchDays;
  let bestDay = days;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let t = start; t <= end; t += step) {
    const distance = angularDistanceTo(moonPhaseAt(t).angleRad, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDay = t;
    }
  }

  let refinedDay = bestDay;
  let refinedDistance = bestDistance;
  for (let t = bestDay - step; t <= bestDay + step; t += step / 20) {
    const distance = angularDistanceTo(moonPhaseAt(t).angleRad, target);
    if (distance < refinedDistance) {
      refinedDistance = distance;
      refinedDay = t;
    }
  }

  return {
    days: refinedDay,
    phaseAngleDeg: moonPhaseAt(refinedDay).angleDeg,
  };
}

export function syzygyAt(days: number, kind: 'new' | 'full'): Syzygy {
  const latitude = moonEclipticLatitudeDeg(days);
  const limit = kind === 'new' ? SOLAR_ECLIPSE_LATITUDE_LIMIT_DEG : LUNAR_ECLIPSE_LATITUDE_LIMIT_DEG;
  return {
    kind,
    days,
    phaseAngleDeg: moonPhaseAt(days).angleDeg,
    moonLatitudeDeg: latitude,
    nodeDistanceDeg: moonNodeDistanceDeg(days),
    possible: Math.abs(latitude) < limit,
  };
}

export function nearestSyzygies(days: number): { newMoon: Syzygy; fullMoon: Syzygy } {
  const newMoon = findNearestSyzygy(days, 'new');
  const fullMoon = findNearestSyzygy(days, 'full');
  return {
    newMoon: syzygyAt(newMoon.days, 'new'),
    fullMoon: syzygyAt(fullMoon.days, 'full'),
  };
}

export function eclipseStatusAt(days: number): EclipseStatus {
  const phase = moonPhaseAt(days);
  const latitude = moonEclipticLatitudeDeg(days);
  const nodeDistance = moonNodeDistanceDeg(days);
  const { newMoon, fullMoon } = nearestSyzygies(days);

  const solarCondition = newMoon.possible;
  const lunarCondition = fullMoon.possible;

  let headlineKo: string;
  if (solarCondition && Math.abs(shortestAngle(NEW_ANGLE, phase.angleRad)) < 0.08) {
    headlineKo = '삭 + 교점 근처 → 일식 조건';
  } else if (lunarCondition && Math.abs(shortestAngle(FULL_ANGLE, phase.angleRad)) < 0.08) {
    headlineKo = '보름 + 교점 근처 → 월식 조건';
  } else if (solarCondition || lunarCondition) {
    headlineKo = solarCondition ? '다음 삭에서 일식 조건' : '다음 보름에서 월식 조건';
  } else {
    headlineKo = '지금은 식 현상 조건이 아닙니다';
  }

  const detailKo =
    `달의 황위 ${latitude >= 0 ? '+' : ''}${latitude.toFixed(2)}° · ` +
    `교점까지 ${nodeDistance.toFixed(1)}° · ` +
    `가장 가까운 삭 ${newMoon.days.toFixed(2)}일(위도 ${newMoon.moonLatitudeDeg.toFixed(2)}°), ` +
    `보름 ${fullMoon.days.toFixed(2)}일(위도 ${fullMoon.moonLatitudeDeg.toFixed(2)}°)`;

  return {
    currentPhaseAngleDeg: phase.angleDeg,
    currentMoonLatitudeDeg: latitude,
    currentNodeDistanceDeg: nodeDistance,
    nearestNew: newMoon,
    nearestFull: fullMoon,
    solarCondition,
    lunarCondition,
    headlineKo,
    detailKo,
  };
}

/** Concept-model eclipse condition at a specific new or full moon. */
export function isEclipseConditionAt(days: number, kind: 'new' | 'full'): boolean {
  return syzygyAt(days, kind).possible;
}
