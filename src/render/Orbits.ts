import * as THREE from 'three';
import { moonOrbitBasis } from '../astro/orbits';
import { SCENE, SCENE_COLORS } from './scale';
import { createLabel } from './Labels';

const ORBIT_SEGMENTS = 256;

export class Orbits {
  readonly earthOrbit: THREE.Line;
  readonly moonOrbit: THREE.Line;
  readonly nodeGroup = new THREE.Group();
  readonly nodeLabel: ReturnType<typeof createLabel>;
  private readonly earthOrbitGeometry: THREE.BufferGeometry;
  private readonly moonOrbitGeometry: THREE.BufferGeometry;
  private readonly nodeGeometry: THREE.BufferGeometry;

  constructor() {
    const earthPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
      const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      earthPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * SCENE.earthOrbitRadius,
          0,
          Math.sin(angle) * SCENE.earthOrbitRadius,
        ),
      );
    }
    this.earthOrbitGeometry = new THREE.BufferGeometry().setFromPoints(earthPoints);
    this.earthOrbit = new THREE.Line(
      this.earthOrbitGeometry,
      new THREE.LineBasicMaterial({
        color: SCENE_COLORS.earthOrbit,
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.earthOrbit.name = 'earth-orbit-line';

    const { node, inclinedPerp } = moonOrbitBasis();
    const moonPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
      const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      const x =
        (node.x * Math.cos(angle) + inclinedPerp.x * Math.sin(angle)) * SCENE.moonOrbitRadius;
      const y =
        (node.y * Math.cos(angle) + inclinedPerp.y * Math.sin(angle)) * SCENE.moonOrbitRadius;
      const z =
        (node.z * Math.cos(angle) + inclinedPerp.z * Math.sin(angle)) * SCENE.moonOrbitRadius;
      moonPoints.push(new THREE.Vector3(x, y, z));
    }
    this.moonOrbitGeometry = new THREE.BufferGeometry().setFromPoints(moonPoints);
    this.moonOrbit = new THREE.Line(
      this.moonOrbitGeometry,
      new THREE.LineBasicMaterial({
        color: SCENE_COLORS.moonOrbit,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.moonOrbit.name = 'moon-orbit-line';

    const nodeHalf = SCENE.moonOrbitRadius * 1.25;
    this.nodeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-node.x * nodeHalf, 0, -node.z * nodeHalf),
      new THREE.Vector3(node.x * nodeHalf, 0, node.z * nodeHalf),
    ]);
    const nodeLine = new THREE.Line(
      this.nodeGeometry,
      new THREE.LineDashedMaterial({
        color: SCENE_COLORS.nodeLine,
        transparent: true,
        opacity: 0.8,
        dashSize: 0.28,
        gapSize: 0.2,
      }),
    );
    nodeLine.computeLineDistances();
    this.nodeGroup.add(nodeLine);

    const nodeMarkerGeometry = new THREE.SphereGeometry(0.09, 10, 8);
    const nodeMarkerMaterial = new THREE.MeshBasicMaterial({
      color: SCENE_COLORS.nodeLine,
      toneMapped: false,
    });
    for (const sign of [-1, 1]) {
      const marker = new THREE.Mesh(nodeMarkerGeometry, nodeMarkerMaterial);
      marker.position.set(
        node.x * SCENE.moonOrbitRadius * sign,
        0,
        node.z * SCENE.moonOrbitRadius * sign,
      );
      this.nodeGroup.add(marker);
    }

    this.nodeLabel = createLabel('교점선', 'label-small label-node');
    this.nodeLabel.position.set(
      node.x * SCENE.moonOrbitRadius * 1.32,
      0.28,
      node.z * SCENE.moonOrbitRadius * 1.32,
    );
    this.nodeGroup.add(this.nodeLabel);
  }

  attachMoonOrbit(parent: THREE.Object3D): void {
    parent.add(this.moonOrbit);
    parent.add(this.nodeGroup);
  }

  setLayers(layers: { orbits: boolean; nodes: boolean; labels: boolean }): void {
    this.earthOrbit.visible = layers.orbits;
    this.moonOrbit.visible = layers.orbits;
    this.nodeGroup.visible = layers.nodes;
    this.nodeLabel.visible = layers.nodes && layers.labels;
  }

  dispose(): void {
    this.earthOrbitGeometry.dispose();
    this.moonOrbitGeometry.dispose();
    this.nodeGeometry.dispose();
    (this.earthOrbit.material as THREE.Material).dispose();
    (this.moonOrbit.material as THREE.Material).dispose();
  }
}
