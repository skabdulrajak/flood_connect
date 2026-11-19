import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';
import { initFloodConnectServiceWorker } from './pwa/registerSW';

// Google Maps Platform demo key quota/auth listeners (Case A Defense)
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new Event('gmp-quota-exceeded'));
};

const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a ?? '')).join(' ');
  if (/OverQuotaMapError|QuotaExceededError/i.test(msg)) {
    window.dispatchEvent(new Event('gmp-quota-exceeded'));
  }
  origConsoleError(...args);
};

// Register Workbox service worker for offline static assets and cached emergency data
initFloodConnectServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
