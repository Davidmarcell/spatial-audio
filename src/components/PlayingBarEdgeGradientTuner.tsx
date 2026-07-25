type PlayingBarEdgeGradientTunerProps = {
  isPlaying?: boolean;
  /** Whether the intro landing gate is enabled (dev toggle, defaults off). */
  landingEnabled?: boolean;
  onLandingEnabledChange?: (enabled: boolean) => void;
};

/** Product preview hides the Radiance / Landing launcher chips. */
export function PlayingBarEdgeGradientTuner(_: PlayingBarEdgeGradientTunerProps) {
  return null;
}
