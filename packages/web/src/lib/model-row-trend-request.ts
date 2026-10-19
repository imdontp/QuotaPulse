/** Keep a single read request while avoiding Node's request-header limit for long exact identities. */
export function modelRowTrendRequest(scope: URLSearchParams, pairs: readonly { model: string | null; provider: string | null }[]) {
  const query = new URLSearchParams(scope);
  const body = JSON.stringify({ pairs });
  query.set('pairs', JSON.stringify(pairs));
  const path = `/api/model-trends?${query}`;
  if (new TextEncoder().encode(path).byteLength <= 8_000) return { path, body: undefined };
  const scopeOnly = new URLSearchParams(scope);
  scopeOnly.delete('pairs');
  return { path: `/api/model-trends?${scopeOnly}`, body };
}
