import {
  MAX_SIM_DAYS,
  MIN_SIM_DAYS,
  OBSERVER_SEOUL,
  SCALE_FACTS,
  speedPresetById,
  type SpeedPresetId,
} from '../astro/constants';
import { eclipseStatusAt, type EclipseStatus } from '../astro/eclipses';
import {
  azimuthCompassKo,
  formatAltitude,
  formatAzimuth,
  observerSkyAt,
  type ObserverSky,
} from '../astro/observer';
import { moonPhaseAt, type MoonPhase } from '../astro/phases';
import { seasonInfoForDays, type SeasonInfo } from '../astro/seasons';
import { subSolarPoint } from '../astro/orbits';
import {
  clampSimDays,
  daysToDate,
  formatDateKo,
  formatDateShortKo,
  formatHoursKo,
  formatTimeKo,
  seasonBoundariesForYear,
} from '../astro/time';
import type { CameraFocus, CameraPreset } from '../render/CameraRig';
import { SceneManager } from '../render/SceneManager';
import { SkyView } from '../ui/SkyView';
import { drawMoonPhaseIcon } from '../ui/moonIcon';
import {
  FACTS,
  MISSIONS,
  firstIncompleteMission,
  missionById,
  nextMission,
} from '../features/missions/missions';
import { MissionPanel } from '../features/missions/MissionPanel';
import { Timeline } from '../features/timeline/Timeline';
import { Teacher } from '../features/teacher/Teacher';
import { loadProgress, saveProgress, type StoredProgressV1 } from '../storage/progress';
import {
  Store,
  cameraFocusForPreset,
  createInitialState,
  type AppState,
  type FactBody,
  type LayersState,
  type Route,
  type ViewMode,
} from './state';
import { parseRoute, routeHash } from './routes';

interface AppElements {
  exploreScreen: HTMLElement;
  teacherScreen: HTMLElement;
  viewport: HTMLElement;
  sceneStatus: HTMLElement;
  topDate: HTMLElement;
  topTime: HTMLElement;
  topSeason: HTMLElement;
  topPhase: HTMLElement;
  topPhaseCanvas: HTMLCanvasElement;
  topEclipse: HTMLElement;
  scaleBadge: HTMLElement;
  hud: HTMLElement;
  hudTabs: HTMLElement;
  slotInfo: HTMLElement;
  slotLayers: HTMLElement;
  slotTime: HTMLElement;
  slotMission: HTMLElement;
  missionTab: HTMLButtonElement;
  statusDate: HTMLElement;
  statusTime: HTMLElement;
  statusSeason: HTMLElement;
  statusSeasonSouth: HTMLElement;
  statusSeasonItem: HTMLElement;
  statusPhase: HTMLElement;
  statusIllum: HTMLElement;
  statusPhaseCanvas: HTMLCanvasElement;
  statusSubsolar: HTMLElement;
  statusEclipse: HTMLElement;
  statusEclipseDetail: HTMLElement;
  diagramText: HTMLElement;
  factCard: HTMLElement;
  factEyebrow: HTMLElement;
  factTitle: HTMLElement;
  factText: HTMLElement;
  factClose: HTMLButtonElement;
  observerView: HTMLElement;
  observerBack: HTMLButtonElement;
  observerDate: HTMLElement;
  observerSolarTime: HTMLElement;
  observerSun: HTMLElement;
  observerMoon: HTMLElement;
  observerPhase: HTMLElement;
  observerEclipse: HTMLElement;
  observerText: HTMLElement;
  skyCanvas: HTMLCanvasElement;
  skyInset: HTMLCanvasElement;
  observerTimeline: HTMLElement;
  helpDialog: HTMLDialogElement;
  helpButton: HTMLButtonElement;
  helpReduced: HTMLInputElement;
  helpLabels: HTMLInputElement;
  reducedMotionInput: HTMLInputElement;
  toast: HTMLElement;
  srLive: HTMLElement;
  navLinks: NodeListOf<HTMLAnchorElement>;
  viewButtons: NodeListOf<HTMLButtonElement>;
  cameraButtons: NodeListOf<HTMLButtonElement>;
  layerInputs: NodeListOf<HTMLInputElement>;
  hudTabButtons: NodeListOf<HTMLButtonElement>;
  hudSlots: NodeListOf<HTMLElement>;
}

type TabId = 'time' | 'layers' | 'info' | 'mission';

export class App {
  private readonly store: Store;
  private readonly scene: SceneManager;
  private readonly mainTimeline: Timeline;
  private readonly observerTimeline: Timeline;
  private readonly missionPanel: MissionPanel;
  private readonly teacher: Teacher;
  private readonly skyView: SkyView;
  private readonly el: AppElements;
  private readonly clock = { lastFrame: performance.now() };
  private activeTab: TabId = 'time';
  private lastRoute: Route | null = null;
  private lastCamera: { preset: CameraPreset; focus: CameraFocus } | null = null;
  private lastReducedMotion: boolean | null = null;
  private lastSky: ObserverSky | null = null;
  private eclipseCache: { status: EclipseStatus; days: number; at: number } | null = null;
  private uiAccumulator = 0;
  private saveAccumulator = 0;
  private persistTimer: number | null = null;
  private raf = 0;
  private toastTimer: number | null = null;

  constructor(root: HTMLElement) {
    const progress = loadProgress();
    const initialState = this.createInitialState(progress);
    this.store = new Store(initialState);
    this.activeTab = initialState.route === 'missions' ? 'mission' : 'time';

    root.innerHTML = this.template();
    this.el = this.cacheElements(root);
    this.scene = new SceneManager(this.el.viewport, {
      onBodyClick: (body) => this.showFact(body),
    });
    this.mainTimeline = new Timeline(this.el.slotTime, this.timelineCallbacks());
    this.observerTimeline = new Timeline(this.el.observerTimeline, this.timelineCallbacks(), {
      compact: true,
    });
    this.missionPanel = new MissionPanel(this.el.slotMission, {
      onSelectMission: (id) => this.selectMission(id),
      onSelectOption: (option) => this.selectOption(option),
      onSubmitPrediction: () => this.submitPrediction(),
      onRevealAnswer: () => this.revealAnswer(),
      onNextMission: () => this.nextMissionAction(),
      onRetry: () => this.retryMission(),
      onOpenExplore: () => this.openExplore(),
    });
    this.teacher = new Teacher(this.el.teacherScreen, {
      onResetProgress: () => this.resetProgress(),
      onPreviewMission: (id) => this.previewMission(id),
      onSetLayer: (key, value) => this.setLayer(key, value),
      onSetReducedMotion: (value) => this.setReducedMotion(value),
    });
    this.skyView = new SkyView(this.el.skyCanvas, this.el.skyInset);

    this.bindEvents();
    this.store.subscribe(() => this.onStoreChanged());
    this.applyState(true);
    this.setActiveTab(this.activeTab);
    this.updateUi(true);
    this.setupKeyboard();
    this.setupVisibility();

    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pagehide', this.persist);
    this.el.helpDialog.addEventListener('close', () => {
      this.el.helpButton.setAttribute('aria-expanded', 'false');
    });

    if (!window.location.hash) {
      history.replaceState(null, '', routeHash(initialState.route));
    }

    this.startLoop();
    requestAnimationFrame(() => {
      document.getElementById('boot')?.remove();
    });
  }

  private createInitialState(progress: StoredProgressV1 | null): AppState {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = createInitialState({
      labels: !isMobile,
      reducedMotion: progress?.reducedMotion ?? prefersReduced,
    });

    const validIds = new Set(MISSIONS.map((mission) => mission.id));
    if (progress) {
      base.time.days = clampSimDays(progress.lastDays);
      base.time.speedId = progress.speedId;
      base.view = progress.view;
      base.layers = { ...base.layers, ...progress.layers };
      base.preferences.reducedMotion = progress.reducedMotion;
      for (const [id, answer] of Object.entries(progress.answers)) {
        const mission = missionById(id);
        if (mission && mission.options.includes(answer)) base.mission.answers[id] = answer;
      }
      base.mission.completed = progress.completed.filter((id) => validIds.has(id));
    }

    base.route = parseRoute(window.location.hash);
    base.mission.currentId =
      progress?.currentMissionId && validIds.has(progress.currentMissionId)
        ? progress.currentMissionId
        : (firstIncompleteMission(base.mission.completed)?.id ?? MISSIONS[0]?.id ?? null);
    base.mission.phase = 'predict';
    base.mission.selectedOption = null;
    base.mission.lastCorrect = null;
    base.cameraPreset = 'system';
    base.focus = 'sun';
    base.time.playing = false;
    base.factCard = null;
    if (base.route !== 'explore') base.view = 'space';
    return base;
  }

  private template(): string {
    const shortcuts: Array<[string, string]> = [
      ['Space', '재생 / 일시정지'],
      ['← / →', '1일씩 이동'],
      ['Shift + ← / →', '1주씩 이동'],
      ['1 / 2', '우주 뷰 / 지구 관측자 뷰'],
      ['L', '3D 라벨 켜기 / 끄기'],
      ['Esc', '관측자 뷰 닫기 · 카드 닫기'],
    ];
    const shortcutRows = shortcuts
      .map(
        ([keys, label]) =>
          `<div class="shortcut-row"><kbd>${keys}</kbd><span>${label}</span></div>`,
      )
      .join('');
    const scaleRows = SCALE_FACTS.map(
      (fact) =>
        `<div class="fact-row"><dt>${fact.labelKo}</dt><dd>${fact.valueKo}${
          fact.noteKo ? `<span>${fact.noteKo}</span>` : ''
        }</dd></div>`,
    ).join('');

    const switchRow = (label: string, attrs: string, checked = false) => `
      <label class="toggle-row">
        <span class="toggle-label">${label}</span>
        <span class="switch-control">
          <input type="checkbox" ${attrs} ${checked ? 'checked' : ''} />
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
        </span>
      </label>
    `;

    return `
      <a class="skip-link" href="#main">본문으로 건너뛰기</a>
      <header id="topbar" class="topbar">
        <a class="brand" href="#/explore">
          <span class="brand-mark" aria-hidden="true"><span class="brand-ring"></span><span class="brand-sun"></span><span class="brand-moon"></span></span>
          <span class="brand-copy"><strong>OrbitLab</strong><span>지구·달·태양 탐구실</span></span>
        </a>
        <nav class="main-nav" aria-label="화면 이동">
          <a href="#/explore" data-route="explore">탐구</a>
          <a href="#/missions" data-route="missions">미션</a>
          <a href="#/teacher" data-route="teacher">교사</a>
        </nav>
        <div class="topbar-actions">
          <span class="model-pill">개념 모형</span>
          <button type="button" id="help-button" class="icon-button" aria-label="도움말과 설정" aria-haspopup="dialog" aria-expanded="false" aria-controls="help-dialog">?</button>
        </div>
      </header>

      <main id="main" tabindex="-1">
        <section id="explore-screen" class="screen explore-screen route-explore" aria-label="탐구 화면">
          <div id="viewport" class="viewport" role="region" aria-label="3D 태양·지구·달 시뮬레이션. 행성을 클릭하면 정보 카드가 열립니다."></div>

          <div id="scene-status" class="scene-status glass" aria-label="현재 장면 요약">
            <div class="scene-status-date"><strong data-ref="top-date"></strong><span data-ref="top-time"></span></div>
            <span class="scene-chip scene-chip-season" data-ref="top-season"></span>
            <span class="scene-chip scene-chip-phase"><canvas data-ref="top-phase-canvas" width="22" height="22" aria-hidden="true"></canvas><span data-ref="top-phase"></span></span>
            <span class="scene-chip scene-chip-eclipse" data-ref="top-eclipse"></span>
          </div>

          <div id="scale-badge" class="scale-badge" role="note">
            <span class="scale-badge-dot" aria-hidden="true"></span>
            <span>개념 모형 · 실제 축척 아님</span>
          </div>

          <div id="hud" class="hud">
            <div id="hud-tabs" class="hud-tabs" role="tablist" aria-label="모바일 패널">
              <button type="button" role="tab" id="tab-time" data-tab="time" aria-controls="slot-time" aria-selected="true">시간</button>
              <button type="button" role="tab" id="tab-layers" data-tab="layers" aria-controls="slot-layers" aria-selected="false" tabindex="-1">레이어</button>
              <button type="button" role="tab" id="tab-info" data-tab="info" aria-controls="slot-info" aria-selected="false" tabindex="-1">설명</button>
              <button type="button" role="tab" id="tab-mission" data-tab="mission" aria-controls="slot-mission" aria-selected="false" tabindex="-1" hidden>미션</button>
            </div>

            <div id="slot-info" class="hud-slot hud-slot-info" data-tab="info" role="tabpanel" aria-labelledby="tab-info">
              <aside class="panel status-panel glass" aria-label="현재 장면 설명">
                <div class="panel-head">
                  <div>
                    <p class="eyebrow">지금 장면</p>
                    <h2 class="panel-title" data-ref="status-date"></h2>
                    <p class="panel-sub" data-ref="status-time"></p>
                  </div>
                  <span class="panel-live-dot" title="실시간 모형 시간" aria-hidden="true"></span>
                </div>
                <div class="status-grid">
                  <div class="status-item status-season season-spring" data-ref="status-season-item">
                    <span class="status-label">계절</span>
                    <p class="status-value" data-ref="status-season"></p>
                    <p class="status-sub" data-ref="status-season-south"></p>
                  </div>
                  <div class="status-item">
                    <span class="status-label">달의 위상</span>
                    <div class="phase-line">
                      <canvas data-ref="status-phase-canvas" width="34" height="34" aria-hidden="true"></canvas>
                      <div><p class="status-value" data-ref="status-phase"></p><p class="status-sub" data-ref="status-illum"></p></div>
                    </div>
                  </div>
                  <div class="status-item">
                    <span class="status-label">태양 직하점</span>
                    <p class="status-value" data-ref="status-subsolar"></p>
                    <p class="status-sub">태양이 바로 위에 있는 지점의 위도</p>
                  </div>
                  <div class="status-item">
                    <span class="status-label">식 현상 조건</span>
                    <p class="status-value" data-ref="status-eclipse"></p>
                    <p class="status-sub" data-ref="status-eclipse-detail"></p>
                  </div>
                </div>
                <div class="diagram-card">
                  <h3>그림 읽기</h3>
                  <p data-ref="diagram-text"></p>
                </div>
                <p class="panel-footnote">공전 궤도는 원형, 교점은 고정, 크기·거리는 실제 축척이 아닙니다. 이 모형은 실제 일식·월식 예보가 아닙니다.</p>
              </aside>
            </div>

            <div id="slot-layers" class="hud-slot hud-slot-layers" data-tab="layers" role="tabpanel" aria-labelledby="tab-layers">
              <aside class="panel control-panel glass" aria-label="보기와 레이어">
                <div class="panel-head">
                  <p class="eyebrow">보기 설정</p>
                  <h2 class="panel-title">탐구 도구</h2>
                </div>
                <section class="control-group">
                  <h3 class="control-label">화면 모드</h3>
                  <div class="segmented" role="group" aria-label="화면 모드">
                    <button type="button" data-view="space" aria-pressed="true">우주 뷰</button>
                    <button type="button" data-view="earth" aria-pressed="false">지구 관측자 뷰</button>
                  </div>
                </section>
                <section class="control-group">
                  <h3 class="control-label">카메라</h3>
                  <div class="camera-grid" role="group" aria-label="카메라 시점">
                    <button type="button" data-camera="system" aria-pressed="true">전체</button>
                    <button type="button" data-camera="earth" aria-pressed="false">지구</button>
                    <button type="button" data-camera="top" aria-pressed="false">위에서</button>
                    <button type="button" data-camera="side" aria-pressed="false">옆에서</button>
                    <button type="button" data-camera="moon" aria-pressed="false">달</button>
                  </div>
                </section>
                <section class="control-group">
                  <h3 class="control-label">레이어</h3>
                  ${switchRow('공전 궤도', 'data-layer="orbits"', true)}
                  ${switchRow('3D 라벨', 'data-layer="labels"', true)}
                  ${switchRow('낮 / 밤 경계', 'data-layer="terminator"', true)}
                  ${switchRow('교점선', 'data-layer="nodes"', true)}
                  ${switchRow('자전축', 'data-layer="tiltAxis"', true)}
                </section>
                <details class="facts-panel">
                  <summary>실제 수치 · 모형 안내</summary>
                  <dl class="scale-facts">${scaleRows}</dl>
                  <p class="model-note">이 모형은 세 천체를 한눈에 보기 위해 크기와 거리를 압축했습니다. 실제 비율로 해석하지 마세요. 달의 교점도 실제처럼 이동하지 않고 고정해 두었습니다.</p>
                </details>
                <details class="shortcuts-panel">
                  <summary>키보드 단축키</summary>
                  <div class="shortcut-list">${shortcutRows}</div>
                </details>
                <section class="control-group">
                  <h3 class="control-label">접근성</h3>
                  ${switchRow('움직임 줄이기', 'data-pref="reducedMotion"')}
                </section>
              </aside>
            </div>

            <div id="slot-time" class="hud-slot hud-slot-time" data-tab="time" role="tabpanel" aria-labelledby="tab-time"></div>
            <div id="slot-mission" class="hud-slot hud-slot-mission" data-tab="mission" role="tabpanel" aria-labelledby="tab-mission"></div>
          </div>

          <aside id="fact-card" class="fact-card glass" aria-label="천체 정보" hidden>
            <button type="button" id="fact-close" class="fact-close" aria-label="정보 카드 닫기">×</button>
            <p class="eyebrow" data-ref="fact-eyebrow">천체 정보</p>
            <h2 data-ref="fact-title"></h2>
            <p data-ref="fact-text"></p>
          </aside>

          <div id="observer-view" class="observer-view" hidden aria-label="지구 관측자 뷰">
            <div class="observer-head">
              <button type="button" id="observer-back" class="btn btn-secondary btn-small">우주 뷰로 돌아가기</button>
              <div class="observer-place"><span class="observer-place-dot" aria-hidden="true"></span>서울 · ${OBSERVER_SEOUL.latitudeDeg.toFixed(1)}°N · ${OBSERVER_SEOUL.longitudeDeg.toFixed(1)}°E</div>
              <div class="observer-clock"><span data-ref="observer-date"></span><strong data-ref="observer-solar-time"></strong><span class="muted">지방 태양시</span></div>
              <span class="model-badge">개념 모형</span>
            </div>
            <div class="observer-stage">
              <canvas id="sky-canvas" role="img" aria-label="서울에서 본 하늘. 태양과 달의 고도와 방위를 표시합니다."></canvas>
              <div class="observer-inset glass">
                <canvas id="sky-inset" role="img" aria-label="태양·지구·달의 위에서 본 배치 모식도. 실제 축척이 아닙니다."></canvas>
                <span class="inset-label">위에서 본 배치 · 축척 아님</span>
              </div>
              <aside class="observer-info glass" aria-label="관측 정보">
                <div class="observer-info-grid">
                  <div class="info-row"><span>태양</span><strong data-ref="observer-sun"></strong></div>
                  <div class="info-row"><span>달</span><strong data-ref="observer-moon"></strong></div>
                  <div class="info-row"><span>달의 위상</span><strong data-ref="observer-phase"></strong></div>
                  <div class="info-row"><span>식 현상</span><strong data-ref="observer-eclipse"></strong></div>
                </div>
                <p class="observer-text" data-ref="observer-text"></p>
                <p class="observer-note">지방 태양시는 경도로 계산한 태양시입니다. 마커 크기는 실제 각크기와 다릅니다.</p>
              </aside>
            </div>
            <div class="observer-timeline" data-ref="observer-timeline"></div>
          </div>
        </section>

        <section id="teacher-screen" class="screen teacher-screen" aria-label="교사 모드" hidden></section>
      </main>

      <div id="toast" class="toast" role="status" aria-live="polite"></div>
      <div id="sr-live" class="sr-only" aria-live="polite"></div>

      <dialog id="help-dialog" class="dialog help-dialog" aria-labelledby="help-title">
        <form method="dialog" class="help-form">
          <div class="dialog-head">
            <p class="eyebrow">도움말</p>
            <h2 id="help-title">조작과 설정</h2>
          </div>
          <div class="help-grid">
            <section>
              <h3>키보드</h3>
              <div class="shortcut-list">${shortcutRows}</div>
            </section>
            <section>
              <h3>이 모형에 대하여</h3>
              <p>공전 궤도는 원형, 자전축 기울기는 23.44°, 달 궤도 기울기는 5.14°로 단순화했습니다. 교점은 고정되어 있으며 실제 일식·월식 예보가 아닙니다.</p>
              <p>화면의 크기와 거리는 실제 축척이 아닙니다. 오른쪽 '실제 수치'에서 실제 값을 확인할 수 있습니다.</p>
            </section>
          </div>
          <div class="help-settings">
            ${switchRow('움직임 줄이기', 'data-help-pref="reducedMotion"')}
            ${switchRow('3D 라벨 표시', 'data-help-layer="labels"')}
          </div>
          <div class="dialog-actions">
            <button type="submit" class="btn btn-primary" value="close">닫기</button>
          </div>
        </form>
      </dialog>
    `;
  }

  private cacheElements(root: HTMLElement): AppElements {
    const q = <T extends HTMLElement = HTMLElement>(selector: string): T => {
      const found = root.querySelector<T>(selector);
      if (!found) throw new Error(`OrbitLab: missing element ${selector}`);
      return found;
    };
    return {
      exploreScreen: q('#explore-screen'),
      teacherScreen: q('#teacher-screen'),
      viewport: q('#viewport'),
      sceneStatus: q('#scene-status'),
      topDate: q('[data-ref="top-date"]'),
      topTime: q('[data-ref="top-time"]'),
      topSeason: q('[data-ref="top-season"]'),
      topPhase: q('[data-ref="top-phase"]'),
      topPhaseCanvas: q<HTMLCanvasElement>('[data-ref="top-phase-canvas"]'),
      topEclipse: q('[data-ref="top-eclipse"]'),
      scaleBadge: q('#scale-badge'),
      hud: q('#hud'),
      hudTabs: q('#hud-tabs'),
      slotInfo: q('#slot-info'),
      slotLayers: q('#slot-layers'),
      slotTime: q('#slot-time'),
      slotMission: q('#slot-mission'),
      missionTab: q<HTMLButtonElement>('#tab-mission'),
      statusDate: q('[data-ref="status-date"]'),
      statusTime: q('[data-ref="status-time"]'),
      statusSeason: q('[data-ref="status-season"]'),
      statusSeasonSouth: q('[data-ref="status-season-south"]'),
      statusSeasonItem: q('[data-ref="status-season-item"]'),
      statusPhase: q('[data-ref="status-phase"]'),
      statusIllum: q('[data-ref="status-illum"]'),
      statusPhaseCanvas: q<HTMLCanvasElement>('[data-ref="status-phase-canvas"]'),
      statusSubsolar: q('[data-ref="status-subsolar"]'),
      statusEclipse: q('[data-ref="status-eclipse"]'),
      statusEclipseDetail: q('[data-ref="status-eclipse-detail"]'),
      diagramText: q('[data-ref="diagram-text"]'),
      factCard: q('#fact-card'),
      factEyebrow: q('[data-ref="fact-eyebrow"]'),
      factTitle: q('[data-ref="fact-title"]'),
      factText: q('[data-ref="fact-text"]'),
      factClose: q<HTMLButtonElement>('#fact-close'),
      observerView: q('#observer-view'),
      observerBack: q<HTMLButtonElement>('#observer-back'),
      observerDate: q('[data-ref="observer-date"]'),
      observerSolarTime: q('[data-ref="observer-solar-time"]'),
      observerSun: q('[data-ref="observer-sun"]'),
      observerMoon: q('[data-ref="observer-moon"]'),
      observerPhase: q('[data-ref="observer-phase"]'),
      observerEclipse: q('[data-ref="observer-eclipse"]'),
      observerText: q('[data-ref="observer-text"]'),
      skyCanvas: q<HTMLCanvasElement>('#sky-canvas'),
      skyInset: q<HTMLCanvasElement>('#sky-inset'),
      observerTimeline: q('[data-ref="observer-timeline"]'),
      helpDialog: q<HTMLDialogElement>('#help-dialog'),
      helpButton: q<HTMLButtonElement>('#help-button'),
      helpReduced: q<HTMLInputElement>('[data-help-pref="reducedMotion"]'),
      helpLabels: q<HTMLInputElement>('[data-help-layer="labels"]'),
      reducedMotionInput: q<HTMLInputElement>('[data-pref="reducedMotion"]'),
      toast: q('#toast'),
      srLive: q('#sr-live'),
      navLinks: root.querySelectorAll<HTMLAnchorElement>('a[data-route]'),
      viewButtons: root.querySelectorAll<HTMLButtonElement>('[data-view]'),
      cameraButtons: root.querySelectorAll<HTMLButtonElement>('[data-camera]'),
      layerInputs: root.querySelectorAll<HTMLInputElement>('[data-layer]'),
      hudTabButtons: root.querySelectorAll<HTMLButtonElement>('#hud-tabs button[data-tab]'),
      hudSlots: root.querySelectorAll<HTMLElement>('.hud-slot[data-tab]'),
    };
  }

  private timelineCallbacks() {
    return {
      onTogglePlay: () => this.togglePlay(),
      onScrub: (days: number) => this.setDays(days),
      onSpeedChange: (speedId: SpeedPresetId) => this.setSpeed(speedId),
      onJumpSeason: (kind: 'spring' | 'summer' | 'autumn' | 'winter') => this.jumpSeason(kind),
    };
  }

  private bindEvents(): void {
    this.el.helpButton.addEventListener('click', () => this.openHelp());
    this.el.factClose.addEventListener('click', () => this.closeFact());
    this.el.observerBack.addEventListener('click', () => this.setView('space'));

    this.el.viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view as ViewMode;
        this.setView(view);
      });
    });
    this.el.cameraButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const preset = button.dataset.camera as CameraPreset;
        this.setCameraPreset(preset);
      });
    });
    this.el.layerInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.layer as keyof LayersState;
        this.setLayer(key, input.checked);
      });
    });
    this.el.reducedMotionInput.addEventListener('change', () => {
      this.setReducedMotion(this.el.reducedMotionInput.checked);
    });
    this.el.helpReduced.addEventListener('change', () => {
      this.setReducedMotion(this.el.helpReduced.checked);
    });
    this.el.helpLabels.addEventListener('change', () => {
      this.setLayer('labels', this.el.helpLabels.checked);
    });

    this.el.hudTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab as TabId;
        this.setActiveTab(tab);
      });
    });
    this.el.hudTabs.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const visibleTabs = [...this.el.hudTabButtons].filter((button) => !button.hidden);
      const currentIndex = visibleTabs.findIndex((button) => button.dataset.tab === this.activeTab);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length;
      const nextTab = visibleTabs[nextIndex]?.dataset.tab as TabId | undefined;
      if (nextTab) {
        this.setActiveTab(nextTab);
        visibleTabs[nextIndex]?.focus();
      }
    });
  }

  private onHashChange = (): void => {
    const route = parseRoute(window.location.hash);
    if (route === this.store.state.route) return;
    this.applyRoute(route);
  };

  private applyRoute(route: Route): void {
    this.store.update((state) => {
      state.route = route;
      if (route !== 'explore' && state.view === 'earth') state.view = 'space';
      if (route === 'missions' && state.mission.phase === 'predict') state.time.playing = false;
      if (route === 'teacher') state.time.playing = false;
      if (route === 'missions' && !missionById(state.mission.currentId)) {
        const first = firstIncompleteMission(state.mission.completed);
        state.mission.currentId = first?.id ?? MISSIONS[0]?.id ?? null;
        state.mission.phase = 'predict';
        state.mission.selectedOption = null;
        state.mission.lastCorrect = null;
      }
    });
    this.setActiveTab(route === 'missions' ? 'mission' : 'time');
  }

  private onStoreChanged(): void {
    this.applyState();
    this.updateUi();
    this.schedulePersist();
  }

  private applyState(initial = false): void {
    const state = this.store.state;
    const routeChanged = this.lastRoute !== state.route;
    this.lastRoute = state.route;

    this.applyRouteUi(routeChanged);
    this.applyViewUi();
    this.applyCameraUi(initial);
    this.applyLayerUi();
    this.applyFactCard();
    this.missionPanel.update(state);
    this.teacher.update(state);
  }

  private applyRouteUi(routeChanged: boolean): void {
    const state = this.store.state;
    const isTeacher = state.route === 'teacher';
    this.el.exploreScreen.hidden = isTeacher;
    this.el.teacherScreen.hidden = !isTeacher;
    this.el.exploreScreen.classList.toggle('route-missions', state.route === 'missions');
    this.el.exploreScreen.classList.toggle('route-explore', state.route === 'explore');
    this.el.missionTab.hidden = state.route !== 'missions';
    for (const link of this.el.navLinks) {
      const isActive = link.dataset.route === state.route;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (routeChanged) {
      if (state.route === 'missions') this.setActiveTab('mission');
      else if (this.activeTab === 'mission') this.setActiveTab('time');
    }
    if (isTeacher) {
      this.scene.setActive(false);
      this.mainTimeline.update(state, null);
      return;
    }
  }

  private applyViewUi(): void {
    const state = this.store.state;
    const isObserver = state.view === 'earth' && state.route === 'explore';
    this.el.observerView.hidden = !isObserver;
    this.el.hud.hidden = isObserver || state.route === 'teacher';
    this.el.sceneStatus.hidden = isObserver || state.route === 'teacher';
    this.el.scaleBadge.hidden = isObserver || state.route === 'teacher';
    this.scene.setActive(state.route !== 'teacher' && !isObserver);
    this.el.exploreScreen.classList.toggle('is-observer', isObserver);
    for (const button of this.el.viewButtons) {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (!isObserver) this.lastSky = null;
  }

  private applyCameraUi(initial: boolean): void {
    const state = this.store.state;
    for (const button of this.el.cameraButtons) {
      const active = button.dataset.camera === state.cameraPreset;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (
      initial ||
      !this.lastCamera ||
      this.lastCamera.preset !== state.cameraPreset ||
      this.lastCamera.focus !== state.focus
    ) {
      this.scene.setCamera(state.cameraPreset, state.focus);
      this.lastCamera = { preset: state.cameraPreset, focus: state.focus };
    }
  }

  private applyLayerUi(): void {
    const state = this.store.state;
    for (const input of this.el.layerInputs) {
      const key = input.dataset.layer as keyof LayersState;
      input.checked = state.layers[key];
    }
    this.el.helpLabels.checked = state.layers.labels;
    this.el.reducedMotionInput.checked = state.preferences.reducedMotion;
    this.el.helpReduced.checked = state.preferences.reducedMotion;
    document.body.classList.toggle('reduce-motion', state.preferences.reducedMotion);
    if (this.lastReducedMotion !== state.preferences.reducedMotion) {
      this.lastReducedMotion = state.preferences.reducedMotion;
      this.scene.setReducedMotion(state.preferences.reducedMotion);
    }
  }

  private applyFactCard(): void {
    const fact = this.store.state.factCard;
    this.el.factCard.hidden = !fact;
    if (!fact) return;
    this.el.factEyebrow.textContent = '천체 정보';
    this.el.factTitle.textContent = fact.titleKo;
    this.el.factText.textContent = fact.textKo;
  }

  private updateUi(_initial = false): void {
    const state = this.store.state;
    const days = state.time.days;
    const phase = moonPhaseAt(days);
    const season = seasonInfoForDays(days);
    const subsolar = subSolarPoint(days);
    const eclipse = this.getEclipse(days);

    this.updateTopStatus(days, phase, season, eclipse);
    this.updateStatusPanel(days, phase, season, subsolar, eclipse);
    this.updateObserver(state, phase, eclipse);

    const disabledMessage = this.isTimeLocked
      ? '먼저 예측을 제출하면 시간을 움직일 수 있습니다.'
      : null;
    this.mainTimeline.update(state, disabledMessage);
    this.observerTimeline.update(state, disabledMessage);
  }

  private updateTopStatus(
    days: number,
    phase: MoonPhase,
    season: SeasonInfo,
    eclipse: EclipseStatus,
  ): void {
    this.el.topDate.textContent = formatDateKo(days);
    this.el.topTime.textContent = `${formatTimeKo(days)} UTC`;
    this.el.topSeason.textContent = `북 ${season.northernLabelKo} · 남 ${season.southernLabelKo}`;
    this.setSeasonClass(this.el.topSeason, season);
    this.el.topPhase.textContent = `${phase.nameKo} ${formatIllumination(phase)}`;
    drawMoonPhaseIcon(this.el.topPhaseCanvas, phase.angleRad, 22);
    this.el.topEclipse.textContent = this.eclipseShort(eclipse);
    this.el.topEclipse.title = `${eclipse.headlineKo}. ${eclipse.detailKo}. 이 모형은 실제 일식·월식 예보가 아닙니다.`;
    this.setEclipseClass(this.el.topEclipse, eclipse);
  }

  private updateStatusPanel(
    days: number,
    phase: MoonPhase,
    season: SeasonInfo,
    subsolar: { latitudeDeg: number; longitudeDeg: number },
    eclipse: EclipseStatus,
  ): void {
    this.el.statusDate.textContent = formatDateKo(days);
    this.el.statusTime.textContent = `${formatTimeKo(days)} UTC · 북반구 기준 계절`;
    this.el.statusSeason.textContent = season.northernLabelKo;
    this.el.statusSeasonSouth.textContent = `남반구는 ${season.southernLabelKo}`;
    this.el.statusSeasonItem.classList.remove(
      'season-spring',
      'season-summer',
      'season-autumn',
      'season-winter',
    );
    this.el.statusSeasonItem.classList.add(`season-${season.northern}`);
    this.el.statusPhase.textContent = `${phase.nameKo} · ${formatIllumination(phase)}`;
    this.el.statusIllum.textContent = `${phase.waxing ? '차오르는 중' : '기우는 중'} · 위상각 ${phase.angleDeg.toFixed(0)}°`;
    drawMoonPhaseIcon(this.el.statusPhaseCanvas, phase.angleRad, 34);
    this.el.statusSubsolar.textContent = formatSubsolar(subsolar.latitudeDeg);
    this.el.statusEclipse.textContent = eclipse.headlineKo;
    this.el.statusEclipseDetail.textContent =
      `달의 황위 ${signedDeg(eclipse.currentMoonLatitudeDeg)} · 교점까지 ${eclipse.currentNodeDistanceDeg.toFixed(1)}° · ` +
      `가장 가까운 삭 ${formatDateShortKo(eclipse.nearestNew.days)} (황위 ${signedDeg(eclipse.nearestNew.moonLatitudeDeg)}), ` +
      `보름 ${formatDateShortKo(eclipse.nearestFull.days)} (황위 ${signedDeg(eclipse.nearestFull.moonLatitudeDeg)})`;
    this.el.statusEclipseDetail.title = eclipse.detailKo;
    this.setEclipseClass(this.el.statusEclipse, eclipse);
    this.el.diagramText.textContent = this.diagramText(days, phase, season, subsolar, eclipse);
  }

  private updateObserver(state: AppState, phase: MoonPhase, eclipse: EclipseStatus): void {
    if (state.view !== 'earth' || state.route === 'teacher') return;
    const sky = observerSkyAt(state.time.days);
    this.lastSky = sky;
    this.skyView.draw(state.time.days, sky);

    const sunVisible = sky.sun.altitudeDeg > 0;
    const moonVisible = sky.moon.altitudeDeg > 0;
    this.el.observerDate.textContent = formatDateKo(state.time.days);
    this.el.observerSolarTime.textContent = formatHoursKo(sky.localSolarTimeHours);
    this.el.observerSun.textContent = `${sky.sun.visible ? '지평선 위' : '지평선 아래'} · 고도 ${formatAltitude(sky.sun.altitudeDeg)} · 방위 ${formatAzimuth(sky.sun.azimuthDeg)} (${azimuthCompassKo(sky.sun.azimuthDeg)})`;
    this.el.observerMoon.textContent = `${sky.moon.visible ? '지평선 위' : '지평선 아래'} · 고도 ${formatAltitude(sky.moon.altitudeDeg)} · 방위 ${formatAzimuth(sky.moon.azimuthDeg)} (${azimuthCompassKo(sky.moon.azimuthDeg)})`;
    this.el.observerPhase.textContent = `${phase.nameKo} · ${formatIllumination(phase)}`;
    this.el.observerEclipse.textContent = this.eclipseShort(eclipse);
    const timeOfDay = sky.sun.altitudeDeg > 0 ? '낮' : sky.sun.altitudeDeg > -6 ? '박명' : '밤';
    this.el.observerText.textContent =
      `태양은 ${azimuthCompassKo(sky.sun.azimuthDeg)} 방향, 고도 ${formatAltitude(sky.sun.altitudeDeg)}에 있습니다. ` +
      `달은 ${moonVisible ? '지평선 위' : '지평선 아래'}에 있고 위상은 ${phase.nameKo}입니다. 지금은 ${timeOfDay}입니다.`;
    this.el.observerSun.dataset.visible = String(sunVisible);
    this.el.observerMoon.dataset.visible = String(moonVisible);
  }

  private diagramText(
    days: number,
    phase: MoonPhase,
    season: SeasonInfo,
    subsolar: { latitudeDeg: number; longitudeDeg: number },
    eclipse: EclipseStatus,
  ): string {
    const pole =
      Math.abs(subsolar.latitudeDeg) < 0.5
        ? '자전축이 태양 방향과 거의 수직입니다.'
        : subsolar.latitudeDeg > 0
          ? '북극이 태양 쪽으로 기울어져 있습니다.'
          : '북극이 태양 반대쪽으로 기울어져 있습니다.';
    const node =
      eclipse.currentNodeDistanceDeg < 8
        ? '달이 교점 근처에 있습니다.'
        : '달이 교점에서 멀리 떨어져 있습니다.';
    return (
      `${formatDateKo(days)} UTC, 북반구는 ${season.northernLabelKo}이고 남반구는 ${season.southernLabelKo}입니다. ` +
      `태양은 ${formatSubsolar(subsolar.latitudeDeg)}를 비추고, ${pole} ` +
      `달은 ${phase.nameKo}이며 밝은 부분은 ${formatIllumination(phase)}입니다. ${node} ${eclipse.headlineKo}.`
    );
  }

  private getEclipse(days: number): EclipseStatus {
    const now = performance.now();
    if (
      !this.eclipseCache ||
      Math.abs(days - this.eclipseCache.days) > 0.05 ||
      now - this.eclipseCache.at > 1600
    ) {
      this.eclipseCache = { status: eclipseStatusAt(days), days, at: now };
    }
    return this.eclipseCache.status;
  }

  private eclipseShort(eclipse: EclipseStatus): string {
    if (eclipse.solarCondition && eclipse.lunarCondition) return '일식·월식 조건 (모형)';
    if (eclipse.solarCondition) return '일식 조건 (모형)';
    if (eclipse.lunarCondition) return '월식 조건 (모형)';
    return '식 조건 아님';
  }

  private setSeasonClass(element: HTMLElement, season: SeasonInfo): void {
    element.classList.remove('season-spring', 'season-summer', 'season-autumn', 'season-winter');
    element.classList.add(`season-${season.northern}`);
  }

  private setEclipseClass(element: HTMLElement, eclipse: EclipseStatus): void {
    element.classList.remove('is-solar', 'is-lunar', 'is-both', 'is-none');
    if (eclipse.solarCondition && eclipse.lunarCondition) element.classList.add('is-both');
    else if (eclipse.solarCondition) element.classList.add('is-solar');
    else if (eclipse.lunarCondition) element.classList.add('is-lunar');
    else element.classList.add('is-none');
  }

  private get isTimeLocked(): boolean {
    return this.store.state.route === 'missions' && this.store.state.mission.phase === 'predict';
  }

  private togglePlay(): void {
    if (this.isTimeLocked) {
      this.toast('먼저 예측을 제출하세요. 예측 전에는 시간이 잠겨 있습니다.');
      return;
    }
    if (this.store.state.route === 'teacher') return;
    const playing = !this.store.state.time.playing;
    this.store.update((state) => {
      state.time.playing = playing;
    });
    this.announce(playing ? '시뮬레이션을 재생합니다.' : '시뮬레이션을 일시정지했습니다.');
  }

  private setDays(days: number): void {
    const next = clampSimDays(days);
    this.store.update((state) => {
      state.time.days = next;
      state.time.playing = false;
      state.factCard = null;
    });
    this.announceScene();
  }

  private scrubBy(delta: number): void {
    if (this.isTimeLocked) {
      this.toast('먼저 예측을 제출하세요.');
      return;
    }
    this.setDays(this.store.state.time.days + delta);
  }

  private setSpeed(speedId: SpeedPresetId): void {
    this.store.update((state) => {
      state.time.speedId = speedId;
    });
    this.announce(`시간 속도를 ${speedPresetById(speedId).labelKo}로 바꿨습니다.`);
  }

  private jumpSeason(kind: 'spring' | 'summer' | 'autumn' | 'winter'): void {
    const year = daysToDate(this.store.state.time.days).getUTCFullYear();
    const boundary = seasonBoundariesForYear(year).find((item) => item.kind === kind);
    if (!boundary) return;
    this.store.update((state) => {
      state.time.days = clampSimDays(boundary.days);
      state.time.playing = false;
      state.factCard = null;
    });
    this.announce(`${boundary.labelKo} 지점으로 이동했습니다.`);
  }

  private setView(view: ViewMode): void {
    if (view === 'earth' && this.store.state.route !== 'explore') {
      if (this.store.state.route === 'missions') {
        this.toast('지구 관측자 뷰는 탐구 화면에서 열 수 있습니다.');
      }
      return;
    }
    this.store.update((state) => {
      state.view = view;
      state.factCard = null;
    });
    this.announce(view === 'earth' ? '지구 관측자 뷰로 전환했습니다.' : '우주 뷰로 전환했습니다.');
    if (view === 'earth') {
      requestAnimationFrame(() => this.updateUi());
    }
  }

  private setCameraPreset(preset: CameraPreset): void {
    const focus = cameraFocusForPreset(preset);
    this.store.update((state) => {
      state.cameraPreset = preset;
      state.focus = focus;
      state.factCard = null;
    });
    this.announce(`카메라 시점을 ${cameraLabel(preset)}로 바꿨습니다.`);
  }

  private setLayer(key: keyof LayersState, value: boolean): void {
    this.store.update((state) => {
      state.layers[key] = value;
    });
    const label = layerLabel(key);
    this.announce(`${label}${objectParticle(label)} ${value ? '켰습니다' : '껐습니다'}.`);
  }

  private setReducedMotion(value: boolean): void {
    this.store.update((state) => {
      state.preferences.reducedMotion = value;
      if (value) state.time.playing = false;
    });
    this.announce(value ? '움직임 줄이기를 켰습니다.' : '움직임 줄이기를 껐습니다.');
  }

  private showFact(body: FactBody): void {
    const fact = FACTS[body];
    const preset: CameraPreset = body === 'sun' ? 'system' : body === 'moon' ? 'moon' : 'earth';
    this.store.update((state) => {
      state.factCard = { body, ...fact };
      state.view = 'space';
      state.cameraPreset = preset;
      state.focus = cameraFocusForPreset(preset);
    });
    this.announce(`${fact.titleKo} 정보 카드가 열렸습니다.`);
  }

  private closeFact(): void {
    this.store.update((state) => {
      state.factCard = null;
    });
  }

  private selectMission(id: string): void {
    if (!missionById(id)) return;
    this.store.update((state) => {
      state.mission.currentId = id;
      state.mission.phase = 'predict';
      state.mission.selectedOption = null;
      state.mission.lastCorrect = null;
      state.time.playing = false;
    });
    this.setActiveTab('mission');
    this.announce('미션을 선택했습니다. 먼저 예측을 제출하세요.');
  }

  private selectOption(option: string): void {
    this.store.update((state) => {
      state.mission.selectedOption = option;
    });
  }

  private submitPrediction(): void {
    const state = this.store.state;
    const mission = missionById(state.mission.currentId);
    const option = state.mission.selectedOption;
    if (!mission || !option) return;
    this.store.update((s) => {
      s.mission.answers[mission.id] = option;
      s.mission.phase = 'observe';
      s.time.playing = false;
      s.time.days = clampSimDays(mission.setup.days);
      s.view = mission.setup.view;
      s.cameraPreset = mission.setup.camera;
      s.focus = cameraFocusForPreset(mission.setup.camera);
      s.layers = { ...s.layers, ...mission.setup.layers };
      s.factCard = null;
    });
    this.announce('예측을 제출했습니다. 장면을 관찰한 뒤 정답을 확인하세요.');
  }

  private revealAnswer(): void {
    const state = this.store.state;
    const mission = missionById(state.mission.currentId);
    if (!mission) return;
    const answer = state.mission.answers[mission.id];
    const correct = answer === mission.answer;
    this.store.update((s) => {
      s.mission.phase = 'result';
      s.mission.lastCorrect = correct;
      if (correct && !s.mission.completed.includes(mission.id)) {
        s.mission.completed.push(mission.id);
      }
    });
    this.announce(
      correct
        ? '정답입니다. 설명과 핵심 문장을 확인하세요.'
        : '정답을 확인했습니다. 설명을 읽고 다시 도전해 보세요.',
    );
  }

  private nextMissionAction(): void {
    const state = this.store.state;
    const next = nextMission(state.mission.currentId) ?? MISSIONS[0];
    if (!next) return;
    this.store.update((s) => {
      s.mission.currentId = next.id;
      s.mission.phase = 'predict';
      s.mission.selectedOption = null;
      s.mission.lastCorrect = null;
      s.time.playing = false;
    });
    this.setActiveTab('mission');
    this.announce('다음 미션을 열었습니다. 먼저 예측을 제출하세요.');
  }

  private retryMission(): void {
    this.store.update((s) => {
      s.mission.phase = 'predict';
      s.mission.selectedOption = null;
      s.mission.lastCorrect = null;
      s.time.playing = false;
    });
    this.announce('다시 도전합니다. 예측을 새로 골라 주세요.');
  }

  private openExplore(): void {
    this.applyRoute('explore');
    if (window.location.hash !== routeHash('explore')) {
      history.pushState(null, '', routeHash('explore'));
    }
    this.setActiveTab('info');
  }

  private previewMission(id: string): void {
    const mission = missionById(id);
    if (!mission) return;
    this.store.update((state) => {
      state.route = 'explore';
      state.time.days = clampSimDays(mission.setup.days);
      state.time.playing = false;
      state.view = mission.setup.view;
      state.cameraPreset = mission.setup.camera;
      state.focus = cameraFocusForPreset(mission.setup.camera);
      state.layers = { ...state.layers, ...mission.setup.layers };
      state.factCard = null;
    });
    if (window.location.hash !== routeHash('explore')) {
      history.pushState(null, '', routeHash('explore'));
    }
    this.setActiveTab('info');
    this.toast('미션 장면을 탐구 화면에 불러왔습니다.');
    this.announceScene();
  }

  private resetProgress(): void {
    this.store.update((state) => {
      state.mission.answers = {};
      state.mission.completed = [];
      state.mission.currentId = MISSIONS[0]?.id ?? null;
      state.mission.phase = 'predict';
      state.mission.selectedOption = null;
      state.mission.lastCorrect = null;
      state.time.playing = false;
    });
    this.persist();
    this.toast('진행 기록을 초기화했습니다.');
    this.announce('미션 진행 기록을 초기화했습니다.');
  }

  private setActiveTab(tab: TabId): void {
    this.activeTab = tab;
    for (const button of this.el.hudTabButtons) {
      const isActive = button.dataset.tab === tab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }
    for (const slot of this.el.hudSlots) {
      slot.classList.toggle('is-active', slot.dataset.tab === tab);
    }
  }

  private openHelp(): void {
    this.el.helpReduced.checked = this.store.state.preferences.reducedMotion;
    this.el.helpLabels.checked = this.store.state.layers.labels;
    this.el.helpButton.setAttribute('aria-expanded', 'true');
    if (!this.el.helpDialog.open) {
      if (typeof this.el.helpDialog.showModal === 'function') this.el.helpDialog.showModal();
      else this.el.helpDialog.setAttribute('open', '');
    }
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (
          target.matches('input, textarea, select, button, [contenteditable="true"]') ||
          target.closest('dialog')
        ) {
          return;
        }
      }
      if (this.el.helpDialog.open) return;
      const state = this.store.state;
      if (state.route === 'teacher') return;

      if (event.code === 'Space') {
        if (event.repeat) return;
        event.preventDefault();
        this.togglePlay();
        return;
      }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        if (this.isTimeLocked) {
          this.toast('먼저 예측을 제출하세요.');
          return;
        }
        event.preventDefault();
        const step = event.shiftKey ? 7 : 1;
        this.scrubBy(event.code === 'ArrowRight' ? step : -step);
        return;
      }
      if (event.code === 'Digit1') {
        event.preventDefault();
        this.setView('space');
        return;
      }
      if (event.code === 'Digit2') {
        event.preventDefault();
        this.setView('earth');
        return;
      }
      if (event.code === 'KeyL') {
        event.preventDefault();
        this.setLayer('labels', !state.layers.labels);
        return;
      }
      if (event.code === 'Escape') {
        if (state.factCard) this.closeFact();
        else if (state.view === 'earth') this.setView('space');
      }
    });
  }

  private setupVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.persist();
      } else {
        this.clock.lastFrame = performance.now();
      }
    });
  }

  private startLoop(): void {
    this.clock.lastFrame = performance.now();
    const tick = (now: number): void => {
      const delta = Math.min((now - this.clock.lastFrame) / 1000, 0.1);
      this.clock.lastFrame = now;
      const state = this.store.state;
      let boundary = false;

      if (!document.hidden && state.time.playing && state.route !== 'teacher') {
        const speed = speedPresetById(state.time.speedId).daysPerSecond;
        let next = state.time.days + delta * speed;
        if (next >= MAX_SIM_DAYS) {
          next = MAX_SIM_DAYS;
          boundary = true;
        } else if (next <= MIN_SIM_DAYS) {
          next = MIN_SIM_DAYS;
          boundary = true;
        }
        this.store.update((s) => {
          s.time.days = next;
          if (boundary) s.time.playing = false;
        }, true);
        this.uiAccumulator += delta;
        this.saveAccumulator += delta;
      }

      if (!document.hidden && state.route !== 'teacher' && state.view === 'space') {
        this.scene.update(this.store.state.time.days, this.store.state);
        this.scene.render();
      }

      if (this.uiAccumulator >= 0.1) {
        this.updateUi();
        this.uiAccumulator = 0;
      }
      if (this.saveAccumulator >= 5) {
        this.persist();
        this.saveAccumulator = 0;
      }
      if (boundary) {
        this.toast('시뮬레이션 범위의 끝입니다.');
        this.store.emit();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private onResize = (): void => {
    this.scene.resize();
    this.skyView.resize();
    if (this.store.state.view === 'earth') this.updateUi();
  };

  private announceScene(prefix = ''): void {
    const state = this.store.state;
    const phase = moonPhaseAt(state.time.days);
    const season = seasonInfoForDays(state.time.days);
    const eclipse = this.getEclipse(state.time.days);
    this.announce(
      `${prefix}${formatDateKo(state.time.days)} ${formatTimeKo(state.time.days)} UTC. ` +
        `북반구 ${season.northernLabelKo}, 달 ${phase.nameKo}, ${eclipse.headlineKo}.`,
    );
  }

  private announce(message: string): void {
    this.el.srLive.textContent = '';
    window.setTimeout(() => {
      this.el.srLive.textContent = message;
    }, 30);
  }

  private toast(message: string): void {
    this.el.toast.textContent = message;
    this.el.toast.classList.add('is-visible');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.el.toast.classList.remove('is-visible');
      this.toastTimer = null;
    }, 3400);
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 600);
  }

  private persist = (): void => {
    const state = this.store.state;
    saveProgress({
      answers: { ...state.mission.answers },
      completed: [...state.mission.completed],
      lastDays: state.time.days,
      view: state.view,
      speedId: state.time.speedId,
      currentMissionId: state.mission.currentId,
      missionPhase: state.mission.phase,
      layers: { ...state.layers },
      reducedMotion: state.preferences.reducedMotion,
    });
  };

  getState(): AppState {
    return this.store.state;
  }

  get lastObserverSky(): ObserverSky | null {
    return this.lastSky;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pagehide', this.persist);
    this.persist();
    this.scene.dispose();
  }
}

function formatIllumination(phase: MoonPhase): string {
  const percent = phase.illuminatedFraction * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

function formatSubsolar(latitudeDeg: number): string {
  if (Math.abs(latitudeDeg) < 0.05) return '적도 0.0°';
  return `${latitudeDeg > 0 ? '북위' : '남위'} ${Math.abs(latitudeDeg).toFixed(1)}°`;
}

function signedDeg(value: number): string {
  const rounded = Math.abs(value) < 0.01 ? 0 : value;
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded).toFixed(2)}°`;
}

function cameraLabel(preset: CameraPreset): string {
  const labels: Record<CameraPreset, string> = {
    system: '전체 보기',
    earth: '지구 확대',
    top: '위에서 보기',
    side: '옆에서 보기',
    moon: '달 확대',
  };
  return labels[preset];
}

function objectParticle(word: string): string {
  const code = word.codePointAt(word.length - 1);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return '을';
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

function layerLabel(key: keyof LayersState): string {
  const labels: Record<keyof LayersState, string> = {
    orbits: '공전 궤도',
    labels: '3D 라벨',
    terminator: '낮과 밤 경계',
    nodes: '교점선',
    tiltAxis: '자전축',
  };
  return labels[key];
}
