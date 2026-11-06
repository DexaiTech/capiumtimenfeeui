import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { reloadForNewVersion } from './utils/reloadForNewVersion';
import '@fontsource-variable/inter';
import './styles/base.css';

// A lazily loaded page or chart file could not be fetched, most often because a new version was
// released while this tab was open (APT82): reload once for the new version instead of failing.
// When no reload happens (offline, already reloaded), the error goes on to the error screen.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
