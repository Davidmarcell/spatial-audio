import { useEffect, useState } from 'react';
import { getDetailIconSrc } from '../data/iconDetailSrc';
import { getIconCrop } from '../data/iconCrop';
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
  const resolvedSrc =
    size === 'detail' ? getDetailIconSrc(src, sourceUrl, detailSrc) : src;
  const [imageSrc, setImageSrc] = useState(resolvedSrc);
  const resolvedCrop = crop ?? getIconCrop(soundId ?? '', src, size);

  useEffect(() => {
    setImageSrc(resolvedSrc);
  }, [resolvedSrc]);

  return (
    <span className={`${styles.frame} ${styles[size] ?? ''}`}>
      <img
        className={styles.image}
        src={imageSrc}
        alt={alt}
        draggable={false}
        loading={size === 'detail' ? 'eager' : 'lazy'}
        decoding={size === 'detail' ? 'sync' : 'async'}
        onError={() => {
          if (imageSrc !== src) setImageSrc(src);
        }}
        style={{
          transform: `scale(${resolvedCrop.scale})`,
          objectPosition: `${resolvedCrop.x ?? '50%'} ${resolvedCrop.y ?? '50%'}`,
        }}
      />
    </span>
  );
}
