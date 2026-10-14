import { readScope, writeScope } from './scope';

/** The Overview rail aggregates by exact model, independently of the runtime map project. */
export function modelDrilldownHref(historyHref: string, model: string | null): string {
  const previous = new URLSearchParams(historyHref.split('?')[1] ?? '');
  const next = writeScope(new URLSearchParams(), readScope(previous, 'today'));
  // Only supported Models scope filters survive; never infer a route from its maker.
  const provider = previous.get('provider');
  const vendor = previous.get('vendor');
  if (provider) {
    next.set('provider', provider);
    next.set('selected_provider', provider);
  }
  if (vendor) next.set('vendor', vendor);
  if (model === null) next.set('model_missing', '1');
  else next.set('model', model);
  return `#models?${next}`;
}
