import * as THREE from "three";
import type { WorldFrame } from "../core";
import { spatialMotionScale } from "./motion-preference";
import { createContourGeometry, createMoteGeometry, createPigmentGeometry } from "./descentGeometry";
import { contourVertex, contourFragment, moteVertex, moteFragment, atmosphereFragment, pigmentVertex, pigmentFragment } from "./descentShaders";

/** The GPU receives world semantics, never raw audio buffers. */
export class FallWorld {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240);
  private readonly motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly uniforms = {
    uTime: { value: 0 }, uTravel: { value: 0 }, uBass: { value: 0 },
    uCurrent: { value: 0 }, uAir: { value: 0 }, uWake: { value: 0 },
    uLight: { value: 0 }, uChroma: { value: 0 }, uWidth: { value: 0 }, uMotion: { value: 1 },
    uAspect: { value: 1 }, uCenter: { value: new THREE.Vector2(0.62, 0.5) },
    uPixelRatio: { value: 1 },
    uEvents: { value: new Float32Array(8).fill(-1000) },
  };
  private readonly contourMaterial = new THREE.ShaderMaterial({
    uniforms: this.uniforms, vertexShader: contourVertex, fragmentShader: contourFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  private readonly contours = new THREE.Mesh(createContourGeometry(), this.contourMaterial);
  private readonly moteMaterial = new THREE.ShaderMaterial({
    uniforms: this.uniforms, vertexShader: moteVertex, fragmentShader: moteFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  private readonly motes = new THREE.Points(createMoteGeometry(), this.moteMaterial);
  private readonly pigmentMaterial = new THREE.ShaderMaterial({
    uniforms: this.uniforms, vertexShader: pigmentVertex, fragmentShader: pigmentFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  private readonly pigments = new THREE.Mesh(createPigmentGeometry(), this.pigmentMaterial);
  private readonly atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: atmosphereFragment, depthWrite: false, depthTest: false,
  });
  private readonly atmosphere = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.atmosphereMaterial);
  private lastFrame: WorldFrame | null = null;
  private contextLost = false;
  private still = false;
  private travel = 0;
  private spatialTime = 0;
  private previousTime = -1;
  private previousWake = 0;
  private eventCursor = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer.setClearColor(0x140817);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.contours.frustumCulled = false;
    this.motes.frustumCulled = false;
    this.pigments.frustumCulled = false;
    this.atmosphere.frustumCulled = false;
    this.atmosphere.renderOrder = -10;
    this.scene.add(this.atmosphere, this.contours, this.motes, this.pigments);
    this.renderer.domElement.className = "fall-canvas";
    this.renderer.domElement.setAttribute("aria-label", "a descending passage of light shaped by sound");
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored);
    container.append(this.renderer.domElement);
    this.resize();
  }

  resize(): void {
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    const mobile = width < 700;
    const ratio = Math.min(devicePixelRatio, mobile ? 1.35 : 1.65);
    this.camera.aspect = width / height;
    this.camera.setViewOffset(width, height, mobile ? 0 : -width * 0.12, 0, width, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height);
    this.uniforms.uAspect.value = width / height;
    this.uniforms.uCenter.value.set(mobile ? 0.5 : 0.62, 0.5);
    this.uniforms.uPixelRatio.value = ratio;
    if (this.lastFrame) this.render(this.lastFrame);
  }

  setStill(still: boolean): void {
    this.still = still;
  }

  render(frame: WorldFrame): void {
    this.lastFrame = frame;
    if (this.contextLost) return;
    const { reactivity: music } = frame;
    const motion = spatialMotionScale(this.motionQuery.matches);
    const newFrame = frame.timeSeconds !== this.previousTime;
    if (newFrame && !this.still) {
      this.travel += frame.fall.velocity * frame.deltaSeconds * motion;
      this.spatialTime += frame.deltaSeconds * motion;
      if (music.wakeEnergy > this.previousWake + 0.1) {
        this.uniforms.uEvents.value[this.eventCursor] = this.travel + 38;
        this.eventCursor = (this.eventCursor + 1) % 8;
      }
    }
    this.previousTime = frame.timeSeconds;
    this.previousWake = music.wakeEnergy;
    this.uniforms.uTime.value = this.spatialTime;
    this.uniforms.uTravel.value = this.travel;
    this.uniforms.uBass.value = music.gravityWeight / 0.55;
    this.uniforms.uCurrent.value = music.currentPresence / 0.4;
    this.uniforms.uAir.value = music.dustPresence / 0.45;
    this.uniforms.uWake.value = music.transientPulse;
    this.uniforms.uLight.value = music.lightGain;
    this.uniforms.uChroma.value = music.chromaBoost;
    this.uniforms.uWidth.value = (music.soundstageScale - 1) / 1.2;
    this.uniforms.uMotion.value = this.still ? 0 : motion;
    if (!this.still) {
      this.camera.position.x = music.lateralPull * 0.045 * motion;
      this.camera.position.y = Math.sin(this.spatialTime * 0.08) * 0.08;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.container.dataset.graphics = "recovering";
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    delete this.container.dataset.graphics;
    if (this.lastFrame) this.render(this.lastFrame);
  };

  dispose(): void {
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.contours.geometry.dispose();
    this.contourMaterial.dispose();
    this.motes.geometry.dispose();
    this.moteMaterial.dispose();
    this.pigments.geometry.dispose();
    this.pigmentMaterial.dispose();
    this.atmosphere.geometry.dispose();
    this.atmosphereMaterial.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
