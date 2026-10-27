import { findNearestSyzygy, syzygyAt } from '../src/astro/eclipses';
import { formatDateTimeKo } from '../src/astro/time';
import { moonPhaseAt } from '../src/astro/phases';
import { moonEclipticLatitudeDeg } from '../src/astro/orbits';

console.log('=== new moons ===');
let cursor = -20;
for (let i = 0; i < 28; i++) {
  const found = findNearestSyzygy(cursor + 14.8, 'new', 14);
  const s = syzygyAt(found.days, 'new');
  if (found.days > 400) break;
  console.log(`day=${found.days.toFixed(3)} ${formatDateTimeKo(found.days)} phase=${s.phaseAngleDeg.toFixed(3)} lat=${s.moonLatitudeDeg.toFixed(3)} node=${s.nodeDistanceDeg.toFixed(2)} possible=${s.possible}`);
  cursor = found.days;
}
console.log('=== full moons ===');
cursor = -20;
for (let i = 0; i < 28; i++) {
  const found = findNearestSyzygy(cursor + 14.8, 'full', 14);
  const s = syzygyAt(found.days, 'full');
  if (found.days > 400) break;
  console.log(`day=${found.days.toFixed(3)} ${formatDateTimeKo(found.days)} phase=${s.phaseAngleDeg.toFixed(3)} lat=${s.moonLatitudeDeg.toFixed(3)} node=${s.nodeDistanceDeg.toFixed(2)} possible=${s.possible}`);
  cursor = found.days;
}
console.log('=== selected candidate dates ===');
for (const d of [-21.5, -1.5, 0, 0.4, 14.358, 29.128, 44, 60, 73, 90, 118, 147, 176, 205, 235, 265, 294]) {
  const p = moonPhaseAt(d);
  console.log(`day=${d} ${formatDateTimeKo(d)} phase=${p.angleDeg.toFixed(1)} ${p.name} lat=${moonEclipticLatitudeDeg(d).toFixed(2)}`);
}
