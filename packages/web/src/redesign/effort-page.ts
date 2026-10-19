/** A display page size, never a limit on factual categories or their totals. */
export const EFFORT_PAGE_SIZE = 20;

export interface EffortPageSelection { scopeKey: string; page: number }

export function effortPageSelection(selection: EffortPageSelection, scopeKey: string, count: number | undefined): EffortPageSelection {
  const lastPage = count === undefined ? Infinity : Math.max(0, Math.ceil(count / EFFORT_PAGE_SIZE) - 1);
  const page = selection.scopeKey === scopeKey ? Math.min(lastPage, Math.max(0, Math.trunc(selection.page))) : 0;
  return selection.scopeKey === scopeKey && selection.page === page ? selection : { scopeKey, page };
}

export function effortPage<T>(rows: readonly T[], page: number) {
  const selected = effortPageSelection({ scopeKey: '', page }, '', rows.length);
  const start = selected.page * EFFORT_PAGE_SIZE;
  return {
    rows: rows.length <= EFFORT_PAGE_SIZE ? rows : rows.slice(start, start + EFFORT_PAGE_SIZE),
    page: selected.page,
    from: rows.length ? start + 1 : 0,
    to: Math.min(rows.length, start + EFFORT_PAGE_SIZE),
    total: rows.length,
    hasPrevious: selected.page > 0,
    hasNext: start + EFFORT_PAGE_SIZE < rows.length,
  };
}
