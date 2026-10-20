import type { Dimension } from './model';

export const runtimeInspectorKey = (dimension: Dimension, key: string | null) => JSON.stringify([dimension, key]);
/** UI null/undefined means All; exact empty project remains distinct. */
export const runtimeInspectorContext = (scope: string, project: string | null | undefined) =>
  JSON.stringify([scope, project == null ? ['all'] : ['exact', project]]);
export interface RuntimeInspectorSelection { dimension: Dimension; key: string | null; contextKey: string; serial: number }
export const currentRuntimeInspection = (selection: RuntimeInspectorSelection | null, contextKey: string, available: boolean) =>
  available && selection?.contextKey === contextKey ? selection : null;
export interface RuntimeInspectorMotionState { contextKey: string; key: string | null; serial: number }
export function runtimeInspectorDecision(previous: RuntimeInspectorMotionState, next: RuntimeInspectorMotionState, enabled: boolean, startable = true) {
  const changedContext = previous.contextKey !== next.contextKey;
  return {
    state: { ...next, serial: Math.max(previous.serial, next.serial) },
    animate: enabled && startable && !changedContext && next.key !== null && next.key !== previous.key && next.serial > previous.serial,
    cancel: !enabled || changedContext || next.key !== previous.key,
  };
}

/** Native close/focus is independent of effect completion. Never focus a detached/hidden opener. */
export function restoreRuntimeInspectorFocus(opener: HTMLElement | null, fallback: HTMLElement | null) {
  const target = opener?.isConnected && opener.getClientRects().length > 0 ? opener : fallback;
  if (target?.isConnected) target.focus({ preventScroll: true });
}
