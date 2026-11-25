import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { DigestPage } from '../views/digest.js';
import { Layout } from '../views/layout.js';
import { isDigestNight } from './night.js';
import type { ReadNight } from './types.js';

export function registerDigestPage(app: Hono, config: RigConfig, readNight: ReadNight): void {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const valid = isDigestNight(night);
    const digest = valid ? readNight(config.runsDir, night) : null;
    const title = `digest · ${night}`;

    if (!digest) {
      return c.html(
        <Layout title={title} lane={lane()}>
          <>
            <h1>{title}</h1>
            <p class="mute">{valid ? 'no run log' : 'invalid night'}</p>
          </>
        </Layout>,
        valid ? 404 : 400,
      );
    }

    return c.html(
      <Layout title={title} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });
}
