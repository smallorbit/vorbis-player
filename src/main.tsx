import { createRoot } from 'react-dom/client'
import { initErrorLogger, logError } from './services/errorLogger'
import './index.css'
import './styles/glow-animations.css'
import './styles/container-queries.css'
import App from './App.tsx'

initErrorLogger();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        logError(
          `SW registration failed: ${registrationError instanceof Error ? registrationError.message : String(registrationError)}`,
          'main'
        );
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <App />
)
