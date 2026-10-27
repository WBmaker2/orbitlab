import * as THREE from 'three';
import { AU_KM, EARTH_MOON_DISTANCE_KM } from '../astro/constants';
import { earthPosition, moonRelativePosition } from '../astro/orbits';

/**
 * Visual scale used by the 3D scene. These are deliberately NOT real ratios.
 * The persistent "개념 모형" badge and the scale facts panel make this explicit.
 */
export const SCENE = {
  earthOrbitRadius: 90,
  sunRadius: 10,
  earthRadius: 2.4,
  moonOrbitRadius: 7.6,
  moonRadius: 0.66,
  starRadius: 850,
} as const;

export const SCENE_COLORS = {
  background: 0x05080f,
  earthOrbit: 0x5476a8,
  moonOrbit: 0x98a2c8,
  nodeLine: 0xb39cff,
  axis: 0xffe2a0,
  sunArrow: 0xffd166,
  marker: 0xffd166,
} as const;

export function earthScenePosition(days: number, target = new THREE.Vector3()): THREE.Vector3 {
  const position = earthPosition(days);
  return target.set(
    (position.x / AU_KM) * SCENE.earthOrbitRadius,
    (position.y / AU_KM) * SCENE.earthOrbitRadius,
    (position.z / AU_KM) * SCENE.earthOrbitRadius,
  );
}

export function moonSceneOffset(days: number, target = new THREE.Vector3()): THREE.Vector3 {
  const relative = moonRelativePosition(days);
  const factor = SCENE.moonOrbitRadius / EARTH_MOON_DISTANCE_KM;
  return target.set(relative.x * factor, relative.y * factor, relative.z * factor);
}

export function moonScenePosition(
  days: number,
  earthScene: THREE.Vector3,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const offset = moonSceneOffset(days);
  return target.copy(earthScene).add(offset);
}
