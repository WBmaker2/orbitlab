import rawMissions from '../../data/missions.json';
import rawFacts from '../../data/facts.json';
import type { LayersState, ViewMode } from '../../app/state';
import type { CameraPreset } from '../../render/CameraRig';
import type { FactBody } from '../../app/state';

export type MissionConcept = 'seasons' | 'phases' | 'eclipses' | 'scale' | 'rotation';
export type MissionDifficulty = 1 | 2 | 3;

export interface MissionSetup {
  days: number;
  view: ViewMode;
  camera: CameraPreset;
  layers?: Partial<LayersState>;
}

export interface Mission {
  id: string;
  titleKo: string;
  concept: MissionConcept;
  promptKo: string;
  setup: MissionSetup;
  options: string[];
  answer: string;
  observeKo: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: MissionDifficulty;
}

export interface FactEntry {
  titleKo: string;
  textKo: string;
}

const VALID_CAMERAS: CameraPreset[] = ['system', 'earth', 'top', 'side', 'moon'];
const VALID_CONCEPTS: MissionConcept[] = ['seasons', 'phases', 'eclipses', 'scale', 'rotation'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMission(value: unknown): value is Mission {
  if (!isRecord(value)) return false;
  const options = value.options;
  const setup = value.setup;
  return (
    typeof value.id === 'string' &&
    typeof value.titleKo === 'string' &&
    typeof value.promptKo === 'string' &&
    typeof value.answer === 'string' &&
    typeof value.observeKo === 'string' &&
    typeof value.explanationKo === 'string' &&
    typeof value.takeawayKo === 'string' &&
    typeof value.difficulty === 'number' &&
    VALID_CONCEPTS.includes(value.concept as MissionConcept) &&
    Array.isArray(options) &&
    options.length >= 2 &&
    options.every((option) => typeof option === 'string') &&
    options.includes(value.answer) &&
    isRecord(setup) &&
    typeof setup.days === 'number' &&
    (setup.view === 'space' || setup.view === 'earth') &&
    VALID_CAMERAS.includes(setup.camera as CameraPreset)
  );
}

const rawList: unknown[] = Array.isArray(rawMissions.missions) ? rawMissions.missions : [];
export const MISSIONS: readonly Mission[] = rawList.filter(validateMission);

if (MISSIONS.length !== rawList.length) {
  console.error('OrbitLab: some mission data entries were invalid and were skipped.');
}

export function missionById(id: string | null | undefined): Mission | undefined {
  if (!id) return undefined;
  return MISSIONS.find((mission) => mission.id === id);
}

export function missionIndex(id: string | null | undefined): number {
  if (!id) return -1;
  return MISSIONS.findIndex((mission) => mission.id === id);
}

export function nextMission(id: string | null | undefined): Mission | undefined {
  const index = missionIndex(id);
  if (index < 0) return MISSIONS[0];
  return MISSIONS[index + 1];
}

export function firstIncompleteMission(completed: readonly string[]): Mission | undefined {
  return MISSIONS.find((mission) => !completed.includes(mission.id)) ?? MISSIONS[0];
}

export const CONCEPT_LABEL_KO: Record<MissionConcept, string> = {
  seasons: '계절',
  phases: '달의 위상',
  eclipses: '식 현상',
  scale: '축척',
  rotation: '자전',
};

export const CONCEPT_COLOR: Record<MissionConcept, string> = {
  seasons: 'var(--season-spring)',
  phases: 'var(--phase-color)',
  eclipses: 'var(--eclipse-color)',
  scale: 'var(--scale-color)',
  rotation: 'var(--rotation-color)',
};

export const DIFFICULTY_LABEL_KO: Record<MissionDifficulty, string> = {
  1: '기초',
  2: '탐구',
  3: '도전',
};

const facts = rawFacts as Record<string, FactEntry>;

export const FACTS: Record<FactBody, FactEntry> = {
  sun: facts.sun ?? { titleKo: '태양', textKo: '태양은 태양계의 중심별입니다.' },
  earth: facts.earth ?? { titleKo: '지구', textKo: '지구는 자전축이 기울어진 채 태양을 공전합니다.' },
  moon: facts.moon ?? { titleKo: '달', textKo: '달은 지구 주위를 공전합니다.' },
};
