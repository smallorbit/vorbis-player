import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { SnapshotSeed } from './types.ts';

export class SeedFreshlyCreatedError extends Error {
  constructor(seedPath: string) {
    super(
      `Generated ${seedPath}. Commit it (it is not a secret — just a salt\n` +
        `for deterministic anonymization) and re-run this command.`,
    );
    this.name = 'SeedFreshlyCreatedError';
  }
}

/**
 * Loads scripts/snapshot/seed.json.
 * If missing, generates a fresh seed, writes it, and throws SeedFreshlyCreatedError.
 */
export function loadOrInitSeed(seedPath: string): SnapshotSeed {
  try {
    const raw = readFileSync(seedPath, 'utf-8');
    return JSON.parse(raw) as SnapshotSeed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;

    const seed: SnapshotSeed = {
      anonymizationSeed: randomBytes(16).toString('hex'),
      generatedAt: new Date().toISOString(),
    };
    writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
    throw new SeedFreshlyCreatedError(seedPath);
  }
}
