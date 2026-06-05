import { lazy, Suspense } from 'react';
import { Sheet } from '@silk-hq/components';
import type { WorldLocation } from '../data/worldLocations';
import {
  bottomSheetStackingAnimation,
  sheetBackdropTravelAnimation,
} from './sheetDepth';
import sheet from './indentedSheet.module.css';
import styles from './GlobeMapSheet.module.css';

const GlobeExplorer = lazy(() =>
  import('./GlobeExplorer').then((module) => ({ default: module.GlobeExplorer })),
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: WorldLocation[];
  activeEnvironmentId: string;
  activeRegionId: string;
  activeLocationId?: string;
  onSelect: (location: WorldLocation) => void;
};

export function GlobeMapSheet({
  open,
  onOpenChange,
  locations,
  activeEnvironmentId,
  activeRegionId,
  activeLocationId,
  onSelect,
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
          detents={['38%', '100%']}
          nativeEdgeSwipePrevention
        >
          <Sheet.Backdrop
            className={sheet.backdrop}
            themeColorDimming="auto"
            travelAnimation={sheetBackdropTravelAnimation}
          />
          <Sheet.Content
            className={`${sheet.content} ${sheet.contentWide}`}
            stackingAnimation={bottomSheetStackingAnimation}
          >
            <Sheet.BleedingBackground className={sheet.bleeding} />
            {open && (
              <Suspense
                fallback={
                  <div className={styles.loading} role="status" aria-live="polite">
                    Loading world map…
                  </div>
                }
              >
                <GlobeExplorer
                  locations={locations}
                  activeEnvironmentId={activeEnvironmentId}
                  activeRegionId={activeRegionId}
                  activeLocationId={activeLocationId}
                  onSelect={onSelect}
                  onClose={() => onOpenChange(false)}
                />
              </Suspense>
            )}
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}
