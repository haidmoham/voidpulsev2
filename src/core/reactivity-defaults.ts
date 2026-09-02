/** Renderer-safe gain limits for the pre-topology Faltone world. */
export interface ReactivityDefaults {
  readonly maxDeltaSeconds: number;
  readonly wakeRecoveryRate: number;
  readonly onsetWakeImpulse: number;
  readonly onsetCooldownSeconds: number;
  readonly widthExpansionMax: number;
  readonly highDustPresenceMax: number;
  readonly midCurrentPresenceMax: number;
  readonly lowGravityWeightMax: number;
  readonly transientRingOpacityMax: number;
  readonly balanceBasePull: number;
  readonly balanceWidthPull: number;
}

/**
 * These are policy caps, not a tuning-panel schema. They keep every music
 * signal local to one semantic world response and preserve quiet baseline life.
 */
export const REACTIVITY_DEFAULTS: Readonly<ReactivityDefaults> = Object.freeze({
  maxDeltaSeconds: 0.1,
  wakeRecoveryRate: 1.4,
  onsetWakeImpulse: 0.66,
  onsetCooldownSeconds: 0.12,
  widthExpansionMax: 0.12,
  highDustPresenceMax: 0.045,
  midCurrentPresenceMax: 0.04,
  lowGravityWeightMax: 0.055,
  transientRingOpacityMax: 0.1,
  balanceBasePull: 0.35,
  balanceWidthPull: 0.25,
});
