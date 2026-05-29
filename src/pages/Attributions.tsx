import { attributions } from '../data/attributions';
import styles from './Attributions.module.css';

export function Attributions() {
  return (
    <section className={styles.page} aria-labelledby="attributions-title">
      <h1 id="attributions-title" className={styles.title}>
        Audio Attributions
      </h1>
      <p className={styles.intro}>
        All bundled sounds are royalty-free or Creative Commons licensed. Some clips are
        representative stand-ins where region-specific recordings were unavailable under a
        compatible license.
      </p>
      <ul className={styles.list}>
        {attributions.map((item) => (
          <li key={item.file} className={styles.item}>
            <h2 className={styles.itemTitle}>{item.title}</h2>
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
    </section>
  );
}
