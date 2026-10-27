import type { CameraFocus, CameraPreset } from '../render/CameraRig';
import type { SpeedPresetId } from '../astro/constants';

export type Route = 'explore' | 'missions' | 'teacher';
export type ViewMode = 'space' | 'earth';
export type MissionPhase = 'predict' | 'observe' | 'result';
export type FactBody = 'sun' | 'earth' | 'moon';

export interface LayersState {
  orbits: boolean;
  labels: boolean;
  terminator: boolean;
  nodes: boolean;
  tiltAxis: boolean;
}

export interface MissionState {
  currentId: string | null;
  phase: MissionPhase;
  selectedOption: string | null;
  answers: Record<string, string>;
  completed: string[];
  lastCorrect: boolean | null;
}

export interface PreferencesState {
  reducedMotion: boolean;
  /** Reserved for the true-scale extension; the MVP renders visual scale only. */
  scaleMode: 'visual';
}

export interface FactCardState {
  body: FactBody;
  titleKo: string;
  textKo: string;
}

export interface AppState {
  route: Route;
  time: {
    days: number;
    playing: boolean;
    speedId: SpeedPresetId;
  };
  view: ViewMode;
  cameraPreset: CameraPreset;
  focus: CameraFocus;
  layers: LayersState;
  mission: MissionState;
  preferences: PreferencesState;
  factCard: FactCardState | null;
}

export interface InitialStateOptions {
  labels?: boolean;
  reducedMotion?: boolean;
}

export function createInitialState(options: InitialStateOptions = {}): AppState {
  return {
    route: 'explore',
    time: {
      days: 0,
      playing: false,
      speedId: 'day',
    },
    view: 'space',
    cameraPreset: 'system',
    focus: 'sun',
    layers: {
      orbits: true,
      labels: options.labels ?? true,
      terminator: true,
      nodes: true,
      tiltAxis: true,
    },
    mission: {
      currentId: null,
      phase: 'predict',
      selectedOption: null,
      answers: {},
      completed: [],
      lastCorrect: null,
    },
    preferences: {
      reducedMotion: options.reducedMotion ?? false,
      scaleMode: 'visual',
    },
    factCard: null,
  };
}

export function cameraFocusForPreset(preset: CameraPreset): CameraFocus {
  if (preset === 'system') return 'sun';
  if (preset === 'moon') return 'moon';
  return 'earth';
}

type StoreListener = () => void;

/**
 * A deliberately small synchronous store. Time ticks are applied silently so the
 * 3D scene can animate at 60fps without re-rendering every UI panel.
 */
export class Store {
  private readonly listeners = new Set<StoreListener>();

  constructor(public state: AppState) {}

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(mutator: (state: AppState) => void, silent = false): void {
    mutator(this.state);
    if (!silent) this.emit();
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
