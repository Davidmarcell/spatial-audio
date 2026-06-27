import { lazy, Suspense } from 'react';
import { Sheet } from '@silk-hq/components';
import type { WorldLocation } from '../data/worldLocations';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  bottomSheetStackingAnimation,
  sheetBackdropTravelAnimation,
} from './sheetDepth';
import sheet from './indentedSheet.module.css';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import styles from './GlobeMapSheet.module.css';

const GlobeExplorer = lazy(() =>
  import('./GlobeExplorer').then((module) => ({ default: module.GlobeExplorer })),
);

const MOBILE_MAP_QUERY = '(max-width: 768px)';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: WorldLocation[];
  activeEnvironmentId: string;
  activeRegionId: string;
  activeLocationId?: string;
  onSelect: (location: WorldLocation) => void;
};

type GlobeContentProps = Omit<Props, 'open'> & {
  showCloseButton?: boolean;
};

function GlobeMapContent({
  onOpenChange,
  locations,
  activeEnvironmentId,
  activeRegionId,
  activeLocationId,
  onSelect,
  showCloseButton = true,
}: GlobeContentProps) {
  return (
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
        showCloseButton={showCloseButton}
      />
    </Suspense>
  );
}

function GlobeMapMobileSheet(props: Props) {
  const { open, onOpenChange } = props;

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
            {open && <GlobeMapContent {...props} />}
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}

function GlobeMapModal(props: Props) {
  const { open, onOpenChange } = props;

  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="World map"
      titleId="globe-map-modal-title"
      closeLabel="Close world map"
      lockBodyScroll
      extraPanelClassName={styles.modalPanel}
      bodyClassName={styles.modalBody}
      backdropClassName={styles.modalBackdrop}
    >
      <GlobeMapContent {...props} showCloseButton={false} />
    </ScaleBlurOverlay>
  );
}

export function GlobeMapSheet(props: Props) {
  const isMobile = useMediaQuery(MOBILE_MAP_QUERY);

  if (isMobile) {
    return <GlobeMapMobileSheet {...props} />;
  }

  return <GlobeMapModal {...props} />;
}
