import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@silk-hq/components/unlayered-styles.css';
import './styles/fontawesome.css';
import './index.css';
import { PlayingBarEdgeGradientProvider } from './context/PlayingBarEdgeGradientContext';
import { SearchSpotlightAnimationProvider } from './context/SearchSpotlightAnimationContext';
import { initTheme } from './utils/theme';
import {
  applyPlayingBarEdgeGradient,
  loadPlayingBarEdgeGradient,
} from './utils/playingBarEdgeGradient';
import { applySearchSpotlightAnimation, loadSearchSpotlightAnimation } from './utils/searchSpotlightAnimation';

initTheme();
applySearchSpotlightAnimation(loadSearchSpotlightAnimation());
applyPlayingBarEdgeGradient(loadPlayingBarEdgeGradient());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SearchSpotlightAnimationProvider>
      <PlayingBarEdgeGradientProvider>
        <App />
      </PlayingBarEdgeGradientProvider>
    </SearchSpotlightAnimationProvider>
  </StrictMode>,
);
