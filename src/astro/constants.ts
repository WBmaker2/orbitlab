/**
 * OrbitLab astronomy constants.
 *
 * Sources: NASA Solar System Exploration, NASA Moon phases, NOAA seasons.
 * All values are real-world values. The renderer deliberately applies a separate
 * "visual scale" (see render/scale.ts) so the three bodies can share one screen.
 */

export const AU_KM = 149_597_870.7;
export const EARTH_RADIUS_KM = 6_371.0;
export const SUN_RADIUS_KM = 696_340;
export const MOON_RADIUS_KM = 1_737.4;
export const EARTH_MOON_DISTANCE_KM = 384_400;

export const EARTH_YEAR_DAYS = 365.2422;
export const EARTH_ROTATION_HOURS = 23.9345;
export const MOON_SIDEREAL_DAYS = 27.3217;
export const MOON_SYNODIC_DAYS = 29.5306;

export const EARTH_AXIAL_TILT_DEG = 23.44;
export const MOON_ORBIT_INCLINATION_DEG = 5.14;

/**
 * Real nodes regress with an 18.6-year period. The MVP keeps the node line
 * fixed, which is stated in the UI. This value is kept for the scale/facts panel.
 */
export const MOON_NODE_REGRESSION_YEARS = 18.6;

/** Fixed simulation epoch: 2026 March equinox, 00:00 UTC. */
export const EPOCH_UTC_MS = Date.UTC(2026, 2, 20, 0, 0, 0);

/** How far the timeline may travel from the epoch. */
export const MIN_SIM_DAYS = -730;
export const MAX_SIM_DAYS = 1095;

/**
 * Fixed line of nodes used by the concept model. 205° was chosen so that the
 * epoch's own new moon misses the node, while the following new moon (about a
 * month later) falls into an eclipse season. It is NOT real ephemeris data.
 */
export const MOON_NODE_LONGITUDE_DEG = 205;

/**
 * Initial argument of latitude. With the fixed node above this places the Moon
 * about 5° past new at the epoch (a thin waxing crescent), close to the real
 * 2026-03-20 moon. The exact value is solved from the node longitude.
 */
export const MOON_INITIAL_ARGUMENT_DEG = -20.08;

/** Observing site used by the Earth-observer view (Seoul). */
export const OBSERVER_SEOUL = {
  nameKo: '서울',
  latitudeDeg: 37.5665,
  longitudeDeg: 126.978,
} as const;

/**
 * Concept-model eclipse limits. Real solar/lunar eclipse limits depend on the
 * exact distances of the bodies; these simple thresholds are for teaching only.
 */
export const SOLAR_ECLIPSE_LATITUDE_LIMIT_DEG = 1.5;
export const LUNAR_ECLIPSE_LATITUDE_LIMIT_DEG = 1.0;

/** The model's eight phase bins use ±22.5° around each cardinal phase. */
export const PHASE_BIN_DEG = 22.5;

export type SpeedPresetId = 'hour' | 'day' | 'week' | 'month';

export interface SpeedPreset {
  id: SpeedPresetId;
  labelKo: string;
  shortKo: string;
  daysPerSecond: number;
}

export const SPEED_PRESETS: readonly SpeedPreset[] = [
  { id: 'hour', labelKo: '1시간 / 초', shortKo: '1시간', daysPerSecond: 1 / 24 },
  { id: 'day', labelKo: '1일 / 초', shortKo: '1일', daysPerSecond: 1 },
  { id: 'week', labelKo: '1주 / 초', shortKo: '1주', daysPerSecond: 7 },
  { id: 'month', labelKo: '1개월 / 초', shortKo: '1개월', daysPerSecond: 30 },
] as const;

export const DEFAULT_SPEED_ID: SpeedPresetId = 'day';

export function speedPresetById(id: SpeedPresetId): SpeedPreset {
  return SPEED_PRESETS.find((preset) => preset.id === id) ?? SPEED_PRESETS[1];
}

/**
 * Calendar season boundaries used by the labels. These are approximate UTC
 * dates (within ±2 days of the real equinoxes/solstices) and are independent
 * of the mathematical orbital angle, which stays circular and uniform.
 */
export const SEASON_BOUNDARIES = {
  springMonth: 2, // March (0-based)
  springDay: 20,
  summerMonth: 5, // June
  summerDay: 21,
  autumnMonth: 8, // September
  autumnDay: 23,
  winterMonth: 11, // December
  winterDay: 21,
} as const;

export interface ScaleFact {
  labelKo: string;
  valueKo: string;
  noteKo?: string;
}

export const SCALE_FACTS: readonly ScaleFact[] = [
  {
    labelKo: '태양–지구 평균 거리',
    valueKo: '1 AU = 약 1억 4,960만 km',
    noteKo: '빛이 약 8분 20초 걸리는 거리',
  },
  {
    labelKo: '지구–달 평균 거리',
    valueKo: '약 384,400 km',
    noteKo: '지구 지름의 약 30배',
  },
  {
    labelKo: '태양 지름',
    valueKo: '약 139만 km',
    noteKo: '지구 지름의 약 109배',
  },
  {
    labelKo: '지구 지름',
    valueKo: '약 12,742 km',
  },
  {
    labelKo: '달 지름',
    valueKo: '약 3,475 km',
    noteKo: '지구 지름의 약 0.27배',
  },
  {
    labelKo: '지구 자전축 기울기',
    valueKo: '23.44°',
    noteKo: '계절의 원인',
  },
  {
    labelKo: '달 공전면 기울기',
    valueKo: '5.14°',
    noteKo: '매달 식 현상이 일어나지 않는 이유',
  },
];
