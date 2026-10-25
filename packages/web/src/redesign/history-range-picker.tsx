import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { UsageSelection } from '@/components/usage-range';
import { useI18n, useT } from '@/i18n';
import './history-range-picker.css';

/** Present existing range controls compactly; query resolution stays with History. */
export function HistoryRangePicker({ selection, scope, sources, disabled, children }: {
  selection: UsageSelection;
  scope: { from: number; to: number } | null;
  sources: Array<{ id: number; display_name: string }>;
  disabled: boolean;
  children: ReactNode;
}) {
  const t = useT(), { lang } = useI18n();
  const id = useId().replace(/:/g, '');
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const align = useCallback(() => {
    const picker = details.current, popover = panel.current;
    if (!picker || !popover) return;
    if (!picker.open) { popover.style.visibility = 'hidden'; return; }
    const anchor = picker.getBoundingClientRect(), width = popover.getBoundingClientRect().width;
    const left = Math.max(8, Math.min(innerWidth - width - 8, anchor.right - width));
    popover.style.left = `${left - anchor.left}px`;
    popover.style.right = 'auto';
    popover.style.visibility = 'visible';
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (details.current?.open && !details.current.contains(event.target as Node)) details.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', align);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', align); };
  }, [align]);
  useEffect(() => { if (disabled && details.current) details.current.open = false; }, [disabled]);
  const from = selection.range === 'custom' ? selection.from : scope?.from;
  const to = selection.range === 'custom' ? selection.to : scope?.to;
  const preset = { today: 'usage.today', week: 'usage.thisWeek', month: 'usage.thisMonth', last30: 'redesign.last30', all: 'usage.allTime', custom: 'usage.custom' } as const;
  const date = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  let label = t(preset[selection.range]);
  if (selection.range !== 'all' && from !== undefined && to !== undefined && to > from) {
    const start = date.format(from), end = date.format(to - 1);
    label = start === end ? start : `${start} – ${end}`;
  }
  const source = selection.sourceId === undefined ? null : sources.find(item => item.id === selection.sourceId)?.display_name ?? `#${selection.sourceId}`;
  useLayoutEffect(align, [align, open, label, source]);
  return <div className="qp-history-range-picker-wrap">
    <details ref={details} className="qp-history-range-picker" onToggle={event => { setOpen(event.currentTarget.open); align(); }} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false;
    }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; summary.current?.focus(); }
    }}>
      <summary ref={summary} aria-label={`${t('usage.rangeLabel')}: ${label}`} title={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-range`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={event => { if (disabled) event.preventDefault(); }}>
        <CalendarDays size={16} aria-hidden="true"/><span className="qp-history-range-label">{label}</span><ChevronDown size={13} aria-hidden="true"/>
      </summary>
      <div ref={panel} id={`${id}-range`} className="qp-history-range-popover" role="dialog" aria-label={t('usage.rangeLabel')}>{children}</div>
    </details>
    {source && <span className="qp-history-range-source" title={`${t('analysis.source')}: ${source}`}>{t('analysis.source')}: {source}</span>}
  </div>;
}
