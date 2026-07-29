import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AsciiBackgroundPreview from './pages/AsciiBackgroundPreview';
import '@silk-hq/components/unlayered-styles.css';
import './styles/fontawesome.css';
import './styles/romie.css';
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

const showAsciiPreview = new URLSearchParams(window.location.search).get('view') === 'ascii';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showAsciiPreview ? (
      <AsciiBackgroundPreview />
    ) : (
      <SearchSpotlightAnimationProvider>
        <PlayingBarEdgeGradientProvider>
          <App />
        </PlayingBarEdgeGradientProvider>
      </SearchSpotlightAnimationProvider>
    )}
  </StrictMode>,
);
