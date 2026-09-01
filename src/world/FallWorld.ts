import * as THREE from "three";
import type { FallState } from "../dynamics/FallDynamics";

const LANDMARK_COUNT = 160;
const LOOP_DEPTH = 180;

export class FallWorld {
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly landmarks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: 0xb9b6ff }),
    LANDMARK_COUNT,
  );
  private readonly matrix = new THREE.Matrix4();

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x03030a);
    this.scene.fog = new THREE.FogExp2(0x03030a, 0.025);
    this.camera.rotation.x = -Math.PI / 2;
    this.scene.add(this.landmarks);

    for (let index = 0; index < LANDMARK_COUNT; index += 1) {
      const radius = 2 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const depth = Math.random() * LOOP_DEPTH;
      const scale = 0.5 + Math.random() * 3;
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(Math.cos(angle) * radius, -depth, Math.sin(angle) * radius);
      this.landmarks.setMatrixAt(index, this.matrix);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    container.append(this.renderer.domElement);
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
  }

  render(state: FallState, timeSeconds: number): void {
    this.camera.position.y = -(state.distance % LOOP_DEPTH);
    this.camera.position.x = Math.sin(timeSeconds * 0.17) * (0.25 + state.intensity);
    this.camera.position.z = Math.cos(timeSeconds * 0.13) * (0.25 + state.intensity);
    this.camera.fov = 68 + state.intensity * 18;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}
