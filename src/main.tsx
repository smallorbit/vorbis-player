import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shadcn-tokens.css'
import App from './App.tsx'
import { logSw } from '@/lib/debugLog'
import { purgeLegacyServiceWorkerCaches } from '@/services/serviceWorkerCaches'

// Deploy provenance: always log the running build and expose it on window so the
// exact deployed commit can be confirmed from any environment (staging/prod).
const buildInfo: BuildInfo = {
  sha: __BUILD_SHA__,
  ref: __BUILD_REF__,
  env: __BUILD_ENV__,
  version: __APP_VERSION__,
};
window.__BUILD__ = buildInfo;
console.info(
  `Vorbis build ${buildInfo.sha === 'unknown' ? 'dev' : buildInfo.sha.slice(0, 7)} · ${buildInfo.ref} · ${buildInfo.env}`,
);

// Mock provider loads when VITE_MOCK_PROVIDER=true or in any dev build (so
// `?provider=mock` URL activation works without restarting). Both constants are
// build-time, so production builds DCE the branch and tree-shake the mock.
if (import.meta.env.VITE_MOCK_PROVIDER === 'true' || import.meta.env.DEV) {
  await import('@/providers/mock/mockProvider');
}

function registerServiceWorker(): void {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      logSw('registered %s', registration.scope);
      return purgeLegacyServiceWorkerCaches();
    })
    .catch((registrationError) => {
      console.error('[SW] registration failed:', registrationError);
    });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // The top-level await above can outlast the load event (mock builds), so
  // register immediately when the page has already loaded.
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
