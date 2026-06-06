import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Prototypes } from './pages/Prototypes';
import '@silk-hq/components/unlayered-styles.css';
import './index.css';

const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const Root = pathname === '/prototypes' ? Prototypes : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
