# OrbitLab — Implementation Plan

**Project name:** OrbitLab
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/orbitlab`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All astronomy runs in the browser.
**Target learners:** Grades 5–9 (Korean 초5~중3)
**Subject:** Science — Earth's rotation and revolution, axial tilt, seasons, moon phases, eclipses
**MVP duration:** 3–4 weeks

---

## 0. One-page summary

OrbitLab is a 3D Earth–Moon–Sun simulator built around a single question: **why do seasons, moon phases, and eclipses happen?**

Students scrub through time, switch between a space view and an Earth-observer view, and complete short missions that force them to predict before they observe. The app deliberately uses a simplified but honest model:

- Earth's orbit is circular in the MVP, so students cannot explain seasons by distance.
- Earth's axial tilt is the cause of seasons.
- The Moon's 5.14° orbital inclination is included so students can see why eclipses do not happen every month.
- A visible "concept model, not an eclipse forecast" label keeps the claims honest.

The app is **not** an AI tutor. It is a deterministic simulation with local missions and progress.

**Why this is a strong build**

- High visual payoff with a small asset budget: procedural spheres, shaders, orbit lines, and labels.
- Real math: orbital periods, axial tilt, phase angles, and eclipse geometry are testable.
- Clear misconceptions to target: distance causes seasons, the Moon has a dark side, eclipses happen every month.
- Responsive 3D and an Earth-observer mode make it more than a spinning globe.

---

## 1. Product definition

### 1.1 Learning problem

Students often memorize "Earth is tilted, so we have seasons" without being able to connect the tilt, the orbit, and the observer's view. Moon phases and eclipses are even harder because they require reasoning about three bodies at once.

### 1.2 Learning goals

By the end of the core missions, a student should be able to:

- Explain why the Northern and Southern Hemispheres have opposite seasons.
- Identify the equinoxes and solstices from Earth's position and tilt.
- Explain why the Moon shows phases and why the same side always faces Earth.
- Explain why solar and lunar eclipses do not happen every month.
- Distinguish "not to scale" visual models from real distances and sizes.

### 1.3 Core learning loop

1. **Predict** — the mission asks what will happen at a given date or configuration.
2. **Set** — the student scrubs time, changes the camera, or toggles layers.
3. **Observe** — the 3D scene and the observer view update.
4. **Explain** — the student answers a short multiple-choice or ordering question.
5. **Connect** — a one-sentence takeaway links the observation to the concept.

### 1.4 Success criteria

- A student can explain the cause of seasons without saying "Earth is closer to the Sun."
- A student can predict the moon phase from a top-down view.
- A student can explain why an eclipse requires a new or full moon near a node.
- A teacher can reset progress and choose a mission set without code changes.

---

## 2. Scope

### MVP (must ship)

- Sun, Earth, and Moon with procedural stylized surfaces.
- Time controls: play/pause, speed, date scrubber, jump to equinox/solstice.
- Earth axial tilt (23.44°), rotation, and revolution.
- Moon orbit with 5.14° inclination and a visible line of nodes.
- Day/night terminator on Earth.
- Moon phase calculated from the Sun–Earth–Moon angle.
- Space view and Earth-observer view.
- Orbit lines, labels, and a scale warning.
- Six missions with prediction gates and explanations.
- Local progress and teacher reset.
- Responsive layout, keyboard controls, reduced motion.
- PWA install + offline cache.

### Later (do not build in the first pass)

- Other planets, moons, or exoplanets.
- Tides.
- Real ephemeris data or high-precision eclipse prediction.
- Moon-observer view.
- Analemma, equation of time, or sundial mode.
- Account-based classroom dashboard.

### Out of scope

- Any server, database, login, or analytics.
- Any runtime AI or generated explanations.
- Downloaded scientific datasets.
- AR/VR.
- Claims of real eclipse forecasting.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Static output, fast iteration |
| 3D | Three.js | Scene graph, shaders, camera controls |
| UI | Vanilla DOM + CSS custom properties | Small bundle; no framework needed |
| Math tests | Vitest | Orbital and phase math |
| Browser tests | Playwright | Missions, camera modes, screenshots |
| PWA | `vite-plugin-pwa` | Offline classroom use |
| Hosting | GitHub Pages / Cloudflare Pages | No server |

**Constraints**

- Node.js 20+.
- No backend, no API keys, no runtime network calls.
- No large texture downloads. Use procedural materials and simple geometry.
- Target 60 fps on a mid-range laptop and ≥ 30 fps on a school tablet.
- Initial gzip bundle under 800 KB.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts
    state.ts
    routes.ts
  astro/
    constants.ts          AU, radii, periods, tilt, inclination
    time.ts               simulation date and time scaling
    orbits.ts             Earth and Moon positions
    geometry.ts           coordinate frames and conversions
    phases.ts             moon phase angle and name
    seasons.ts            season from date and tilt
    eclipses.ts           node distance and eclipse conditions
    observer.ts           local sky positions for the Earth observer
  render/
    SceneManager.ts
    Sun.ts
    Earth.ts
    Moon.ts
    Orbits.ts
    Stars.ts
    Labels.ts
    CameraRig.ts
    shaders/
      earthDayNight.glsl
      atmosphere.glsl
  features/
    timeline/
    camera/
    missions/
    teacher/
  data/
    missions.json
    facts.json
  ui/
    components/
    styles/
  storage/
    progress.ts
  tests/
    unit/
    e2e/
```

### 4.2 Coordinate frames

Use three frames and convert explicitly:

1. **Heliocentric frame** — Sun at the origin; Earth's orbital plane is the XZ plane.
2. **Earth-local frame** — Earth's center at the origin; the axial tilt is applied to the Earth group; the Moon orbits in a plane inclined 5.14° to the ecliptic.
3. **Observer frame** — a point on Earth's surface with a local horizon and up vector.

Keep the math in `astro/` independent of Three.js. The render layer consumes positions and quaternions.

### 4.3 State

```ts
interface AppState {
  route: 'explore' | 'missions' | 'teacher';
  time: {
    days: number;            // simulation days from epoch
    playing: boolean;
    speed: number;           // days per second
  };
  view: 'space' | 'earth';
  layers: {
    orbits: boolean;
    labels: boolean;
    terminator: boolean;
    nodes: boolean;
    tiltAxis: boolean;
  };
  mission: {
    currentId: string | null;
    answers: Record<string, string>;
    completed: string[];
  };
  preferences: {
    reducedMotion: boolean;
    scaleMode: 'visual' | 'true';
  };
}
```

### 4.4 Persistence

- `localStorage` key: `orbitlab.progress.v1`.
- Store mission answers, completed missions, last date, view, and preferences.
- No personal data.
- Teacher reset clears progress after confirmation.

---

## 5. Data model

### 5.1 Mission

```ts
interface Mission {
  id: string;
  titleKo: string;
  concept: 'seasons' | 'phases' | 'eclipses' | 'scale' | 'rotation';
  promptKo: string;
  setup: {
    dayOfYear: number;
    view: 'space' | 'earth';
    camera?: 'top' | 'side' | 'earth-surface';
  };
  options: string[];
  answer: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.2 Simulation constants

```ts
const EARTH_YEAR_DAYS = 365.2422;
const EARTH_ROTATION_HOURS = 23.9345;
const MOON_SIDEREAL_DAYS = 27.3217;
const MOON_SYNODIC_DAYS = 29.5306;
const EARTH_AXIAL_TILT_DEG = 23.44;
const MOON_ORBIT_INCLINATION_DEG = 5.14;
const MOON_NODE_REGRESSION_YEARS = 18.6;
```

Keep these in one file with comments and sources. Do not scatter magic numbers.

### 5.3 Time model

- Use a fixed epoch, e.g. 2026-03-20 00:00 UTC (March equinox).
- `days` is a floating-point simulation day.
- Display date by converting to a calendar; use UTC to avoid timezone bugs.
- Speed presets: 1 hour/s, 1 day/s, 1 week/s, 1 month/s.
- Clamp the date range to a few years around the epoch for the MVP.

---

## 6. Core algorithms

### 6.1 Earth orbit

For the MVP, use a circular orbit:

```text
angle = 2π × (days / 365.2422)
earthPos = (cos(angle) × R, 0, sin(angle) × R)
```

This is intentional: it removes distance as an explanation for seasons. Add a small note in the UI: "Orbit is circular in this model."

If a slightly elliptical orbit is added later, keep the eccentricity small and label it.

### 6.2 Earth rotation and axial tilt

- Apply the 23.44° tilt to the Earth group around a fixed axis in the orbital frame.
- Rotate the Earth mesh around its local polar axis based on the sidereal day.
- The tilt direction must stay fixed in space as Earth orbits; do not rotate the tilt with the orbital position.
- The sub-solar point and the terminator follow from the Sun direction in the Earth-local frame.

**Test:** at the June solstice, the North Pole should be tilted toward the Sun; at the December solstice, away from it.

### 6.3 Moon orbit

- Model the Moon's orbit around Earth as an inclined circle.
- Inclination: 5.14° to the ecliptic.
- Period: 27.3217 days sidereal.
- Add the line of nodes as a visible line.
- For the MVP, keep the node direction fixed. Add a note that real nodes regress over 18.6 years.
- The Moon's rotation should be tidally locked: the same face points toward Earth.

**Test:** the Moon completes one orbit in 27.32 days; the phase cycle takes 29.53 days because Earth also moves around the Sun.

### 6.4 Moon phases

Compute the phase angle from the Sun–Moon and Earth–Moon vectors:

```text
phaseAngle = angle between (Moon - Earth) and (Sun - Moon)
```

Map the angle to eight phase names. The illuminated fraction is:

```text
illuminated = (1 - cos(phaseAngle)) / 2
```

Check the four cardinal phases:

- New Moon: Moon between Earth and Sun.
- First Quarter: Moon 90° east of the Sun as seen from Earth.
- Full Moon: Earth between Sun and Moon.
- Last Quarter: Moon 90° west of the Sun.

The app should show both the 3D view and a small phase icon.

### 6.5 Seasons

- Determine the sub-solar latitude from the Earth's tilt and orbital position.
- Season labels:
  - Northern spring: March equinox to June solstice.
  - Northern summer: June solstice to September equinox.
  - Northern autumn: September equinox to December solstice.
  - Northern winter: December solstice to March equinox.
- Show the opposite labels for the Southern Hemisphere.
- Do not use distance to the Sun as an input.

**Test:** the four season boundaries occur within ±2 days of the expected dates for the chosen epoch.

### 6.6 Eclipses

- A solar eclipse requires a new moon near a node.
- A lunar eclipse requires a full moon near a node.
- Compute the Moon's ecliptic latitude from the inclination and the argument of latitude.
- Eclipse condition: `|latitude| < threshold` at new/full moon.
- Show the node line and the Moon's latitude in the UI.
- The MVP can demonstrate the *condition* without predicting real eclipse dates.

**Test:** with a 5.14° inclination and a fixed node, eclipse seasons occur roughly twice a year; most new/full moons miss the node.

### 6.7 Earth-observer view

- Place the camera at a selected latitude and longitude on the Earth's surface.
- Provide a local horizon plane and a sky dome.
- Show the Sun and Moon as markers with altitude/azimuth.
- Show a simple day/night gradient.
- For the MVP, a single observer latitude (e.g. 37.5°N, Seoul) is enough; add a latitude slider later.

Keep this view simple: it is a teaching aid, not a planetarium. Do not attempt atmospheric scattering or star catalogs.

### 6.8 Scale handling

Use two modes:

- **Visual mode** — sizes and distances are compressed so all three bodies are visible. Show a persistent "not to scale" badge.
- **True-scale mode** — sizes and distances use real ratios; Earth and Moon become tiny. This is the antidote to the "Earth is close to the Sun" misconception.

At minimum, implement the visual mode and a "scale facts" panel with real numbers. True-scale rendering is a stretch goal.

---

## 7. Screens and UX

### 7.1 Explore screen

- Top: date, season, moon phase, and a play/pause control.
- Center: 3D viewport.
- Bottom: timeline scrubber with season markers.
- Right/left panel: layers, camera mode, speed, scale warning.
- Click Earth or Moon to focus the camera and show a fact card.

### 7.2 Earth-observer screen

- Full-screen sky view with horizon.
- Sun and Moon markers with altitude/azimuth.
- A small inset showing the top-down Earth–Moon–Sun configuration.
- A "return to space" button.

### 7.3 Mission screen

- Mission card with a prediction question.
- The student commits an answer before the simulation moves.
- The simulation sets the date and view.
- The student can explore, then answer the explanation question.
- Completion award and a one-sentence takeaway.

### 7.4 Teacher mode

- Select a mission set.
- Show answers and explanations.
- Reset progress.
- Print a worksheet.
- Toggle the scale warning and labels for classroom projection.

### 7.5 Responsive layout

**Desktop (≥ 1024 px)**

- Viewport with a left mission panel and a right layer panel.

**Tablet (768–1023 px)**

- Collapsible panels; timeline at the bottom.

**Phone (< 768 px)**

- Viewport at the top; bottom sheet with tabs: Time | Layers | Mission.
- Touch orbit and pinch zoom.
- Timeline uses large handles.

### 7.6 Accessibility

- Keyboard: `Space` play/pause, arrow keys scrub time, `1`/`2` switch views, `L` toggles labels.
- Every 3D state has a text summary: date, season, moon phase, eclipse condition.
- Respect `prefers-reduced-motion`: no auto-orbiting camera, no smooth camera flights.
- Use color-blind-safe palette; do not encode seasons by color alone.
- Provide a "read the diagram" panel with the current geometry in words.
- Ensure the timeline is a native range input or has full ARIA support.

---

## 8. Implementation milestones

### M0 — Setup (0.5 day)

- Scaffold Vite + TypeScript + Three.js.
- Add Vitest, Playwright, ESLint, Prettier, PWA plugin.
- Create the module map and a basic scene with a sphere.
- **Verify:** dev server, build, and tests run.

### M1 — Astronomy core (3–4 days)

- Implement constants, time conversion, Earth orbit, Earth rotation, Moon orbit, and phase angle.
- Write unit tests for:
  - Earth position at the four season boundaries.
  - Moon orbital period.
  - Phase names at 0°, 90°, 180°, 270°.
  - Sub-solar latitude at solstices and equinoxes.
- **Verify:** all math tests pass without Three.js.

### M2 — 3D scene (3–4 days)

- Build the Sun, Earth, Moon, stars, orbit lines, and labels.
- Add the Earth day/night shader and a simple atmosphere rim.
- Add the Moon's inclined orbit and node line.
- Implement the camera rig with space and Earth-observer modes.
- **Verify:** the scene matches the computed positions; no z-fighting or scale bugs.

### M3 — Time and layers UI (2–3 days)

- Build the timeline, play/pause, speed presets, and date jump buttons.
- Add layer toggles and the scale warning.
- Add the moon phase icon and season badge.
- **Verify:** scrubbing updates all views without allocating new geometry each frame.

### M4 — Missions (2–3 days)

- Author six missions across seasons, phases, eclipses, and scale.
- Implement the prediction gate, answer checking, and explanations.
- Add progress persistence and teacher reset.
- **Verify:** every mission can be completed from a fresh state.

### M5 — Earth-observer view (2–3 days)

- Implement the local horizon, sky dome, and Sun/Moon markers.
- Add the top-down inset.
- Add the observer latitude control if time allows; otherwise fix it to Seoul.
- **Verify:** the Sun is above the horizon during local day and below at night.

### M6 — Responsive, accessibility, PWA (2 days)

- Implement the three layouts.
- Add keyboard controls, text summaries, reduced motion.
- Configure offline caching.
- **Verify:** keyboard-only mission completion; offline reload.

### M7 — QA and pilot (2 days)

- Run all tests and screenshot checks.
- Test on a low-end tablet.
- Ask 3–5 students to try the seasons and phases missions.
- Fix the top usability issues.
- Deploy.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- Earth orbital angle after 365.2422 days returns to the start.
- June solstice: North Pole tilted toward the Sun.
- December solstice: North Pole tilted away.
- Equinox: sub-solar latitude near 0°.
- Moon phase names at the four cardinal angles.
- Synodic vs sidereal month difference.
- Eclipse condition: new/full moon near node; not every month.
- Date conversion across leap years and month boundaries.

### Interaction tests (Playwright)

- Scrub the timeline and confirm the date and season update.
- Switch to Earth-observer view and back.
- Toggle each layer.
- Complete a mission correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only path through the seasons mission.

### Visual tests

- Screenshot the March equinox, June solstice, and a full moon.
- Screenshot the Earth-observer view at noon and midnight.
- Run at 1440×900, 1024×768, and 390×844.
- Check that the "not to scale" badge is always visible in visual mode.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Keyboard reaches every control.
- Reduced motion disables camera flights and auto-play.
- Text summary matches the current scene.
- Color is not the only season cue.

### Performance budget

- 60 fps on a mid-range laptop; ≥ 30 fps on a school tablet.
- No per-frame object creation.
- Pause rendering when the tab is hidden.
- DPR clamp to 2.
- Initial load < 2.5 s on simulated 4G.

---

## 10. Acceptance criteria / Go-No-Go

- [ ] Earth's tilt and orbit produce the correct season labels within ±2 days.
- [ ] The four cardinal moon phases match the geometry.
- [ ] The Moon's 5.14° inclination and node line are visible.
- [ ] The app demonstrates why eclipses do not happen every month.
- [ ] Space and Earth-observer views both work.
- [ ] Six missions are playable, scored, and saved locally.
- [ ] Teacher reset works.
- [ ] Keyboard-only mission completion works.
- [ ] Reduced motion is respected.
- [ ] The "not to scale" warning is visible in visual mode.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.
- [ ] No claim of real eclipse forecasting anywhere in the UI.

If the season or phase tests fail, stop and fix the astronomy before adding missions.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Students think distance causes seasons | Core misconception persists | Circular orbit in the MVP; explicit "distance is not the cause" mission |
| Simplified orbits are mistaken for real ephemeris | False claims | Persistent "concept model" label; no eclipse date predictions |
| Moon phases or eclipse geometry is wrong | Teaches incorrect science | Unit tests for cardinal phases and node conditions; teacher review |
| Earth-observer mode becomes a planetarium project | Scope creep | Fixed observer latitude; simple markers only |
| Shader or atmosphere effects hurt tablet performance | Unusable in class | Procedural simple shader; quality tiers; no post-processing |
| Camera flights cause motion sickness | Discomfort | Reduced-motion mode; instant cuts instead of flights |
| Visual scale exaggerates proximity | Misconception | "Not to scale" badge; scale facts panel; true-scale stretch goal |
| Labels overlap on small screens | Confusing UI | Hide labels by default on phone; tap to reveal |

---

## 12. AI build guide

Use the AI coding agent for scaffolding, math implementation, shaders, tests, and screenshot-driven fixes. Astronomy is easy to make plausible but wrong, so tests and teacher review are mandatory.

### Recommended build order

1. Scaffold Vite + TypeScript + Three.js with tests.
2. Implement the pure astronomy math and unit tests first.
3. Build the Sun–Earth–Moon scene with orbit lines.
4. Add the day/night shader and the Earth tilt.
5. Add the Moon inclination, node line, and phase calculation.
6. Add the timeline and camera modes.
7. Add missions and teacher mode.
8. Add the Earth-observer view.
9. Do responsive/accessibility passes.
10. Use screenshots at three viewports and fix visual regressions.

### Prompt rules

- State the constraint: “No backend, no runtime AI, no network calls.”
- Require a test for every astronomy formula.
- Ask the agent to explain the coordinate frame before coding.
- Use a fixed epoch and exact expected dates in tests.
- Never let the app claim to predict real eclipses.
- Provide screenshots when fixing camera or shader issues.

### What not to delegate

- The decision that the season model is pedagogically correct.
- The claim that an eclipse configuration is scientifically valid.
- The final review of the Earth-observer view.
- Accessibility judgment.
- Classroom pilot feedback.

### Definition of done

- All astronomy and interaction tests pass.
- The acceptance checklist is complete.
- A teacher can run the six missions without developer help.
- The model's simplifications are visible in the UI.

---

## 13. Future extensions

- True-scale mode with real size/distance ratios.
- Other planets and moons.
- Tides and barycenter.
- Moon-observer view.
- Latitude/longitude observer controls.
- Real ephemeris data as an optional, clearly labeled mode.
- Classroom worksheet generator.
- Localization.

---

## 14. References

- NASA Solar System Exploration: https://science.nasa.gov/solar-system/
- NASA Moon phases: https://science.nasa.gov/moon/moon-phases/
- NOAA seasons and equinoxes: https://www.noaa.gov/
- Three.js documentation: https://threejs.org/docs/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/

---

**Plan version:** 1.0
**Created:** 2026-10-27
**Next step:** scaffold the project, then implement M1 (astronomy core + tests) before building the scene.
