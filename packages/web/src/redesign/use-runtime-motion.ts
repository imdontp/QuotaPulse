import { useEffect, useRef, useState, type RefObject } from 'react';
import { RUNTIME_ACTIVITY_WINDOW_MS, type RuntimeGraph } from './model';
import { RuntimeMotionGate, motionContextKey, type MotionScope, type MotionSignal, type RuntimeMotionBatch, type RuntimeMotionEligibility } from './runtime-motion';

/** One observation batch and one expiry timer; no animation loop or replay queue. */
export function useRuntimeMotion(element: RefObject<HTMLElement>, batch: RuntimeMotionBatch | undefined, project: string | null | undefined, graph: Pick<RuntimeGraph, 'nodes' | 'edges' | 'activityWindowMs'>, graphReady: boolean, eligibility?: RuntimeMotionEligibility) {
  const gate = useRef(new RuntimeMotionGate());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const context = useRef<string>();
  const [signals, setSignals] = useState<MotionSignal[]>([]);
  const [conditions, setConditions] = useState({ visible: !document.hidden, intersecting: null as boolean | null, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  const cancel = () => { if (timer.current !== undefined) clearTimeout(timer.current); timer.current = undefined; setSignals([]); };

  useEffect(() => {
    const node = element.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intersecting: boolean | null = node ? null : false;
    const update = () => {
      eligibility?.update(!document.hidden && intersecting === true, Date.now());
      if (document.hidden || intersecting === false) cancel();
      setConditions({ visible: !document.hidden, intersecting, reduced: reduced.matches });
    };
    const observer = node && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); }) : null;
    if (observer && node) observer.observe(node);
    else if (node) intersecting = true;
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    update();
    return () => { eligibility?.update(false, Date.now()); observer?.disconnect(); document.removeEventListener('visibilitychange', update); reduced.removeEventListener('change', update); if (timer.current !== undefined) clearTimeout(timer.current); timer.current = undefined; gate.current.reset(); };
  }, [element, eligibility]);

  useEffect(() => {
    const scope: MotionScope = { key: batch?.scopeKey ?? '', sourceId: batch?.sourceId, project: project ?? undefined };
    const key = motionContextKey(scope);
    if (context.current !== key) { cancel(); context.current = key; }
    if (!batch) { cancel(); gate.current.reset(); return; }
    // Wait for the first intersection observation, so mounting cannot consume a new batch as hidden.
    if (conditions.intersecting === null) return;
    if (!conditions.visible || !conditions.intersecting) cancel();
    if (conditions.reduced) setSignals(previous => previous.some(s => s.presentation === 'moving') ? previous.map(s => ({ ...s, presentation: 'static' })) : previous);
    const next = gate.current.observe({ batchSerial: batch.serial, reason: batch.reason, scope, now: Date.now(), activityWindowMs: graph.activityWindowMs ?? RUNTIME_ACTIVITY_WINDOW_MS, rows: batch.rows, requestEligibility: batch.requestEligibility, eligibility: eligibility?.snapshot(), ...conditions, intersecting: conditions.intersecting,
      graph: graphReady ? { batchSerial: batch.serial, contextKey: key, edges: graph.edges, harnesses: graph.nodes.harness.map(n => n.key) } : undefined });
    if (next.length) { cancel(); setSignals(next); timer.current = setTimeout(() => { timer.current = undefined; setSignals([]); }, 700); }
  }, [batch, project, graph.nodes, graph.edges, graph.activityWindowMs, graphReady, conditions, eligibility]);
  return signals;
}
