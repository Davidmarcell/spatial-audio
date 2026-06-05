import { Sheet } from '@silk-hq/components';
import { Attributions } from '../pages/Attributions';
import {
  bottomSheetStackingAnimation,
  sheetBackdropTravelAnimation,
} from './sheetDepth';
import sheet from './indentedSheet.module.css';
import styles from './AttributionsSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AttributionsSheet({ open, onOpenChange }: Props) {
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
            className={`${sheet.content} ${styles.content}`}
            stackingAnimation={bottomSheetStackingAnimation}
          >
            <Sheet.BleedingBackground className={sheet.bleeding} />
            {open && (
              <>
                <header className={styles.header}>
                  <h2 className={styles.title}>Attributions</h2>
                  <button
                    type="button"
                    className={styles.close}
                    aria-label="Close attributions"
                    onClick={() => onOpenChange(false)}
                  >
                    ×
                  </button>
                </header>
                <div className={styles.scroll}>
                  <Attributions embedded />
                </div>
              </>
            )}
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}
