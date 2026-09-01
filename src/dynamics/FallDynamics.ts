export interface FallState {
  distance: number;
  velocity: number;
  intensity: number;
}

export class FallDynamics {
  readonly state: FallState = { distance: 0, velocity: 0, intensity: 0 };

  private smoothedIntensity = 0;

  update(rawIntensity: number, deltaSeconds: number): FallState {
    const intensity = Math.min(1, Math.max(0, rawIntensity));
    const smoothing = 1 - Math.exp(-deltaSeconds * 2.4);
    this.smoothedIntensity += (intensity - this.smoothedIntensity) * smoothing;

    const targetVelocity = 1.2 + this.smoothedIntensity * 12;
    const inertia = 1 - Math.exp(-deltaSeconds * 1.35);
    this.state.velocity += (targetVelocity - this.state.velocity) * inertia;
    this.state.distance += this.state.velocity * deltaSeconds;
    this.state.intensity = this.smoothedIntensity;

    return this.state;
  }
}
