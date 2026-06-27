import { Attributions } from '../pages/Attributions';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import styles from './AttributionsSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AttributionsSheet({ open, onOpenChange }: Props) {
  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Attributions"
      titleId="attributions-overlay-title"
      closeLabel="Close attributions"
      wide
      bodyClassName={styles.scroll}
    >
      <Attributions embedded />
    </ScaleBlurOverlay>
  );
}
