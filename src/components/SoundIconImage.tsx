import { useEffect, useMemo, useState } from 'react';
import { FALLBACK_ICON_SRC, iconSrcFallbackChain } from '../data/iconDetailSrc';
import { publicUrl } from '../utils/publicUrl';
import styles from './SoundIconImage.module.css';

type Props = {
  src: string;
  alt: string;
  soundId?: string;
  sourceUrl?: string;
  detailSrc?: string;
  size?: 'canvas' | 'compact' | 'palette' | 'detail' | 'detailNatural';
  /**
   * Optional explicit crop. Tiles intentionally use plain center-cover by
   * default so the canvas, expand face, and settled card share one framing
   * and do not jump on open/close.
   */
  crop?: { scale: number; x?: string; y?: string };
};

export function SoundIconImage({
  src,
  alt,
  soundId: _soundId,
  sourceUrl,
  detailSrc,
  size = 'canvas',
  crop,
}: Props) {
  const usesDetailAsset = size === 'detail' || size === 'detailNatural';
  const fallbackChain = useMemo(
    () =>
      iconSrcFallbackChain(
        { src, sourceUrl, detailSrc },
        usesDetailAsset ? 'detail' : 'tile',
      ),
    [detailSrc, sourceUrl, src, usesDetailAsset],
  );
  const [chainIndex, setChainIndex] = useState(0);
  const imageSrc = fallbackChain[chainIndex] ?? FALLBACK_ICON_SRC;
  const resolvedSrc = publicUrl(imageSrc);
  const isDetail = usesDetailAsset;
  const isNatural = size === 'detailNatural';
  // Keep unused soundId in the public API for callers; crop tables are no longer
  // applied automatically (see `crop` prop for rare overrides).
  void _soundId;

  useEffect(() => {
    setChainIndex(0);
  }, [fallbackChain]);

  return (
    <span className={`${styles.frame} ${styles[size] ?? ''}`}>
      <img
        key={resolvedSrc}
        className={styles.image}
        src={resolvedSrc}
        alt={alt}
        draggable={false}
        /* Canvas / dock / landing faces should decode with the scene — lazy
           left too many empty square frames while the network caught up. */
        loading="eager"
        decoding={isDetail ? 'sync' : 'async'}
        fetchPriority={size === 'canvas' || size === 'detail' || size === 'detailNatural' ? 'high' : 'auto'}
        onError={() => {
          setChainIndex((current) => {
            if (current >= fallbackChain.length - 1) return current;
            return current + 1;
          });
        }}
        style={
          isDetail || isNatural || !crop
            ? undefined
            : {
                transform: `scale(${crop.scale})`,
                objectPosition: `${crop.x ?? '50%'} ${crop.y ?? '50%'}`,
              }
        }
      />
    </span>
  );
}
