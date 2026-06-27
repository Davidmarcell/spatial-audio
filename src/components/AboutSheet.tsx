import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import styles from './AboutSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AboutSheet({ open, onOpenChange }: Props) {
  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="About"
      titleId="about-overlay-title"
      closeLabel="Close about"
      bodyClassName={styles.scroll}
    >
      <section className={styles.section} aria-labelledby="about-project">
        <h3 className={styles.heading} id="about-project">
          This project
        </h3>
        <p className={styles.body}>
          Saudade is a place to compose soundscapes in space. Choose a
          location, drag sounds across the canvas, and listen as distance and
          direction shape what you hear. Each scene is a small world you can share.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="about-memory">
        <h3 className={styles.heading} id="about-memory">
          Sound and memory
        </h3>
        <p className={styles.body}>
          Environmental sound carries place. A distant bird, rain on stone, traffic
          fading — these textures embed in memory faster than sight alone. When you
          hear them again, even faintly, the mind returns: a street, a season,
          someone else&apos;s window. Spatial audio lets you arrange those echoes and
          feel them move around you.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="about-saudade">
        <h3 className={styles.heading} id="about-saudade">
          Saudade
        </h3>
        <p className={styles.body}>
          Saudade is a Portuguese word for a bittersweet longing — the presence of
          something absent. A soundscape can hold that feeling: waves from a shore you
          haven&apos;t returned to, birdsong from a childhood summer, café murmur from
          a city far away. Here, sound is not just heard. It is remembered, imagined,
          and gently missed.
        </p>
      </section>
    </ScaleBlurOverlay>
  );
}
