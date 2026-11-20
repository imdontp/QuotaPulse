/** Chromium can report visible while Windows has minimized the Electron dashboard. */
export function dashboardHidden(): boolean {
  return typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden'
    || document.documentElement?.hasAttribute('data-qp-native-hidden') === true);
}

export function onDashboardVisibilityChange(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  let hidden = dashboardHidden();
  const update = () => {
    const next = dashboardHidden();
    if (next === hidden) return;
    hidden = next;
    listener();
  };
  document.addEventListener('visibilitychange', update);
  document.addEventListener('qp-dashboard-visibility', update);
  return () => {
    document.removeEventListener('visibilitychange', update);
    document.removeEventListener('qp-dashboard-visibility', update);
  };
}
