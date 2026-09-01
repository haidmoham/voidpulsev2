export interface IntensitySignal {
  sample(timeSeconds: number): number;
}

/** Temporary signal for developing the fall before audio input is wired in. */
export class DemoIntensitySignal implements IntensitySignal {
  sample(timeSeconds: number): number {
    const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.55);
    const pulse = Math.max(0, Math.sin(timeSeconds * 2.1)) ** 10;
    return Math.min(1, 0.08 + breath * 0.42 + pulse * 0.5);
  }
}
