import { useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import type { ScopeSelection } from './scope';

export function ScopeNotice({ scope }: { scope: ScopeSelection }) {
  const t = useT();
  const f = useFormat();
  if (scope.range !== 'custom' && !scope.sourceId) return null;
  return <p className="qp-footnote" data-testid="scope-notice">{[
    scope.range === 'custom' ? `${t('usage.custom')}: ${f.day(scope.from!)} – ${f.day(scope.to!)}` : null,
    scope.sourceId ? `${t('analysis.source')} #${scope.sourceId}` : null,
  ].filter(Boolean).join(' · ')}</p>;
}
