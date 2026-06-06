import heroImage from '../assets/hero.png';
import styles from './Prototypes.module.css';

const spatialAudio = {
  title: 'Spatial Audio',
  eyebrow: 'Prototype',
  description:
    'An interactive ambient soundscape composer where draggable sounds respond with real-time distance, volume, and stereo panning in the browser.',
  repoUrl: 'https://github.com/Davidmarcell/spatial-audio',
  liveUrl: '/',
  tags: ['React', 'TypeScript', 'Web Audio API', 'globe.gl', 'Three.js'],
};

export function Prototypes() {
  return (
    <main className={styles.page} aria-labelledby="prototypes-title">
      <section className={styles.hero}>
        <p className={styles.kicker}>Prototypes</p>
        <h1 id="prototypes-title">Interactive experiments</h1>
        <p>
          Small, polished builds exploring sound, motion, and playful interface systems.
        </p>
      </section>

      <section className={styles.grid} aria-label="Prototype list">
        <article className={styles.card}>
          <a className={styles.imageLink} href={spatialAudio.liveUrl} aria-label="Open Spatial Audio">
            <img src={heroImage} alt="" className={styles.image} />
          </a>
          <div className={styles.content}>
            <p className={styles.eyebrow}>{spatialAudio.eyebrow}</p>
            <h2>{spatialAudio.title}</h2>
            <p>{spatialAudio.description}</p>
            <ul className={styles.tags} aria-label={`${spatialAudio.title} technologies`}>
              {spatialAudio.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href={spatialAudio.liveUrl}>
                Open prototype
              </a>
              <a href={spatialAudio.repoUrl} target="_blank" rel="noreferrer">
                View source
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
