import { useState } from 'react';
import { useI18n, useT } from '@/i18n';
import { effortPage, effortPageSelection } from './effort-page';

export function useEffortPage<T>(rows: readonly T[] | undefined, scopeKey: string) {
  const [selection, setSelection] = useState({ scopeKey, page: 0 });
  const current = effortPageSelection(selection, scopeKey, rows?.length);
  // Update only when the accepted scope changes or a shrinking list invalidates its page.
  // Ordinary refreshes retain the current page, including after a prior clamp.
  if (current !== selection) setSelection(current);
  return { ...effortPage(rows ?? [], current.page), setPage: (page: number) => setSelection({ scopeKey, page }) };
}

export function EffortPagination({ page, from, to, total, hasPrevious, hasNext, setPage }: ReturnType<typeof useEffortPage>) {
  const t = useT();
  const { lang } = useI18n();
  if (!hasPrevious && !hasNext) return null;
  const count = (value: number) => value.toLocaleString(lang);
  return <nav aria-label={t('redesign.effortPages')} data-testid="effort-pagination" style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
    <small role="status" aria-live="polite">{t('redesign.effortRange', { from: count(from), to: count(to), total: count(total) })}</small>
    <button type="button" disabled={!hasPrevious} onClick={() => setPage(page - 1)}>{t('history.previous')}</button>
    <button type="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>{t('history.next')}</button>
  </nav>;
}
