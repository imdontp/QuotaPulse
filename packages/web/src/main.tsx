import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@/i18n';
import { canonicalHash } from '@/redesign/routes';
import { RouteLoadBoundary, RouteLoadingShell } from '@/redesign/route-loading';
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
 * browser loads only the declared character ranges it needs. Thai uses the
 * bundled Noto Sans Thai face rather than a machine's system font.
 */
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@/thai-font.css';
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
  const page = route === 'overview' || route === 'projects' || route === 'providers' || route === 'models' || route === 'cost' || route === 'alerts' || route === 'live' || route === 'history' ? route : 'settings';
  return <I18nProvider><RouteLoadBoundary key={page} page={page}><Suspense fallback={<RouteLoadingShell page={page}/>}>{page === 'overview' ? <ProductionOverview /> : page === 'projects' ? <ProductionProjects /> : page === 'providers' ? <ProductionProviders /> : page === 'models' ? <ProductionModels /> : page === 'cost' ? <ProductionCost /> : page === 'alerts' ? <ProductionAlerts /> : page === 'live' ? <ProductionLive /> : <ProductionUtilityPage page={page}/>}</Suspense></RouteLoadBoundary></I18nProvider>;
}
// The fixture and preview UI are excluded from production builds by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') === 'redesign-preview') {
  void import('@/redesign/preview').then(({ default: Preview }) => {
    root.render(<StrictMode><Preview /></StrictMode>);
  });
} else {
  root.render(<StrictMode><RoutedApp /></StrictMode>);
}
