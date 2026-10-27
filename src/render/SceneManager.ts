import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { AppState, FactBody } from '../app/state';
import { earthOrientation, helioToEarthLocal, sunDirectionFromEarth } from '../astro/orbits';
import { CameraRig, type CameraFocus, type CameraPreset } from './CameraRig';
import { Earth } from './Earth';
import { createLabel } from './Labels';
import { Moon } from './Moon';
import { Orbits } from './Orbits';
import { SCENE, SCENE_COLORS, earthScenePosition, moonSceneOffset } from './scale';
import { Stars } from './Stars';
import { Sun } from './Sun';

export interface SceneCallbacks {
  onBodyClick: (body: FactBody) => void;
}

interface PendingCamera {
  preset: CameraPreset;
  focus: CameraFocus;
}

export class SceneManager {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly rig: CameraRig;
  private readonly sun = new Sun();
  private readonly earth = new Earth();
  private readonly moon = new Moon();
  private readonly orbits = new Orbits();
  private readonly stars = new Stars();
  private readonly earthAnchor = new THREE.Group();
  private readonly sunArrow: THREE.ArrowHelper;
  private readonly sunArrowLabel = createLabel('태양 방향', 'label-small label-sun-arrow');
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly hitTargets: THREE.Object3D[];
  private readonly resizeObserver: ResizeObserver;
  private readonly clock = new THREE.Clock();

  private readonly tmpEarth = new THREE.Vector3();
  private readonly tmpMoonRelative = new THREE.Vector3();
  private readonly tmpMoonWorld = new THREE.Vector3();
  private readonly tmpSunDirection = new THREE.Vector3();
  private readonly tmpMoonSunDirection = new THREE.Vector3();
  private readonly tmpMoonLabel = new THREE.Vector3(0, SCENE.moonRadius * 2.4, 0);
  private readonly tmpLocalSun = new THREE.Vector3();

  private pendingCamera: PendingCamera | null = null;
  private labelsVisible = true;
  private currentPreset: CameraPreset = 'system';
  private active = true;
  private disposed = false;
  private pointerDown: { id: number; x: number; y: number; time: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: SceneCallbacks,
  ) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
    this.camera.position.set(0, 70, 150);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'scene-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'scene-label-layer';
    this.labelRenderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.labelRenderer.domElement);

    this.scene.add(this.stars.group);
    this.scene.add(this.sun.group);
    this.scene.add(this.earthAnchor);
    this.scene.add(this.orbits.earthOrbit);

    this.earthAnchor.name = 'earth-anchor';
    this.earthAnchor.add(this.earth.group);
    this.earthAnchor.add(this.moon.mesh);
    this.moon.label.position.set(0, SCENE.moonRadius * 2.4, 0);
    this.earthAnchor.add(this.moon.label);
    this.orbits.attachMoonOrbit(this.earthAnchor);

    this.sunArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      13,
      SCENE_COLORS.sunArrow,
      1.5,
      0.9,
    );
    this.sunArrow.name = 'sun-direction-arrow';
    const arrowLineMaterial = this.sunArrow.line.material as THREE.LineBasicMaterial;
    arrowLineMaterial.transparent = true;
    arrowLineMaterial.opacity = 0.9;
    const arrowConeMaterial = this.sunArrow.cone.material as THREE.MeshBasicMaterial;
    arrowConeMaterial.transparent = true;
    arrowConeMaterial.opacity = 0.95;
    this.sunArrowLabel.position.set(0, 13.5, 0);
    this.sunArrow.add(this.sunArrowLabel);
    this.sunArrow.visible = false;
    this.scene.add(this.sunArrow);

    this.hitTargets = [this.sun.mesh, this.earth.mesh, this.moon.mesh];

    this.rig = new CameraRig(this.camera, this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerCancel);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);

    this.resize();
  }

  setCamera(preset: CameraPreset, focus: CameraFocus): void {
    this.pendingCamera = { preset, focus };
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.rig.setReducedMotion(reducedMotion);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.renderer.domElement.style.visibility = active ? 'visible' : 'hidden';
    this.labelRenderer.domElement.style.visibility = active ? 'visible' : 'hidden';
  }

  update(days: number, state: AppState): void {
    if (this.disposed) return;

    earthScenePosition(days, this.tmpEarth);
    this.earthAnchor.position.copy(this.tmpEarth);
    moonSceneOffset(days, this.tmpMoonRelative);
    this.tmpMoonWorld.copy(this.tmpEarth).add(this.tmpMoonRelative);

    this.tmpSunDirection.copy(this.tmpEarth).negate().normalize();
    this.tmpMoonSunDirection.copy(this.tmpMoonWorld).negate().normalize();
    this.moon.update(this.tmpMoonRelative, this.tmpMoonSunDirection);

    const orientation = earthOrientation(days);
    const localSun = helioToEarthLocal(days, sunDirectionFromEarth(days));
    this.tmpLocalSun.set(localSun.x, localSun.y, localSun.z);
    this.earth.update(orientation, this.tmpLocalSun, {
      terminator: state.layers.terminator,
      tiltAxis: state.layers.tiltAxis,
      labels: state.layers.labels,
    });

    this.orbits.setLayers(state.layers);
    this.sun.setLabelVisible(state.layers.labels);
    this.moon.setLabelVisible(state.layers.labels);
    this.moon.label.position.copy(this.tmpMoonRelative).add(this.tmpMoonLabel);

    this.labelsVisible = state.layers.labels;
    this.labelRenderer.domElement.style.display = this.labelsVisible ? '' : 'none';

    const showArrow =
      state.view === 'space' && state.cameraPreset !== 'system' && state.cameraPreset !== 'moon';
    this.sunArrow.visible = showArrow;
    this.sunArrow.position.copy(this.tmpEarth);
    this.sunArrow.setDirection(this.tmpSunDirection);
    this.sunArrowLabel.visible = showArrow && state.layers.labels;
    this.orbits.nodeLabel.visible = state.layers.nodes && state.layers.labels;

    if (this.pendingCamera) {
      const context = {
        earth: this.tmpEarth,
        moon: this.tmpMoonWorld,
        sunDirectionFromEarth: this.tmpSunDirection,
      };
      this.currentPreset = this.pendingCamera.preset;
      this.rig.applyPreset(this.pendingCamera.preset, this.pendingCamera.focus, context);
      this.pendingCamera = null;
    } else {
      this.currentPreset = state.cameraPreset;
    }

    this.sun.update(this.clock.getDelta(), state.preferences.reducedMotion);
    this.rig.update(this.tmpEarth, this.tmpMoonWorld);
  }

  render(): void {
    if (!this.active || this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    if (this.labelsVisible) this.labelRenderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.8 ? 55 : 45;
    this.camera.updateProjectionMatrix();
    this.rig.setAspect(aspect, width);
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.onPointerCancel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.rig.dispose();
    this.sun.dispose();
    this.earth.dispose();
    this.moon.dispose();
    this.orbits.dispose();
    this.stars.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) return;
    this.pointerDown = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || down.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (distance > 6 || performance.now() - down.time > 700) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitTargets, false);
    if (hits.length === 0) return;
    const body = hits[0].object.userData.body as FactBody | undefined;
    if (body) this.callbacks.onBodyClick(body);
  };

  private readonly onPointerCancel = (): void => {
    this.pointerDown = null;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  get currentCameraPreset(): CameraPreset {
    return this.currentPreset;
  }
}
