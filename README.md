# OrbitLab

지구의 자전·공전, 자전축 기울기, 달의 위상과 식 현상을 3D로 탐구하는 과학 수업 도구입니다. 초5~중3 학습자를 대상으로 하며, 설치형 PWA로도 동작합니다.

**라이브 데모:** <https://wbmaker2.github.io/orbitlab/>

- **정적 사이트**: 서버, 로그인, 데이터베이스가 없습니다.
- **런타임 AI 없음**: 빌드 후에는 LLM/API 호출이나 외부 네트워크 요청이 없습니다.
- **개념 모형**: 공전 궤도는 원형, 달의 교점은 고정, 크기와 거리는 실제 축척이 아닙니다.
- **식 예보 아님**: 식 현상은 조건을 보여 주는 교육용 모형이며 실제 일식·월식 예보가 아닙니다.

## 주요 기능

- 태양·지구·달 3D 장면과 낮/밤 경계, 대기 표현
- 시간 재생, 속도 조절, 날짜 스크러버, 춘분·하지·추분·동지 이동
- 계절, 달의 위상, 태양 직하점, 식 조건 요약
- 우주 뷰와 서울 기준 지구 관측자 뷰(하늘, 지평선, 위에서 본 배치)
- 계절·위상·식·축척을 다루는 6개 미션(예측 → 관찰 → 설명)
- 교사 모드: 진행 현황, 정답과 설명, 진행 초기화, 인쇄용 워크시트
- `localStorage` 기반 진행 저장, 키보드 조작, 움직임 줄이기, 스크린리더 안내
- PWA 매니페스트와 오프라인 캐시

## 시작하기

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드와 미리보기:

```bash
npm run build
npm run preview
```

## 스크립트

| 명령               | 설명                                  |
| ------------------ | ------------------------------------- |
| `npm run dev`      | 개발 서버                             |
| `npm run build`    | 타입 검사 후 정적 빌드                |
| `npm run preview`  | 빌드 결과 미리보기                    |
| `npm run verify`   | 타입 검사 + 린트 + 단위 테스트 + 빌드 |
| `npm test`         | Vitest 천문 단위 테스트               |
| `npm run test:e2e` | Playwright E2E·접근성·PWA 테스트      |
| `npm run lint`     | ESLint                                |
| `npm run format`   | Prettier                              |
| `npm run icons`    | PWA 아이콘 재생성                     |

E2E 테스트를 처음 실행할 때는 Chromium을 설치합니다.

```bash
npx playwright install chromium
npm run test:e2e
```

## 프로젝트 구조

```text
src/
  app/          앱 상태, 라우팅, 화면 오케스트레이션
  astro/        순수 천문 계산(시간, 궤도, 위상, 계절, 식, 관측자)
  render/       Three.js 장면, 카메라, 셰이더, 절차적 텍스처
  features/     타임라인, 미션, 교사 모드
  ui/           관측자 하늘 뷰, 달 위상 아이콘, 스타일
  storage/      localStorage 진행 저장
  data/         미션과 천체 사실 데이터
  tests/unit/   Vitest 단위 테스트
  tests/e2e/    Playwright E2E·접근성·성능·PWA 테스트
```

천문 계산은 `src/astro/`에 모여 있으며 Three.js에 의존하지 않습니다. 렌더러는 계산된 위치와 방향만 소비합니다.

## 테스트

- **단위 테스트**: 지구 궤도와 자전축, 달 궤도, 위상, 계절 경계, 서울 관측자 하늘, 식 조건
- **E2E**: 타임라인, 뷰 전환, 레이어, 6개 미션 흐름, 교사 초기화, 키보드 전용 미션 완료
- **접근성**: `@axe-core/playwright`로 탐구·미션·관측자·교사 화면의 serious/critical 위반 검사
- **시각 스모크**: 1440×900, 1024×768, 390×844 스크린샷
- **PWA/성능**: 오프라인 재로드, 번들 gzip 예산(800 KB), 느린 4G 로드 예산(2.5초), 렌더 루프 FPS

## 모형의 한계

- 지구 공전 궤도는 원형이며, 계절을 거리로 설명하지 않도록 의도했습니다.
- 달의 교점은 고정되어 있습니다. 실제 교점은 약 18.6년 주기로 이동합니다.
- 화면의 크기와 거리는 압축된 시각 축척입니다. 실제 비율은 `실제 수치` 패널을 참고하세요.
- 실제 축척(True-scale) 3D 모드는 향후 확장 후보이며 현재 구현 범위에 포함되지 않습니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 타입 검사·린트·단위 테스트·빌드를 실행하고 GitHub Pages에 배포합니다.

`npm run build` 결과(`dist/`)를 다른 정적 호스팅에 올려도 됩니다. `vite.config.ts`의 `base: './'` 설정 덕분에 하위 경로에서도 동작합니다. PWA 서비스 워커는 HTTPS 또는 localhost에서만 활성화됩니다.

자세한 제품·학습 설계는 [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)를 참고하세요. 변경 기록은 [`docs/UPDATELOG.md`](docs/UPDATELOG.md)에 있습니다.
