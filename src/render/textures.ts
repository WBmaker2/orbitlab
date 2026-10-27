import * as THREE from 'three';

/** Deterministic RNG so the procedural maps look the same on every load. */
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

function makeTexture(canvas: HTMLCanvasElement, repeatS = THREE.RepeatWrapping): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = repeatS;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

interface Continent {
  name: string;
  points: Array<[number, number]>;
  fill: string;
  accent?: string;
}

const CONTINENTS: Continent[] = [
  {
    name: 'north-america',
    fill: '#3f7c53',
    accent: '#8c9a58',
    points: [
      [-168, 64],
      [-150, 70],
      [-130, 72],
      [-110, 72],
      [-95, 70],
      [-80, 63],
      [-62, 55],
      [-55, 47],
      [-70, 42],
      [-75, 34],
      [-82, 25],
      [-97, 20],
      [-106, 22],
      [-115, 31],
      [-125, 40],
      [-130, 53],
      [-148, 59],
      [-168, 64],
    ],
  },
  {
    name: 'greenland',
    fill: '#dce9ef',
    accent: '#b9d3db',
    points: [
      [-58, 82],
      [-30, 83],
      [-18, 76],
      [-22, 68],
      [-42, 60],
      [-55, 67],
      [-59, 76],
    ],
  },
  {
    name: 'south-america',
    fill: '#3c7d4d',
    accent: '#9b8b52',
    points: [
      [-81, 11],
      [-64, 11],
      [-50, 3],
      [-35, -6],
      [-40, -20],
      [-49, -29],
      [-58, -39],
      [-69, -55],
      [-75, -46],
      [-78, -33],
      [-81, -15],
      [-81, 0],
    ],
  },
  {
    name: 'africa',
    fill: '#8a7c46',
    accent: '#3f7a4e',
    points: [
      [-17, 35],
      [0, 37],
      [20, 33],
      [33, 31],
      [43, 12],
      [50, -2],
      [41, -17],
      [35, -30],
      [18, -35],
      [10, -25],
      [7, -6],
      [0, 5],
      [-15, 13],
      [-17, 25],
    ],
  },
  {
    name: 'europe',
    fill: '#4d7d57',
    accent: '#9f9b5e',
    points: [
      [-10, 36],
      [-5, 44],
      [2, 51],
      [10, 57],
      [22, 60],
      [40, 58],
      [45, 48],
      [35, 43],
      [22, 40],
      [10, 37],
      [-2, 36],
    ],
  },
  {
    name: 'asia',
    fill: '#5f7e4b',
    accent: '#a7945c',
    points: [
      [28, 44],
      [40, 58],
      [60, 68],
      [85, 74],
      [110, 73],
      [130, 68],
      [150, 59],
      [178, 64],
      [178, 48],
      [155, 45],
      [142, 40],
      [132, 32],
      [122, 22],
      [110, 12],
      [100, 7],
      [90, 10],
      [78, 20],
      [65, 25],
      [55, 30],
      [45, 36],
      [35, 38],
    ],
  },
  {
    name: 'india',
    fill: '#7c8a48',
    accent: '#ad9150',
    points: [
      [67, 24],
      [76, 31],
      [88, 24],
      [91, 10],
      [82, 7],
      [75, 16],
      [70, 20],
    ],
  },
  {
    name: 'australia',
    fill: '#a07a49',
    accent: '#6f8549',
    points: [
      [112, -21],
      [122, -13],
      [138, -12],
      [150, -20],
      [154, -29],
      [146, -39],
      [132, -34],
      [118, -35],
      [113, -28],
    ],
  },
  {
    name: 'japan',
    fill: '#477d58',
    accent: '#b3a066',
    points: [
      [129, 33],
      [136, 38],
      [143, 45],
      [146, 41],
      [141, 33],
      [134, 31],
    ],
  },
  {
    name: 'uk',
    fill: '#4f7d58',
    points: [
      [-8, 58],
      [-2, 60],
      [2, 54],
      [-3, 50],
      [-8, 52],
    ],
  },
  {
    name: 'madagascar',
    fill: '#6f8a4b',
    points: [
      [44, -12],
      [50, -17],
      [48, -25],
      [44, -22],
    ],
  },
  {
    name: 'new-zealand',
    fill: '#4f7d58',
    points: [
      [166, -34],
      [174, -38],
      [178, -45],
      [170, -47],
      [168, -41],
    ],
  },
  {
    name: 'indonesia',
    fill: '#3e7f52',
    points: [
      [95, 5],
      [120, 4],
      [130, -2],
      [120, -8],
      [103, -6],
      [96, -2],
    ],
  },
];

function drawOcean(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#123b68');
  gradient.addColorStop(0.18, '#0d315c');
  gradient.addColorStop(0.5, '#0f4c86');
  gradient.addColorStop(0.82, '#0d315c');
  gradient.addColorStop(1, '#123b68');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = 20 + random() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(45, 120, 180, 0.055)');
    g.addColorStop(1, 'rgba(45, 120, 180, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (let i = 0; i < 6000; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const alpha = 0.012 + random() * 0.025;
    ctx.fillStyle = `rgba(170, 220, 255, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawContinent(ctx: CanvasRenderingContext2D, width: number, height: number, continent: Continent, random: () => number): void {
  const xOf = (lon: number) => (0.5 - lon / 360) * width;
  const yOf = (lat: number) => (0.5 - lat / 180) * height;

  ctx.save();
  ctx.beginPath();
  continent.points.forEach(([lon, lat], index) => {
    const x = xOf(lon);
    const y = yOf(lat);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  ctx.fillStyle = continent.fill;
  ctx.fill();

  // Shelf / coastal glow.
  ctx.strokeStyle = 'rgba(120, 190, 220, 0.35)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 235, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Biome variation clipped inside the continent.
  ctx.clip();
  for (let i = 0; i < 70; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 12 + random() * 85;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, continent.accent ?? 'rgba(130, 150, 90, 0.35)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.16 + random() * 0.2;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A few inland "deserts" and lakes.
  for (let i = 0; i < 12; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 4 + random() * 26;
    ctx.fillStyle = random() > 0.72 ? 'rgba(58, 120, 160, 0.75)' : 'rgba(178, 156, 102, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIceCaps(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  const north = ctx.createLinearGradient(0, 0, 0, height * 0.11);
  north.addColorStop(0, 'rgba(240, 249, 255, 0.98)');
  north.addColorStop(0.55, 'rgba(228, 244, 255, 0.72)');
  north.addColorStop(1, 'rgba(228, 244, 255, 0)');
  ctx.fillStyle = north;
  ctx.fillRect(0, 0, width, height * 0.11);

  const south = ctx.createLinearGradient(0, height, 0, height * 0.86);
  south.addColorStop(0, 'rgba(240, 249, 255, 1)');
  south.addColorStop(0.5, 'rgba(232, 246, 255, 0.9)');
  south.addColorStop(1, 'rgba(232, 246, 255, 0)');
  ctx.fillStyle = south;
  ctx.fillRect(0, height * 0.86, width, height * 0.14);

  // Jagged sea-ice edge.
  ctx.save();
  ctx.fillStyle = 'rgba(235, 248, 255, 0.8)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= width; x += 24) {
    const y = height * 0.075 + Math.sin(x * 0.031) * height * 0.012 + random() * height * 0.008;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 28) {
    const y = height * 0.93 + Math.sin(x * 0.027) * height * 0.014 + random() * height * 0.008;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCloudBands(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 42; i += 1) {
    const y = height * (0.08 + random() * 0.84);
    const x = random() * width;
    const rx = 35 + random() * 190;
    const ry = 9 + random() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0.06)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function createEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const random = mulberry32(0x0b17a9);

  drawOcean(ctx, width, height, random);
  for (const continent of CONTINENTS) {
    drawContinent(ctx, width, height, continent, random);
  }
  drawIceCaps(ctx, width, height, random);
  drawCloudBands(ctx, width, height, random);

  // Subtle vignette at the poles to help the sphere feel round.
  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(3, 12, 30, 0.22)');
  vignette.addColorStop(0.15, 'rgba(3, 12, 30, 0)');
  vignette.addColorStop(0.85, 'rgba(3, 12, 30, 0)');
  vignette.addColorStop(1, 'rgba(3, 12, 30, 0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return makeTexture(canvas);
}

export function createMoonTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const random = mulberry32(0x51f1e2);

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#b6b3ad');
  base.addColorStop(0.5, '#9a978f');
  base.addColorStop(1, '#85827c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // The near side faces Earth (+Z = 90°E in the model); place the maria there.
  const mariaCenters: Array<[number, number, number]> = [
    [0.23, 0.36, 0.17],
    [0.29, 0.46, 0.2],
    [0.18, 0.5, 0.12],
    [0.3, 0.3, 0.09],
    [0.12, 0.42, 0.08],
    [0.33, 0.58, 0.11],
    [0.24, 0.62, 0.08],
  ];
  ctx.save();
  for (const [cx, cy, r] of mariaCenters) {
    const g = ctx.createRadialGradient(
      cx * width,
      cy * height,
      0,
      cx * width,
      cy * height,
      r * width,
    );
    g.addColorStop(0, 'rgba(93, 94, 96, 0.78)');
    g.addColorStop(0.7, 'rgba(108, 108, 108, 0.45)');
    g.addColorStop(1, 'rgba(120, 120, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx * width, cy * height, r * width, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Fine regolith speckle.
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const light = random() > 0.5;
    ctx.fillStyle = light ? 'rgba(230, 227, 218, 0.14)' : 'rgba(35, 35, 36, 0.13)';
    ctx.fillRect(x, y, 1 + random() * 1.3, 1 + random() * 1.3);
  }

  // Craters.
  for (let i = 0; i < 260; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 1.2 + Math.pow(random(), 2.1) * 24;
    const rim = ctx.createRadialGradient(x - r * 0.22, y - r * 0.22, r * 0.1, x, y, r);
    rim.addColorStop(0, 'rgba(245, 241, 230, 0.38)');
    rim.addColorStop(0.55, 'rgba(150, 147, 140, 0.08)');
    rim.addColorStop(0.82, 'rgba(62, 62, 63, 0.28)');
    rim.addColorStop(1, 'rgba(62, 62, 63, 0)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(225, 221, 210, 0.12)';
    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bright ray crater near the south-east of the near side.
  ctx.save();
  const tychoX = 0.34 * width;
  const tychoY = 0.68 * height;
  const glow = ctx.createRadialGradient(tychoX, tychoY, 0, tychoX, tychoY, 90);
  glow.addColorStop(0, 'rgba(255, 252, 240, 0.7)');
  glow.addColorStop(0.25, 'rgba(255, 250, 235, 0.22)');
  glow.addColorStop(1, 'rgba(255, 250, 235, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tychoX, tychoY, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 246, 232, 0.16)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 34; i += 1) {
    const angle = random() * Math.PI * 2;
    const len = 35 + random() * 150;
    ctx.beginPath();
    ctx.moveTo(tychoX, tychoY);
    ctx.lineTo(tychoX + Math.cos(angle) * len, tychoY + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  return makeTexture(canvas);
}

export function createSunTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const random = mulberry32(0x5a4f21);

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#ff9f1a');
  base.addColorStop(0.25, '#ffc44d');
  base.addColorStop(0.5, '#ffe08a');
  base.addColorStop(0.75, '#ffc44d');
  base.addColorStop(1, '#ff9f1a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 4 + random() * 55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = random() > 0.45;
    g.addColorStop(0, warm ? 'rgba(255, 248, 205, 0.24)' : 'rgba(255, 120, 20, 0.2)');
    g.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return makeTexture(canvas);
}

export function createGlowTexture(inner = 'rgba(255, 229, 156, 1)', outer = 'rgba(255, 170, 60, 0)'): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, 'rgba(255, 220, 130, 0.82)');
  g.addColorStop(0.45, 'rgba(255, 170, 70, 0.24)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createStarTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.35, 'rgba(255, 255, 255, 0.75)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
