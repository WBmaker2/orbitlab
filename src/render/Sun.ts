import * as THREE from 'three';
import { SCENE } from './scale';
import { createGlowTexture, createSunTexture } from './textures';
import { createLabel } from './Labels';

export class Sun {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly label: ReturnType<typeof createLabel>;
  private readonly glow: THREE.Sprite;
  private readonly glowTexture: THREE.Texture;
  private readonly surfaceTexture: THREE.Texture;

  constructor() {
    this.group.name = 'sun-group';

    this.surfaceTexture = createSunTexture();
    const material = new THREE.MeshBasicMaterial({
      map: this.surfaceTexture,
      color: 0xffffff,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SCENE.sunRadius, 64, 48), material);
    this.mesh.name = 'sun';
    this.mesh.userData.body = 'sun';
    this.group.add(this.mesh);

    this.glowTexture = createGlowTexture('rgba(255, 243, 196, 1)', 'rgba(255, 150, 40, 0)');
    const glowMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffc45c,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.glow = new THREE.Sprite(glowMaterial);
    this.glow.scale.setScalar(SCENE.sunRadius * 8);
    this.group.add(this.glow);

    this.label = createLabel('태양', 'label-body label-sun');
    this.label.position.set(0, SCENE.sunRadius * 1.42, 0);
    this.group.add(this.label);
  }

  update(deltaSeconds: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      this.mesh.rotation.y += deltaSeconds * 0.025;
    }
  }

  setLabelVisible(visible: boolean): void {
    this.label.visible = visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.glow.material.dispose();
    this.glowTexture.dispose();
    this.surfaceTexture.dispose();
  }
}
