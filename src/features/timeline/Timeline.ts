import type { AppState } from '../../app/state';
import {
  MAX_SIM_DAYS,
  MIN_SIM_DAYS,
  SPEED_PRESETS,
  type SpeedPresetId,
} from '../../astro/constants';
import {
  daysToDate,
  formatDateKo,
  formatDateTimeKo,
  formatTimeKo,
  seasonBoundariesForYear,
} from '../../astro/time';

export interface TimelineCallbacks {
  onTogglePlay: () => void;
  onScrub: (days: number) => void;
  onSpeedChange: (speedId: SpeedPresetId) => void;
  onJumpSeason: (kind: 'spring' | 'summer' | 'autumn' | 'winter') => void;
}

export interface TimelineOptions {
  compact?: boolean;
}

export class Timeline {
  private readonly root: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly playText: HTMLElement;
  private readonly dateMain: HTMLElement;
  private readonly dateSub: HTMLElement;
  private readonly speed: HTMLSelectElement;
  private readonly range: HTMLInputElement;
  private readonly markers: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly jumpButtons: HTMLButtonElement[] = [];
  private readonly compact: boolean;
  private markerYear: number | null = null;
  private disabled = false;
  private scrubbing = false;

  constructor(
    container: HTMLElement,
    private readonly callbacks: TimelineCallbacks,
    options: TimelineOptions = {},
  ) {
    this.compact = options.compact ?? false;
    this.root = document.createElement('div');
    this.root.className = `timeline${this.compact ? ' timeline--compact' : ''}`;
    this.root.innerHTML = `
      <div class="timeline-head">
        <button class="transport-btn" type="button" data-ref="play" aria-label="재생" aria-pressed="false">
          <span class="transport-icon" aria-hidden="true"></span>
          <span class="transport-text" data-ref="play-text">재생</span>
        </button>
        <div class="timeline-date">
          <span class="timeline-date-main" data-ref="date-main"></span>
          <span class="timeline-date-sub" data-ref="date-sub"></span>
        </div>
        <label class="speed-control">
          <span class="sr-only">시간 속도</span>
          <select data-ref="speed" aria-label="시간 속도"></select>
        </label>
      </div>
      <div class="timeline-track">
        <div class="season-markers" data-ref="markers" aria-hidden="true"></div>
        <input class="timeline-range" data-ref="range" type="range"
          min="${MIN_SIM_DAYS}" max="${MAX_SIM_DAYS}" step="0.01" value="0"
          aria-label="시뮬레이션 날짜" />
      </div>
      ${
        this.compact
          ? ''
          : `<div class="timeline-jumps" data-ref="jumps" role="group" aria-label="계절 경계로 이동">
              <button type="button" class="jump-btn jump-spring" data-season="spring">춘분</button>
              <button type="button" class="jump-btn jump-summer" data-season="summer">하지</button>
              <button type="button" class="jump-btn jump-autumn" data-season="autumn">추분</button>
              <button type="button" class="jump-btn jump-winter" data-season="winter">동지</button>
            </div>`
      }
      <p class="timeline-hint" data-ref="hint" hidden></p>
    `;
    container.appendChild(this.root);

    this.playButton = this.root.querySelector<HTMLButtonElement>('[data-ref="play"]')!;
    this.playText = this.root.querySelector<HTMLElement>('[data-ref="play-text"]')!;
    this.dateMain = this.root.querySelector<HTMLElement>('[data-ref="date-main"]')!;
    this.dateSub = this.root.querySelector<HTMLElement>('[data-ref="date-sub"]')!;
    this.speed = this.root.querySelector<HTMLSelectElement>('[data-ref="speed"]')!;
    this.range = this.root.querySelector<HTMLInputElement>('[data-ref="range"]')!;
    this.markers = this.root.querySelector<HTMLElement>('[data-ref="markers"]')!;
    this.hint = this.root.querySelector<HTMLElement>('[data-ref="hint"]')!;

    for (const preset of SPEED_PRESETS) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.labelKo;
      this.speed.appendChild(option);
    }

    this.playButton.addEventListener('click', () => this.callbacks.onTogglePlay());
    this.speed.addEventListener('change', () => {
      this.callbacks.onSpeedChange(this.speed.value as SpeedPresetId);
    });
    this.range.addEventListener('input', () => {
      this.callbacks.onScrub(Number(this.range.value));
    });
    this.range.addEventListener('pointerdown', () => {
      this.scrubbing = true;
    });
    const stopScrub = () => {
      this.scrubbing = false;
    };
    this.range.addEventListener('pointerup', stopScrub);
    this.range.addEventListener('pointercancel', stopScrub);
    this.range.addEventListener('blur', stopScrub);

    const jumps = this.root.querySelector<HTMLElement>('[data-ref="jumps"]');
    if (jumps) {
      jumps.querySelectorAll<HTMLButtonElement>('[data-season]').forEach((button) => {
        this.jumpButtons.push(button);
        button.addEventListener('click', () => {
          const season = button.dataset.season as 'spring' | 'summer' | 'autumn' | 'winter';
          this.callbacks.onJumpSeason(season);
        });
      });
    }
  }

  update(state: AppState, disabledMessage: string | null = null): void {
    const days = state.time.days;
    if (!this.scrubbing) this.range.value = String(days);
    this.range.setAttribute('aria-valuetext', formatDateTimeKo(days));
    this.dateMain.textContent = formatDateKo(days);
    this.dateSub.textContent = `${formatTimeKo(days)} UTC`;
    this.playButton.setAttribute('aria-pressed', String(state.time.playing));
    this.playButton.setAttribute(
      'aria-label',
      state.time.playing ? '시뮬레이션 일시정지' : '시뮬레이션 재생',
    );
    this.playText.textContent = state.time.playing ? '일시정지' : '재생';
    this.playButton.classList.toggle('is-playing', state.time.playing);
    this.speed.value = state.time.speedId;

    const disabled = disabledMessage !== null;
    this.setDisabled(disabled);
    this.hint.hidden = !disabled;
    if (disabled) this.hint.textContent = disabledMessage ?? '';

    const year = daysToDate(days).getUTCFullYear();
    if (this.markerYear !== year) {
      this.markerYear = year;
      this.renderMarkers(year);
    }
  }

  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.root.classList.toggle('is-disabled', disabled);
    this.playButton.disabled = disabled;
    this.speed.disabled = disabled;
    this.range.disabled = disabled;
    for (const button of this.jumpButtons) button.disabled = disabled;
  }

  destroy(): void {
    this.root.remove();
  }

  private renderMarkers(year: number): void {
    this.markers.replaceChildren();
    const boundaries = seasonBoundariesForYear(year);
    const span = MAX_SIM_DAYS - MIN_SIM_DAYS;
    for (const boundary of boundaries) {
      const percent = ((boundary.days - MIN_SIM_DAYS) / span) * 100;
      if (percent < 0 || percent > 100) continue;
      const marker = document.createElement('span');
      marker.className = `season-marker season-marker--${boundary.kind}`;
      marker.style.left = `${percent}%`;
      const tick = document.createElement('span');
      tick.className = 'season-marker-tick';
      const label = document.createElement('span');
      label.className = 'season-marker-label';
      label.textContent = boundary.labelKo;
      marker.title = `${formatDateKo(boundary.days)} · ${boundary.labelKo}`;
      marker.append(tick, label);
      this.markers.appendChild(marker);
    }
  }
}
