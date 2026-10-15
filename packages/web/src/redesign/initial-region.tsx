import type { ReactNode } from 'react';
import './initial-region.css';

export interface InitialRegionState {
  kind: 'loading' | 'error' | 'paused';
  label: string;
  detail?: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}

/** Reserved dashboard space without invented records, chart points or quota values. */
export function InitialRegion({ id, label, state, className = '', heading, status = false, slots = 3 }: {
  id: string;
  label: string;
  state: InitialRegionState;
  className?: string;
  heading?: ReactNode;
  status?: boolean;
  slots?: number;
}) {
  const visibleSlots = status ? Math.max(1, slots - 2) : slots;
  return <section className={`qp-panel qp-initial-region ${className}`} aria-label={label}
    aria-busy={state.kind === 'loading'} data-initial-region={id} data-initial-state={state.kind}>
    {heading ?? <h2>{label}</h2>}
    {status && <div className="qp-initial-region-status"><p role="status">{state.label}</p>
      {state.kind === 'error' && <button onClick={state.onRetry} disabled={state.retrying}>{state.retryLabel}</button>}
    </div>}
    <div className="qp-initial-region-slots" aria-hidden="true">
      {Array.from({ length: visibleSlots }, (_, index) => <span key={index}/>)}
    </div>
  </section>;
}
