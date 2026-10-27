import { moonPhaseAt } from '../src/astro/phases';
import { findNearestSyzygy } from '../src/astro/eclipses';
for (let d = 101.5; d <= 104; d += 0.1) {
  console.log(d.toFixed(2), moonPhaseAt(d).angleDeg.toFixed(3));
}
console.log('found', findNearestSyzygy(102.4, 'full', 14));
console.log('found2', findNearestSyzygy(102.9, 'full', 14));
