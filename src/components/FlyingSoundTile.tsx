import { useEffect, useRef, useState } from 'react';
import { getSoundIconSrc, type RegionArtContext } from '../data/iconArt';
import { SoundIconImage } from './SoundIconImage';
import styles from './FlyingSoundTile.module.css';

type Props = {
  soundId: string;
  name: string;
  x: number;
  y: number;
  size: number;
  instanceId?: string;
  showLabel?: boolean;
  animateTo?: { x: number; y: number; size: number };
  onComplete?: () => void;
  regionArt?: RegionArtContext;
};

export function FlyingSoundTile({
  soundId,
  name,
  x,
  y,
  size,
  instanceId,
  showLabel = false,
  animateTo,
  onComplete,
  regionArt,
}: Props) {
  const completedRef = useRef(false);
  const isGuidedFlight = animateTo != null;
  const [frame, setFrame] = useState({ x, y, size });
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!isGuidedFlight) return;
    completedRef.current = false;
    setFrame({ x, y, size });
    setTransitioning(false);
  }, [x, y, size, soundId, isGuidedFlight]);

  useEffect(() => {
    if (!isGuidedFlight || !animateTo) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFrame(animateTo);
      onComplete?.();
      return;
    }

    const id = requestAnimationFrame(() => {
      setTransitioning(true);
      setFrame(animateTo);
    });
    return () => cancelAnimationFrame(id);
  }, [animateTo, isGuidedFlight, onComplete]);

  const handleTransitionEnd = () => {
    if (!isGuidedFlight || !transitioning || !animateTo || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  };

  if (!isGuidedFlight) {
    return (
      <div
        className={`${styles.tile} ${styles.dragFollow}`}
        style={{
          left: x,
          top: y,
          width: size,
          height: size,
        }}
        aria-hidden
      >
        <SoundIconImage
          src={getSoundIconSrc(soundId, instanceId, regionArt)}
          alt=""
          soundId={soundId}
          size="palette"
        />
        {showLabel && <span className={styles.label}>{name}</span>}
      </div>
    );
  }

  return (
    <div
      className={`${styles.tile} ${transitioning ? styles.animating : ''}`}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.size,
        height: frame.size,
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden
    >
      <SoundIconImage
        src={getSoundIconSrc(soundId, instanceId, regionArt)}
        alt=""
        soundId={soundId}
        size="palette"
      />
      {showLabel && <span className={styles.label}>{name}</span>}
    </div>
  );
}
