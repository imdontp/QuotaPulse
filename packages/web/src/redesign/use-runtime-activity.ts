import { useEffect, useState } from 'react';
import type { RuntimeObservation } from './runtime-motion';
import { recentRuntimeExpiry } from './runtime-activity';

const EMPTY: readonly RuntimeObservation[] = [];

export function useRuntimeActivity(observations: readonly RuntimeObservation[] | undefined, windowMs: number, visible: boolean) {
  const rows = observations ?? EMPTY;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const expiry = recentRuntimeExpiry(rows, Date.now(), windowMs);
    if (expiry === null) return;
    const timer = setTimeout(() => setRevision(value => value + 1), Math.min(2_147_483_647, Math.max(1, expiry - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [rows, windowMs, visible, revision]);
  return recentRuntimeExpiry(rows, Date.now(), windowMs) !== null;
}
