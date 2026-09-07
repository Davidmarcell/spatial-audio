import type { FanConfig } from './landingFan';

type LandingFanTunerProps = {
  config: FanConfig;
  onChange: (config: FanConfig) => void;
  /** Whether the landing gate is currently shown (drives the preview hint). */
  landingEnabled?: boolean;
  /** Toggles the landing gate on/off (dev control, persisted by the parent). */
  onLandingEnabledChange?: (enabled: boolean) => void;
};

export function LandingFanTuner(_: LandingFanTunerProps) {
  return null;
}
