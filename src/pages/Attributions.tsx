import { artworkAttributions } from '../data/iconArt';
import { attributions } from '../data/attributions';
import { locationArtAttributions } from '../data/locationArtAttributions';
import type { ArtworkAttribution, Attribution } from '../data/types';
import styles from './Attributions.module.css';

type Props = {
  embedded?: boolean;
};

function AttributionList({
  items,
  headingId,
  title,
}: {
  items: Attribution[] | ArtworkAttribution[];
  headingId: string;
  title: string;
}) {
  return (
    <>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      <ul className={styles.list} aria-labelledby={headingId}>
        {items.map((item) => (
          <li key={item.file} className={styles.item}>
            <h3 className={styles.itemTitle}>{item.title}</h3>
            <dl className={styles.meta}>
              <div>
                <dt>File</dt>
                <dd>{item.file}</dd>
              </div>
              <div>
                <dt>Author</dt>
                <dd>{item.author}</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>{item.license}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {item.sourceUrl}
                  </a>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Attributions({ embedded = false }: Props) {
  return (
    <section
      className={`${styles.page} ${embedded ? styles.embedded : ''}`}
      aria-labelledby={embedded ? undefined : 'attributions-title'}
      aria-label={embedded ? 'Attributions' : undefined}
    >
      <h1 id="attributions-title" className={embedded ? styles.srOnly : styles.title}>
        Attributions
      </h1>
      <p className={styles.intro}>
        Bundled audio and illustration assets are public domain, CC0, or Creative Commons
        licensed. Species tiles favour historical plates (e.g. Audubon lithographs from The New
        York Public Library; NZ plates on Wikimedia). Ambient icons use The Met&apos;s Open Access
        drawings and watercolours. Some audio clips are representative stand-ins where
        region-specific recordings were unavailable under a compatible license.
      </p>
      <AttributionList items={attributions} headingId="audio-attributions" title="Audio" />
      <AttributionList
        items={artworkAttributions}
        headingId="artwork-attributions"
        title="Illustrations"
      />
      <AttributionList
        items={locationArtAttributions}
        headingId="location-art-attributions"
        title="Location art"
      />
    </section>
  );
}
