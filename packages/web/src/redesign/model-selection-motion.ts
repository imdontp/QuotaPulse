/** One explicit user selection, independent of refreshes and automatic fallback. */
export interface ModelSelectionIntent { serial: number; key: string; contextKey: string }
interface PendingDetail { key: string; contextKey: string; detailKey: string }
export interface ModelSelectionMotionState {
  contextKey: string | null;
  selectedKey: string | null;
  consumedSerial: number;
  pending: PendingDetail | null;
}
export const initialModelSelectionMotion = (): ModelSelectionMotionState => ({ contextKey: null, selectedKey: null, consumedSerial: 0, pending: null });
export interface ModelSelectionObservation {
  contextKey: string;
  selectedKey: string | null;
  detailKey: string | null;
  acceptedDetailKey: string | null;
  intent: ModelSelectionIntent | null;
  enabled: boolean;
  failed: boolean;
  rowVisible: boolean;
  detailVisible: boolean;
}

/** Eligibility loss consumes pending work, including an intent committed before its effect. */
export function cancelModelSelectionMotion(state: ModelSelectionMotionState, latestSerial = state.consumedSerial): ModelSelectionMotionState {
  return { ...state, pending: null, consumedSerial: Math.max(state.consumedSerial, latestSerial) };
}

/** Pure finite decision: at most one pending exact accepted-detail request, no queue. */
export function observeModelSelectionMotion(state: ModelSelectionMotionState, observation: ModelSelectionObservation) {
  const contextChanged = state.contextKey !== null && state.contextKey !== observation.contextKey;
  const selectedChanged = state.selectedKey !== observation.selectedKey;
  const disabled = !observation.enabled || observation.failed;
  const freshIntent = observation.intent !== null && observation.intent.serial > state.consumedSerial;
  let pending = state.pending;
  if (disabled || contextChanged || selectedChanged || !observation.detailVisible
    || pending && (pending.contextKey !== observation.contextKey || pending.key !== observation.selectedKey || pending.detailKey !== observation.detailKey)) pending = null;
  const explicit = freshIntent && !disabled && !contextChanged && state.contextKey === observation.contextKey
    && selectedChanged && observation.intent!.contextKey === observation.contextKey && observation.intent!.key === observation.selectedKey;
  const row = explicit && observation.rowVisible;
  if (explicit && observation.detailVisible && observation.detailKey !== null)
    pending = { key: observation.intent!.key, contextKey: observation.contextKey, detailKey: observation.detailKey };
  const detail = !disabled && observation.detailVisible && pending !== null && pending.detailKey === observation.acceptedDetailKey;
  if (detail) pending = null;
  const next: ModelSelectionMotionState = { contextKey: observation.contextKey, selectedKey: observation.selectedKey,
    consumedSerial: Math.max(state.consumedSerial, observation.intent?.serial ?? 0), pending };
  return { state: next, row, detail, cancel: disabled || contextChanged || selectedChanged };
}
