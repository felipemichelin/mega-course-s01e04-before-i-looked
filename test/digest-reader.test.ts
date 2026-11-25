import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const night = '2026-10-28';

it('reads all five jobs in the recorded night, in job order', () => {
  const digest = readNight('runs', night);
  expect(digest?.rows.map(row => row.job)).toEqual([
    'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
  ]);
  expect(digest?.badLines).toBe(1);
  expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  expect(digest?.rows[0].owner).toBeNull();
  expect(digest?.rows[1]).toEqual({
    job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok',
    lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
  });
});

describe('readNight', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rig-digest-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('distinguishes a missing file from an empty night', () => {
    expect(readNight(dir, night)).toBeNull();
    writeFileSync(join(dir, night + '.jsonl'), '');
    expect(readNight(dir, night)).toEqual({ night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts malformed and structurally invalid records and skips blank lines', () => {
    const valid = { at: '2026-10-28T06:00:00Z', job: 'check', owner: null, status: 'ok' };
    const invalid = [
      null, [], 2, {}, { ...valid, owner: undefined }, { ...valid, owner: 2 },
      { ...valid, job: ' ' }, { ...valid, at: 'invalid' }, { ...valid, status: 'unknown' },
      { ...valid, error: 42 },
    ];
    const lines = ['{', ...invalid.map(value => JSON.stringify(value)), '  ', JSON.stringify(valid), ''];
    writeFileSync(join(dir, night + '.jsonl'), lines.join('\r\n'));
    expect(readNight(dir, night)).toMatchObject({
      rows: [{ job: 'check', runs: 1, lastError: null }],
      counts: { ok: 1, retry: 0, fail: 0 }, badLines: invalid.length + 1,
    });
  });

  it('keeps the most recent error, even after recovery and out-of-order writes', () => {
    const run = { job: 'sync', owner: 'rook' };
    const events = [
      { ...run, at: '2026-10-28T00:15:00-01:00', status: 'retry', error: 'locked' },
      { ...run, at: '2026-10-28T01:10:00+01:00', status: 'fail', error: 'timed out' },
      { ...run, at: '2026-10-28T01:15:00Z', status: 'ok', owner: null },
    ];
    writeFileSync(join(dir, night + '.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
    expect(readNight(dir, night)).toEqual({
      night, badLines: 0, counts: { ok: 1, retry: 1, fail: 1 },
      rows: [{
        job: 'sync', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'locked',
        firstAt: '2026-10-28T01:10:00+01:00', lastAt: '2026-10-28T01:15:00Z',
      }],
    });
  });

  it('opens only night filenames', () => {
    const runs = join(dir, 'runs');
    mkdirSync(runs);
    writeFileSync(join(dir, night + '.jsonl'), '');
    writeFileSync(join(runs, 'notes.jsonl'), '');
    expect(readNight(runs, '../' + night)).toBeNull();
    expect(readNight(runs, 'notes')).toBeNull();
  });
});
