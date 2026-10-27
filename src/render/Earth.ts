import * as THREE from 'three';
import {
  EARTH_AXIAL_TILT_DEG,
  OBSERVER_SEOUL,
} from '../astro/constants';
import {
  earthSurfaceLocalDirection,
  type EarthOrientation,
} from '../astro/orbits';
import { SCENE, SCENE_COLORS } from './scale';
import { createEarthTexture } from './textures';
import { createLabel } from './Labels';
import earthVertex from './shaders/earthVertex.glsl?raw';
import earthFragment from './shaders/earthFragment.glsl?raw';
import atmosphereVertex from './shaders/atmosphereVertex.glsl?raw';
import atmosphereFragment from './shaders/atmosphereFragment.glsl?raw';

interface EarthUniforms {
  [key: string]: THREE.IUniform;
  uMap: { value: THREE.Texture };
  uSunDirLocal: { value: THREE.Vector3 };
  uTerminator: { value: number };
  uAtmosphereColor: { value: THREE.Color };
}

export class Earth {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly marker: THREE.Mesh;
  readonly label: ReturnType<typeof createLabel>;
  readonly markerLabel: ReturnType<typeof createLabel>;
  readonly axisLabel: ReturnType<typeof createLabel>;
  readonly axisGroup = new THREE.Group();
  private readonly atmosphere: THREE.Mesh;
  private readonly uniforms: EarthUniforms;
  private readonly atmosphereUniforms: {
    [key: string]: THREE.IUniform;
    uSunDirLocal: { value: THREE.Vector3 };
    uColor: { value: THREE.Color };
  };
  private readonly texture: THREE.Texture;
  private readonly basisMatrix = new THREE.Matrix4();
  private readonly basisX = new THREE.Vector3();
  private readonly basisY = new THREE.Vector3();
  private readonly basisZ = new THREE.Vector3();

  constructor() {
    this.group.name = 'earth-orientation';

    this.texture = createEarthTexture();
    this.uniforms = {
      uMap: { value: this.texture },
      uSunDirLocal: { value: new THREE.Vector3(-1, 0, 0) },
      uTerminator: { value: 1 },
      uAtmosphereColor: { value: new THREE.Color(0x2c7ec4) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(SCENE.earthRadius, 96, 64),
      material,
    );
    this.mesh.name = 'earth';
    this.mesh.userData.body = 'earth';
    this.group.add(this.mesh);

    this.atmosphereUniforms = {
      uSunDirLocal: { value: new THREE.Vector3(-1, 0, 0) },
      uColor: { value: new THREE.Color(0x58b6ff) },
    };
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: this.atmosphereUniforms,
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(SCENE.earthRadius * 1.045, 64, 48),
      atmosphereMaterial,
    );
    this.atmosphere.name = 'earth-atmosphere';
    this.atmosphere.renderOrder = 2;
    this.group.add(this.atmosphere);

    this.label = createLabel('지구', 'label-body label-earth');
    this.label.position.set(0, SCENE.earthRadius * 1.75, 0);

    const localMarker = earthSurfaceLocalDirection(
      OBSERVER_SEOUL.latitudeDeg,
      OBSERVER_SEOUL.longitudeDeg,
    );
    const markerDirection = new THREE.Vector3(
      localMarker.x,
      localMarker.y,
      localMarker.z,
    );
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(SCENE.earthRadius * 0.035, 14, 10),
      new THREE.MeshBasicMaterial({
        color: SCENE_COLORS.marker,
        toneMapped: false,
      }),
    );
    this.marker.position.copy(markerDirection).multiplyScalar(SCENE.earthRadius * 1.015);
    this.marker.renderOrder = 3;
    this.group.add(this.marker);

    this.markerLabel = createLabel('서울', 'label-small label-seoul');
    this.markerLabel.position.copy(markerDirection).multiplyScalar(SCENE.earthRadius * 1.12);
    this.group.add(this.markerLabel);

    const axisLength = SCENE.earthRadius * 1.52;
    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const axisLine = new THREE.Line(
      axisGeometry,
      new THREE.LineBasicMaterial({
        color: SCENE_COLORS.axis,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.axisGroup.add(axisLine);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(SCENE.earthRadius * 0.055, SCENE.earthRadius * 0.14, 16),
      new THREE.MeshBasicMaterial({ color: SCENE_COLORS.axis, toneMapped: false }),
    );
    cap.position.y = axisLength;
    this.axisGroup.add(cap);

    this.axisLabel = createLabel('자전축', 'label-small label-axis');
    this.axisLabel.position.set(0, axisLength + 0.18, 0);
    this.axisGroup.add(this.axisLabel);
    this.group.add(this.axisGroup);

    this.mesh.add(this.label);
  }

  update(
    orientation: EarthOrientation,
    sunDirectionLocal: THREE.Vector3,
    options: { terminator: boolean; tiltAxis: boolean; labels: boolean },
  ): void {
    this.basisX.set(orientation.xAxis.x, orientation.xAxis.y, orientation.xAxis.z);
    this.basisY.set(orientation.yAxis.x, orientation.yAxis.y, orientation.yAxis.z);
    this.basisZ.set(orientation.zAxis.x, orientation.zAxis.y, orientation.zAxis.z);
    this.basisMatrix.makeBasis(this.basisX, this.basisY, this.basisZ);
    this.group.quaternion.setFromRotationMatrix(this.basisMatrix);

    this.uniforms.uSunDirLocal.value.copy(sunDirectionLocal);
    this.atmosphereUniforms.uSunDirLocal.value.copy(sunDirectionLocal);
    this.uniforms.uTerminator.value = options.terminator ? 1 : 0;

    this.axisGroup.visible = options.tiltAxis;
    this.axisLabel.visible = options.tiltAxis && options.labels;
    this.label.visible = options.labels;
    this.markerLabel.visible = options.labels;
  }

  setTiltAxisVisible(visible: boolean): void {
    this.axisGroup.visible = visible;
  }

  /** Axis tilt in degrees, exposed for the teacher/scale panel. */
  static readonly tiltDeg = EARTH_AXIAL_TILT_DEG;

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.atmosphere.geometry.dispose();
    (this.atmosphere.material as THREE.Material).dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
