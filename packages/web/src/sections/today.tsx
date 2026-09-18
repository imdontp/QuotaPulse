import { useMemo, useState } from 'react';
import { api, type ModelRow, type TodayUsage } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { sumTodayRows } from '@/lib/today';
import { useLiveRefresh } from '@/lib/use-live';

function filterValues(rows: ModelRow[], field: 'harness' | 'model'): string[] {
  return [...new Set(rows.map((row) => row[field]))].sort((a, b) => a.localeCompare(b));
}

export function TodaySection() {
  const t = useT();
  const f = useFormat();
  const [data, setData] = useState<TodayUsage | null>(null);
  const [harness, setHarness] = useState('all');
  const [model, setModel] = useState('all');
  const [err, setErr] = useState<string | null>(null);

  useLiveRefresh(() => api.today().then((next) => {
    setData(next);
    setErr(null);
  }).catch((error) => {
    setErr(String(error));
    throw error;
  }), []);

  const harnesses = useMemo(() => filterValues(data?.rows ?? [], 'harness'), [data]);
  const models = useMemo(() => filterValues(data?.rows ?? [], 'model'), [data]);
  const rows = useMemo(
    () => (data?.rows ?? []).filter((row) =>
      (harness === 'all' || row.harness === harness) && (model === 'all' || row.model === model)),
    [data, harness, model],
  );
  const totals = useMemo(() => sumTodayRows(rows), [rows]);

  if (err && !data) return <ErrorBox>{err}</ErrorBox>;
  if (!data) return <Empty>{t('app.loading')}</Empty>;

  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{t('today.title')}</h2>
            <p className="text-muted-foreground note mt-1 text-[12.5px] leading-relaxed">{t('today.blurb')}</p>
          </div>
          <div className="text-muted-foreground text-xs">{t('today.window', { time: f.clock(data.from) })}</div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardHeader><CardTitle>{t('today.totalTokens')}</CardTitle></CardHeader><CardContent><p className="tabular text-2xl font-semibold font-mono">{f.tokens(totals.total_tokens)}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>{t('today.calls')}</CardTitle></CardHeader><CardContent><p className="tabular text-2xl font-semibold font-mono">{totals.calls.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>{t('col.freshIn')}</CardTitle></CardHeader><CardContent><p className="tabular text-2xl font-semibold font-mono">{f.tokens(totals.input_tokens)}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>{t('col.output')}</CardTitle></CardHeader><CardContent><p className="tabular text-2xl font-semibold font-mono">{f.tokens(totals.output_tokens)}</p></CardContent></Card>
        </div>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('today.breakdown')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Select label={t('today.harness')} value={harness} onChange={(event) => setHarness(event.target.value)}>
                  <option value="all">{t('today.all')}</option>
                  {harnesses.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
                <Select label={t('today.model')} value={model} onChange={(event) => setModel(event.target.value)}>
                  <option value="all">{t('today.all')}</option>
                  {models.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </div>
            </div>
            <CardDescription>{t('today.breakdownBlurb')}</CardDescription>
          </CardHeader>
          {rows.length === 0 ? <Empty>{t('today.none')}</Empty> : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead>{t('col.harness')}</TableHead>
                <TableHead>{t('col.model')}</TableHead>
                <TableHead>{t('col.effort')}</TableHead>
                <TableHead className="text-right">{t('col.calls')}</TableHead>
                <TableHead className="text-right">{t('col.freshIn')}</TableHead>
                <TableHead className="text-right">{t('col.cacheRead')}</TableHead>
                <TableHead className="text-right">{t('col.cacheWrite')}</TableHead>
                <TableHead className="text-right">{t('col.output')}</TableHead>
                <TableHead className="text-right">{t('col.reasoning')}</TableHead>
                <TableHead className="text-right">{t('col.total')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>{rows.map((row, index) => <TableRow key={`${row.harness}/${row.model}/${row.effort}/${index}`}>
                <TableCell className="font-medium">{row.harness}</TableCell>
                <TableCell className="font-mono">{row.model}</TableCell>
                <TableCell className="text-muted-foreground">{row.effort || '--'}</TableCell>
                <TableCell className="tabular text-right font-mono">{row.calls.toLocaleString()}</TableCell>
                <TableCell className="tabular text-right font-mono">{f.tokens(row.input_tokens)}</TableCell>
                <TableCell className="tabular text-right font-mono">{f.tokens(row.cached_input_tokens)}</TableCell>
                <TableCell className="tabular text-right font-mono">{f.tokens(row.cache_write_tokens)}</TableCell>
                <TableCell className="tabular text-right font-mono">{f.tokens(row.output_tokens)}</TableCell>
                <TableCell className="tabular text-right font-mono">{row.reasoning_tokens > 0 ? f.tokens(row.reasoning_tokens) : '--'}</TableCell>
                <TableCell className="tabular text-right font-mono font-semibold">{f.tokens(row.total_tokens)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          )}
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
