/**
 * Wave 4 asset contract & compatibility (ASSET_VERSIONING_POLICY.md).
 *
 * The runtime supports exactly one manifest contract version. A manifest that
 * declares a *newer* contract is never partially interpreted: the loader must
 * refuse it so the caller can fall back to the bundled known-good default pet.
 */

export const PET_CONTRACT_VERSION = 1;

/** The runtime build this contract targets; manifests may require a newer one. */
export const PET_RUNTIME_VERSION = '4.0.0';

/** True when the declared contract can be loaded by this runtime. */
export function isContractCompatible(contractVersion: unknown): boolean {
  return (
    typeof contractVersion === 'number' &&
    Number.isInteger(contractVersion) &&
    contractVersion >= 1 &&
    contractVersion <= PET_CONTRACT_VERSION
  );
}

/** True when a manifest's minimum runtime requirement is satisfied. */
export function runtimeSatisfies(minimumRuntimeVersion: string | unknown): boolean {
  if (typeof minimumRuntimeVersion !== 'string' || !minimumRuntimeVersion) return true;
  const compare = (v: string): number[] => v.split('.').map((n) => parseInt(n, 10) || 0);
  const a = compare(PET_RUNTIME_VERSION);
  const b = compare(minimumRuntimeVersion);
  const c = (i: number): number => a[i] ?? 0;
  const d = (i: number): number => b[i] ?? 0;
  return c(0) > d(0) || (c(0) === d(0) && (c(1) > d(1) || (c(1) === d(1) && c(2) >= d(2))));
}
