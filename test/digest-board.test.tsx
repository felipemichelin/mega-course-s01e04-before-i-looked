import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';

it('links each night with counts of its individual run events', async () => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-board-'));
  try {
    const event = { at: '2026-10-28T04:00:00+01:00', job: 'sync', owner: null };
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
      ...['retry', 'retry', 'ok', 'fail'].map((status) => JSON.stringify({ ...event, status })),
      'bad line',
    ].join('\n'));
    writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');

    const config = { adapter: 'shim', installed: '2026-10-29', beatEverySeconds: 60, runsDir };
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · ok 1 / retry 2 / fail 1');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a> · ok 0 / retry 0 / fail 0');
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
});
