import { useEffect, useMemo, useState } from 'react';
import { getIconCrop } from '../data/iconCrop';
import { FALLBACK_ICON_SRC, iconSrcFallbackChain } from '../data/iconDetailSrc';
import styles from './SoundIconImage.module.css';

type Props = {
  src: string;
  alt: string;
  soundId?: string;
  sourceUrl?: string;
  detailSrc?: string;
  size?: 'canvas' | 'compact' | 'palette' | 'detail';
  crop?: { scale: number; x?: string; y?: string };
};

export function SoundIconImage({
  src,
  alt,
  soundId,
  sourceUrl,
  detailSrc,
  size = 'canvas',
  crop,
}: Props) {
  const fallbackChain = useMemo(
    () =>
      iconSrcFallbackChain({ src, sourceUrl, detailSrc }, size === 'detail' ? 'detail' : 'tile'),
    [detailSrc, size, sourceUrl, src],
  );
  const [chainIndex, setChainIndex] = useState(0);
  const imageSrc = fallbackChain[chainIndex] ?? FALLBACK_ICON_SRC;
  const resolvedCrop = crop ?? getIconCrop(soundId ?? '', src, size);
  const isDetail = size === 'detail';

  useEffect(() => {
    setChainIndex(0);
  }, [fallbackChain]);

  return (
    <span className={`${styles.frame} ${styles[size] ?? ''}`}>
      <img
        className={styles.image}
        src={imageSrc}
        alt={alt}
        draggable={false}
        loading={isDetail ? 'eager' : 'lazy'}
        decoding={isDetail ? 'sync' : 'async'}
        onError={() => {
          setChainIndex((current) => {
            if (current >= fallbackChain.length - 1) return current;
            return current + 1;
          });
        }}
        style={
          isDetail
            ? undefined
            : {
                transform: `scale(${resolvedCrop.scale})`,
                objectPosition: `${resolvedCrop.x ?? '50%'} ${resolvedCrop.y ?? '50%'}`,
              }
        }
      />
    </span>
  );
}
