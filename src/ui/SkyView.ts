import { moonOrbitBasis, moonRelativePosition } from '../astro/orbits';
import { clamp, dot, type Vec3 } from '../astro/geometry';
import type { ObserverSky } from '../astro/observer';

interface Star {
  azimuth: number;
  altitude: number;
  size: number;
  brightness: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

type Rgb = [number, number, number];

function mixTuple(a: Rgb, b: Rgb, t: number): Rgb {
  const clamped = clamp(t, 0, 1);
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

function cssColor(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const NIGHT_TOP = hexToRgb('#030712');
const NIGHT_MID = hexToRgb('#081226');
const NIGHT_HORIZON = hexToRgb('#12213a');
const TWILIGHT_TOP = hexToRgb('#182a4b');
const TWILIGHT_MID = hexToRgb('#4e5f8c');
const TWILIGHT_HORIZON = hexToRgb('#d08a5c');
const DAY_TOP = hexToRgb('#20558f');
const DAY_MID = hexToRgb('#5d9bce');
const DAY_HORIZON = hexToRgb('#cfe6f3');

export class SkyView {
  private readonly skyCtx: CanvasRenderingContext2D;
  private readonly insetCtx: CanvasRenderingContext2D;
  private readonly stars: Star[] = [];
  private width = 0;
  private height = 0;
  private insetWidth = 0;
  private insetHeight = 0;

  constructor(
    private readonly skyCanvas: HTMLCanvasElement,
    private readonly insetCanvas: HTMLCanvasElement,
  ) {
    const skyCtx = skyCanvas.getContext('2d');
    const insetCtx = insetCanvas.getContext('2d');
    if (!skyCtx || !insetCtx) throw new Error('2D canvas context unavailable');
    this.skyCtx = skyCtx;
    this.insetCtx = insetCtx;

    const random = mulberry32(0x2e4a91);
    for (let i = 0; i < 150; i += 1) {
      this.stars.push({
        azimuth: random() * 360,
        altitude: Math.asin(random()) * (180 / Math.PI),
        size: 0.6 + random() * 1.5,
        brightness: 0.35 + random() * 0.65,
      });
    }
  }

  draw(days: number, sky: ObserverSky): void {
    this.resizeIfNeeded();
    if (this.width <= 0 || this.height <= 0) return;
    this.drawSky(days, sky);
    this.drawInset(days, sky);
  }

  resize(): void {
    this.width = 0;
    this.height = 0;
    this.insetWidth = 0;
    this.insetHeight = 0;
  }

  private resizeIfNeeded(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const skyWidth = this.skyCanvas.clientWidth;
    const skyHeight = this.skyCanvas.clientHeight;
    if (skyWidth <= 0 || skyHeight <= 0) return;
    const pixelWidth = Math.round(skyWidth * dpr);
    const pixelHeight = Math.round(skyHeight * dpr);
    if (this.skyCanvas.width !== pixelWidth || this.skyCanvas.height !== pixelHeight) {
      this.skyCanvas.width = pixelWidth;
      this.skyCanvas.height = pixelHeight;
    }
    this.width = skyWidth;
    this.height = skyHeight;
    this.skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const insetWidth = this.insetCanvas.clientWidth;
    const insetHeight = this.insetCanvas.clientHeight;
    if (insetWidth > 0 && insetHeight > 0) {
      const insetPixelWidth = Math.round(insetWidth * dpr);
      const insetPixelHeight = Math.round(insetHeight * dpr);
      if (
        this.insetCanvas.width !== insetPixelWidth ||
        this.insetCanvas.height !== insetPixelHeight
      ) {
        this.insetCanvas.width = insetPixelWidth;
        this.insetCanvas.height = insetPixelHeight;
      }
      this.insetWidth = insetWidth;
      this.insetHeight = insetHeight;
      this.insetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  private drawSky(days: number, sky: ObserverSky): void {
    const ctx = this.skyCtx;
    const width = this.width;
    const height = this.height;
    const horizonY = height * 0.71;
    const sunAltitude = sky.sun.altitudeDeg;
    const daylight = clamp((sunAltitude + 6) / 12, 0, 1);
    const blend = (night: Rgb, twilight: Rgb, day: Rgb): string => {
      if (sunAltitude <= -12) return cssColor(night);
      if (sunAltitude < 0) return cssColor(mixTuple(night, twilight, (sunAltitude + 12) / 12));
      if (sunAltitude < 10) return cssColor(mixTuple(twilight, day, sunAltitude / 10));
      return cssColor(day);
    };

    ctx.clearRect(0, 0, width, height);

    const top = blend(NIGHT_TOP, TWILIGHT_TOP, DAY_TOP);
    const mid = blend(NIGHT_MID, TWILIGHT_MID, DAY_MID);
    const horizon = blend(NIGHT_HORIZON, TWILIGHT_HORIZON, DAY_HORIZON);

    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, top);
    skyGradient.addColorStop(0.58, mid);
    skyGradient.addColorStop(1, horizon);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, horizonY + 1);

    // Stars, fading with daylight and rotating with the day.
    if (daylight < 0.92) {
      const rotation = (days * 360.9856) % 360;
      for (const star of this.stars) {
        const alpha = star.brightness * (1 - daylight);
        if (alpha < 0.03) continue;
        const azimuth = (star.azimuth + rotation) % 360;
        const x = (azimuth / 360) * width;
        const y = horizonY * (1 - star.altitude / 90);
        if (y < 0 || y > horizonY) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#eaf2ff';
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // A faint glow around the Sun's position, even below the horizon.
    const sunX = (sky.sun.azimuthDeg / 360) * width;
    const sunY = horizonY * (1 - sunAltitude / 90);
    if (sunY < height + 90) {
      const glowRadius = 118;
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
      const glowStrength = sunAltitude > 0 ? 0.5 : 0.22;
      glow.addColorStop(0, `rgba(255, 220, 140, ${glowStrength})`);
      glow.addColorStop(0.35, `rgba(255, 184, 90, ${glowStrength * 0.45})`);
      glow.addColorStop(1, 'rgba(255, 170, 70, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground.
    const groundGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGradient.addColorStop(0, cssColor(mixTuple(hexToRgb('#0b121c'), hexToRgb('#243028'), daylight)));
    groundGradient.addColorStop(1, cssColor(mixTuple(hexToRgb('#04070c'), hexToRgb('#0a1110'), daylight)));
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // Altitude guides.
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 235, 255, 0.14)';
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    for (const altitude of [30, 60]) {
      const y = horizonY * (1 - altitude / 90);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 235, 255, 0.46)';
      ctx.font = '600 10px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(`${altitude}°`, 8, y - 4);
    }
    ctx.restore();

    // Horizon line.
    ctx.strokeStyle = 'rgba(226, 240, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // Compass labels.
    const compass: Array<[number, string]> = [
      [0, '북'],
      [90, '동'],
      [180, '남'],
      [270, '서'],
    ];
    ctx.save();
    ctx.font = '700 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const [azimuth, label] of compass) {
      const x = (azimuth / 360) * width;
      ctx.fillStyle = 'rgba(235, 244, 255, 0.82)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 6;
      ctx.fillText(label, x === 0 ? 14 : x === width ? width - 14 : x, horizonY + 8);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(235, 244, 255, 0.55)';
      ctx.beginPath();
      ctx.moveTo(x, horizonY - 5);
      ctx.lineTo(x, horizonY + 3);
      ctx.stroke();
    }
    ctx.restore();

    // Sun marker.
    const sunVisible = sunY <= height + 12;
    const sunAlpha = sunAltitude > 0 ? 1 : 0.34;
    if (sunVisible) {
      ctx.globalAlpha = sunAlpha;
      const disk = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, 10);
      disk.addColorStop(0, '#fffdf0');
      disk.addColorStop(0.55, '#ffe08a');
      disk.addColorStop(1, '#ffb347');
      ctx.fillStyle = disk;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 245, 200, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      this.drawPill(ctx, sunX, sunY, '태양', sunX > width - 70 ? 'left' : 'right');
      ctx.globalAlpha = 1;
    }

    // Moon marker.
    const moonX = (sky.moon.azimuthDeg / 360) * width;
    const moonY = horizonY * (1 - sky.moon.altitudeDeg / 90);
    if (moonY <= height + 12) {
      const moonAlpha = sky.moon.altitudeDeg > 0 ? 1 : 0.35;
      ctx.globalAlpha = moonAlpha;
      const angleToSun = Math.atan2(sunY - moonY, sunX - moonX);
      this.drawOrientedMoon(this.skyCtx, moonX, moonY, 10, sky.moonPhase.angleRad, angleToSun);
      this.drawPill(ctx, moonX, moonY, `달 · ${sky.moonPhase.nameKo}`, moonX > width - 110 ? 'left' : 'right');
      ctx.globalAlpha = 1;
    }

    // Horizon label.
    ctx.save();
    ctx.fillStyle = 'rgba(210, 228, 250, 0.45)';
    ctx.font = '500 10px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('지평선', 8, horizonY - 6);
    ctx.restore();
  }

  private drawPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    side: 'left' | 'right',
  ): void {
    ctx.save();
    ctx.font = '600 11px -apple-system, "Apple SD Gothic Neo", sans-serif';
    const metrics = ctx.measureText(text);
    const paddingX = 6;
    const width = metrics.width + paddingX * 2;
    const height = 19;
    let boxX = side === 'right' ? x + 16 : x - 16 - width;
    boxX = clamp(boxX, 4, this.width - width - 4);
    const boxY = clamp(y - height / 2, 4, this.height - height - 4);
    ctx.fillStyle = 'rgba(6, 11, 22, 0.72)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, width, height, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 210, 245, 0.18)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(240, 246, 255, 0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxX + paddingX, boxY + height / 2 + 0.5);
    ctx.restore();
  }

  private drawOrientedMoon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    phaseAngle: number,
    angleToSun: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(93, 102, 122, 0.62)';
    ctx.fill();

    const cos = Math.cos(phaseAngle);
    ctx.rotate(angleToSun);
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    if (cos >= 0) {
      ctx.ellipse(0, 0, Math.abs(cos) * radius, radius, 0, Math.PI / 2, -Math.PI / 2, true);
    } else {
      ctx.ellipse(0, 0, Math.abs(cos) * radius, radius, 0, Math.PI / 2, (3 * Math.PI) / 2, false);
    }
    ctx.closePath();
    const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
    gradient.addColorStop(0, '#fff9e9');
    gradient.addColorStop(1, '#c9bfa8');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240, 246, 255, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  private drawInset(days: number, sky: ObserverSky): void {
    if (this.insetWidth <= 0 || this.insetHeight <= 0) return;
    const ctx = this.insetCtx;
    const width = this.insetWidth;
    const height = this.insetHeight;
    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(10, 18, 34, 0.94)');
    background.addColorStop(1, 'rgba(5, 9, 18, 0.96)');
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();

    const earthCenter = { x: width * 0.62, y: height * 0.54 };
    const sunDirHelio = sky.sunDirectionFromEarth;
    const sunDir2: Vec3 = { x: sunDirHelio.x, y: 0, z: sunDirHelio.z };
    const sunLength = Math.hypot(sunDir2.x, sunDir2.z) || 1;
    const sunDir: Vec3 = { x: sunDir2.x / sunLength, y: 0, z: sunDir2.z / sunLength };
    const perp: Vec3 = { x: -sunDir.z, y: 0, z: sunDir.x };
    const relative = moonRelativePosition(days);
    const solarComponent = dot(relative, sunDir);
    const perpComponent = dot(relative, perp);
    const orbitRadius = Math.min(width * 0.31, height * 0.36);

    // Sun at the left edge.
    const sunX = 22;
    const sunY = height / 2;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 27);
    sunGlow.addColorStop(0, 'rgba(255, 246, 198, 0.95)');
    sunGlow.addColorStop(0.4, 'rgba(255, 196, 80, 0.4)');
    sunGlow.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Sunlight line.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 213, 120, 0.32)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(sunX + 12, sunY);
    ctx.lineTo(earthCenter.x - 12, earthCenter.y);
    ctx.stroke();
    ctx.restore();

    // Moon orbit and nodes.
    ctx.strokeStyle = 'rgba(155, 177, 224, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(earthCenter.x, earthCenter.y, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();

    const { node } = moonOrbitBasis();
    const nodeSolar = (node.x * sunDir.x + node.z * sunDir.z) * orbitRadius;
    const nodePerp = (node.x * perp.x + node.z * perp.z) * orbitRadius;
    ctx.save();
    ctx.strokeStyle = 'rgba(179, 156, 255, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(earthCenter.x - nodeSolar, earthCenter.y - nodePerp);
    ctx.lineTo(earthCenter.x + nodeSolar, earthCenter.y + nodePerp);
    ctx.stroke();
    ctx.restore();

    // Earth.
    const earthGlow = ctx.createRadialGradient(
      earthCenter.x,
      earthCenter.y,
      0,
      earthCenter.x,
      earthCenter.y,
      16,
    );
    earthGlow.addColorStop(0, 'rgba(100, 190, 255, 0.45)');
    earthGlow.addColorStop(1, 'rgba(60, 130, 220, 0)');
    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(earthCenter.x, earthCenter.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fa3e3';
    ctx.beginPath();
    ctx.arc(earthCenter.x, earthCenter.y, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Moon.
    const moonX = earthCenter.x - (solarComponent / 384_400) * orbitRadius;
    const moonY = earthCenter.y + (perpComponent / 384_400) * orbitRadius;
    this.drawOrientedMoon(ctx, moonX, moonY, 5.2, sky.moonPhase.angleRad, Math.atan2(sunY - moonY, sunX - moonX));

    ctx.fillStyle = 'rgba(224, 236, 255, 0.8)';
    ctx.font = '600 10px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('지구', earthCenter.x, earthCenter.y + 22);
    ctx.fillText('달', moonX, moonY - 10);
    ctx.textAlign = 'left';
    ctx.fillText('태양 방향', sunX - 4, sunY - 20);
    ctx.fillStyle = 'rgba(224, 236, 255, 0.45)';
    ctx.font = '500 9px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('위에서 본 모식도 · 축척 아님', 8, height - 8);
  }
}
