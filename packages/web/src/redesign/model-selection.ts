interface ModelIdentity {
  model: string | null;
  provider: string | null;
}

/** A model-only drill-down uses the first matching row in the existing ranked list. */
export function selectModelGroup<T extends ModelIdentity>(
  groups: readonly T[],
  model: string | null | undefined,
  provider: string | null | undefined,
): T | undefined {
  return groups.find(group => group.model === model && (provider === undefined || group.provider === provider)) ?? groups[0];
}
