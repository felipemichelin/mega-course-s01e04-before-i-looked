import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { RigConfig } from '../src/config.js';
import { registerDigestJson } from '../src/digest/routes-json.js';
import type { NightDigest, ReadNight } from '../src/digest/types.js';

const config: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'test-runs',
};

function makeApp(readNight: ReadNight) {
  const app = new Hono();
  registerDigestJson(app, config, readNight);
  return app;
}

describe('JSON digest', () => {
  it('returns the digest with job order and log values preserved', async () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      rows: [
        {
          job: 'archive',
          owner: null,
          runs: 2,
          retries: 1,
          lastStatus: 'fail',
          lastError: 'Timed out',
          firstAt: '2026-10-28T04:00:00+01:00',
          lastAt: '2026-10-28T05:00:00-03:00',
        },
        {
          job: 'sync',
          owner: 'rook',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T02:00:00+05:30',
          lastAt: '2026-10-28T02:00:00+05:30',
        },
      ],
      badLines: 1,
      counts: { ok: 1, retry: 1, fail: 1 },
    };
    const readNight = vi.fn<ReadNight>().mockReturnValue(digest);

    const res = await makeApp(readNight).request('/api/digest/2026-10-28');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual(digest);
    expect(readNight).toHaveBeenCalledExactlyOnceWith(config.runsDir, digest.night);
  });

  it('returns 404 with a JSON error for a missing night', async () => {
    const app = makeApp(() => null);

    const res = await app.request('/api/digest/2026-10-29');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No run log found for this night.' });
  });

  it('returns 200 with empty rows and zero counts for an empty night', async () => {
    const digest: NightDigest = {
      night: '2024-02-29',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    };

    const res = await makeApp(() => digest).request('/api/digest/2024-02-29');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(digest);
  });

  it.each(['2026-1-28', '2026-10-28.jsonl', '2026-02-29', '..%2Frig'])('rejects %s before reading', async (night) => {
    const readNight = vi.fn<ReadNight>();

    const res = await makeApp(readNight).request('/api/digest/' + night);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected a valid night in YYYY-MM-DD format.' });
    expect(readNight).not.toHaveBeenCalled();
  });
});
