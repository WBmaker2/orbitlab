import type { AppState } from '../../app/state';
import {
  CONCEPT_COLOR,
  CONCEPT_LABEL_KO,
  DIFFICULTY_LABEL_KO,
  MISSIONS,
  missionById,
  missionIndex,
  type Mission,
} from './missions';

export interface MissionPanelCallbacks {
  onSelectMission: (id: string) => void;
  onSelectOption: (option: string) => void;
  onSubmitPrediction: () => void;
  onRevealAnswer: () => void;
  onNextMission: () => void;
  onRetry: () => void;
  onOpenExplore: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class MissionPanel {
  private readonly root: HTMLElement;
  private signature = '';
  private lastPhaseKey = '';
  private liveRegion: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    private readonly callbacks: MissionPanelCallbacks,
  ) {
    this.root = document.createElement('aside');
    this.root.className = 'panel mission-panel glass';
    this.root.setAttribute('aria-label', '미션');
    container.appendChild(this.root);
  }

  update(state: AppState): void {
    const signature = JSON.stringify({
      currentId: state.mission.currentId,
      phase: state.mission.phase,
      selected: state.mission.selectedOption,
      answers: state.mission.answers,
      completed: state.mission.completed,
      lastCorrect: state.mission.lastCorrect,
    });
    if (signature === this.signature) return;
    this.signature = signature;

    const activeElement = document.activeElement;
    const focusKey =
      activeElement instanceof HTMLElement && this.root.contains(activeElement)
        ? activeElement.dataset.focusKey
        : undefined;
    const phaseKey = `${state.mission.currentId ?? 'none'}:${state.mission.phase}`;
    const phaseChanged = phaseKey !== this.lastPhaseKey;
    this.lastPhaseKey = phaseKey;

    this.render(state, focusKey, phaseChanged);
  }

  private render(
    state: AppState,
    previousFocusKey: string | undefined,
    phaseChanged: boolean,
  ): void {
    const current = missionById(state.mission.currentId);
    const completed = new Set(state.mission.completed);
    const completedCount = MISSIONS.filter((mission) => completed.has(mission.id)).length;
    const index = missionIndex(current?.id);
    const percent = MISSIONS.length > 0 ? (completedCount / MISSIONS.length) * 100 : 0;

    this.root.innerHTML = `
      <div class="mission-panel-head">
        <div>
          <p class="eyebrow">예측하고, 관찰하고, 설명하기</p>
          <h2 class="panel-title">미션</h2>
        </div>
        <div class="mission-score" aria-label="완료한 미션 ${completedCount}개 / ${MISSIONS.length}개">
          <strong>${completedCount}</strong><span>/${MISSIONS.length}</span>
        </div>
      </div>
      <div class="mission-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${MISSIONS.length}" aria-valuenow="${completedCount}" aria-label="미션 완료 진행">
        <span style="width:${percent}%"></span>
      </div>
      <div class="mission-picker" role="group" aria-label="미션 선택">
        ${MISSIONS.map((mission, missionNumber) => {
          const isCurrent = mission.id === current?.id;
          const isDone = completed.has(mission.id);
          const isAnswered = mission.id in state.mission.answers;
          const status = isDone ? '완료' : isAnswered ? '도전함' : '시작 전';
          const number = String(missionNumber + 1).padStart(2, '0');
          return `<button type="button" class="mission-pick${isCurrent ? ' is-current' : ''}" data-focus-key="pick-${mission.id}" data-mission-id="${mission.id}" aria-pressed="${isCurrent}">
            <span class="mission-pick-number">${number}</span>
            <span class="sr-only">번 미션. ${escapeHtml(mission.titleKo)}. ${status}</span>
            <span class="mission-pick-dot mission-pick-dot--${mission.concept}" aria-hidden="true"></span>
            ${isDone ? '<span class="mission-pick-check" aria-hidden="true"></span>' : ''}
          </button>`;
        }).join('')}
      </div>
      ${current ? this.renderMission(state, current, index) : this.renderEmpty()}
      <div class="sr-only" data-ref="live" aria-live="polite"></div>
    `;

    this.liveRegion = this.root.querySelector<HTMLElement>('[data-ref="live"]');

    this.root.querySelectorAll<HTMLButtonElement>('[data-mission-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.missionId;
        if (id) this.callbacks.onSelectMission(id);
      });
    });

    const mission = current;
    if (!mission) return;

    if (state.mission.phase === 'predict') {
      this.root
        .querySelectorAll<HTMLInputElement>('input[name="mission-option"]')
        .forEach((input) => {
          input.addEventListener('change', () => {
            if (input.checked) this.callbacks.onSelectOption(input.value);
          });
        });
      const submit = this.root.querySelector<HTMLButtonElement>('[data-action="submit"]');
      submit?.addEventListener('click', () => this.callbacks.onSubmitPrediction());
    } else if (state.mission.phase === 'observe') {
      this.root
        .querySelector<HTMLButtonElement>('[data-action="reveal"]')
        ?.addEventListener('click', () => this.callbacks.onRevealAnswer());
    } else {
      this.root
        .querySelector<HTMLButtonElement>('[data-action="retry"]')
        ?.addEventListener('click', () => {
          this.callbacks.onRetry();
        });
      this.root
        .querySelector<HTMLButtonElement>('[data-action="next"]')
        ?.addEventListener('click', () => this.callbacks.onNextMission());
      this.root
        .querySelector<HTMLButtonElement>('[data-action="explore"]')
        ?.addEventListener('click', () => this.callbacks.onOpenExplore());
      if (this.liveRegion) {
        if (state.mission.lastCorrect) {
          this.liveRegion.textContent = '정답입니다. 설명과 핵심 문장을 확인하세요.';
        } else {
          this.liveRegion.textContent = '정답을 확인하고 다시 도전해 보세요.';
        }
      }
    }

    if (phaseChanged) {
      if (state.mission.phase === 'observe') {
        this.focusByKey('reveal');
        return;
      }
      if (state.mission.phase === 'result') {
        this.root.querySelector<HTMLElement>('[data-focus-key="result-heading"]')?.focus();
        return;
      }
      this.root.querySelector<HTMLElement>('[data-focus-key="mission-heading"]')?.focus();
      return;
    }

    if (previousFocusKey) {
      const restored = this.root.querySelector<HTMLElement>(
        `[data-focus-key="${previousFocusKey}"]`,
      );
      if (restored) restored.focus();
    }
  }

  private renderEmpty(): string {
    return `
      <div class="mission-empty">
        <p>아직 선택한 미션이 없습니다.</p>
        <p class="muted">위에서 미션을 골라 예측을 시작하세요.</p>
      </div>
    `;
  }

  private renderMission(state: AppState, mission: Mission, index: number): string {
    const selected = state.mission.selectedOption;
    const submitted = state.mission.answers[mission.id];
    const isCorrect = state.mission.lastCorrect;
    const next = MISSIONS[index + 1];
    const conceptColor = CONCEPT_COLOR[mission.concept];

    const meta = `
      <div class="mission-meta">
        <span class="concept-chip" style="--concept-color:${conceptColor}">${CONCEPT_LABEL_KO[mission.concept]}</span>
        <span class="difficulty-chip">난이도 ${DIFFICULTY_LABEL_KO[mission.difficulty]}</span>
        <span class="mission-index">${index + 1} / ${MISSIONS.length}</span>
      </div>
    `;

    const header = `
      <div class="mission-card-head">
        <h3 id="mission-heading" class="mission-heading" data-focus-key="mission-heading" tabindex="-1">${escapeHtml(mission.titleKo)}</h3>
        <p class="mission-prompt">${escapeHtml(mission.promptKo)}</p>
      </div>
    `;

    if (state.mission.phase === 'predict') {
      return `
        <article class="mission-card" aria-labelledby="mission-heading">
          ${meta}
          ${header}
          <p class="mission-gate"><span class="gate-dot" aria-hidden="true"></span> 먼저 예측을 제출하면 시뮬레이션이 움직입니다.</p>
          <fieldset class="mission-options">
            <legend class="sr-only">예측 선택</legend>
            ${mission.options
              .map(
                (option, optionIndex) => `
              <label class="option${selected === option ? ' is-selected' : ''}">
                <input type="radio" name="mission-option" value="${escapeHtml(option)}"
                  data-focus-key="option-${optionIndex}" ${selected === option ? 'checked' : ''} />
                <span class="option-marker" aria-hidden="true"></span>
                <span class="option-text">${escapeHtml(option)}</span>
              </label>
            `,
              )
              .join('')}
          </fieldset>
          <button type="button" class="btn btn-primary btn-pulse" data-action="submit" data-focus-key="submit" ${selected ? '' : 'disabled'}>
            예측 제출하고 장면 보기
          </button>
          <p class="mission-note">예측을 제출하면 이 미션의 장면으로 이동합니다.</p>
        </article>
      `;
    }

    if (state.mission.phase === 'observe') {
      return `
        <article class="mission-card" aria-labelledby="mission-heading">
          ${meta}
          ${header}
          <div class="mission-submitted">
            <span class="mission-submitted-label">내 예측</span>
            <strong>${escapeHtml(submitted ?? '')}</strong>
          </div>
          <div class="mission-observe">
            <p class="eyebrow">관찰 안내</p>
            <p>${escapeHtml(mission.observeKo)}</p>
            <p class="mission-scene-label">3D 장면을 움직여 관찰한 뒤 정답을 확인하세요.</p>
          </div>
          <button type="button" class="btn btn-primary btn-pulse" data-action="reveal" data-focus-key="reveal">
            관찰했어요, 정답 보기
          </button>
        </article>
      `;
    }

    const correctAnswer = mission.answer;
    const nextLabel = next ? '다음 미션' : '처음 미션으로';
    return `
      <article class="mission-card mission-result ${isCorrect ? 'is-correct' : 'is-incorrect'}" aria-labelledby="result-heading">
        ${meta}
        <div class="result-banner">
          <span class="result-icon" aria-hidden="true"></span>
          <div>
            <h3 id="result-heading" data-focus-key="result-heading" tabindex="-1">${isCorrect ? '정답입니다!' : '정답을 함께 확인해요'}</h3>
            <p>${isCorrect ? '관찰한 장면과 설명을 연결해 보세요.' : '예측은 틀릴 수 있습니다. 장면을 다시 떠올리며 설명을 읽어 보세요.'}</p>
          </div>
        </div>
        ${
          isCorrect
            ? ''
            : `<div class="answer-compare">
                <p><span class="answer-label">내 예측</span> ${escapeHtml(submitted ?? '')}</p>
                <p><span class="answer-label answer-label--correct">정답</span> ${escapeHtml(correctAnswer)}</p>
              </div>`
        }
        <div class="result-copy">
          <h4>왜 그럴까요?</h4>
          <p>${escapeHtml(mission.explanationKo)}</p>
          <p class="takeaway"><span class="takeaway-mark" aria-hidden="true">→</span> ${escapeHtml(mission.takeawayKo)}</p>
        </div>
        <div class="mission-actions">
          ${
            isCorrect
              ? `<button type="button" class="btn btn-primary btn-pulse" data-action="next" data-focus-key="next">${nextLabel}</button>`
              : `<button type="button" class="btn btn-primary btn-pulse" data-action="retry" data-focus-key="retry">다시 도전</button>
                 <button type="button" class="btn btn-secondary" data-action="next" data-focus-key="next">${nextLabel}</button>`
          }
          <button type="button" class="btn btn-ghost" data-action="explore" data-focus-key="explore">탐구 화면으로</button>
        </div>
      </article>
    `;
  }

  private focusByKey(key: string): void {
    this.root.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  }
}
