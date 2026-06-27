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
  applySearchSpotlightAnimation,
  DEFAULT_SEARCH_SPOTLIGHT_ANIMATION,
  loadSearchSpotlightAnimation,
  saveSearchSpotlightAnimation,
  syncCloseAnimationToOpen,
  type SearchSpotlightAnimationConfig,
} from '../utils/searchSpotlightAnimation';

type SearchSpotlightAnimationContextValue = {
  config: SearchSpotlightAnimationConfig;
  setConfig: (patch: Partial<SearchSpotlightAnimationConfig>) => void;
  resetConfig: () => void;
};

const SearchSpotlightAnimationContext = createContext<SearchSpotlightAnimationContextValue | null>(
  null,
);

export function SearchSpotlightAnimationProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<SearchSpotlightAnimationConfig>(() =>
    loadSearchSpotlightAnimation(),
  );

  useEffect(() => {
    applySearchSpotlightAnimation(config);
    saveSearchSpotlightAnimation(config);
  }, [config]);

  const setConfig = useCallback((patch: Partial<SearchSpotlightAnimationConfig>) => {
    setConfigState((current) => syncCloseAnimationToOpen({ ...current, ...patch }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(syncCloseAnimationToOpen(DEFAULT_SEARCH_SPOTLIGHT_ANIMATION));
  }, []);

  const value = useMemo(
    () => ({ config, setConfig, resetConfig }),
    [config, resetConfig, setConfig],
  );

  return (
    <SearchSpotlightAnimationContext.Provider value={value}>
      {children}
    </SearchSpotlightAnimationContext.Provider>
  );
}

export function useSearchSpotlightAnimation() {
  const context = useContext(SearchSpotlightAnimationContext);
  if (!context) {
    throw new Error('useSearchSpotlightAnimation must be used within SearchSpotlightAnimationProvider');
  }
  return context;
}
