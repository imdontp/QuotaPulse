/** Opt in to smaller model responses, retaining compatibility with older daemons. */
export function createModelSummaryLoader<T extends object>(read: (path: string) => Promise<T>) {
  let legacy = false;
  const withoutRows = (data: T): Omit<T, 'rows'> => {
    const { rows: _rows, ...summary } = data as T & { rows?: unknown };
    return summary;
  };
  return async (path: string): Promise<Omit<T, 'rows'>> => {
    if (legacy) return withoutRows(await read(path));
    try { return withoutRows(await read(`${path}&breakdown=0`)); }
    catch (error) {
      // Only a successful full-mode read establishes an older daemon. Auth,
      // network/server failures and invalid scopes must not disable the opt-in.
      if (error === null || typeof error !== 'object' || !('status' in error) || error.status !== 400) throw error;
      const data = await read(path);
      legacy = true;
      return withoutRows(data);
    }
  };
}
