import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
/*
 * Fonts are bundled, not fetched. index.html used to pull Geist from fonts.googleapis.com
 * on every page load, which quietly broke the promise made in four places in the README
 * and in PRIVACY.md that this app makes no outbound request -- opening the dashboard told
 * Google the machine's IP and that it had been opened. `wght` is the upright axis only
 * (the UI never renders italics), and the @font-face rules carry unicode-range, so a
 * browser only ever loads the Latin subset it actually needs.
 */
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@/index.css';

const root = createRoot(document.getElementById('root')!);
// The fixture and preview UI are excluded from production builds by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') === 'redesign-preview') {
  void import('@/redesign/preview').then(({ default: Preview }) => {
    root.render(<StrictMode><Preview /></StrictMode>);
  });
} else {
  root.render(<StrictMode><App /></StrictMode>);
}
