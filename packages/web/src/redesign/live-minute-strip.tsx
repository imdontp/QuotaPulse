import { useId, useMemo, type CSSProperties } from 'react';
import type { ProviderModelMinuteResponse } from '@/api';
import { VendorIcon } from '@/components/vendor-icon';
import type { MessageKey } from '@/i18n/en';
import { liveMinutePairs, type LiveMinuteCell } from './live-minute-data';

type Translate = (key: MessageKey) => string;
interface Props {
  data: ProviderModelMinuteResponse;
  language: 'en' | 'th';
  t: Translate;
  frozen: boolean;
  provider: string | null;
  model: string | null;
  onSelect(provider: string, model: string): void;
  onClear(): void;
}

export function LiveMinuteMatrix({ data, language, t, frozen, provider, model, onSelect, onClear }: Props) {
  const pairs = useMemo(() => liveMinutePairs(data), [data]);
  const legendId = useId();
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const formatter = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' });
  const number = (value: number) => formatter.format(value);
  const name = (value: string | null) => value === null ? t('redesign.unknownValue') : value === '' ? t('redesign.emptyIdentity') : value;
  const state = (cell: LiveMinuteCell) => t(cell.state === 'missing' ? 'redesign.liveMinuteMissing' : cell.state === 'zero' ? 'redesign.liveMinuteZero' : 'redesign.liveMinuteRecorded');
  const describe = (cell: LiveMinuteCell) => `${date.format(cell.start)} – ${date.format(cell.end)} · ${state(cell)}${cell.tokens === null ? '' : ` · ${number(cell.tokens)} ${t('redesign.tokens')} · ${number(cell.records!)} ${t('redesign.records')} · ${number(cell.calls!)} ${t('redesign.modelsCalls')}`}${cell.partial ? ` · ${t('redesign.liveMinutePartial')}` : ''}`;
  const buckets = pairs[0]?.cells ?? [];
  const aggregate = data.groups.reduce((sum, group) => sum + group.aggregateRecords, 0);
  const unknown = data.groups.reduce((sum, group) => sum + group.unknownRecords, 0);

  return <>
    {(provider || model) && <button disabled={frozen} className="qp-live-clear" onClick={onClear}>{t('redesign.liveClearMatrix')}</button>}
    {pairs.length === 0 ? <p>{t('redesign.liveMinuteEmpty')}</p> : <>
      <div className="qp-live-minute-range"><span>{clock.format(buckets[0]!.start)}</span><span>{clock.format(buckets[buckets.length - 1]!.start)} · {t('redesign.liveMinuteCurrent')}</span></div>
      <ol className="qp-live-matrix" tabIndex={0} aria-label={t('redesign.liveMatrix')}>{pairs.map(group => {
        const content = <>
          <span className="qp-live-matrix-label" title={`${name(group.provider)} · ${name(group.model)}`}><span className="qp-live-provider-mark" aria-hidden="true"><VendorIcon vendor={group.provider ?? 'unknown'}/></span><span><b>{name(group.model)}</b><small>{name(group.provider)}</small></span></span>
          <span className="qp-live-minute-strip" role="img" aria-label={`${name(group.provider)} · ${name(group.model)} · ${number(group.callRecords)} ${t('redesign.liveMinuteIncluded')}`} aria-describedby={legendId}>
            {group.cells.map(cell => <i key={cell.at} data-at={cell.at} data-state={cell.state} data-tokens={cell.tokens ?? undefined} data-records={cell.records ?? undefined} data-calls={cell.calls ?? undefined} data-partial={cell.partial || undefined} title={describe(cell)} aria-hidden="true" style={{ '--qp-minute-intensity': cell.intensity } as CSSProperties}/>)}
          </span>
          <strong className="qp-live-matrix-total" title={`${t('redesign.liveMinuteWindowAll')} · ${t('redesign.liveMinuteExcluded')}: ${number(group.aggregateRecords)} ${t('redesign.liveAggregate')} · ${number(group.unknownRecords)} ${t('redesign.liveUnknownGrain')}`}><span data-value={group.tokens} aria-label={String(group.tokens)} title={number(group.tokens)}>{compact.format(group.tokens)}</span><small>{t('redesign.liveMinuteWindow')}</small></strong>
        </>;
        return <li className="qp-live-matrix-row" key={group.key} data-pair-key={group.key} data-call-records={group.callRecords} data-aggregate-records={group.aggregateRecords} data-unknown-records={group.unknownRecords}>
          {group.provider !== null && group.provider !== '' && group.model !== null && group.model !== ''
            ? <button className="qp-live-matrix-row-body" disabled={frozen} aria-pressed={provider === group.provider && model === group.model} onClick={() => onSelect(group.provider!, group.model!)}>{content}</button>
            : <div className="qp-live-matrix-row-body">{content}</div>}
        </li>;
      })}</ol>
      <p className="qp-live-minute-legend" id={legendId}><span data-state="missing"><i aria-hidden="true"/>{t('redesign.liveMinuteMissing')}</span><span data-state="zero"><i aria-hidden="true"/>{t('redesign.liveMinuteZero')}</span><span data-state="recorded"><i aria-hidden="true"/>{t('redesign.liveMinuteRecorded')}</span></p>
      <details className="qp-live-minute-data"><summary>{t('redesign.liveMinuteData')}</summary><div className="qp-live-minute-data-table" role="region" tabIndex={0} aria-label={t('redesign.liveMinuteData')}><table><caption>{t('redesign.liveMinuteData')}</caption><thead><tr><th scope="col">{t('redesign.provider')}</th><th scope="col">{t('redesign.model')}</th><th scope="col">{t('redesign.liveMinuteInterval')}</th><th scope="col">{t('redesign.tokens')}</th><th scope="col">{t('redesign.records')}</th><th scope="col">{t('redesign.modelsCalls')}</th></tr></thead><tbody>{pairs.flatMap(group => group.cells.map(cell => <tr key={JSON.stringify([group.key, cell.at])} data-pair-key={group.key} data-at={cell.at} data-state={cell.state}><td>{name(group.provider)}</td><td>{name(group.model)}</td><td>{date.format(cell.start)} – {date.format(cell.end)}{cell.partial && <small>{t('redesign.liveMinutePartial')}</small>}</td><td>{cell.tokens === null ? '—' : number(cell.tokens)}<small>{state(cell)}</small></td><td>{cell.records === null ? '—' : number(cell.records)}</td><td>{cell.calls === null ? '—' : number(cell.calls)}</td></tr>))}</tbody></table></div></details>
    </>}
    <div className="qp-live-matrix-coverage"><span data-coverage="included" data-count={data.coverage.includedRecords}>{t('redesign.liveMinuteIncluded')}: {number(data.coverage.includedRecords)}</span><span data-coverage="aggregate" data-count={aggregate}>{t('redesign.liveAggregate')}: {number(aggregate)}</span><span data-coverage="unknown" data-count={unknown}>{t('redesign.liveUnknownGrain')}: {number(unknown)}</span></div>
  </>;
}
