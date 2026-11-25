import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestStatus, NightDigest } from '../src/digest/types.js';

const night = '2026-10-28';

function run(job: string, status: DigestStatus, at: string, owner: string | null = 'rook') {
  return JSON.stringify({ at, job, owner, status });
}

describe('digest routes', () => {
  let runsDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
  });

  afterEach(() => rmSync(runsDir, { recursive: true, force: true }));

  function requestDigest(date: string) {
    return Promise.all([app.request(`/digest/${date}`), app.request(`/api/digest/${date}`)]);
  }

  it('serves the same sorted jobs in HTML and JSON, with warnings and source offsets', async () => {
    const firstAt = '2026-10-28T09:30:00+05:30';
    const lastAt = '2026-10-28T02:15:00-03:00';
    const startAt = '2026-10-28T03:00:00Z';
    const retryAt = '2026-10-28T04:30:00Z';
    const finishAt = '2026-10-28T06:00:00Z';
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      run('zulu', 'retry', startAt),
      run('alpha', 'retry', firstAt, null),
      run('Bravo', 'retry', retryAt),
      run('zulu', 'retry', retryAt),
      run('alpha', 'retry', retryAt, null),
      run('Bravo', 'retry', retryAt),
      run('Bravo', 'retry', retryAt),
      run('Bravo', 'retry', retryAt),
      run('alpha', 'retry', retryAt, null),
      run('alpha', 'ok', lastAt, null),
      run('zulu', 'fail', finishAt),
    ].join('\n'));

    const [page, api] = await requestDigest(night);
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(api.headers.get('content-type')).toContain('application/json');

    const html = await page.text();
    const digest: NightDigest = await api.json();
    const htmlJobs = [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map((match) => match[1]);
    expect(htmlJobs).toEqual(digest.rows.map(({ job }) => job));
    expect(htmlJobs).toEqual(['Bravo', 'alpha', 'zulu']);
    expect(digest).toMatchObject({
      night,
      badLines: 0,
      counts: { ok: 1, retry: 9, fail: 1 },
      rows: [
        { job: 'Bravo', runs: 4, retries: 4, lastStatus: 'retry' },
        { job: 'alpha', owner: null, runs: 4, retries: 3, lastStatus: 'ok', firstAt, lastAt },
        { job: 'zulu', runs: 3, retries: 2, lastStatus: 'fail' },
      ],
    });
    expect(html).toContain('<th scope="row">Bravo</th><td>rook</td><td>4</td><td><strong class="warn">4</strong></td><td>retry</td>');
    expect(html).toContain('<th scope="row">alpha</th><td>—</td><td>4</td><td><strong class="warn">3</strong></td><td>ok</td>');
    expect(html).toContain(`<td>${firstAt}</td><td>${lastAt}</td>`);
    expect(html).toContain('<th scope="row">zulu</th><td>rook</td><td>3</td><td>2</td><td><strong class="warn">fail</strong></td>');
  });

  it('returns 404 on both routes for a valid night without a file', async () => {
    const [page, api] = await requestDigest(night);

    expect(page.status).toBe(404);
    expect(await page.text()).toContain('no run log');
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'No run log found for this night.' });
  });

  it('serves an empty run log with HTTP 200 on both routes', async () => {
    writeFileSync(join(runsDir, `${night}.jsonl`), '');

    const [page, api] = await requestDigest(night);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts a malformed line and keeps valid events on either side', async () => {
    const at = '2026-10-28T03:00:00Z';
    writeFileSync(join(runsDir, `${night}.jsonl`), [run('backup', 'ok', at), '{', run('sync', 'ok', at)].join('\n'));

    const [page, api] = await requestDigest(night);

    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('skipped malformed lines (1)');
    expect(html).toContain('<th scope="row">backup</th>');
    expect(html).toContain('<th scope="row">sync</th>');
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({
      badLines: 1,
      counts: { ok: 2, retry: 0, fail: 0 },
      rows: [{ job: 'backup', runs: 1 }, { job: 'sync', runs: 1 }],
    });
  });

  it.each(['2026-02-29', '2026-1-28'])('returns 400 on both routes for invalid night %s', async (date) => {
    writeFileSync(join(runsDir, `${date}.jsonl`), '');

    const [page, api] = await requestDigest(date);

    expect(page.status).toBe(400);
    expect(await page.text()).toContain('invalid night');
    expect(api.status).toBe(400);
    expect(await api.json()).toEqual({ error: 'Expected a valid night in YYYY-MM-DD format.' });
  });
});
