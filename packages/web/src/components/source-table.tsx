import type { PricingScope, SourceTotals } from '@/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';
import { ValueDisplay } from '@/components/value-display';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';

/**
 * The per-harness usage table, shared by three sections.
 *
 * It lived in `sections/live.tsx` and the other two sections imported it from there, which
 * quietly made a section file into a shared module -- and meant a change to Live could break
 * Usage or Cost with nothing in either file to show for it. It is a component, so it lives
 * with the other components.
 *
 * Mounted three times against three different windows: today's rows on Live, the selected
 * period in Usage, and all-time in Cost. That is deliberate. The redundancy is in what a
 * reader is shown, not in the markup.
 */
export function SourceTable({ rows, empty, scope }: { rows: SourceTotals[]; empty: string; scope?: PricingScope }) {
  const t = useT();
  const f = useFormat();
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('col.harness')}</TableHead>
          <TableHead className="text-right">{t('col.calls')}</TableHead>
          <TableHead className="text-right">{t('col.freshIn')}</TableHead>
          <TableHead className="text-right">{t('col.cacheRead')}</TableHead>
          <TableHead className="text-right">{t('col.output')}</TableHead>
          <TableHead className="text-right">{t('col.total')}</TableHead>
          <TableHead className="text-right">{t('col.value')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.source_id}>
            <TableCell>
              <span className="inline-flex items-center gap-2">
                <HarnessIcon
                  harness={r.harness}
                  vendor={r.vendor}
                  label={r.display_name}
                  className="text-muted-foreground text-[15px]"
                />
                {r.display_name}
              </span>
            </TableCell>
            <TableCell className="tabular text-right font-mono">{r.calls.toLocaleString()}</TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.input_tokens)}
            </TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.cached_input_tokens)}
            </TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.output_tokens)}
            </TableCell>
            <TableCell className="tabular text-right font-mono">{f.tokens(r.total_tokens)}</TableCell>
            <TableCell className="tabular text-right font-mono">
              <ValueDisplay total={r} scope={scope ? { ...scope, sourceId: r.source_id } : undefined} label={r.display_name} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
