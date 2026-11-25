import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import type { NightDigest, ReadNight } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightCounts?: Partial<Record<string, NightDigest['counts']>>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig, digestReader: ReadNight = readNight): Status {
  const nights = nightsOnDisk(config.runsDir);
  const nightCounts: NonNullable<Status['nightCounts']> = {};
  for (const night of nights) {
    try {
      const digest = digestReader(config.runsDir, night);
      if (digest) nightCounts[night] = digest.counts;
    } catch (err) {
      // Keep the board available if a listed log cannot be read.
      if (!(err instanceof Error && 'code' in err)) throw err;
    }
  }

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightCounts,
  };
}
