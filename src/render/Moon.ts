import * as THREE from 'three';
import { SCENE } from './scale';
import { createMoonTexture } from './textures';
import { createLabel } from './Labels';
import moonFragment from './shaders/moonFragment.glsl?raw';
import earthVertex from './shaders/earthVertex.glsl?raw';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class Moon {
  readonly mesh: THREE.Mesh;
  readonly label: ReturnType<typeof createLabel>;
  private readonly uniforms: {
    uMap: { value: THREE.Texture };
    uSunDirLocal: { value: THREE.Vector3 };
  };
  private readonly texture: THREE.Texture;
  private readonly targetDirection = new THREE.Vector3();
  private readonly inverseRotation = new THREE.Quaternion();
  private readonly localSun = new THREE.Vector3();

  constructor() {
    this.texture = createMoonTexture();
    this.uniforms = {
      uMap: { value: this.texture },
      uSunDirLocal: { value: new THREE.Vector3(1, 0, 0) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: earthVertex,
      fragmentShader: moonFragment,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SCENE.moonRadius, 64, 48), material);
    this.mesh.name = 'moon';
    this.mesh.userData.body = 'moon';

    this.label = createLabel('달', 'label-body label-moon');
  }

  update(relativePosition: THREE.Vector3, sunDirectionWorld: THREE.Vector3): void {
    this.mesh.position.copy(relativePosition);

    // Tidal locking: the Moon's local +Z (its near side) always faces Earth.
    this.targetDirection.copy(relativePosition).negate().normalize();
    this.mesh.quaternion.setFromUnitVectors(Z_AXIS, this.targetDirection);

    this.inverseRotation.copy(this.mesh.quaternion).invert();
    this.localSun.copy(sunDirectionWorld).applyQuaternion(this.inverseRotation);
    this.uniforms.uSunDirLocal.value.copy(this.localSun);
  }

  setLabelVisible(visible: boolean): void {
    this.label.visible = visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
