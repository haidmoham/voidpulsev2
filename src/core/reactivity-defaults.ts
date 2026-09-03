/** Renderer-safe gain limits for the pre-topology Faltone world. */
export interface ReactivityDefaults {
  readonly maxDeltaSeconds: number;
  readonly wakeRecoveryRate: number;
  readonly onsetWakeImpulse: number;
  readonly onsetCooldownSeconds: number;
  readonly intensityRiseMax: number;
  readonly widthExpansionMax: number;
  readonly highDustPresenceMax: number;
  readonly midCurrentPresenceMax: number;
  readonly lowGravityWeightMax: number;
  readonly transientRingOpacityMax: number;
  readonly balanceBasePull: number;
  readonly balanceWidthPull: number;
  readonly chromaBoostMax: number;
  readonly lightGainMax: number;
  readonly transientPulseMax: number;
}

/**
 * Grotesque by design: this policy turns the historical ambience into an
 * explicitly capped, music-driven event without changing fall-speed ownership.
 */
export const REACTIVITY_DEFAULTS: Readonly<ReactivityDefaults> = Object.freeze({
  maxDeltaSeconds: 0.1,
  wakeRecoveryRate: 4.8,
  onsetWakeImpulse: 1,
  onsetCooldownSeconds: 0.12,
  intensityRiseMax: 1,
  widthExpansionMax: 1.2,
  highDustPresenceMax: 0.45,
  midCurrentPresenceMax: 0.4,
  lowGravityWeightMax: 0.55,
  transientRingOpacityMax: 1,
  balanceBasePull: 3.5,
  balanceWidthPull: 2.5,
  chromaBoostMax: 1,
  lightGainMax: 1,
  transientPulseMax: 1,
});
