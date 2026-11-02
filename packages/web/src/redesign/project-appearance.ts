export type ProjectTone = 'cyan' | 'violet' | 'blue' | 'orange' | 'neutral';

/** Stable decorative identity only; the tone does not describe project status or type. */
export function projectTone(key: string | null): ProjectTone {
  if (key === 'QuotaPulse') return 'cyan';
  if (key === null || key === '') return 'neutral';
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193) >>> 0;
  // Mix all bits before choosing a colour so similar names do not systematically
  // cluster on the low bits of the FNV hash.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return (['violet', 'blue', 'orange', 'cyan'] as const)[hash % 4]!;
}
