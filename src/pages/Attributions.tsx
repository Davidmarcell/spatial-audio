import styles from './Attributions.module.css';

type Props = {
  embedded?: boolean;
};

type SourceLibrary = {
  name: string;
  url: string;
};

/**
 * De-duplicated list of the open collections Saudade draws its assets from.
 * Per-item credits (author, title, licence, exact source) live inline on each
 * sound and tile in the app; this view lists only the source libraries.
 *
 * Derived from the attribution data: audio from src/data/soundClips.generated.ts
 * (via soundPools), imagery from iconPools.generated.ts, iconArt.ts and
 * locationArtAttributions.ts. Keep in step with those sources.
 */
const audioLibraries: SourceLibrary[] = [
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org' },
  { name: 'BigSoundBank', url: 'https://bigsoundbank.com' },
  { name: 'xeno-canto', url: 'https://xeno-canto.org' },
  { name: 'Freesound', url: 'https://freesound.org' },
];

const imageryLibraries: SourceLibrary[] = [
  { name: 'The Metropolitan Museum of Art (Open Access)', url: 'https://www.metmuseum.org/art/collection' },
  { name: 'The New York Public Library Digital Collections', url: 'https://digitalcollections.nypl.org' },
  { name: 'Rijksmuseum', url: 'https://www.rijksmuseum.nl' },
  { name: 'Wellcome Collection', url: 'https://wellcomecollection.org' },
  { name: 'The J. Paul Getty Museum', url: 'https://www.getty.edu' },
  { name: 'British Library', url: 'https://www.bl.uk' },
  { name: 'National Gallery of Art', url: 'https://www.nga.gov' },
  { name: 'Biodiversity Heritage Library', url: 'https://www.biodiversitylibrary.org' },
  { name: 'Auckland War Memorial Museum', url: 'https://www.aucklandmuseum.com' },
  { name: 'Marianne North Gallery, Royal Botanic Gardens, Kew', url: 'https://www.kew.org' },
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org' },
];

function LibraryList({
  items,
  headingId,
  title,
}: {
  items: SourceLibrary[];
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
          <li key={item.name} className={styles.item}>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.name}
              <span className={styles.externalIcon} aria-hidden="true">
                &#8599;
              </span>
            </a>
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
        Every sound and image carries its own credit where it appears in the app. This
        page simply lists the open collections those assets are drawn from. The material
        is public domain, CC0, or Creative Commons licensed. Some items reach us via
        Wikimedia Commons from the collections below.
      </p>
      <LibraryList items={audioLibraries} headingId="audio-attributions" title="Audio" />
      <LibraryList
        items={imageryLibraries}
        headingId="imagery-attributions"
        title="Imagery"
      />
      <p className={styles.suggest}>Suggestions for new sources are welcome.</p>
    </section>
  );
}
