import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import type { ReadNight } from './types.js';
import { isDigestNight } from './night.js';

export function registerDigestJson(app: Hono, config: RigConfig, readNight: ReadNight): void {
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isDigestNight(night)) {
      return c.json({ error: 'Expected a valid night in YYYY-MM-DD format.' }, 400);
    }

    const digest = readNight(config.runsDir, night);
    if (digest === null) {
      return c.json({ error: 'No run log found for this night.' }, 404);
    }

    return c.json(digest);
  });
}
