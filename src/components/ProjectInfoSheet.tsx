import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Attributions } from '../pages/Attributions';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import styles from './ProjectInfoSheet.module.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TabKey = 'project' | 'attributions';

const TAB_ORDER: TabKey[] = ['project', 'attributions'];

export function ProjectInfoSheet({ open, onOpenChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('project');
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    project: null,
    attributions: null,
  });
  const id = useId();

  useEffect(() => {
    if (!open) {
      setActiveTab('project');
    }
  }, [open]);

  const focusTab = useCallback((tab: TabKey) => {
    tabRefs.current[tab]?.focus({ preventScroll: true });
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: TabKey) => {
      const currentIndex = TAB_ORDER.indexOf(currentTab);
      if (currentIndex < 0) return;

      let nextTab: TabKey | null = null;
      switch (event.key) {
        case 'ArrowRight':
          nextTab = TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length];
          break;
        case 'ArrowLeft':
          nextTab = TAB_ORDER[(currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length];
          break;
        case 'Home':
          nextTab = TAB_ORDER[0];
          break;
        case 'End':
          nextTab = TAB_ORDER[TAB_ORDER.length - 1];
          break;
        default:
          break;
      }

      if (!nextTab) return;
      event.preventDefault();
      setActiveTab(nextTab);
      requestAnimationFrame(() => focusTab(nextTab));
    },
    [focusTab],
  );

  const projectTabId = `${id}-project-tab`;
  const projectPanelId = `${id}-project-panel`;
  const attributionsTabId = `${id}-attributions-tab`;
  const attributionsPanelId = `${id}-attributions-panel`;

  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Project Info"
      titleId="project-info-overlay-title"
      closeLabel="Close project info"
      wide
      lockBodyScroll
      bodyClassName={styles.shell}
    >
      <div className={styles.tabs} role="tablist" aria-label="Project information sections">
        <button
          ref={(node) => {
            tabRefs.current.project = node;
          }}
          type="button"
          id={projectTabId}
          role="tab"
          aria-controls={projectPanelId}
          aria-selected={activeTab === 'project'}
          tabIndex={activeTab === 'project' ? 0 : -1}
          className={activeTab === 'project' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('project')}
          onKeyDown={(event) => handleTabKeyDown(event, 'project')}
        >
          Project
        </button>
        <button
          ref={(node) => {
            tabRefs.current.attributions = node;
          }}
          type="button"
          id={attributionsTabId}
          role="tab"
          aria-controls={attributionsPanelId}
          aria-selected={activeTab === 'attributions'}
          tabIndex={activeTab === 'attributions' ? 0 : -1}
          className={activeTab === 'attributions' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('attributions')}
          onKeyDown={(event) => handleTabKeyDown(event, 'attributions')}
        >
          Attributions
        </button>
      </div>

      {activeTab === 'project' ? (
        <div
          id={projectPanelId}
          role="tabpanel"
          aria-labelledby={projectTabId}
          className={styles.panel}
          tabIndex={0}
        >
          <section className={styles.section} aria-labelledby="project-info-about-project">
            <h3 className={styles.heading} id="project-info-about-project">
              This project
            </h3>
            <p className={styles.copy}>
              Saudade is a place to compose soundscapes in space. Choose a
              location, drag sounds across the canvas, and listen as distance and
              direction shape what you hear. Each scene is a small world you can share.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="project-info-about-memory">
            <h3 className={styles.heading} id="project-info-about-memory">
              Sound and memory
            </h3>
            <p className={styles.copy}>
              Environmental sound carries place. A distant bird, rain on stone, traffic
              fading - these textures embed in memory faster than sight alone. When you
              hear them again, even faintly, the mind returns: a street, a season,
              someone else&apos;s window. Spatial audio lets you arrange those echoes and
              feel them move around you.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="project-info-about-saudade">
            <h3 className={styles.heading} id="project-info-about-saudade">
              Saudade
            </h3>
            <p className={styles.copy}>
              Saudade is a Portuguese word for a bittersweet longing - the presence of
              something absent. A soundscape can hold that feeling: waves from a shore you
              haven&apos;t returned to, birdsong from a childhood summer, cafe murmur from
              a city far away. Here, sound is not just heard. It is remembered, imagined,
              and gently missed.
            </p>
          </section>
        </div>
      ) : (
        <div
          id={attributionsPanelId}
          role="tabpanel"
          aria-labelledby={attributionsTabId}
          className={styles.panel}
          tabIndex={0}
        >
          <Attributions embedded />
        </div>
      )}
    </ScaleBlurOverlay>
  );
}
