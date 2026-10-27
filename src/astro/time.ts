import {
  EPOCH_UTC_MS,
  MAX_SIM_DAYS,
  MIN_SIM_DAYS,
  SEASON_BOUNDARIES,
} from './constants';
import { clamp } from './geometry';

const MS_PER_DAY = 86_400_000;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = MS_PER_DAY;

export function daysToDate(days: number): Date {
  return new Date(EPOCH_UTC_MS + days * MS_PER_DAY);
}

export function dateToDays(date: Date): number {
  return (date.getTime() - EPOCH_UTC_MS) / MS_PER_DAY;
}

export function utcMsToDays(ms: number): number {
  return (ms - EPOCH_UTC_MS) / MS_PER_DAY;
}

export function clampSimDays(days: number): number {
  if (!Number.isFinite(days)) return 0;
  return clamp(days, MIN_SIM_DAYS, MAX_SIM_DAYS);
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDateKo(days: number): string {
  return dateFormatter.format(daysToDate(days));
}

export function formatDateShortKo(days: number): string {
  return shortDateFormatter.format(daysToDate(days));
}

export function formatTimeKo(days: number): string {
  return timeFormatter.format(daysToDate(days));
}

export function formatDateTimeKo(days: number): string {
  return `${formatDateKo(days)} ${formatTimeKo(days)} UTC`;
}

export function formatTimeUtcHhMm(days: number): string {
  return formatTimeKo(days);
}

export function formatSignedDays(days: number): string {
  const rounded = Math.abs(days) < 0.005 ? 0 : days;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(1)}일`;
}

export function normalizeHours(hours: number): number {
  const wrapped = hours % 24;
  return wrapped < 0 ? wrapped + 24 : wrapped;
}

export function formatHoursKo(hours: number): string {
  const normalized = normalizeHours(hours);
  let h = Math.floor(normalized);
  let m = Math.round((normalized - h) * 60);
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface SeasonBoundaryDate {
  kind: 'spring' | 'summer' | 'autumn' | 'winter';
  labelKo: string;
  ms: number;
  days: number;
}

export function seasonBoundariesForYear(year: number): SeasonBoundaryDate[] {
  const b = SEASON_BOUNDARIES;
  return [
    {
      kind: 'spring',
      labelKo: '춘분',
      ms: Date.UTC(year, b.springMonth, b.springDay),
      days: utcMsToDays(Date.UTC(year, b.springMonth, b.springDay)),
    },
    {
      kind: 'summer',
      labelKo: '하지',
      ms: Date.UTC(year, b.summerMonth, b.summerDay),
      days: utcMsToDays(Date.UTC(year, b.summerMonth, b.summerDay)),
    },
    {
      kind: 'autumn',
      labelKo: '추분',
      ms: Date.UTC(year, b.autumnMonth, b.autumnDay),
      days: utcMsToDays(Date.UTC(year, b.autumnMonth, b.autumnDay)),
    },
    {
      kind: 'winter',
      labelKo: '동지',
      ms: Date.UTC(year, b.winterMonth, b.winterDay),
      days: utcMsToDays(Date.UTC(year, b.winterMonth, b.winterDay)),
    },
  ];
}

export function seasonMarkersBetween(minDays: number, maxDays: number): SeasonBoundaryDate[] {
  const startYear = daysToDate(minDays).getUTCFullYear();
  const endYear = daysToDate(maxDays).getUTCFullYear();
  const markers: SeasonBoundaryDate[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (const marker of seasonBoundariesForYear(year)) {
      if (marker.days >= minDays && marker.days <= maxDays) markers.push(marker);
    }
  }
  return markers;
}

export function dayFraction(days: number): number {
  const date = daysToDate(days);
  const msIntoDay =
    date.getUTCHours() * HOUR_MS +
    date.getUTCMinutes() * MINUTE_MS +
    date.getUTCSeconds() * 1000 +
    date.getUTCMilliseconds();
  return msIntoDay / DAY_MS;
}
