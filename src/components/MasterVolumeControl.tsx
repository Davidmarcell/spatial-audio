import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { getStoredMasterVolume, storeMasterVolume } from '../utils/masterVolume';
import { UiIcon, type UiIconName } from './UiIcon';
import glass from '../styles/glassButton.module.css';
import styles from './MasterVolumeControl.module.css';

type Props = {
  engine: AudioEngine;
};

function iconForVolume(volume: number): UiIconName {
  if (volume <= 0) return 'volume-xmark';
  if (volume < 0.5) return 'volume-low';
  return 'volume-high';
}

export function MasterVolumeControl({ engine }: Props) {
  const [volume, setVolume] = useState(() => getStoredMasterVolume());
  const [open, setOpen] = useState(false);
  // Remembers the level to restore when unmuting from a click.
  const preMuteRef = useRef(volume > 0 ? volume : 1);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    engine.setMasterVolume(volume, 0);
  }, [engine]);

  const applyVolume = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(1, next));
      setVolume(clamped);
      engine.setMasterVolume(clamped);
      storeMasterVolume(clamped);
      if (clamped > 0) preMuteRef.current = clamped;
    },
    [engine],
  );

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      preMuteRef.current = volume;
      applyVolume(0);
    } else {
      applyVolume(preMuteRef.current > 0 ? preMuteRef.current : 1);
    }
  }, [applyVolume, volume]);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  const sliderId = useId();
  const percent = Math.round(volume * 100);

  return (
    <div
      className={styles.wrap}
      onPointerEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={scheduleClose}
      onFocus={() => {
        cancelClose();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <div
        className={`${styles.popover} ${open ? styles.popoverOpen : ''}`}
        role="group"
        aria-label="Master volume"
        aria-hidden={!open}
      >
        <label className={styles.sliderLabel} htmlFor={sliderId}>
          Master volume
        </label>
        <div className={styles.sliderRow}>
          <input
            id={sliderId}
            className={styles.slider}
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            tabIndex={open ? 0 : -1}
            onChange={(event) => applyVolume(Number(event.target.value) / 100)}
            aria-label="Master volume"
            aria-valuetext={`${percent}%`}
          />
          <span className={styles.value}>{percent}%</span>
        </div>
      </div>
      <button
        type="button"
        className={`${glass.icon} ${styles.button}`}
        onClick={toggleMute}
        aria-label={volume <= 0 ? 'Unmute everything' : 'Mute everything'}
      >
        <UiIcon icon={iconForVolume(volume)} />
      </button>
    </div>
  );
}
