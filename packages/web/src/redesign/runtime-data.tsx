import { useState } from 'react';
import { dimensions, type Dimension, type RuntimeGraph } from './model';
import type { RedesignTranslate } from './shell';
import './chart-data.css';

/** Complete graph facts. Each adjacent dimension pair represents the same scope. */
export function RuntimeData({ nodes, edges, language, t, onInspect }: {
  nodes: RuntimeGraph['nodes']; edges: RuntimeGraph['edges']; language: 'en' | 'th';
  t: RedesignTranslate; onInspect: (dimension: Dimension, key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const number = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US');
  const name = (dimension: Dimension, key: string | null) => key === null
    ? t(dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue')
    : key === '' ? t('redesign.emptyIdentity') : key;
  const count = dimensions.reduce((sum, dimension) => sum + nodes[dimension].length, 0);
  return <details className="qp-chart-data qp-runtime-data" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t('redesign.chartData')}</summary>
    {open && <div>
      <p className="qp-footnote">{t('redesign.runtimeDataNote')}</p>
      <table className="qp-runtime-nodes"><caption>{t('redesign.runtimeNodes')} ({number.format(count)})</caption><thead><tr>
        <th scope="col">{t('redesign.runtimeDimension')}</th><th scope="col">{t('redesign.runtimeName')}</th><th scope="col">{t('redesign.tokens')}</th><th scope="col">{t('redesign.records')}</th><th scope="col">{t('redesign.sessions')}</th>
      </tr></thead><tbody>{dimensions.flatMap(dimension => nodes[dimension].map(node => <tr key={JSON.stringify([dimension, node.key])} data-identity={JSON.stringify([dimension, node.key])} data-tokens={node.tokens} data-records={node.records} data-sessions={node.sessions}>
        <td>{t(`redesign.${dimension}`)}</td><td><button onClick={() => onInspect(dimension, node.key)}>{name(dimension, node.key)}</button></td><td>{number.format(node.tokens)}</td><td>{number.format(node.records)}</td><td>{number.format(node.sessions)}</td>
      </tr>))}</tbody></table>
      <table className="qp-runtime-edges"><caption>{t('redesign.runtimeEdges')} ({number.format(edges.length)})</caption><thead><tr>
        <th scope="col">{t('redesign.runtimeFrom')} · {t('redesign.runtimeDimension')}</th><th scope="col">{t('redesign.runtimeFrom')} · {t('redesign.runtimeName')}</th><th scope="col">{t('redesign.runtimeTo')} · {t('redesign.runtimeDimension')}</th><th scope="col">{t('redesign.runtimeTo')} · {t('redesign.runtimeName')}</th><th scope="col">{t('redesign.tokens')}</th>
      </tr></thead><tbody>{edges.map(edge => <tr key={JSON.stringify([edge.column, edge.from, edge.to])} data-identity={JSON.stringify([edge.column, edge.from, edge.to])} data-tokens={edge.tokens}>
        <td>{t(`redesign.${dimensions[edge.column]}`)}</td><td>{name(dimensions[edge.column], edge.from)}</td><td>{t(`redesign.${dimensions[edge.column + 1]}`)}</td><td>{name(dimensions[edge.column + 1], edge.to)}</td><td>{number.format(edge.tokens)}</td>
      </tr>)}</tbody></table>
    </div>}
  </details>;
}
