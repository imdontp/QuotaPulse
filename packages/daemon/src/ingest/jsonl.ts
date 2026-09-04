import { createReadStream, readFileSync, statSync } from 'node:fs';

export interface JsonlChunkResult {
  /** Byte offset of the end of the last COMPLETE line consumed. */
  nextOffset: number;
  fileSize: number;
  fileMtime: number;
  /** True when the file shrank (rotation/truncation) and we restarted from zero. */
  restarted: boolean;
  lines: number;
  parseErrors: number;
}

/**
 * Stream only the bytes appended since `fromOffset` and hand each complete JSON line
 * to `onRecord`. A trailing partial line is left unconsumed so the next pass picks it
 * up whole -- agent harnesses append while we read, so this happens constantly.
 *
 * This incremental path is what keeps ~700 MB of transcripts affordable: the first
 * pass reads everything once, every pass after that reads only the delta.
 */
export async function readJsonlDelta(
  path: string,
  fromOffset: number,
  onRecord: (record: unknown, byteEnd: number) => void,
): Promise<JsonlChunkResult> {
  const st = statSync(path);
  const fileSize = st.size;
  const fileMtime = st.mtimeMs;

  let start = fromOffset;
  let restarted = false;
  if (fromOffset > fileSize) {
    // File was truncated or replaced; the old offset is meaningless.
    start = 0;
    restarted = true;
  }
  if (start === fileSize) {
    return { nextOffset: start, fileSize, fileMtime, restarted, lines: 0, parseErrors: 0 };
  }

  let consumed = start;
  let lines = 0;
  let parseErrors = 0;
  let pending: Buffer = Buffer.alloc(0);

  const stream = createReadStream(path, { start, highWaterMark: 1 << 20 });

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);

    let searchFrom = 0;
    for (;;) {
      const nl = pending.indexOf(0x0a, searchFrom);
      if (nl === -1) break;
      const raw = pending.subarray(searchFrom, nl);
      searchFrom = nl + 1;
      consumed += raw.length + 1;

      // Tolerate CRLF and a UTF-8 BOM on the first line.
      let text = raw.toString('utf8').replace(/\r$/, '');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      if (text.trim() === '') continue;

      lines++;
      try {
        onRecord(JSON.parse(text), consumed);
      } catch {
        // A half-written final line is normal while a session is live; skip it and the
        // next pass will re-read it from the retained offset.
        parseErrors++;
      }
    }
    pending = searchFrom > 0 ? pending.subarray(searchFrom) : pending;
  }

  return { nextOffset: consumed, fileSize, fileMtime, restarted, lines, parseErrors };
}

/** Read a whole JSON file as UTF-8. Windows' default codepage corrupts these catalogs. */
export function readJsonFile<T>(path: string): T | null {
  try {
    let text = readFileSync(path, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
