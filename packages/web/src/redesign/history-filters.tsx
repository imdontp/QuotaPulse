import { useRef } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/i18n';
import type { UsageEventScope, UsageGrain } from '@/lib/usage-events';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import './history-filters.css';

type Filters = Pick<UsageEventScope, 'q' | 'project' | 'projectMissing' | 'provider' | 'vendor' | 'model' | 'harness' | 'grain'>;
const primaryFields = ['q', 'project', 'harness', 'provider', 'model'] as const;

/** Keep exact metadata inputs; no incomplete option list or invented status filter. */
export function HistoryFilters({ draft, disabled, onChange, onApply, onClear }: {
  draft: Filters; disabled: boolean; onChange: (next: Filters) => void; onApply: () => void; onClear: () => void;
}) {
  const t = useT();
  const search = useRef<HTMLInputElement>(null);
  const apply = useRef<HTMLButtonElement>(null);
  const extra = useRef<HTMLDetailsElement>(null);
  const extraCount = Number(Boolean(draft.vendor)) + Number(Boolean(draft.projectMissing));
  const field = (name: typeof primaryFields[number] | 'vendor') => <label key={name} className={`qp-history-filter-field${name === 'q' ? ' qp-history-filter-search' : ''}`}>
    <span>{t(name === 'q' ? 'history.search' : `history.${name}`)}</span>
    {name === 'q' && <Search size={17} aria-hidden="true"/>}
    <input ref={name === 'q' ? search : undefined} type={name === 'q' ? 'search' : 'text'} placeholder={t(name === 'q' ? 'history.search' : `history.${name}`)} title={t(name === 'q' ? 'history.search' : `history.${name}`)} value={draft[name] ?? ''} disabled={name === 'project' && draft.projectMissing} onChange={event => onChange({ ...draft, [name]: event.target.value || undefined })} maxLength={name === 'q' ? 256 : 4096}/>
  </label>;
  return <form className="qp-history-filter-form" onSubmit={event => { event.preventDefault(); if (extra.current?.contains(document.activeElement)) apply.current?.focus(); extra.current?.removeAttribute('open'); onApply(); }}>
    <fieldset disabled={disabled} aria-label={t('history.filters')}>
      {primaryFields.map(field)}
      <Select label={t('history.kind')} value={draft.grain ?? 'all'} onChange={event => onChange({ ...draft, grain: event.target.value as UsageGrain })}>{(['all', 'call', 'session_aggregate', 'unknown'] as const).map(grain => <option key={grain} value={grain}>{t(`history.${grain}`)}</option>)}</Select>
      <details ref={extra} className="qp-history-extra-filters" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
      }}>
        <summary title={t('history.moreFilters')} aria-label={`${t('history.moreFilters')}${extraCount ? ` (${extraCount})` : ''}`} data-active={extraCount > 0} onClick={event => { if (disabled) event.preventDefault(); }} tabIndex={disabled ? -1 : 0} aria-disabled={disabled}>
          <SlidersHorizontal size={17} aria-hidden="true"/>{extraCount > 0 && <b aria-hidden="true">{extraCount}</b>}
        </summary>
        <div className="qp-history-extra-fields">
          {field('vendor')}
          <label className="qp-history-filter-missing"><input type="checkbox" checked={draft.projectMissing ?? false} onChange={event => onChange({ ...draft, projectMissing: event.target.checked })}/>{t('history.missing')}</label>
        </div>
      </details>
      <Button ref={apply} className="qp-history-filter-apply" type="submit" aria-label={t('history.apply')} title={t('history.apply')}><Search size={17} aria-hidden="true"/></Button>
      <Button type="button" className="qp-history-filter-clear" onClick={() => { extra.current?.removeAttribute('open'); onClear(); search.current?.focus(); }}>{t('history.clearFilters')}</Button>
    </fieldset>
  </form>;
}
