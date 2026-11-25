import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { readNight } from './digest/read-night.js';
import { registerDigestPage } from './digest/routes-html.js';
import { registerDigestJson } from './digest/routes-json.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();
  registerDigestPage(app, config, readNight);
  registerDigestJson(app, config, readNight);

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  return app;
}
