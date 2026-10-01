import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@/i18n';
import { canonicalHash } from '@/redesign/routes';
const App = lazy(() => import('@/App'));
const ProductionOverview = lazy(() => import('@/redesign/production').then(module => ({ default: module.ProductionOverview })));
const ProductionProjects = lazy(() => import('@/redesign/projects').then(module => ({ default: module.ProductionProjects })));
const ProductionLive = lazy(() => import('@/redesign/live').then(module => ({ default: module.ProductionLive })));
const ProductionProviders = lazy(() => import('@/redesign/providers').then(module => ({ default: module.ProductionProviders })));
const ProductionModels = lazy(() => import('@/redesign/models').then(module => ({ default: module.ProductionModels })));
const ProductionCost = lazy(() => import('@/redesign/cost').then(module => ({ default: module.ProductionCost })));
const ProductionAlerts = lazy(() => import('@/redesign/alerts').then(module => ({ default: module.ProductionAlerts })));
const ProductionUtilityPage = lazy(() => import('@/redesign/utility-pages').then(module => ({ default: module.ProductionUtilityPage })));
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
function routedHash() {
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'popup' || mode === 'legacy') return location.hash;
  const next = canonicalHash(location.hash);
  if (next !== location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  return next;
}
function RoutedApp() {
  const [hash, setHash] = useState(routedHash);
  useEffect(() => {
    const onHash = () => setHash(routedHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const route = hash.slice(1).split('?')[0];
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'popup' || mode === 'legacy') return <Suspense fallback={<div role="status">Loading…</div>}><App /></Suspense>;
  return <Suspense fallback={<div role="status">Loading…</div>}><I18nProvider>{route === 'overview' ? <ProductionOverview /> : route === 'projects' ? <ProductionProjects /> : route === 'providers' ? <ProductionProviders /> : route === 'models' ? <ProductionModels /> : route === 'cost' ? <ProductionCost /> : route === 'alerts' ? <ProductionAlerts /> : route === 'live' ? <ProductionLive /> : <ProductionUtilityPage page={route === 'history' ? 'history' : 'settings'}/>}</I18nProvider></Suspense>;
}
// The fixture and preview UI are excluded from production builds by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') === 'redesign-preview') {
  void import('@/redesign/preview').then(({ default: Preview }) => {
    root.render(<StrictMode><Preview /></StrictMode>);
  });
} else {
  root.render(<StrictMode><RoutedApp /></StrictMode>);
}
