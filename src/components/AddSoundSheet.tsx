import { useEffect, useMemo, useState } from 'react';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import type { AddSoundTab, Season, SoundDef } from '../data/types';
import {
  displaySoundName,
  filterSoundsByQuery,
  librarySoundsForRegion,
  paletteSoundsForRegion,
} from '../utils/soundCatalog';
import type { OriginRectSnapshot } from '../utils/overlayOriginAnimation';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import { SeasonPicker } from './SeasonPicker';
import { SoundIconImage } from './SoundIconImage';
import { UiIcon } from './UiIcon';
import styles from './AddSoundSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect?: OriginRectSnapshot | null;
  sounds: SoundDef[];
  activeSoundIds: string[];
  regionArt: RegionArtContext;
  migratoryBirds?: boolean;
  defaultSeason?: Season;
  draggingSoundId: string | null;
  dragActive: boolean;
  onDragStart: (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => void;
};

const TABS: Array<{ id: AddSoundTab; label: string }> = [
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'ambient', label: 'Ambient' },
];

export function AddSoundSheet({
  open,
  onOpenChange,
  originRect,
  sounds,
  activeSoundIds,
  regionArt,
  migratoryBirds,
  defaultSeason = 'spring',
  draggingSoundId,
  dragActive,
  onDragStart,
}: Props) {
  const [tab, setTab] = useState<AddSoundTab>('wildlife');
  const [season, setSeason] = useState<Season>(defaultSeason);
  const [searchQuery, setSearchQuery] = useState('');

  const isSearching = searchQuery.trim().length > 0;

  const listedSounds = useMemo(() => {
    const base = isSearching
      ? librarySoundsForRegion(sounds, season)
      : paletteSoundsForRegion(sounds, tab, season);
    return filterSoundsByQuery(base, searchQuery);
  }, [sounds, tab, season, searchQuery, isSearching]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setTab('wildlife');
      setSeason(defaultSeason);
    }
  }, [open, defaultSeason]);

  const handlePointerDown = (
    sound: SoundDef,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (activeSoundIds.includes(sound.id)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragStart(sound, event);
  };

  const emptyMessage = isSearching
    ? `No sounds match "${searchQuery.trim()}".`
    : 'No sounds in this category for the current season.';

  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Sound library"
      titleId="add-sound-overlay-title"
      closeLabel="Close sound library"
      hideTitle
      wide
      bodyClassName={styles.body}
      pointerPassThrough={dragActive}
      originRect={originRect}
      headerContent={
        <div className={styles.topBar}>
          <div className={styles.searchRow}>
            <UiIcon icon="magnifying-glass" size="sm" className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search sounds"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search sounds"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                className={styles.clearSearch}
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
              >
                <UiIcon icon="xmark" size="sm" className={styles.closeIcon} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.closeSheet}
            aria-label="Close sound library"
            onClick={() => onOpenChange(false)}
          >
            <UiIcon icon="xmark" size="sm" className={styles.closeIcon} />
          </button>
        </div>
      }
    >
      <div className={styles.controls}>
        <div
          className={`${styles.categoryToggle} ${isSearching ? styles.categoryToggleMuted : ''}`}
          data-tab={tab}
          role="tablist"
          aria-label="Sound categories"
        >
          <span className={styles.categoryThumb} aria-hidden />
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={!isSearching && tab === item.id}
              className={`${styles.categorySegment} ${!isSearching && tab === item.id ? styles.categorySegmentActive : ''}`}
              onClick={() => {
                setSearchQuery('');
                setTab(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {migratoryBirds && (tab === 'wildlife' || isSearching) && (
          <SeasonPicker value={season} onChange={setSeason} />
        )}
        {isSearching && (
          <p className={styles.searchHint}>Searching regional and global sounds</p>
        )}
      </div>

      <div className={styles.scroll} role="tabpanel">
        {listedSounds.length === 0 ? (
          <div className={styles.empty}>
            <p>{emptyMessage}</p>
            {isSearching && (
              <button
                type="button"
                className={styles.emptyAction}
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className={styles.gridFade} key={tab}>
            <ul className={styles.list}>
              {listedSounds.map((sound) => {
                const onCanvas = activeSoundIds.includes(sound.id);
                const isDragging = draggingSoundId === sound.id;
                const label = displaySoundName(sound);
                const artwork = getSoundArtworkForRegion(
                  regionArt.id,
                  regionArt.soundIds,
                  sound.id,
                  undefined,
                  regionArt.tags,
                );
                return (
                  <li
                    key={sound.id}
                    className={`${styles.listItem} ${isDragging ? styles.listItemDragging : ''}`}
                  >
                    {!isDragging && (
                      <button
                        type="button"
                        className={`${styles.card} ${onCanvas ? styles.cardOnCanvas : ''}`}
                        disabled={onCanvas}
                        onPointerDown={(event) => handlePointerDown(sound, event)}
                      >
                        <span className={styles.cardHead}>
                          <span className={styles.iconWrap}>
                            <SoundIconImage
                              src={artwork.src}
                              sourceUrl={artwork.sourceUrl}
                              detailSrc={artwork.detailSrc}
                              alt=""
                              soundId={sound.id}
                              size="palette"
                            />
                          </span>
                          <span className={styles.cardTitleWrap}>
                            <span className={styles.soundName}>{label}</span>
                            <span className={styles.soundMeta}>
                              {onCanvas ? (
                                <span className={styles.onCanvasBadge}>On canvas</span>
                              ) : (
                                'Drag or tap to add'
                              )}
                            </span>
                          </span>
                          {!onCanvas && (
                            <span className={styles.addHint} aria-hidden>
                              <UiIcon icon="plus" size="sm" />
                            </span>
                          )}
                        </span>
                        <span className={styles.cardDescription}>{sound.description ?? ''}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </ScaleBlurOverlay>
  );
}
