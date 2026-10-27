import type { AppState, LayersState } from '../../app/state';
import { formatDateKo } from '../../astro/time';
import {
  CONCEPT_COLOR,
  CONCEPT_LABEL_KO,
  DIFFICULTY_LABEL_KO,
  MISSIONS,
  missionById,
} from '../missions/missions';

export interface TeacherCallbacks {
  onResetProgress: () => void;
  onPreviewMission: (id: string) => void;
  onSetLayer: (key: keyof LayersState, value: boolean) => void;
  onSetReducedMotion: (value: boolean) => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function switchRow(label: string, checked: boolean, dataKey: string): string {
  return `
    <label class="switch-row">
      <span class="switch-label">${label}</span>
      <span class="switch-control">
        <input type="checkbox" data-role="${dataKey}" ${checked ? 'checked' : ''} />
        <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
      </span>
    </label>
  `;
}

export class Teacher {
  private readonly root: HTMLElement;
  private readonly summaryDone: HTMLElement;
  private readonly summaryCorrect: HTMLElement;
  private readonly summaryAttempted: HTMLElement;
  private readonly progressBar: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly worksheet: HTMLElement;
  private readonly includeAnswers: HTMLInputElement;
  private readonly cards = new Map<string, HTMLElement>();
  private readonly dialog: HTMLDialogElement;
  private currentState: AppState | null = null;

  constructor(
    container: HTMLElement,
    private readonly callbacks: TeacherCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'teacher-layout';
    this.root.innerHTML = `
      <div class="teacher-head">
        <div>
          <p class="eyebrow">수업 준비와 기록 확인</p>
          <h1 class="page-title">교사 모드</h1>
          <p class="page-lede">학생의 예측 기록을 확인하고, 진행 상황을 초기화하거나 인쇄용 워크시트를 만들 수 있습니다. 이 모형은 개념 학습용이며 실제 일식 예보가 아닙니다.</p>
        </div>
        <div class="teacher-head-actions">
          <button type="button" class="btn btn-secondary" data-action="print">워크시트 인쇄</button>
          <button type="button" class="btn btn-danger" data-action="reset">진행 기록 초기화</button>
        </div>
      </div>

      <section class="teacher-summary-grid" aria-label="진행 요약">
        <div class="summary-card"><span class="summary-label">완료</span><strong data-ref="done">0</strong><span class="summary-unit">/ ${MISSIONS.length}</span></div>
        <div class="summary-card"><span class="summary-label">정답</span><strong data-ref="correct">0</strong><span class="summary-unit">/ ${MISSIONS.length}</span></div>
        <div class="summary-card"><span class="summary-label">도전한 미션</span><strong data-ref="attempted">0</strong><span class="summary-unit">/ ${MISSIONS.length}</span></div>
        <div class="summary-card summary-card--progress">
          <span class="summary-label">전체 진행</span>
          <div class="teacher-progress" role="progressbar" aria-label="미션 완료 진행" aria-valuemin="0" aria-valuemax="${MISSIONS.length}" aria-valuenow="0" data-ref="progress"><span data-ref="progress-bar"></span></div>
          <span class="summary-unit" data-ref="progress-label">0 / ${MISSIONS.length}</span>
        </div>
      </section>

      <div class="teacher-columns">
        <section class="teacher-section" aria-labelledby="teacher-missions-heading">
          <div class="section-head">
            <h2 id="teacher-missions-heading">미션과 정답</h2>
            <div class="section-actions">
              <button type="button" class="btn btn-ghost btn-small" data-action="expand">모두 펼치기</button>
              <button type="button" class="btn btn-ghost btn-small" data-action="collapse">모두 접기</button>
            </div>
          </div>
          <div class="teacher-mission-list">
            ${MISSIONS.map((mission, index) => {
              const status = '시작 전';
              return `
                <details class="teacher-mission" data-mission-id="${mission.id}">
                  <summary>
                    <span class="teacher-mission-number">${String(index + 1).padStart(2, '0')}</span>
                    <span class="teacher-mission-summary">
                      <span class="teacher-mission-title">${escapeHtml(mission.titleKo)}</span>
                      <span class="teacher-mission-meta">
                        <span class="concept-chip" style="--concept-color:${CONCEPT_COLOR[mission.concept]}">${CONCEPT_LABEL_KO[mission.concept]}</span>
                        <span class="difficulty-chip">난이도 ${DIFFICULTY_LABEL_KO[mission.difficulty]}</span>
                        <span class="teacher-status" data-ref="status">${status}</span>
                      </span>
                    </span>
                    <span class="teacher-mission-chevron" aria-hidden="true"></span>
                  </summary>
                  <div class="teacher-mission-body">
                    <p class="teacher-question">${escapeHtml(mission.promptKo)}</p>
                    <p class="teacher-answer"><span class="answer-label answer-label--correct">정답</span> ${escapeHtml(mission.answer)}</p>
                    <p class="teacher-explanation">${escapeHtml(mission.explanationKo)}</p>
                    <p class="teacher-takeaway"><span class="takeaway-mark" aria-hidden="true">→</span> ${escapeHtml(mission.takeawayKo)}</p>
                    <div class="teacher-student-answer">
                      <span class="teacher-student-label">학생 답안</span>
                      <span data-ref="student-answer" class="muted">아직 제출하지 않음</span>
                    </div>
                    <div class="teacher-scene-row">
                      <span class="muted">장면 날짜: ${formatDateKo(mission.setup.days)} UTC</span>
                      <button type="button" class="btn btn-secondary btn-small" data-action="preview" data-mission-id="${mission.id}">이 장면 탐구하기</button>
                    </div>
                  </div>
                </details>
              `;
            }).join('')}
          </div>
        </section>

        <aside class="teacher-side">
          <section class="teacher-section teacher-projection" aria-labelledby="projection-heading">
            <h2 id="projection-heading">투사 설정</h2>
            <p class="muted">수업 화면에 맞춰 3D 라벨과 자전축을 조절합니다.</p>
            ${switchRow('3D 라벨 표시', true, 'labels')}
            ${switchRow('자전축 표시', true, 'tiltAxis')}
            ${switchRow('움직임 줄이기', false, 'reducedMotion')}
            <p class="teacher-note">축척 경고는 개념 오해를 막기 위해 항상 표시됩니다.</p>
          </section>

          <section class="teacher-section" aria-labelledby="worksheet-heading">
            <h2 id="worksheet-heading">워크시트</h2>
            <p class="muted">여섯 미션의 질문과 선택지를 인쇄합니다. 학생용 답안란과 교사용 답안을 포함할 수 있습니다.</p>
            <label class="switch-row switch-row--plain">
              <span class="switch-label">교사용 답안 포함</span>
              <input type="checkbox" data-role="include-answers" />
            </label>
            <button type="button" class="btn btn-primary btn-pulse" data-action="print">워크시트 인쇄하기</button>
          </section>

          <section class="teacher-section" aria-labelledby="teacher-model-heading">
            <h2 id="teacher-model-heading">모형 안내</h2>
            <ul class="teacher-model-list">
              <li>공전 궤도는 원형으로 단순화했습니다.</li>
              <li>달의 교점은 고정되어 있습니다. 실제 교점은 약 18.6년 주기로 이동합니다.</li>
              <li>식 현상은 조건을 보여 주는 개념 모형이며 실제 일식·월식 예보가 아닙니다.</li>
              <li>화면의 크기와 거리는 실제 축척이 아닙니다.</li>
            </ul>
          </section>
        </aside>
      </div>

      <dialog class="dialog" data-ref="reset-dialog">
        <form method="dialog">
          <h2>진행 기록을 초기화할까요?</h2>
          <p>학생의 미션 답안과 완료 기록을 지웁니다. 시간·보기 설정은 유지됩니다.</p>
          <div class="dialog-actions">
            <button type="submit" class="btn btn-secondary" value="cancel">취소</button>
            <button type="submit" class="btn btn-danger" value="reset">초기화</button>
          </div>
        </form>
      </dialog>

      <section id="worksheet" aria-label="인쇄용 워크시트" hidden></section>
    `;
    container.appendChild(this.root);

    this.summaryDone = this.root.querySelector<HTMLElement>('[data-ref="done"]')!;
    this.summaryCorrect = this.root.querySelector<HTMLElement>('[data-ref="correct"]')!;
    this.summaryAttempted = this.root.querySelector<HTMLElement>('[data-ref="attempted"]')!;
    this.progressBar = this.root.querySelector<HTMLElement>('[data-ref="progress-bar"]')!;
    this.progressLabel = this.root.querySelector<HTMLElement>('[data-ref="progress-label"]')!;
    this.worksheet = this.root.querySelector<HTMLElement>('#worksheet')!;
    this.includeAnswers = this.root.querySelector<HTMLInputElement>(
      '[data-role="include-answers"]',
    )!;
    this.dialog = this.root.querySelector<HTMLDialogElement>('[data-ref="reset-dialog"]')!;

    this.root
      .querySelectorAll<HTMLElement>('details.teacher-mission[data-mission-id]')
      .forEach((element) => {
        const id = element.dataset.missionId;
        if (id) this.cards.set(id, element);
      });

    this.root.querySelectorAll<HTMLButtonElement>('[data-action="preview"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.missionId;
        if (id) this.callbacks.onPreviewMission(id);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-action="print"]').forEach((button) => {
      button.addEventListener('click', () => this.printWorksheet());
    });
    this.includeAnswers.addEventListener('change', () => this.renderWorksheet());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="expand"]')
      ?.addEventListener('click', () => {
        for (const details of this.root.querySelectorAll<HTMLDetailsElement>('details'))
          details.open = true;
      });
    this.root
      .querySelector<HTMLButtonElement>('[data-action="collapse"]')
      ?.addEventListener('click', () => {
        for (const details of this.root.querySelectorAll<HTMLDetailsElement>('details'))
          details.open = false;
      });

    const resetButton = this.root.querySelector<HTMLButtonElement>('[data-action="reset"]');
    resetButton?.addEventListener('click', () => {
      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else if (window.confirm('진행 기록을 초기화할까요?')) this.callbacks.onResetProgress();
    });
    this.dialog.addEventListener('close', () => {
      if (this.dialog.returnValue === 'reset') this.callbacks.onResetProgress();
    });

    this.root
      .querySelectorAll<HTMLInputElement>(
        '[data-role="labels"], [data-role="tiltAxis"], [data-role="reducedMotion"]',
      )
      .forEach((input) => {
        input.addEventListener('change', () => {
          const role = input.dataset.role;
          if (role === 'labels') this.callbacks.onSetLayer('labels', input.checked);
          else if (role === 'tiltAxis') this.callbacks.onSetLayer('tiltAxis', input.checked);
          else if (role === 'reducedMotion') this.callbacks.onSetReducedMotion(input.checked);
        });
      });
  }

  update(state: AppState): void {
    this.currentState = state;
    const completed = new Set(state.mission.completed);
    const attempted = Object.keys(state.mission.answers).filter((id) => missionById(id));
    const correct = MISSIONS.filter((mission) => completed.has(mission.id)).length;

    this.summaryDone.textContent = String(completed.size);
    this.summaryCorrect.textContent = String(correct);
    this.summaryAttempted.textContent = String(attempted.length);
    const percent = (completed.size / Math.max(1, MISSIONS.length)) * 100;
    this.progressBar.style.width = `${percent}%`;
    this.progressLabel.textContent = `${completed.size} / ${MISSIONS.length}`;
    const progressContainer = this.progressBar.parentElement;
    progressContainer?.setAttribute('aria-valuenow', String(completed.size));

    for (const mission of MISSIONS) {
      const card = this.cards.get(mission.id);
      if (!card) continue;
      const status = card.querySelector<HTMLElement>('[data-ref="status"]');
      const studentAnswer = card.querySelector<HTMLElement>('[data-ref="student-answer"]');
      const answer = state.mission.answers[mission.id];
      const isDone = completed.has(mission.id);
      if (status) {
        status.textContent = isDone ? '완료 · 정답' : answer ? '도전함 · 다시 도전' : '시작 전';
        status.className = `teacher-status${isDone ? ' is-done' : answer ? ' is-attempted' : ''}`;
      }
      if (studentAnswer) {
        studentAnswer.textContent = answer ?? '아직 제출하지 않음';
        studentAnswer.classList.toggle('muted', !answer);
      }
      card.classList.toggle('is-done', isDone);
    }

    const labels = this.root.querySelector<HTMLInputElement>('[data-role="labels"]');
    const tiltAxis = this.root.querySelector<HTMLInputElement>('[data-role="tiltAxis"]');
    const reducedMotion = this.root.querySelector<HTMLInputElement>('[data-role="reducedMotion"]');
    if (labels) labels.checked = state.layers.labels;
    if (tiltAxis) tiltAxis.checked = state.layers.tiltAxis;
    if (reducedMotion) reducedMotion.checked = state.preferences.reducedMotion;

    this.renderWorksheet();
  }

  private printWorksheet(): void {
    this.renderWorksheet();
    window.print();
  }

  private renderWorksheet(): void {
    const includeAnswers = this.includeAnswers.checked;
    const state = this.currentState;
    const studentNameLine =
      '<div class="worksheet-meta"><span>이름: ______________________________</span><span>날짜: ______________</span></div>';
    const questions = MISSIONS.map(
      (mission, index) => `
      <li class="worksheet-question">
        <div class="worksheet-question-head">
          <span class="worksheet-number">${index + 1}</span>
          <div>
            <h3>${escapeHtml(mission.titleKo)}</h3>
            <p class="worksheet-prompt">${escapeHtml(mission.promptKo)}</p>
          </div>
        </div>
        <ol class="worksheet-options" type="A">
          ${mission.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}
        </ol>
        <p class="worksheet-answer-line">내 예측: ________________________________________________________________</p>
      </li>
    `,
    ).join('');

    const answerKey = includeAnswers
      ? `<section class="worksheet-key">
          <h2>교사용 답안</h2>
          <ol>
            ${MISSIONS.map(
              (mission) =>
                `<li><strong>${escapeHtml(mission.answer)}</strong><br />${escapeHtml(mission.explanationKo)}</li>`,
            ).join('')}
          </ol>
        </section>`
      : '';

    const progress =
      state && state.mission.completed.length > 0
        ? `<p class="worksheet-progress">현재 완료: ${new Set(state.mission.completed).size} / ${MISSIONS.length}</p>`
        : '';

    this.worksheet.innerHTML = `
      <header class="worksheet-head">
        <p class="worksheet-brand">OrbitLab · 지구·달·태양 탐구실</p>
        <h1>계절·달의 위상·식 현상 탐구 워크시트</h1>
        <p class="worksheet-intro">먼저 각 질문에 대한 예측을 적고, 시뮬레이션을 관찰한 뒤 설명을 확인하세요.</p>
        ${studentNameLine}
        ${progress}
      </header>
      <ol class="worksheet-list">${questions}</ol>
      ${answerKey}
      <footer class="worksheet-footer">
        <p>이 활동은 개념 모형을 사용합니다. 공전 궤도는 원형으로 단순화했고, 교점은 고정되어 있으며, 화면의 크기와 거리는 실제 축척이 아닙니다.</p>
        <p>이 모형은 실제 일식·월식 예보가 아닙니다.</p>
      </footer>
    `;
  }
}
