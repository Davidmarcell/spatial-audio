import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MasterVolumeControl } from './MasterVolumeControl';
import { PlayBar } from './PlayBar';
import styles from './PlayCluster.module.css';

type Props = {
  engine: AudioEngine;
  isPlaying: boolean;
  onToggle: () => void;
};

/** Keep in sync with --pair-duration in PlayCluster.module.css */
const PAIR_DURATION_MS = 480;

type PairPhase = 'collapsed' | 'opening' | 'expanded' | 'closing';

/**
 * Play pill + master volume. Volume pairs from the play pill centre and eases
 * out to the right — mirrored open and close choreography.
 */
export function PlayCluster({ engine, isPlaying, onToggle }: Props) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [phase, setPhase] = useState<PairPhase>(isPlaying ? 'expanded' : 'collapsed');
  const [pairTravel, setPairTravel] = useState(80);
  const [pairRecenter, setPairRecenter] = useState(0);
  const playPillRef = useRef<HTMLDivElement>(null);
  const volumeRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      setPhase(isPlaying ? 'expanded' : 'collapsed');
      return;
    }

    if (isPlaying) {
      setPhase((current) => {
        if (current === 'expanded' || current === 'opening') return current;
        return 'opening';
      });
      const timer = window.setTimeout(() => {
        setPhase((current) => (current === 'opening' ? 'expanded' : current));
      }, PAIR_DURATION_MS);
      return () => window.clearTimeout(timer);
    }

    setPhase((current) => {
      if (current === 'collapsed' || current === 'closing') return current;
      return 'closing';
    });
    const timer = window.setTimeout(() => {
      setPhase((current) => (current === 'closing' ? 'collapsed' : current));
    }, PAIR_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isPlaying, reducedMotion]);

  useLayoutEffect(() => {
    const pill = playPillRef.current;
    if (!pill) return;

    const measure = () => {
      const rect = pill.getBoundingClientRect();
      if (rect.width < 1) return;
      const gap = rect.height * 0.2;
      setPairTravel(rect.width / 2 + gap + rect.height / 2);
      // The pill and the round volume button shift equal distances about the
      // centre, but the pill is much wider — so the visible pair lands left of
      // centre by (pillWidth − volumeWidth) / 4. Nudge the whole slot right to
      // recentre the combined block on the viewport.
      const volumeWidth = volumeRailRef.current?.offsetWidth ?? rect.height;
      setPairRecenter((rect.width - volumeWidth) / 4);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pill);
    return () => observer.disconnect();
  }, []);

  const volumeVisible = phase !== 'collapsed';

  const slotStyle = {
    '--pair-travel': `${pairTravel}px`,
    '--pair-offset': `${pairTravel / 2}px`,
    '--pair-recenter': `${pairRecenter}px`,
  } as CSSProperties;

  return (
    <div
      className={styles.cluster}
      data-reduced-motion={reducedMotion || undefined}
    >
      <div
        className={styles.playSlot}
        style={slotStyle}
        data-phase={phase}
      >
        <div
          className={styles.volumeRail}
          ref={volumeRailRef}
          data-phase={phase}
          inert={!volumeVisible || undefined}
          aria-hidden={!volumeVisible || undefined}
        >
          <MasterVolumeControl engine={engine} />
        </div>

        <div className={styles.playPill} ref={playPillRef}>
          <PlayBar isPlaying={isPlaying} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}
