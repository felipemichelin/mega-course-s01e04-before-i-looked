import { Hono } from 'hono';
import { expect, it, vi } from 'vitest';
import { registerDigestPage } from '../src/digest/routes-html.js';
import type { DigestRow, NightDigest, ReadNight } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'test-runs' };
const night = '2026-10-28';
const empty: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
const row: DigestRow = {
  job: 'alpha', owner: 'rook', runs: 3, retries: 2, lastStatus: 'ok', lastError: null,
  firstAt: '2026-10-28T01:23:45+05:30', lastAt: '2026-10-28T09:21:13-03:00',
};

function makeApp(readNight: ReadNight) {
  const app = new Hono();
  registerDigestPage(app, config, readNight);
  return app;
}

it('renders all fields in job order, marks retries and failures, and escapes log text', async () => {
  vi.stubEnv('LANE_ID', 'test-lane');
  vi.stubEnv('LANE_MARKER', 'test-marker');

  try {
    const digest: NightDigest = {
      ...empty,
      rows: [
        { ...row, job: 'bravo', owner: null, runs: 4, retries: 3, lastStatus: 'retry' },
        { ...row, job: 'Zeta', owner: '<owner>', runs: 1, retries: 0, lastStatus: 'fail', lastError: '<script>bad & worse</script>' },
        row,
      ],
      badLines: 2,
      counts: { ok: 1, retry: 1, fail: 1 },
    };
    const readNight = vi.fn<ReadNight>().mockReturnValue(digest);
    const response = await makeApp(readNight).request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(readNight).toHaveBeenCalledWith(config.runsDir, night);
    expect(html).toContain('<span>test-lane</span><span class="marker">test-marker</span>');
    expect(html).toContain(`<h1>digest · ${night}</h1>`);
    expect(html).toContain('skipped malformed lines (2)');
    expect([...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map((match) => match[1])).toEqual(['Zeta', 'alpha', 'bravo']);
    expect(html).toContain(`<td>rook</td><td>3</td><td>2</td><td>ok</td><td>—</td><td>${row.firstAt}</td><td>${row.lastAt}</td>`);
    expect(html).toContain('<td>—</td><td>4</td><td><strong class="warn">3</strong></td><td>retry</td>');
    expect(html).toContain('<td>&lt;owner&gt;</td><td>1</td><td>0</td><td><strong class="warn">fail</strong></td>');
    expect(html).toContain('&lt;script&gt;bad &amp; worse&lt;/script&gt;');
    expect(html).not.toContain('<script');
    expect(digest.rows.map(({ job }) => job)).toEqual(['bravo', 'Zeta', 'alpha']);
  } finally {
    vi.unstubAllEnvs();
  }
});

it('renders an empty file with HTTP 200', async () => {
  const response = await makeApp(() => empty).request(`/digest/${night}`);

  expect(response.status).toBe(200);
  expect(await response.text()).toContain('nothing ran');
});

it('reports malformed lines even when no valid rows remain', async () => {
  const response = await makeApp(() => ({ ...empty, badLines: 1 })).request(`/digest/${night}`);
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain('skipped malformed lines (1)');
  expect(html).toContain('no valid runs');
});

it('returns HTTP 404 for a missing file', async () => {
  const response = await makeApp(() => null).request(`/digest/${night}`);

  expect(response.status).toBe(404);
  expect(await response.text()).toContain('no run log');
});

it('returns HTTP 400 for an invalid date without calling the reader', async () => {
  const readNight = vi.fn<ReadNight>();
  const response = await makeApp(readNight).request('/digest/2026-02-29');

  expect(response.status).toBe(400);
  expect(await response.text()).toContain('invalid night');
  expect(readNight).not.toHaveBeenCalled();
});
