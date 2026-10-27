import { moonPhaseAt } from '../src/astro/phases';
import { moonEclipticLatitudeDeg, moonNodeDistanceDeg } from '../src/astro/orbits';
import { formatDateTimeKo } from '../src/astro/time';
import { shortestAngle } from '../src/astro/geometry';

function refine(targetDay: number, kind: 'new' | 'full') {
  const target = kind === 'new' ? 0 : Math.PI;
  let lo = targetDay - 0.5;
  let hi = targetDay + 0.5;
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const d1 = Math.abs(shortestAngle(target, moonPhaseAt(m1).angleRad));
    const d2 = Math.abs(shortestAngle(target, moonPhaseAt(m2).angleRad));
    if (d1 < d2) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
}

const found: { kind: 'new' | 'full'; day: number; phase: number; lat: number; node: number }[] = [];
let prevAngle = moonPhaseAt(-30).angleRad;
for (let d = -30; d <= 420; d += 0.01) {
  const angle = moonPhaseAt(d).angleRad;
  for (const [kind, target] of [
    ['new', 0],
    ['full', Math.PI],
  ] as const) {
    const prevDiff = shortestAngle(target, prevAngle);
    const diff = shortestAngle(target, angle);
    if (Math.sign(prevDiff) !== Math.sign(diff) && Math.abs(prevDiff) < 0.4) {
      const exact = refine(d, kind);
      if (!found.some((f) => f.kind === kind && Math.abs(f.day - exact) < 1)) {
        found.push({
          kind,
          day: exact,
          phase: moonPhaseAt(exact).angleDeg,
          lat: moonEclipticLatitudeDeg(exact),
          node: moonNodeDistanceDeg(exact),
        });
      }
    }
  }
  prevAngle = angle;
}

for (const f of found.sort((a, b) => a.day - b.day)) {
  const possible = f.kind === 'new' ? Math.abs(f.lat) < 1.5 : Math.abs(f.lat) < 1.0;
  console.log(
    `${f.kind.padEnd(4)} day=${f.day.toFixed(4)} ${formatDateTimeKo(f.day)} lat=${f.lat.toFixed(3)} node=${f.node.toFixed(2)} phase=${f.phase.toFixed(2)} possible=${possible}`,
  );
}
console.log('\nfirst quarter dates near 36:');
for (let d = 34; d <= 40; d += 0.1) {
  const a = moonPhaseAt(d).angleDeg;
  if (Math.abs(a - 90) < 2) console.log(d.toFixed(2), a.toFixed(2));
}
