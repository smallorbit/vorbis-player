import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StandalonePlayerDemo from './StandalonePlayerDemo.tsx'

// Toggle between original app and standalone demo
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === 'true';

// Register service worker for caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    DEMO_MODE ? <StandalonePlayerDemo /> : <App />
  // </StrictMode>,
)
