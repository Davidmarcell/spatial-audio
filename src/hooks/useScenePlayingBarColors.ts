import { useEffect, useMemo, useState } from 'react';
import type { RegionArtContext } from '../data/iconArt';
import type { ActiveSound } from '../data/types';
import {
  extractScenePlayingBarVars,
  getActiveSceneImageUrls,
  type PlayingBarCssVars,
} from '../utils/sceneGradientColors';
import { getResolvedTheme, type ResolvedTheme } from '../utils/theme';

const DEBOUNCE_MS = 280;

function sceneSignature(activeSounds: ActiveSound[], regionArt: RegionArtContext): string {
  const soundKey = activeSounds.map((item) => `${item.instanceId}:${item.soundId}`).join('|');
  return `${regionArt.id}:${regionArt.soundIds.join(',')}:${soundKey}`;
}

export function useScenePlayingBarColors(
  activeSounds: ActiveSound[],
  regionArt: RegionArtContext,
): PlayingBarCssVars | undefined {
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedTheme());
  const [vars, setVars] = useState<PlayingBarCssVars | undefined>(undefined);

  const signature = useMemo(
    () => sceneSignature(activeSounds, regionArt),
    [activeSounds, regionArt],
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(getResolvedTheme());
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      setTheme(getResolvedTheme());
    };
    media.addEventListener('change', onSystemThemeChange);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const urls = getActiveSceneImageUrls(activeSounds, regionArt);

    if (urls.length === 0) {
      // Region switches briefly pass through zero resolvable art URLs before
      // the new scene's sounds/art are known. Clearing `vars` synchronously
      // here used to drop the colour override for that one frame, snapping
      // the radiance to its generic CSS fallback colour and then snapping
      // again to the real colour once the debounced computation below
      // landed — a visible double "jump" on every scene load. Debouncing the
      // clear the same way the set is debounced means a same-tick reappearing
      // scene cancels it before it ever fires, so the previous colour just
      // holds through the gap instead of flashing to the fallback.
      const clearTimer = window.setTimeout(() => {
        if (!cancelled) setVars(undefined);
      }, DEBOUNCE_MS);
      return () => {
        cancelled = true;
        window.clearTimeout(clearTimer);
      };
    }

    const timer = window.setTimeout(() => {
      void extractScenePlayingBarVars(activeSounds, regionArt, theme).then((next) => {
        if (!cancelled) {
          setVars(next);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature, theme, activeSounds, regionArt]);

  return vars;
}
