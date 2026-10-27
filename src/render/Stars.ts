import * as THREE from 'three';
import { SCENE } from './scale';
import { createStarTexture } from './textures';

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

function randomDirection(random: () => number): THREE.Vector3 {
  const u = random() * 2 - 1;
  const theta = random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(Math.cos(theta) * r, u, Math.sin(theta) * r);
}

function makeStars(
  count: number,
  size: number,
  color: number,
  radius: number,
  random: () => number,
  milkyWay = false,
): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    let direction = randomDirection(random);
    if (milkyWay) {
      const angle = random() * Math.PI * 2;
      const band = (random() + random() + random() - 1.5) * 0.16;
      const tilt = 0.38;
      const x = Math.cos(angle);
      const z = Math.sin(angle) * Math.cos(tilt) - band * Math.sin(tilt);
      const y = Math.sin(angle) * Math.sin(tilt) + band * Math.cos(tilt);
      direction = new THREE.Vector3(x, y, z).normalize();
    }
    positions[i * 3] = direction.x * radius;
    positions[i * 3 + 1] = direction.y * radius;
    positions[i * 3 + 2] = direction.z * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    map: createStarTexture(),
    transparent: true,
    opacity: milkyWay ? 0.32 : 0.88,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = -3;
  points.frustumCulled = false;
  return points;
}

export class Stars {
  readonly group = new THREE.Group();
  private readonly layers: THREE.Points[] = [];

  constructor() {
    const random = mulberry32(0x57a123);
    const faint = makeStars(1500, 1.6, 0xcfe1ff, SCENE.starRadius, random);
    const bright = makeStars(150, 3.2, 0xeaf2ff, SCENE.starRadius * 1.01, random);
    const warm = makeStars(80, 2.6, 0xffe0b0, SCENE.starRadius * 1.02, random);
    const milky = makeStars(650, 1.3, 0xb8c9ff, SCENE.starRadius * 0.99, random, true);
    this.layers.push(faint, bright, warm, milky);
    for (const layer of this.layers) this.group.add(layer);
    this.group.name = 'starfield';
  }

  dispose(): void {
    for (const layer of this.layers) {
      layer.geometry.dispose();
      const material = layer.material as THREE.PointsMaterial;
      material.map?.dispose();
      material.dispose();
    }
  }
}
