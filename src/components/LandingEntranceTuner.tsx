import type { LandingEntranceConfig } from '../utils/landingEntranceAnimation';

type LandingEntranceTunerProps = {
  config: LandingEntranceConfig;
  onChange: (config: LandingEntranceConfig) => void;
  /** Replays the landing entrance in place (re-arms all one-shot latches). */
  onReplay: () => void;
};

export function LandingEntranceTuner(_: LandingEntranceTunerProps) {
  return null;
}
