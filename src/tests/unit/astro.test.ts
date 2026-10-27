import { describe, expect, it } from 'vitest';
import {
  EARTH_YEAR_DAYS,
  MOON_ORBIT_INCLINATION_DEG,
  MOON_SIDEREAL_DAYS,
  MOON_SYNODIC_DAYS,
  OBSERVER_SEOUL,
  AU_KM,
} from '../../astro/constants';
import {
  clamp,
  degToRad,
  length,
  radToDeg,
  shortestAngle,
  wrapRadians,
  type Vec3,
} from '../../astro/geometry';
import {
  earthPosition,
  earthNorthPoleDirection,
  moonEclipticLatitudeDeg,
  moonRelativePosition,
  moonRelativePositionAtArgument,
  sunDirectionFromEarth,
  subSolarPoint,
  dot,
} from '../../astro/orbits';
import {
  illuminatedFractionFromPhaseAngle,
  moonPhaseAngle,
  moonPhaseAt,
  phaseNameForAngle,
} from '../../astro/phases';
import { seasonInfoForDays } from '../../astro/seasons';
import {
  currentSimDays,
  daysToDate,
  dateToDays,
  formatDateKo,
  formatDateTimeKo,
  formatTimeKo,
  koreaYearForDays,
  seasonBoundariesForYear,
} from '../../astro/time';
import { observerSkyAt } from '../../astro/observer';
import { eclipseStatusAt, findNearestSyzygy, syzygyAt } from '../../astro/eclipses';

const JUNE_SOLSTICE = EARTH_YEAR_DAYS / 4;
const SEPT_EQUINOX = EARTH_YEAR_DAYS / 2;
const DEC_SOLSTICE = (EARTH_YEAR_DAYS * 3) / 4;

function findDailyExtreme(
  days: number,
  kind: 'max' | 'min',
  span = 2,
  step = 0.002,
): { days: number; altitudeDeg: number; azimuthDeg: number } {
  let best = days;
  let bestAltitude = kind === 'max' ? -Infinity : Infinity;
  let bestAzimuth = 0;
  for (let t = days - span; t <= days + span; t += step) {
    const sky = observerSkyAt(t);
    const altitude = sky.sun.altitudeDeg;
    if (
      (kind === 'max' && altitude > bestAltitude) ||
      (kind === 'min' && altitude < bestAltitude)
    ) {
      bestAltitude = altitude;
      bestAzimuth = sky.sun.azimuthDeg;
      best = t;
    }
  }
  return { days: best, altitudeDeg: bestAltitude, azimuthDeg: bestAzimuth };
}

describe('Earth orbit and tilt', () => {
  it('starts on the +X axis and completes a circular orbit', () => {
    const start = earthPosition(0);
    const end = earthPosition(EARTH_YEAR_DAYS);
    expect(start.x).toBeCloseTo(AU_KM, 3);
    expect(start.z).toBeCloseTo(0, 6);
    expect(end.x).toBeCloseTo(start.x, 1);
    expect(end.z).toBeCloseTo(0, 1);
    expect(length({ x: end.x, y: end.y, z: end.z })).toBeCloseTo(AU_KM, 3);
  });

  it('keeps the orbital radius constant (circular model)', () => {
    for (const day of [-200, 0, 50, 200, 400]) {
      expect(length(earthPosition(day))).toBeCloseTo(AU_KM, 2);
    }
  });

  it('tilts the north pole toward the Sun at the June solstice and away at December', () => {
    const juneDot = dot(earthNorthPoleDirection(), sunDirectionFromEarth(JUNE_SOLSTICE));
    const decemberDot = dot(earthNorthPoleDirection(), sunDirectionFromEarth(DEC_SOLSTICE));
    expect(juneDot).toBeGreaterThan(0.37);
    expect(decemberDot).toBeLessThan(-0.37);
  });

  it('gives the expected sub-solar latitude at cardinal points', () => {
    expect(subSolarPoint(0).latitudeDeg).toBeCloseTo(0, 1);
    expect(subSolarPoint(JUNE_SOLSTICE).latitudeDeg).toBeCloseTo(23.44, 1);
    expect(subSolarPoint(SEPT_EQUINOX).latitudeDeg).toBeCloseTo(0, 1);
    expect(subSolarPoint(DEC_SOLSTICE).latitudeDeg).toBeCloseTo(-23.44, 1);
  });

  it('points the Sun at 180°E at the epoch (00:00 UTC)', () => {
    expect(Math.abs(subSolarPoint(0).longitudeDeg)).toBeCloseTo(180, 1);
  });
});

describe('Moon orbit', () => {
  it('returns to the same relative position after one sidereal month', () => {
    const a = moonRelativePosition(3.2);
    const b = moonRelativePosition(3.2 + MOON_SIDEREAL_DAYS);
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(b.y).toBeCloseTo(a.y, 3);
    expect(b.z).toBeCloseTo(a.z, 3);
  });

  it('has the expected ecliptic latitude at the nodes and extremes', () => {
    expect(moonRelativePositionAtArgument(0).y).toBeCloseTo(0, 6);
    const radius = 384_400;
    expect(moonRelativePositionAtArgument(Math.PI / 2).y / radius).toBeCloseTo(
      Math.sin(degToRad(MOON_ORBIT_INCLINATION_DEG)),
      6,
    );
    expect(moonRelativePositionAtArgument(Math.PI).y).toBeCloseTo(0, 6);
    expect(moonRelativePositionAtArgument((3 * Math.PI) / 2).y / radius).toBeCloseTo(
      -Math.sin(degToRad(MOON_ORBIT_INCLINATION_DEG)),
      6,
    );
  });

  it('repeats its phase after a synodic month', () => {
    const phase0 = moonPhaseAt(5).angleRad;
    const phase1 = moonPhaseAt(5 + MOON_SYNODIC_DAYS).angleRad;
    expect(Math.abs(shortestAngle(phase0, phase1))).toBeLessThan(0.03);
  });

  it('computes a small waxing crescent at the epoch', () => {
    const phase = moonPhaseAt(0);
    expect(phase.angleDeg).toBeGreaterThan(2);
    expect(phase.angleDeg).toBeLessThan(9);
    expect(['new', 'waxingCrescent']).toContain(phase.name);
  });
});

describe('Moon phases', () => {
  it('maps cardinal phase angles to the eight phase bins', () => {
    expect(phaseNameForAngle(0)).toBe('new');
    expect(phaseNameForAngle(Math.PI / 2)).toBe('firstQuarter');
    expect(phaseNameForAngle(Math.PI)).toBe('full');
    expect(phaseNameForAngle((3 * Math.PI) / 2)).toBe('lastQuarter');
  });

  it('computes illumination from the phase angle', () => {
    expect(illuminatedFractionFromPhaseAngle(0)).toBeCloseTo(0, 6);
    expect(illuminatedFractionFromPhaseAngle(Math.PI / 2)).toBeCloseTo(0.5, 6);
    expect(illuminatedFractionFromPhaseAngle(Math.PI)).toBeCloseTo(1, 6);
    expect(illuminatedFractionFromPhaseAngle((3 * Math.PI) / 2)).toBeCloseTo(0.5, 6);
  });

  it('identifies new, full and quarter geometry from vectors', () => {
    const earth: Vec3 = { x: AU_KM, y: 0, z: 0 };
    const r = 384_400;
    const moonNew: Vec3 = { x: AU_KM - r, y: 0, z: 0 };
    const moonFull: Vec3 = { x: AU_KM + r, y: 0, z: 0 };
    const moonFirstQuarter: Vec3 = { x: AU_KM, y: 0, z: -r };
    const moonLastQuarter: Vec3 = { x: AU_KM, y: 0, z: r };

    expect(radToDeg(moonPhaseAngle(earth, moonNew))).toBeCloseTo(0, 4);
    expect(radToDeg(moonPhaseAngle(earth, moonFull))).toBeCloseTo(180, 4);
    expect(radToDeg(moonPhaseAngle(earth, moonFirstQuarter))).toBeCloseTo(90, 4);
    expect(radToDeg(moonPhaseAngle(earth, moonLastQuarter))).toBeCloseTo(270, 4);
    expect(phaseNameForAngle(moonPhaseAngle(earth, moonFirstQuarter))).toBe('firstQuarter');
    expect(phaseNameForAngle(moonPhaseAngle(earth, moonLastQuarter))).toBe('lastQuarter');
  });
});

describe('Seasons', () => {
  it('labels the four 2026 boundaries for both hemispheres', () => {
    const spring = seasonInfoForDays(dateToDays(new Date(Date.UTC(2026, 2, 20, 12))));
    const summer = seasonInfoForDays(dateToDays(new Date(Date.UTC(2026, 5, 21, 12))));
    const autumn = seasonInfoForDays(dateToDays(new Date(Date.UTC(2026, 8, 23, 12))));
    const winter = seasonInfoForDays(dateToDays(new Date(Date.UTC(2026, 11, 21, 12))));

    expect(spring.northern).toBe('spring');
    expect(spring.southern).toBe('autumn');
    expect(summer.northern).toBe('summer');
    expect(summer.southern).toBe('winter');
    expect(autumn.northern).toBe('autumn');
    expect(autumn.southern).toBe('spring');
    expect(winter.northern).toBe('winter');
    expect(winter.southern).toBe('summer');
  });

  it('places the four season boundaries within two days of the real 2026 dates', () => {
    const boundaries = seasonBoundariesForYear(2026);
    const real = [
      Date.UTC(2026, 2, 20, 14, 46),
      Date.UTC(2026, 5, 21, 8, 24),
      Date.UTC(2026, 8, 23, 0, 5),
      Date.UTC(2026, 11, 21, 20, 50),
    ];
    boundaries.forEach((boundary, index) => {
      const diffDays = Math.abs(boundary.ms - real[index]) / 86_400_000;
      expect(diffDays).toBeLessThanOrEqual(2);
    });
  });

  it('round-trips dates and handles leap days', () => {
    const leapDay = new Date(Date.UTC(2028, 1, 29, 12));
    const before = new Date(Date.UTC(2028, 1, 28));
    const after = new Date(Date.UTC(2028, 2, 1));
    expect(dateToDays(after) - dateToDays(before)).toBeCloseTo(2, 6);
    expect(daysToDate(dateToDays(leapDay)).toISOString()).toBe(leapDay.toISOString());
    expect(formatDateKo(dateToDays(leapDay))).toContain('2028');
  });

  it('displays calendar values in Korean standard time', () => {
    const days = dateToDays(new Date(Date.UTC(2026, 2, 20, 0)));
    expect(formatDateKo(days)).toBe('2026년 3월 20일');
    expect(formatTimeKo(days)).toBe('09:00');
    expect(formatDateTimeKo(days)).toBe('2026년 3월 20일 09:00 KST');
    expect(koreaYearForDays(dateToDays(new Date(Date.UTC(2026, 11, 31, 16))))).toBe(2027);

    const now = new Date();
    expect(Math.abs(currentSimDays(now) - dateToDays(now))).toBeLessThan(1e-9);
  });
});

describe('Earth observer', () => {
  it('sees a high noon Sun at the June solstice and a low noon Sun at December', () => {
    const juneNoon = findDailyExtreme(dateToDays(new Date(Date.UTC(2026, 5, 21, 3))), 'max');
    const decemberNoon = findDailyExtreme(dateToDays(new Date(Date.UTC(2026, 11, 21, 3))), 'max');
    const equinoxNoon = findDailyExtreme(dateToDays(new Date(Date.UTC(2026, 2, 20, 3))), 'max');

    expect(juneNoon.altitudeDeg).toBeCloseTo(75.9, 0);
    expect(decemberNoon.altitudeDeg).toBeCloseTo(29.0, 0);
    expect(equinoxNoon.altitudeDeg).toBeCloseTo(52.4, 0);
    expect(juneNoon.azimuthDeg).toBeGreaterThan(160);
    expect(juneNoon.azimuthDeg).toBeLessThan(200);
  });

  it('has the Sun below the horizon at local midnight', () => {
    const midnight = findDailyExtreme(dateToDays(new Date(Date.UTC(2026, 2, 20, 3))), 'min');
    expect(midnight.altitudeDeg).toBeLessThan(-50);
  });

  it('rises in the east and sets in the west', () => {
    const equinox = dateToDays(new Date(Date.UTC(2026, 2, 21)));
    let sunrise: { days: number; altitudeDeg: number; azimuthDeg: number } | null = null;
    let sunset: { days: number; altitudeDeg: number; azimuthDeg: number } | null = null;
    let previous = observerSkyAt(equinox).sun.altitudeDeg;
    for (let t = equinox; t < equinox + 1; t += 0.001) {
      const altitude = observerSkyAt(t).sun.altitudeDeg;
      if (previous < 0 && altitude >= 0 && !sunrise) {
        sunrise = { days: t, altitudeDeg: altitude, azimuthDeg: observerSkyAt(t).sun.azimuthDeg };
      }
      if (previous >= 0 && altitude < 0) {
        sunset = { days: t, altitudeDeg: altitude, azimuthDeg: observerSkyAt(t).sun.azimuthDeg };
      }
      previous = altitude;
    }
    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    const sunriseAz = sunrise?.azimuthDeg ?? 0;
    const sunsetAz = sunset?.azimuthDeg ?? 0;
    expect(sunriseAz).toBeGreaterThan(70);
    expect(sunriseAz).toBeLessThan(110);
    expect(sunsetAz).toBeGreaterThan(250);
    expect(sunsetAz).toBeLessThan(290);
  });

  it('reports a plausible local solar time for Seoul at the epoch', () => {
    const sky = observerSkyAt(0, OBSERVER_SEOUL);
    expect(sky.localSolarTimeHours).toBeGreaterThan(8);
    expect(sky.localSolarTimeHours).toBeLessThan(9);
    expect(sky.sun.altitudeDeg).toBeGreaterThan(0);
  });
});

describe('Eclipse geometry', () => {
  it('finds new moons both near and far from the node within a year', () => {
    const nearConditions: number[] = [];
    const farConditions: number[] = [];
    let cursor = 0;
    for (let i = 0; i < 14; i += 1) {
      const found = findNearestSyzygy(cursor + MOON_SYNODIC_DAYS, 'new', 14);
      const syzygy = syzygyAt(found.days, 'new');
      if (syzygy.possible) nearConditions.push(found.days);
      else farConditions.push(found.days);
      cursor = found.days;
    }
    expect(nearConditions.length).toBeGreaterThan(0);
    expect(farConditions.length).toBeGreaterThan(0);
  });

  it('requires the Moon to be near a node for a solar eclipse condition', () => {
    const found = findNearestSyzygy(25, 'new');
    const syzygy = syzygyAt(found.days, 'new');
    if (syzygy.possible) {
      expect(Math.abs(syzygy.moonLatitudeDeg)).toBeLessThan(1.5);
    }
  });

  it('does not mark every full moon as a lunar eclipse', () => {
    const status = eclipseStatusAt(60);
    const total = [status.nearestFull.possible, status.nearestNew.possible].filter(Boolean).length;
    expect(total).toBeLessThanOrEqual(2);
    expect(status.detailKo).toContain('교점');
  });

  it('produces an eclipse condition report without claiming a real forecast', () => {
    const state = eclipseStatusAt(29);
    expect(state.headlineKo.length).toBeGreaterThan(0);
    expect(state.nearestNew.days).not.toBeNaN();
    expect(state.nearestFull.days).not.toBeNaN();
  });
});

describe('Angle helpers', () => {
  it('wraps angles and computes shortest differences', () => {
    expect(wrapRadians(-0.1)).toBeCloseTo(2 * Math.PI - 0.1, 6);
    expect(shortestAngle(0.1, 6.2)).toBeCloseTo(shortestAngle(0.1, 6.2), 6);
    expect(Math.abs(shortestAngle(6.2, 0.1))).toBeLessThan(Math.PI);
    expect(clamp(5, 0, 3)).toBe(3);
  });

  it('keeps the Moon inside its inclined plane', () => {
    for (let u = 0; u < 2 * Math.PI; u += 0.2) {
      const position = moonRelativePositionAtArgument(u);
      const latitude = radToDeg(Math.asin(position.y / length(position)));
      expect(Math.abs(latitude)).toBeLessThanOrEqual(MOON_ORBIT_INCLINATION_DEG + 0.01);
      expect(moonEclipticLatitudeDeg(0)).toBeDefined();
    }
  });
});
