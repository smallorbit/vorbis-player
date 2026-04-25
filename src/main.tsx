import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shadcn-tokens.css'
import App from './App.tsx'
import { logSw } from '@/lib/debugLog'

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
