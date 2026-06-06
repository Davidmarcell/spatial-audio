import App from './App';
import { Prototypes } from './pages/Prototypes';

export function Root() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

  return pathname === '/prototypes' ? <Prototypes /> : <App />;
}
