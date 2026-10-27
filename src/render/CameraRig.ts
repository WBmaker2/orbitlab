import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE } from './scale';

export type CameraPreset = 'system' | 'earth' | 'top' | 'side' | 'moon';
export type CameraFocus = 'sun' | 'earth' | 'moon';

export interface CameraContext {
  earth: THREE.Vector3;
  moon: THREE.Vector3;
  sunDirectionFromEarth: THREE.Vector3;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3(0, 0, 0);

export class CameraRig {
  readonly controls: OrbitControls;
  private preset: CameraPreset = 'system';
  private focus: CameraFocus = 'sun';
  private aspect = 1;
  private viewportWidth = 1440;
  private manualOverride = false;
  private initialized = false;
  private readonly lastTarget = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly perp = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
  ) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.8;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 620;
    this.controls.target.copy(ORIGIN);
    this.controls.addEventListener('start', () => {
      this.manualOverride = true;
    });
    this.camera.up.copy(WORLD_UP);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.controls.enableDamping = !reducedMotion;
    if (reducedMotion) this.controls.update();
  }

  setAspect(aspect: number, viewportWidth = this.viewportWidth): void {
    this.aspect = aspect;
    this.viewportWidth = viewportWidth;
    if (this.preset === 'system' && this.initialized && !this.manualOverride) {
      this.controls.target.copy(this.target);
      this.offset.copy(this.camera.position).sub(this.target);
      const distance = this.systemDistance();
      if (this.offset.lengthSq() > 1e-8) {
        this.offset.setLength(distance);
        this.camera.position.copy(this.target).add(this.offset);
      }
      this.controls.update();
    }
  }

  getPreset(): CameraPreset {
    return this.preset;
  }

  getFocus(): CameraFocus {
    return this.focus;
  }

  applyPreset(preset: CameraPreset, focus: CameraFocus, context: CameraContext): void {
    this.preset = preset;
    this.focus = focus;
    this.manualOverride = false;
    this.initialized = true;
    this.camera.up.copy(WORLD_UP);

    this.perp.crossVectors(WORLD_UP, context.sunDirectionFromEarth);
    if (this.perp.lengthSq() < 1e-8) this.perp.set(0, 0, 1);
    this.perp.normalize();

    if (preset === 'system') {
      this.target.copy(ORIGIN);
      const distance = this.systemDistance();
      const elevation = THREE.MathUtils.degToRad(24);
      this.camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    } else if (preset === 'moon') {
      this.target.copy(context.moon);
      const distance = 4.4;
      this.offset
        .copy(context.moon)
        .addScaledVector(this.perp, distance * 0.92)
        .addScaledVector(WORLD_UP, distance * 0.36);
      this.camera.position.copy(this.offset);
    } else if (preset === 'top') {
      this.target.copy(context.earth);
      const distance = this.closeDistance(1.05);
      this.offset
        .copy(context.earth)
        .addScaledVector(WORLD_UP, distance * 0.958)
        .addScaledVector(context.sunDirectionFromEarth, -distance * 0.284);
      this.camera.position.copy(this.offset);
    } else if (preset === 'side') {
      this.target.copy(context.earth);
      const distance = this.closeDistance(1.08);
      this.offset
        .copy(context.earth)
        .addScaledVector(this.perp, distance)
        .addScaledVector(WORLD_UP, distance * 0.24);
      this.camera.position.copy(this.offset);
    } else {
      this.target.copy(context.earth);
      const distance = this.closeDistance(0.88);
      this.offset
        .copy(context.earth)
        .addScaledVector(context.sunDirectionFromEarth, distance * 0.42)
        .addScaledVector(WORLD_UP, distance * 0.8);
      this.camera.position.copy(this.offset);
    }

    this.lastTarget.copy(this.target);
    this.controls.target.copy(this.target);
    this.camera.lookAt(this.target);
    this.controls.update();
  }

  update(earth: THREE.Vector3, moon: THREE.Vector3): void {
    if (!this.initialized) {
      this.lastTarget.copy(ORIGIN);
      this.controls.target.copy(ORIGIN);
      this.initialized = true;
    }
    if (this.focus === 'earth') this.target.copy(earth);
    else if (this.focus === 'moon') this.target.copy(moon);
    else this.target.copy(ORIGIN);

    this.offset.copy(this.target).sub(this.lastTarget);
    if (this.offset.lengthSq() > 1e-10) {
      this.camera.position.add(this.offset);
      this.controls.target.copy(this.target);
      this.lastTarget.copy(this.target);
    }
    this.controls.update();
  }

  private systemDistance(): number {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const radius = SCENE.earthOrbitRadius + SCENE.sunRadius * 0.35;
    const aspect = Math.max(this.aspect, 0.35);
    // On wide screens the floating HUD panels cover the outer thirds of the
    // viewport, so frame the orbit inside the free centre area. The compact
    // tablet layout uses narrower panels but leaves a much smaller gap.
    const safeArea = this.viewportWidth < 768 ? 1.3 : this.viewportWidth < 1181 ? 2.45 : 2.05;
    return (radius / (Math.tan(fov / 2) * aspect)) * safeArea;
  }

  /** Distance that fits the Moon's orbit in the narrow dimension of the screen. */
  private closeDistance(multiplier: number): number {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(this.aspect, 0.35);
    const radius = SCENE.moonOrbitRadius + 1.05;
    return (radius / (Math.tan(fov / 2) * Math.min(1, aspect))) * multiplier;
  }

  dispose(): void {
    this.controls.dispose();
  }
}
