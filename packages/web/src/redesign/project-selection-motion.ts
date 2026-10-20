import { cancelModelSelectionMotion, initialModelSelectionMotion, observeModelSelectionMotion,
  type ModelSelectionIntent, type ModelSelectionMotionState, type ModelSelectionObservation } from './model-selection-motion';

export const projectMotionKey = (project: string | null) => JSON.stringify(project);
export const projectDetailMotionKey = (project: string | null, tab: string) => JSON.stringify([project, tab]);
export interface ProjectSelectionIntent extends ModelSelectionIntent { kind: 'project' | 'detail'; openerKey: string | null }
export interface ProjectSelectionMotionState extends ModelSelectionMotionState { offset: number }
export const initialProjectSelectionMotion = (): ProjectSelectionMotionState => ({ ...initialModelSelectionMotion(), offset: 0 });
export interface ProjectSelectionObservation extends Omit<ModelSelectionObservation, 'intent'> {
  intent: ProjectSelectionIntent | null;
  offset: number;
}

/** Reuse the validated finite selection decision. A session-page change consumes
 * pending work; resetting offset as part of a genuine new selection is not paging.
 */
export function observeProjectSelectionMotion(state: ProjectSelectionMotionState, observation: ProjectSelectionObservation) {
  const explicit = observation.intent !== null && observation.intent.serial > state.consumedSerial
    && observation.intent.key === observation.selectedKey && observation.intent.contextKey === observation.contextKey
    && state.selectedKey !== observation.selectedKey;
  const paged = state.offset !== observation.offset && !explicit;
  const prior = paged ? cancelModelSelectionMotion(state, observation.intent?.serial) : state;
  const decision = observeModelSelectionMotion(prior, { ...observation,
    rowVisible: observation.intent?.kind === 'project' && observation.rowVisible });
  return { ...decision, cancel: decision.cancel || paged,
    state: { ...decision.state, offset: observation.offset } as ProjectSelectionMotionState };
}
