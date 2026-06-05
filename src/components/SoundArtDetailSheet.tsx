import { Sheet } from '@silk-hq/components';
import type { SoundDef } from '../data/types';
import type { RegionArtContext } from '../data/iconArt';
import {
  bottomSheetStackingAnimation,
  sheetBackdropTravelAnimation,
} from './sheetDepth';
import sheet from './indentedSheet.module.css';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import styles from './SoundArtDetailSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DetailTarget | null;
  sound?: SoundDef;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
};

export function SoundArtDetailSheet({
  open,
  onOpenChange,
  target,
  sound,
  onVolumeChange,
  regionArt,
}: Props) {
  const handlePresentedChange = (presented: boolean) => {
    if (!presented) onOpenChange(false);
  };

  return (
    <Sheet.Root
      license="non-commercial"
      forComponent="closest"
      presented={open}
      onPresentedChange={handlePresentedChange}
      defaultActiveDetent={2}
      sheetRole="dialog"
    >
      <Sheet.Portal container={typeof document !== 'undefined' ? document.body : null}>
        <Sheet.View
          className={sheet.view}
          contentPlacement="bottom"
          detents={['42%', '100%']}
          nativeEdgeSwipePrevention
        >
          <Sheet.Backdrop
            className={sheet.backdrop}
            themeColorDimming="auto"
            travelAnimation={sheetBackdropTravelAnimation}
          />
          <Sheet.Content
            className={`${sheet.content} ${styles.content}`}
            stackingAnimation={bottomSheetStackingAnimation}
          >
            <Sheet.BleedingBackground className={sheet.bleeding} />
            {open && target && (
              <div
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="art-detail-title"
              >
                <SoundArtDetailContent
                  target={target}
                  sound={sound}
                  onClose={() => onOpenChange(false)}
                  onVolumeChange={onVolumeChange}
                  regionArt={regionArt}
                />
              </div>
            )}
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}

export type { DetailTarget };
