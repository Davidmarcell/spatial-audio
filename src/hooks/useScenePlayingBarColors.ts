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
      setVars(undefined);
      return undefined;
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
