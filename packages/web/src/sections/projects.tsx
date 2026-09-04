import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { api, type ProjectRow } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { Legend, StackedBars, type BarMetric, type Row } from '@/components/stacked-bars';
import { VendorIcon } from '@/components/vendor-icon';
import { OTHER_LABEL, palette, vendorColor, vendorLabel } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

const DAY = 86_400_000;

/** Turns a key -> vendor lookup into the icon renderer the bars ask for. */
const markOf = (vendors: Map<string, string>) => (key: string) => {
  const vendor = vendors.get(key) ?? 'unknown';
  return <VendorIcon vendor={vendor} label={vendorLabel(vendor)} />;
};

/** Sums one metric over a set of rows, keyed by whichever dimension is being cut. */
function fold(rows: ProjectRow[], keyOf: (r: ProjectRow) => string, metric: BarMetric) {
  const out = new Map<string, number>();
  for (const r of rows) {
    const v = Number(r[metric] ?? 0);
    if (v <= 0) continue;
    const k = keyOf(r);
    out.set(k, (out.get(k) ?? 0) + v);
  }
  return out;
}

/**
 * A cut of one project: one bar per group, segments left uncoloured by rank so that a
 * given harness or vendor keeps its colour across all three cuts on the page.
 */
function Cut({
  title,
  rows,
  keyOf,
  labelOf,
  metric,
  iconOf,
  colorOfKey,
}: {
  title: string;
  rows: ProjectRow[];
  keyOf: (r: ProjectRow) => string;
  labelOf: (key: string) => string;
  metric: BarMetric;
  /** The mark for a bar, when the thing being counted has a brand. */
  iconOf?: (key: string) => React.ReactNode;
  /** Overrides the rank palette where the key names a vendor and so owns a colour. */
  colorOfKey?: (key: string) => string;
}) {
  const f = useFormat();
  const t = useT();

  const { bars, legend } = useMemo(() => {
    const totals = fold(rows, keyOf, metric);
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const { colorOf: rankColor, keep, hasOther } = palette(ranked);
    const bucket = (k: string) => (keep.has(k) ? k : OTHER_LABEL);
    const colorOf = (k: string) =>
      k !== OTHER_LABEL && colorOfKey ? colorOfKey(k) : rankColor(k);

    // Unpriced calls are tracked per bar so a money total can say "unknown" rather than
    // claiming the row is free.
    const agg = new Map<string, { value: number; calls: number; unknown: number }>();
    for (const r of rows) {
      const v = Number(r[metric] ?? 0);
      if (v <= 0) continue;
      const k = bucket(keyOf(r));
      const cur = agg.get(k) ?? { value: 0, calls: 0, unknown: 0 };
      cur.value += v;
      cur.calls += r.calls;
      cur.unknown += r.cost_unknown_calls;
      agg.set(k, cur);
    }

    const bars: Row[] = [...agg.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([key, v]) => ({
        key,
        label: key === OTHER_LABEL ? OTHER_LABEL : labelOf(key),
        total: v.value,
        segments: [
          {
            key,
            value: v.value,
            color: colorOf(key),
            label: key === OTHER_LABEL ? OTHER_LABEL : labelOf(key),
          },
        ],
        ...(iconOf && key !== OTHER_LABEL ? { icon: iconOf(key) } : {}),
        ...(metric === 'cost_usd'
          ? { display: f.moneyTotal(v.value, v.unknown, v.calls) }
          : {}),
      }));

    const legend = ranked
      .filter((k) => keep.has(k))
      .map((k) => ({
        label: labelOf(k),
        color: colorOf(k),
        ...(iconOf ? { icon: iconOf(k) } : {}),
      }));
    if (hasOther) legend.push({ label: OTHER_LABEL, color: colorOf(OTHER_LABEL) });

    return { bars, legend };
  }, [rows, keyOf, labelOf, metric, f, iconOf, colorOfKey]);

  return (
    <div>
      <div className="text-muted-foreground mb-2.5 text-[11.5px] font-medium">{title}</div>
      <StackedBars rows={bars} metric={metric} empty={t('projects.none')} />
      {legend.length > 1 && <Legend items={legend} />}
    </div>
  );
}

export function ProjectsSection() {
  const t = useT();
  const f = useFormat();
  const [metric, setMetric] = useState<BarMetric>('total_tokens');
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useLiveRefresh(() => {
    const to = Date.now();
    // 0 days means everything: the first event predates any range we offer.
    const from = days === 0 ? 0 : to - days * DAY;
    api
      .projects({ from, to })
      .then((r) => {
        setRows(r.rows);
        setErr(null);
        setLoaded(true);
      })
      .catch((e) => {
        setErr(String(e));
        setLoaded(true);
      });
  }, [days]);

  /**
   * Level one: one bar per project, already segmented by harness. The question "which
   * project, and on what" is answered before anything is clicked; the drill-down is for
   * the cuts a single bar cannot carry.
   */
  const { projectBars, harnessLegend } = useMemo(() => {
    const harnessTotals = fold(rows, (r) => r.display_name, metric);
    const rankedHarness = [...harnessTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const { colorOf } = palette(rankedHarness);

    const byProject = new Map<
      string,
      { segments: Map<string, number>; calls: number; unknown: number }
    >();
    for (const r of rows) {
      const v = Number(r[metric] ?? 0);
      if (v <= 0) continue;
      const cur = byProject.get(r.project) ?? { segments: new Map(), calls: 0, unknown: 0 };
      cur.segments.set(r.display_name, (cur.segments.get(r.display_name) ?? 0) + v);
      cur.calls += r.calls;
      cur.unknown += r.cost_unknown_calls;
      byProject.set(r.project, cur);
    }

    const projectBars: Row[] = [...byProject.entries()]
      .map(([project, v]) => {
        const segments = [...v.segments.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([harness, value]) => ({
            key: harness,
            value,
            color: colorOf(harness),
            label: harness,
          }));
        const total = segments.reduce((a, s) => a + s.value, 0);
        return {
          key: project,
          label: project,
          total,
          segments,
          ...(metric === 'cost_usd' ? { display: f.moneyTotal(total, v.unknown, v.calls) } : {}),
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      projectBars,
      harnessLegend: rankedHarness.map((h) => ({ label: h, color: colorOf(h) })),
    };
  }, [rows, metric, f]);

  const detail = useMemo(() => rows.filter((r) => r.project === selected), [rows, selected]);

  /*
   * Two different questions, so two maps. A model's mark is its MAKER; a harness row's
   * mark is whose tool it is. A Claude Code session running Qwen is Anthropic on the
   * harness cut and Qwen on the model cut, and both are right.
   *
   * Both derived server-side and carried on the row, so the client never re-implements
   * the rules -- the daemon owns them and a test pins its two copies together.
   */
  const modelVendors = useMemo(
    () => new Map(detail.map((r) => [r.model, r.vendor || 'unknown'])),
    [detail],
  );
  const harnessVendors = useMemo(
    () => new Map(detail.map((r) => [r.display_name, r.harness_vendor || 'unknown'])),
    [detail],
  );

  /*
   * The project list can run to a screenful, so a selection made at the top would open a
   * panel the reader never sees. Bring it into view rather than leaving them to guess
   * that clicking did anything.
   */
  const detailRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!selected) return;
    detailRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [selected, reduced]);

  /** Level three: the pair the request was actually about -- harness together with model. */
  const pairs = useMemo(() => {
    const out = new Map<string, ProjectRow & { key: string }>();
    for (const r of detail) {
      const key = `${r.source_id}|${r.model}`;
      const cur = out.get(key);
      if (!cur) {
        out.set(key, { ...r, key });
        continue;
      }
      cur.calls += r.calls;
      cur.total_tokens += r.total_tokens;
      cur.cost_usd += r.cost_usd;
      cur.cost_unknown_calls += r.cost_unknown_calls;
      cur.last_ts = Math.max(cur.last_ts, r.last_ts);
    }
    return [...out.values()].sort((a, b) => b.total_tokens - a.total_tokens);
  }, [detail]);

  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{t('projects.title')}</h2>
            <p className="text-muted-foreground note mt-1 text-[12.5px] leading-relaxed">
              {t('projects.blurb')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              label={t('trend.metric')}
              value={metric}
              onChange={(e) => setMetric(e.target.value as BarMetric)}
            >
              <option value="total_tokens">{t('trend.metricTotal')}</option>
              <option value="cost_usd">{t('trend.metricCost')}</option>
              <option value="calls">{t('trend.metricCalls')}</option>
            </Select>
            <Select
              label={t('trend.range')}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>{t('trend.range24h')}</option>
              <option value={7}>{t('trend.range7d')}</option>
              <option value={30}>{t('trend.range30d')}</option>
              <option value={120}>{t('trend.range120d')}</option>
              <option value={0}>{t('projects.allTime')}</option>
            </Select>
          </div>
        </div>
      </StaggerItem>

      {err && (
        <StaggerItem>
          <ErrorBox>{err}</ErrorBox>
        </StaggerItem>
      )}

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>{t('projects.byProject')}</CardTitle>
            <CardDescription>{t('projects.byProjectBlurb')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loaded && projectBars.length === 0 ? (
              <Empty>{t('projects.none')}</Empty>
            ) : (
              <>
                <StackedBars
                  rows={projectBars}
                  metric={metric}
                  onSelect={(k) => setSelected(k === selected ? null : k)}
                  selectedKey={selected}
                  empty={t('projects.none')}
                />
                {harnessLegend.length > 1 && <Legend items={harnessLegend} />}
              </>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {selected && detail.length > 0 && (
        <>
          <StaggerItem>
            <Card ref={detailRef}>
              <CardHeader>
                <CardTitle>{selected}</CardTitle>
                <CardDescription>{t('projects.cutsBlurb')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Cut
                  title={t('projects.byHarness')}
                  rows={detail}
                  keyOf={(r) => r.display_name}
                  labelOf={(k) => k}
                  metric={metric}
                  iconOf={markOf(harnessVendors)}
                />
                <Cut
                  title={t('projects.byVendor')}
                  rows={detail}
                  keyOf={(r) => r.vendor}
                  labelOf={vendorLabel}
                  metric={metric}
                  iconOf={(k) => <VendorIcon vendor={k} label={vendorLabel(k)} />}
                  colorOfKey={vendorColor}
                />
                <Cut
                  title={t('projects.byModel')}
                  rows={detail}
                  keyOf={(r) => r.model}
                  labelOf={(k) => k}
                  metric={metric}
                  iconOf={markOf(modelVendors)}
                  colorOfKey={(k) => vendorColor(modelVendors.get(k) ?? 'unknown')}
                />
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle>{t('projects.detail')}</CardTitle>
                <CardDescription>{t('projects.detailBlurb')}</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('col.harness')}</TableHead>
                    <TableHead>{t('col.model')}</TableHead>
                    <TableHead className="text-right">{t('col.calls')}</TableHead>
                    <TableHead className="text-right">{t('col.total')}</TableHead>
                    <TableHead className="text-right">{t('col.value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairs.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.display_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <VendorIcon
                            vendor={r.vendor}
                            label={vendorLabel(r.vendor)}
                            className="text-[15px]"
                          />
                          <span className="font-mono text-[12px]">{r.model}</span>
                        </span>
                      </TableCell>
                      <TableCell className="tabular text-right font-mono">
                        {r.calls.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono">
                        {f.tokens(r.total_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono">
                        {f.moneyTotal(r.cost_usd, r.cost_unknown_calls, r.calls)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </StaggerItem>
        </>
      )}
    </Stagger>
  );
}
