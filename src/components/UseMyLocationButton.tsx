import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveGeolocationSoundscape } from '../utils/resolveGeolocationSoundscape';
import { UiIcon } from './UiIcon';
import styles from './UseMyLocationButton.module.css';

export type GeoMatchResult = {
  environmentId: string;
  regionId: string;
  lat: number;
  lng: number;
  name: string;
  subtitle: string;
};

type Props = {
  onMatch: (result: GeoMatchResult) => void;
};

type ButtonPhase = 'idle' | 'loading' | 'error';

const GEO_TIMEOUT_MS = 12_000;
const GEO_WATCHDOG_MS = GEO_TIMEOUT_MS + 1_500;

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

export function UseMyLocationButton({ onMatch }: Props) {
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

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

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPhase('loading');

    const watchdog = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      setPhase('error');
      setErrorLabel('Timed out');
      scheduleIdleReset(4000);
    }, GEO_WATCHDOG_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestIdRef.current !== requestId) return;
        window.clearTimeout(watchdog);

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        void (async () => {
          try {
            const match = await resolveGeolocationSoundscape(lat, lng);
            if (requestIdRef.current !== requestId) return;
            onMatch(match);
            setPhase('idle');
            setErrorLabel(null);
          } catch {
            if (requestIdRef.current !== requestId) return;
            setPhase('error');
            setErrorLabel('Location failed');
            scheduleIdleReset(4000);
          }
        })();
      },
      (error) => {
        if (requestIdRef.current !== requestId) return;
        window.clearTimeout(watchdog);
        setPhase('error');
        setErrorLabel(geolocationErrorMessage(error.code));
        scheduleIdleReset(4000);
      },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 },
    );
  }, [clearResetTimer, onMatch, scheduleIdleReset]);

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
      <UiIcon icon="location-crosshairs" />
      <span className={styles.label}>{ariaLabel}</span>
    </button>
  );
}
