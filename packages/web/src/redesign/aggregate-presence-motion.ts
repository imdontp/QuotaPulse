import { LivePresenceLedger, type LiveRecordBatch } from './live-record-motion';

/** Bounded previous accepted response universe, not previous rank/page or lifetime history.
 * A new aggregate presence says nothing about ingestion time or individual calls.
 */
export class AggregatePresenceLedger extends LivePresenceLedger {
  acceptPage(batch: LiveRecordBatch, context: string, universe: readonly string[], page: readonly string[], initialVisible = false) {
    const newlyObserved = new Set(this.accept(batch, context, universe, initialVisible));
    return [...new Set(page)].filter(key => newlyObserved.has(key));
  }
}
