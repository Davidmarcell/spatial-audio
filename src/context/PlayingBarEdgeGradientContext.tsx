import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyPlayingBarEdgeGradient,
  DEFAULT_PLAYING_BAR_EDGE_GRADIENT,
  loadPlayingBarEdgeGradient,
  savePlayingBarEdgeGradientSavedDefault,
  type PlayingBarEdgeGradientConfig,
} from '../utils/playingBarEdgeGradient';

type PlayingBarEdgeGradientContextValue = {
  config: PlayingBarEdgeGradientConfig;
  setConfig: (patch: Partial<PlayingBarEdgeGradientConfig>) => void;
  saveConfigAsDefault: () => void;
  resetConfig: () => void;
};

const PlayingBarEdgeGradientContext = createContext<PlayingBarEdgeGradientContextValue | null>(
  null,
);

export function PlayingBarEdgeGradientProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<PlayingBarEdgeGradientConfig>(() =>
    loadPlayingBarEdgeGradient(),
  );

  useEffect(() => {
    applyPlayingBarEdgeGradient(config);
  }, [config]);

  const setConfig = useCallback((patch: Partial<PlayingBarEdgeGradientConfig>) => {
    setConfigState((current) => ({ ...current, ...patch }));
  }, []);

  const saveConfigAsDefault = useCallback(() => {
    savePlayingBarEdgeGradientSavedDefault(config);
  }, [config]);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_PLAYING_BAR_EDGE_GRADIENT);
  }, []);

  const value = useMemo(
    () => ({ config, setConfig, saveConfigAsDefault, resetConfig }),
    [config, resetConfig, saveConfigAsDefault, setConfig],
  );

  return (
    <PlayingBarEdgeGradientContext.Provider value={value}>
      {children}
    </PlayingBarEdgeGradientContext.Provider>
  );
}

export function usePlayingBarEdgeGradient() {
  const context = useContext(PlayingBarEdgeGradientContext);
  if (!context) {
    throw new Error('usePlayingBarEdgeGradient must be used within PlayingBarEdgeGradientProvider');
  }
  return context;
}
