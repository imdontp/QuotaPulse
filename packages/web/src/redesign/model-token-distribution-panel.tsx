import { useId, useRef } from 'react';
import { useT, useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { modelTokenDistribution, type ModelTokenFacts } from './model-token-distribution';
import './model-token-distribution.css';
import { useModelRingMotion } from './use-model-ring-motion';
import type { ModelSelectionIntent } from './model-selection-motion';

/** Reference composition with the complete recorded breakdown still available. */
export function ModelTokenDistribution({ facts, contextKey, pairKey, intent }: { facts: ModelTokenFacts; contextKey: string; pairKey: string; intent: ModelSelectionIntent | null }) {
  const t = useT(), f = useFormat(), { lang } = useI18n();
  const id = useId().replace(/:/g, '');
  const value = modelTokenDistribution(facts);
  const ring = useRef<HTMLDivElement>(null);
  useModelRingMotion(ring, { value, contextKey, pairKey, intent });
  const exact = (count: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 8 }).format(count);
  const label = (key: 'input' | 'output') => t(key === 'input' ? 'redesign.modelsInputTokens' : 'redesign.modelsOutputTokens');
  return <section className="qp-panel qp-model-distribution" aria-label={value.valid ? `${t('redesign.modelsDistribution')}. ${t('redesign.modelsRecordedTotal')}: ${exact(value.recordedTotal)}. ${t('redesign.modelsComponentTotal')}: ${exact(value.total)}.` : t('redesign.modelsDistribution')} data-ring="input-output" data-component-total={value.valid ? value.total : undefined} data-recorded-total={value.valid ? value.recordedTotal : undefined} data-reconciles={value.reconciles}>
    <h2>{t('redesign.modelsDistribution')}</h2>
    {!value.valid ? <p>{t('redesign.modelsComponentsUnavailable')}</p> : <>
      <div ref={ring} className="qp-model-donut" aria-hidden="true">
        <svg viewBox="0 0 124 124" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-input`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#04ceff"/><stop offset="1" stopColor="#0965ff"/></linearGradient>
            <linearGradient id={`${id}-output`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a44cff"/><stop offset="1" stopColor="#6426e4"/></linearGradient>
          </defs>
          <circle className="qp-model-ring-rim" cx="62" cy="62" r="60" fill="none" strokeWidth=".8"/>
          <circle className="qp-model-ring-track" cx="62" cy="62" r="54" fill="none" strokeWidth="10"/>
          {value.parts.map(part => <g key={part.key}><circle data-ring-sector={part.key} data-token-sector={part.paintedSweep > 0 ? part.key : undefined} data-value={part.value} data-share={part.share!} data-sweep={part.sweep}
            cx="62" cy="62" r="54" fill="none" stroke={`url(#${id}-${part.key})`} strokeWidth="10" strokeLinecap="butt" pathLength="360"
            strokeDasharray={`${part.paintedSweep} ${360 - part.paintedSweep}`} strokeDashoffset={-(part.start + value.gap / 2)} transform="rotate(-90 62 62)"/>
            <circle data-ring-highlight={part.key} cx="62" cy="62" r="58.4" fill="none" stroke={part.key === 'input' ? '#b2f5ff' : '#d9b0ff'} strokeWidth=".7" opacity=".7" pathLength="360"
              strokeDasharray={`${part.paintedSweep} ${360 - part.paintedSweep}`} strokeDashoffset={-(part.start + value.gap / 2)} transform="rotate(-90 62 62)"/>
          </g>) }
          <circle className="qp-model-ring-inner" cx="62" cy="62" r="47" fill="none" strokeWidth=".7"/>
        </svg>
        <span className="qp-model-ring-center"><b>{value.available ? f.tokens(value.total) : '—'}</b><small>{t(!value.available ? 'redesign.modelsComponentsUnavailable' : value.reconciles ? 'redesign.modelsTokenTotal' : 'redesign.modelsComponentTotal')}</small></span>
      </div>
      <ul className="qp-model-distribution-legend">{value.parts.map(part => <li key={part.key} data-token-part={part.key} data-value={part.value}>
        <i data-part={part.key} aria-hidden="true"/><span>{label(part.key)}</span>
        <span className="qp-model-component-share" title={t('redesign.modelsComponentShare')}>{part.share === null ? '—' : f.pct(part.share)}</span>
        <strong title={exact(part.value)} aria-label={`${label(part.key)}: ${value.available ? exact(part.value) : t('redesign.unknownValue')}`}>{value.available ? f.tokens(part.value) : '—'}</strong>
      </li>)}</ul>
      <details className="qp-model-input-breakdown">
        <summary>{t('redesign.modelsInputBreakdown')}</summary>
        <p>{t('redesign.liveFlowBreakdown')}</p>
        <dl>{(['inputTokens', 'cachedInputTokens', 'cacheWriteTokens'] as const).map((key, index) => <div key={key} data-component={key}><dt>{t((['redesign.modelsFreshInput', 'redesign.modelsCachedInput', 'redesign.modelsCacheWrite'] as const)[index])}</dt><dd title={exact(facts[key])}>{exact(facts[key])}</dd></div>)}</dl>
        {!value.reconciles && <p data-testid="model-component-mismatch">{t('redesign.modelsRecordedTotal')}: {exact(value.recordedTotal)} · {t('redesign.modelsComponentTotal')}: {exact(value.total)}</p>}
      </details>
    </>}
  </section>;
}
