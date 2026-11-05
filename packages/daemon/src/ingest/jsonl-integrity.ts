import type { Cursor } from '../adapters/types.js';

/** The count records encounters, not unique missing calls or complete source coverage. */
export function transcriptParseHistory(meta: unknown, byteOffset: number) {
  const value = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  const count = value.jsonlMalformedLines;
  const malformedLines = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : 0;
  const valid = value.jsonlIntegrityVersion === 1 && count === malformedLines
    && (value.jsonlPriorUnverified === 0 || value.jsonlPriorUnverified === 1);
  return { malformedLines, unverified: valid ? value.jsonlPriorUnverified === 1 : byteOffset > 0 };
}

/** Retain gaps from previously consumed bytes, including across a detected truncation. */
export function transcriptParseMeta(cursor: Cursor, newMalformedLines: number) {
  const previous = transcriptParseHistory(cursor.meta, cursor.byteOffset);
  return {
    jsonlIntegrityVersion: 1,
    jsonlMalformedLines: previous.malformedLines + newMalformedLines,
    jsonlPriorUnverified: previous.unverified ? 1 : 0,
  };
}
