import { useEffect, useRef, useState } from 'react';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
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
  elevated?: boolean;
  /** When true, apply canvas-style drag tilt and lift. */
  dragPhysics?: boolean;
};

/** Softer than canvas tiles — same velocity tilt model, less lag. */
const FLYING_TILE_SWAY = {
  maxSway: 0.22,
  swayFactor: 0.38,
  swaySmooth: 42,
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
  elevated = false,
  dragPhysics = false,
}: Props) {
  const completedRef = useRef(false);
  const isGuidedFlight = animateTo != null;
  const [frame, setFrame] = useState({ x, y, size });
  const [transitioning, setTransitioning] = useState(false);
  const [sway, setSway] = useState(0);
  const positionRef = useRef({ x, y });
  positionRef.current = { x, y };
  const motionRef = useRef({
    x,
    y,
    vx: 0,
    sway: 0,
    lastTime: 0,
  });

  useEffect(() => {
    if (!isGuidedFlight) return;
    completedRef.current = false;
    setFrame({ x, y, size });
    setTransitioning(false);
  }, [x, y, size, soundId, isGuidedFlight]);

  useEffect(() => {
    if (!dragPhysics || isGuidedFlight) {
      setSway(0);
      motionRef.current = { x, y, vx: 0, sway: 0, lastTime: 0 };
      return;
    }

    let frameId = 0;

    const loop = (now: number) => {
      const motion = motionRef.current;
      const { x: currentX } = positionRef.current;
      const dt = motion.lastTime ? Math.min((now - motion.lastTime) / 1000, 0.032) : 0;
      motion.lastTime = now;

      if (dt > 0) {
        const vx = (currentX - motion.x) / dt;
        motion.x = currentX;
        motion.y = positionRef.current.y;
        motion.vx = vx;

        const targetSway = Math.max(
          -FLYING_TILE_SWAY.maxSway,
          Math.min(FLYING_TILE_SWAY.maxSway, vx * FLYING_TILE_SWAY.swayFactor),
        );
        const swayBlend = 1 - Math.exp(-FLYING_TILE_SWAY.swaySmooth * dt);
        motion.sway += (targetSway - motion.sway) * swayBlend;

        if (Math.abs(motion.sway) < 0.0001 && Math.abs(targetSway) < 0.0001) {
          motion.sway = 0;
        }

        setSway(motion.sway);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [dragPhysics, isGuidedFlight]);

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

  const tileClass = [
    styles.tile,
    isGuidedFlight ? (transitioning ? styles.animating : '') : styles.dragFollow,
    dragPhysics ? styles.dragPhysics : '',
    elevated ? styles.elevated : '',
  ]
    .filter(Boolean)
    .join(' ');

  const swayDeg = (sway * 180) / Math.PI;
  const dragStyle = dragPhysics && !isGuidedFlight
    ? { transform: `translate(-50%, -50%) rotate(${swayDeg}deg) scale(1.06)` }
    : undefined;
  const artwork = regionArt
    ? getSoundArtworkForRegion(regionArt.id, regionArt.soundIds, soundId, instanceId, regionArt.tags)
    : getSoundArtworkForRegion('fallback', [soundId], soundId, instanceId);

  if (!isGuidedFlight) {
    return (
      <div
        className={tileClass}
        style={{
          left: x,
          top: y,
          width: size,
          height: size,
          ...dragStyle,
        }}
        aria-hidden
      >
        <SoundIconImage
          src={artwork.src}
          sourceUrl={artwork.sourceUrl}
          detailSrc={artwork.detailSrc}
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
      className={tileClass}
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
        src={artwork.src}
        sourceUrl={artwork.sourceUrl}
        detailSrc={artwork.detailSrc}
        alt=""
        soundId={soundId}
        size="palette"
      />
      {showLabel && <span className={styles.label}>{name}</span>}
    </div>
  );
}
