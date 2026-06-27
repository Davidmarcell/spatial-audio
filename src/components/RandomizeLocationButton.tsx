import { useCallback } from 'react';
import type { AppLocation } from '../data/environments';
import type { WorldLocation } from '../data/worldLocations';
import { pickRandomRegion } from '../utils/pickRandomRegion';
import { UiIcon } from './UiIcon';
import styles from './RandomizeLocationButton.module.css';

type Props = {
  appLocations: readonly AppLocation[];
  worldLocations: readonly WorldLocation[];
  onPick: (environmentId: string, regionId: string) => void;
};

export function RandomizeLocationButton({ appLocations, worldLocations, onPick }: Props) {
  const handleClick = useCallback(() => {
    const next = pickRandomRegion(appLocations, worldLocations);
    onPick(next.environmentId, next.regionId);
  }, [appLocations, onPick, worldLocations]);

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      aria-label="Random location"
      data-tooltip="Random location"
    >
      <UiIcon icon="shuffle" />
    </button>
  );
}
