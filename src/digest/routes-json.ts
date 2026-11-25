import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import type { ReadNight } from './types.js';

function isValidNight(night: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return false;

  const date = new Date(night + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === night;
}

export function registerDigestJson(app: Hono, config: RigConfig, readNight: ReadNight): void {
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isValidNight(night)) {
      return c.json({ error: 'Expected a valid night in YYYY-MM-DD format.' }, 400);
    }

    const digest = readNight(config.runsDir, night);
    if (digest === null) {
      return c.json({ error: 'No run log found for this night.' }, 404);
    }

    return c.json(digest);
  });
}
