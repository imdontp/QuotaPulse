import { useEffect, useRef } from 'react';
import { subscribe } from '@/api';

/*
 * The daemon pushes only on a pass that produced rows, but during active work that is
 * every poll, so a burst of pushes must collapse into one refetch. Long enough to
 * coalesce a burst, short enough that the page still reads as live.
 */
const COALESCE_MS = 1200;

/**
 * Fetch on mount and whenever `deps` change, and again whenever the daemon reports new
 * data.
 *
 * The sections that take the overview as a prop have always updated live, because the
 * shell refetches it on every push. The ones that fetch for themselves did not: they ran
 * their effect once on mount and then sat there, so a tab left open showed whatever was
 * true when it was opened while the header pill still said "streaming". Sessions made
 * this obvious, being the view that changes most, but Trend, Projects, Models and Health
 * were all equally frozen.
 *
 * `live` distinguishes the two reasons this runs. A background refresh must not flip the
 * section back to its loading state -- a spinner every few seconds is worse than a
 * slightly stale table -- so callers show loading only when `live` is false.
 */
export function useLiveRefresh(
  fetch: (opts: { live: boolean }) => void,
  deps: React.DependencyList,
): void {
  // Kept in a ref so a caller can pass an inline closure without the subscription
  // tearing down and reopening the stream on every render.
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  useEffect(() => {
    fetchRef.current({ live: false });
    // The caller's deps are the contract here; `fetch` is deliberately not among them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribe(() => {
      if (timer != null) return; // a burst is already scheduled
      timer = setTimeout(() => {
        timer = null;
        fetchRef.current({ live: true });
      }, COALESCE_MS);
    });
    return () => {
      off();
      if (timer != null) clearTimeout(timer);
    };
  }, []);
}
