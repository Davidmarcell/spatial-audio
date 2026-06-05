import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldLocation } from '../data/worldLocations';
import { findNearestRegion } from '../utils/geo';
import styles from './UseMyLocationButton.module.css';

type Props = {
  locations: readonly WorldLocation[];
  onMatch: (environmentId: string, regionId: string) => void;
};

type ButtonPhase = 'idle' | 'loading' | 'error';

function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Location denied';
    case 2:
      return 'Unavailable';
    case 3:
      return 'Timed out';
    default:
      return 'Location failed';
  }
}

function LocationTargetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <circle cx="12" cy="12" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UseMyLocationButton({ locations, onMatch }: Props) {
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const scheduleIdleReset = useCallback(
    (delayMs: number) => {
      clearResetTimer();
      resetTimerRef.current = setTimeout(() => {
        setPhase('idle');
        setErrorLabel(null);
        resetTimerRef.current = null;
      }, delayMs);
    },
    [clearResetTimer],
  );

  const handleClick = useCallback(() => {
    clearResetTimer();
    setErrorLabel(null);

    if (!navigator.geolocation) {
      setPhase('error');
      setErrorLabel('Not supported');
      scheduleIdleReset(4000);
      return;
    }

    setPhase('loading');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const nearest = findNearestRegion(coords, locations);
        if (!nearest) {
          setPhase('error');
          setErrorLabel('No regions');
          scheduleIdleReset(4000);
          return;
        }

        onMatch(nearest.environmentId, nearest.regionId);
        setPhase('idle');
        setErrorLabel(null);
      },
      (error) => {
        setPhase('error');
        setErrorLabel(geolocationErrorMessage(error.code));
        scheduleIdleReset(4000);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [clearResetTimer, locations, onMatch, scheduleIdleReset]);

  const isLoading = phase === 'loading';
  const isError = phase === 'error';

  const className = isError ? styles.buttonError : isLoading ? styles.buttonLoading : styles.button;

  const ariaLabel = isLoading
    ? 'Finding your location'
    : isError && errorLabel
      ? `${errorLabel}. Tap to try again`
      : 'Use my location';

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label={ariaLabel}
      data-tooltip="Use my location"
    >
      <LocationTargetIcon />
      <span className={styles.label}>{ariaLabel}</span>
    </button>
  );
}
