import { EFFORT_PAGE_SIZE } from './effort-page';

export interface ComparisonPageSelection { scopeKey: string; selectionKey: string; page: number }
/** Deep links reveal their selected pair once; manual paging and ordinary refresh never jump back. */
export function comparisonPageSelection(selection: ComparisonPageSelection, scopeKey: string, selectionKey: string, count: number | undefined, selectedIndex: number) {
  const changedScope = selection.scopeKey !== scopeKey;
  const changedSelection = selection.selectionKey !== selectionKey;
  const target = changedScope || changedSelection ? (selectedIndex >= 0 ? Math.floor(selectedIndex / EFFORT_PAGE_SIZE) : 0) : selection.page;
  const page = Math.max(0, Math.min(count === undefined ? Infinity : Math.max(0, Math.ceil(count / EFFORT_PAGE_SIZE) - 1), target));
  // Do not consume an initial/deep-link selection while its accepted list is unavailable.
  const acceptedSelection = count === undefined ? selection.selectionKey : selectionKey;
  return selection.scopeKey === scopeKey && selection.selectionKey === acceptedSelection && selection.page === page ? selection : { scopeKey, selectionKey: acceptedSelection, page };
}
