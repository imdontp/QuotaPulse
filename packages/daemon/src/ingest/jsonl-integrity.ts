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

/** Metadata-only changes cannot prove consumed bytes are unchanged; a legacy cursor starts a new change-time baseline. */
export function sameSizeTranscriptChangeMeta(cursor: Cursor, size: number, mtime: number, ctime: number) {
  if (cursor.byteOffset <= 0 || cursor.byteOffset !== size || cursor.fileSize !== size) return null;
  const previousCtime = cursor.meta?.jsonlObservedCtimeMs;
  const knownCtime = typeof previousCtime === 'number' && Number.isFinite(previousCtime) && previousCtime >= 0;
  const currentCtime = Number.isFinite(ctime) && ctime >= 0 ? ctime : null;
  const changed = cursor.fileMtime !== mtime || (knownCtime && currentCtime !== null && previousCtime !== currentCtime);
  const needsBaseline = currentCtime !== null && (!knownCtime || previousCtime !== currentCtime);
  const markUnverified = changed && !transcriptParseHistory(cursor.meta, cursor.byteOffset).unverified;
  if (!needsBaseline && !markUnverified) return null;
  return { ...cursor.meta, ...(markUnverified ? { ...transcriptParseMeta(cursor, 0), jsonlPriorUnverified: 1 } : {}),
    ...(currentCtime === null ? {} : { jsonlObservedCtimeMs: currentCtime }) };
}
