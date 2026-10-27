import type { SpeedPresetId } from '../astro/constants';
import { clampSimDays } from '../astro/time';
import type { LayersState, MissionPhase, ViewMode } from '../app/state';

export const STORAGE_KEY = 'orbitlab.progress.v1';

export interface StoredProgressV1 {
  version: 1;
  answers: Record<string, string>;
  completed: string[];
  lastDays: number;
  view: ViewMode;
  speedId: SpeedPresetId;
  currentMissionId: string | null;
  missionPhase: MissionPhase;
  layers: LayersState;
  reducedMotion: boolean;
}

export interface ProgressSnapshot {
  answers: Record<string, string>;
  completed: string[];
  lastDays: number;
  view: ViewMode;
  speedId: SpeedPresetId;
  currentMissionId: string | null;
  missionPhase: MissionPhase;
  layers: LayersState;
  reducedMotion: boolean;
}

const VALID_SPEEDS: SpeedPresetId[] = ['hour', 'day', 'week', 'month'];
const VALID_PHASES: MissionPhase[] = ['predict', 'observe', 'result'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function loadProgress(): StoredProgressV1 | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;

    const answers: Record<string, string> = {};
    if (isRecord(parsed.answers)) {
      for (const [key, value] of Object.entries(parsed.answers)) {
        if (typeof value === 'string') answers[key] = value;
      }
    }

    const layersRaw = isRecord(parsed.layers) ? parsed.layers : {};
    const speedId =
      typeof parsed.speedId === 'string' && VALID_SPEEDS.includes(parsed.speedId as SpeedPresetId)
        ? (parsed.speedId as SpeedPresetId)
        : 'day';
    const missionPhase =
      typeof parsed.missionPhase === 'string' &&
      VALID_PHASES.includes(parsed.missionPhase as MissionPhase)
        ? (parsed.missionPhase as MissionPhase)
        : 'predict';

    return {
      version: 1,
      answers,
      completed: readStringArray(parsed.completed),
      lastDays: typeof parsed.lastDays === 'number' ? clampSimDays(parsed.lastDays) : 0,
      view: parsed.view === 'earth' ? 'earth' : 'space',
      speedId,
      currentMissionId:
        typeof parsed.currentMissionId === 'string' ? parsed.currentMissionId : null,
      missionPhase,
      layers: {
        orbits: readBoolean(layersRaw.orbits, true),
        labels: readBoolean(layersRaw.labels, true),
        terminator: readBoolean(layersRaw.terminator, true),
        nodes: readBoolean(layersRaw.nodes, true),
        tiltAxis: readBoolean(layersRaw.tiltAxis, true),
      },
      reducedMotion: readBoolean(parsed.reducedMotion, false),
    };
  } catch {
    return null;
  }
}

export function saveProgress(snapshot: ProgressSnapshot): void {
  try {
    const data: StoredProgressV1 = {
      version: 1,
      answers: snapshot.answers,
      completed: snapshot.completed,
      lastDays: clampSimDays(snapshot.lastDays),
      view: snapshot.view,
      speedId: snapshot.speedId,
      currentMissionId: snapshot.currentMissionId,
      missionPhase: snapshot.missionPhase,
      layers: snapshot.layers,
      reducedMotion: snapshot.reducedMotion,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable in private mode; the app still works for the session.
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
