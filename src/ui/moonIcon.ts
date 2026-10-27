/**
 * Draws a moon-phase icon on a canvas. The icon is a teaching aid, not an
 * attempt to model the exact lunar terminator or libration.
 */
export function drawMoonPhaseIcon(
  canvas: HTMLCanvasElement,
  phaseAngleRad: number,
  sizeCss = 34,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(1, Math.round(sizeCss * dpr));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.scale(dpr, dpr);

  const cx = sizeCss / 2;
  const cy = sizeCss / 2;
  const r = sizeCss / 2 - 1.5;
  const phase = ((phaseAngleRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const waxing = phase <= Math.PI;
  const cos = Math.cos(phase);

  // Full moon disk.
  const diskGradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  diskGradient.addColorStop(0, '#fff9e9');
  diskGradient.addColorStop(0.6, '#e8dfc8');
  diskGradient.addColorStop(1, '#bdb39d');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = diskGradient;
  ctx.fill();

  ctx.save();
  ctx.clip();
  const craters: Array<[number, number, number, number]> = [
    [-0.32, -0.18, 0.16, 0.14],
    [0.18, 0.24, 0.2, 0.17],
    [0.36, -0.34, 0.1, 0.1],
  ];
  for (const [ox, oy, rx, ry] of craters) {
    ctx.beginPath();
    ctx.ellipse(cx + ox * r, cy + oy * r, rx * r, ry * r, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 112, 96, 0.18)';
    ctx.fill();
  }
  ctx.restore();

  // Dark shadow. The waxing geometry is mirrored for waning phases.
  ctx.save();
  if (!waxing) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true);
  const ellipseRadius = Math.abs(cos) * r;
  if (cos >= 0) {
    ctx.ellipse(cx, cy, ellipseRadius, r, 0, Math.PI / 2, -Math.PI / 2, true);
  } else {
    ctx.ellipse(cx, cy, ellipseRadius, r, 0, Math.PI / 2, (3 * Math.PI) / 2, false);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(12, 18, 34, 0.96)';
  ctx.fill();
  ctx.restore();

  // Rim.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(210, 220, 245, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
