import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type RunEvent = {
  at: string;
  time: number;
  job: string;
  owner: string | null;
  status: DigestStatus;
  error?: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') return null;

  const { at, job, owner, status, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || !job.trim()) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  if (error !== undefined && typeof error !== 'string') return null;

  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  return { at, time, job, owner, status, error };
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let log: string;
  try {
    log = readFileSync(join(runsDir, night + '.jsonl'), 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }

  const events: RunEvent[] = [];
  let badLines = 0;
  for (const line of log.split('\n')) {
    if (!line.trim()) continue;
    const event = parseEvent(line);
    if (event) events.push(event);
    else badLines++;
  }

  // Stable sort keeps file order for equal instants, including different UTC offsets.
  events.sort((a, b) => a.time - b.time);
  const counts = { ok: 0, retry: 0, fail: 0 };
  const jobs = new Map<string, DigestRow>();
  for (const event of events) {
    counts[event.status]++;
    const row = jobs.get(event.job) ?? {
      job: event.job, owner: event.owner, runs: 0, retries: 0,
      lastStatus: event.status, lastError: null, firstAt: event.at, lastAt: event.at,
    };
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.error !== undefined) row.lastError = event.error;
    row.lastAt = event.at;
    row.lastStatus = event.status;
    row.owner = event.owner;
    jobs.set(event.job, row);
  }
  const rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { night, rows, badLines, counts };
}
