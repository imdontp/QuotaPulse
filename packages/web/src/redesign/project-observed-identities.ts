/** Recorded identities only. Missing provider labels never become a counted provider. */
export function projectObservedIdentities(rows: readonly { harness: string; provider: string | null }[]) {
  const known = (provider: string | null): provider is string => provider !== null && provider.trim() !== '';
  return {
    harnesses: [...new Set(rows.map(row => row.harness))].sort(),
    providers: [...new Set(rows.map(row => row.provider).filter(known))].sort(),
    hasMissingProvider: rows.some(row => !known(row.provider)),
  };
}
