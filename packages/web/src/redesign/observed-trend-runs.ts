export interface ObservedPoint { at: number; value: number | null }

/** Keep original indices: unknown samples break a line without compressing time. */
export function observedTrendRuns(points: readonly ObservedPoint[]) {
  const runs: Array<Array<{ index: number; at: number; value: number }>> = [];
  let run: Array<{ index: number; at: number; value: number }> = [];
  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ index, at: point.at, value: point.value });
  });
  if (run.length) runs.push(run);
  return runs;
}
