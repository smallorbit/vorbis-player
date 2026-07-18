import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shadcn-tokens.css'
import App from './App.tsx'
import { logSw } from '@/lib/debugLog'

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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        logSw('registered %s', registration.scope);
      })
      .catch((registrationError) => {
        console.error('[SW] registration failed:', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <App />
)
