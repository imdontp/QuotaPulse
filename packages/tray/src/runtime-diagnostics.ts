import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

export interface RuntimeProcessSample {
  pid: number;
  parentPid: number | null;
  name: string;
  executable: string | null;
  workingSetBytes: number | null;
  privateBytes: number | null;
  cpuPercent: number | null;
  source: 'electron' | 'external';
  /** Windows service identities hosted by this PID; never includes command-line data. */
  serviceNames?: string[];
}

export interface RuntimeSample {
  schemaVersion: 1;
  capturedAt: number;
  host: {
    platform: NodeJS.Platform;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
  };
  process: {
    pid: number;
    parentPid: number | null;
    executable: string;
    memory: NodeJS.MemoryUsage;
  };
  electron: RuntimeProcessSample[];
  daemon: {
    pid: number;
    uptimeSeconds: number;
    memory: Record<string, number>;
    scheduler: { running: boolean; sourceCount: number; lastPassAt: number | null; lastPassDurationMs: number | null };
  } | null;
  external: {
    processes: RuntimeProcessSample[];
    unavailableReason?: string;
  };
  pet: {
    enabled: boolean;
    movement: string;
    character: string;
    windows: { pet: boolean; quotaPopup: boolean; dashboard: boolean; gallery: boolean };
    counters: Record<string, number>;
  };
}

export interface RuntimeDiagnosticsOptions {
  intervalMs?: number;
  maxBytes?: number;
  onError?: (error: Error) => void;
  onLimit?: (path: string) => void;
}

export interface RuntimeDiagnosticsSession {
  readonly active: boolean;
  readonly path: string | null;
  start(provider: () => RuntimeSample | Promise<RuntimeSample>): string;
  stop(): void;
  sampleNow(): Promise<void>;
}

/**
 * A bounded JSONL recorder. Samples are never accumulated in memory, and a failed
 * process snapshot cannot stop the tray. This is intentionally a local opt-in tool:
 * it does not send data anywhere or collect command lines, prompts, or document names.
 */
export function createRuntimeDiagnosticsSession(
  dataDir: string,
  options: RuntimeDiagnosticsOptions = {},
): RuntimeDiagnosticsSession {
  const intervalMs = options.intervalMs ?? 60_000;
  const maxBytes = options.maxBytes ?? 128 * 1024 * 1024;
  let timer: NodeJS.Timeout | null = null;
  let provider: (() => RuntimeSample | Promise<RuntimeSample>) | null = null;
  let currentPath: string | null = null;
  let running = false;
  let sampleInFlight = false;

  const session: RuntimeDiagnosticsSession = {
    get active() {
      return running;
    },
    get path() {
      return currentPath;
    },
    start(nextProvider) {
      if (running && currentPath) return currentPath;
      mkdirSync(dataDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      currentPath = join(dataDir, `runtime-diagnostics-${stamp}.jsonl`);
      writeFileSync(currentPath, '', { encoding: 'utf8', flag: 'wx' });
      provider = nextProvider;
      running = true;
      timer = setInterval(() => void session.sampleNow(), intervalMs);
      timer.unref?.();
      void session.sampleNow();
      return currentPath;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      provider = null;
      running = false;
    },
    async sampleNow() {
      if (!running || !currentPath || !provider || sampleInFlight) return;
      sampleInFlight = true;
      const samplePath = currentPath;
      try {
        const sample = await provider();
        // The user may stop and restart recording while an external process snapshot is
        // in flight. Never append that late result to a newer session's file.
        if (!running || currentPath !== samplePath) return;
        const line = `${JSON.stringify(sample)}\n`;
        let bytes = 0;
        try {
          bytes = statSync(samplePath).size;
        } catch {
          bytes = 0;
        }
        if (bytes + Buffer.byteLength(line, 'utf8') > maxBytes) {
          const fullPath = samplePath;
          session.stop();
          options.onLimit?.(fullPath);
          return;
        }
        appendFileSync(samplePath, line, { encoding: 'utf8' });
      } catch (error) {
        options.onError?.(error as Error);
      } finally {
        sampleInFlight = false;
      }
    },
  };
  return session;
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

interface WindowsProcessRow {
  ProcessId?: number | string;
  ParentProcessId?: number | string;
  Name?: string;
  ExecutablePath?: string | null;
  WorkingSetSize?: number | string;
}

interface WindowsServiceRow {
  ProcessId?: number | string;
  Name?: string;
  DisplayName?: string;
}

/** Parse the fixed, command-line-free CIM projection used by the Windows collector. */
export function parseWindowsProcessSnapshot(raw: string): RuntimeProcessSample[] {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, '').trim()) as {
    processes?: WindowsProcessRow | WindowsProcessRow[];
    services?: WindowsServiceRow | WindowsServiceRow[];
  };
  const servicesByPid = new Map<number, string[]>();
  for (const service of arrayOf(parsed.services)) {
    const pid = numberOrNull(String(service.ProcessId ?? ''));
    if (pid == null || pid <= 0) continue;
    const label = service.DisplayName || service.Name;
    if (!label) continue;
    const labels = servicesByPid.get(pid) ?? [];
    if (!labels.includes(label)) labels.push(label);
    servicesByPid.set(pid, labels);
  }
  return arrayOf(parsed.processes)
    .map((row): RuntimeProcessSample | null => {
      const pid = numberOrNull(String(row.ProcessId ?? ''));
      if (pid == null) return null;
      return {
        pid,
        parentPid: numberOrNull(String(row.ParentProcessId ?? '')),
        name: row.Name || 'unknown',
        executable: row.ExecutablePath || null,
        workingSetBytes: numberOrNull(String(row.WorkingSetSize ?? '')),
        privateBytes: null,
        cpuPercent: null,
        source: 'external',
        ...(servicesByPid.has(pid) ? { serviceNames: servicesByPid.get(pid) } : {}),
      };
    })
    .filter((item): item is RuntimeProcessSample => item != null)
    .sort((a, b) => (b.workingSetBytes ?? 0) - (a.workingSetBytes ?? 0))
    .slice(0, 200);
}

/** Read-only process list used to distinguish a Kafka/Java process from Electron. */
export async function collectExternalProcessSnapshot(): Promise<RuntimeSample['external']> {
  try {
    if (process.platform === 'win32') {
      const script = [
        "$p=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,WorkingSetSize",
        "$s=Get-CimInstance Win32_Service | Where-Object {$_.ProcessId -gt 0} | Select-Object ProcessId,Name,DisplayName",
        "[pscustomobject]@{processes=$p;services=$s} | ConvertTo-Json -Compress -Depth 3",
      ].join(';');
      const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
        timeout: 10_000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      return { processes: parseWindowsProcessSnapshot(stdout) };
    }

    const { stdout } = await execFileAsync('ps', ['-eo', 'pid=,ppid=,comm=,rss='], {
      timeout: 5_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const processes = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.match(/^(\d+)\s+(\d+)\s+(.+?)\s+(\d+)$/))
      .map((match): RuntimeProcessSample | null => {
        if (!match) return null;
        return {
          pid: Number(match[1]),
          parentPid: Number(match[2]),
          name: match[3] ?? 'unknown',
          executable: match[3] ?? null,
          workingSetBytes: Number(match[4]) * 1024,
          privateBytes: null,
          cpuPercent: null,
          source: 'external' as const,
        } satisfies RuntimeProcessSample;
      })
      .filter((item): item is RuntimeProcessSample => item != null)
      .sort((a, b) => (b.workingSetBytes ?? 0) - (a.workingSetBytes ?? 0))
      .slice(0, 200);
    return { processes };
  } catch (error) {
    return { processes: [], unavailableReason: (error as Error).message };
  }
}
