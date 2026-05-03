
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOrInitSeed, SeedFreshlyCreatedError } from '../seed-store.ts';
import type { SnapshotSeed } from '../types.ts';

const TMP = join(tmpdir(), 'snapshot-test-seed-store');
const SEED_PATH = join(TMP, 'seed.json');

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('loadOrInitSeed', () => {
  it('generates and writes seed when file is missing', () => {
    expect(() => loadOrInitSeed(SEED_PATH)).toThrow(SeedFreshlyCreatedError);
    expect(existsSync(SEED_PATH)).toBe(true);
  });

  it('generated seed has correct shape', () => {
    try {
      loadOrInitSeed(SEED_PATH);
    } catch {
      // expected: SeedFreshlyCreatedError
    }
    const written = JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SnapshotSeed;
    expect(written.anonymizationSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof written.generatedAt).toBe('string');
    expect(new Date(written.generatedAt).getTime()).not.toBeNaN();
  });

  it('SeedFreshlyCreatedError message mentions the seed path', () => {
    try {
      loadOrInitSeed(SEED_PATH);
    } catch (err) {
      expect(err).toBeInstanceOf(SeedFreshlyCreatedError);
      expect((err as Error).message).toContain(SEED_PATH);
    }
  });

  it('loads existing seed without throwing', () => {
    const existing: SnapshotSeed = {
      anonymizationSeed: 'abcdef0123456789abcdef0123456789',
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    writeFileSync(SEED_PATH, JSON.stringify(existing));
    const loaded = loadOrInitSeed(SEED_PATH);
    expect(loaded.anonymizationSeed).toBe(existing.anonymizationSeed);
    expect(loaded.generatedAt).toBe(existing.generatedAt);
  });

  it('roundtrip — loaded seed is stable across re-reads', () => {
    const existing: SnapshotSeed = {
      anonymizationSeed: 'deadbeef01234567deadbeef01234567',
      generatedAt: '2026-04-29T10:00:00.000Z',
    };
    writeFileSync(SEED_PATH, JSON.stringify(existing));
    const a = loadOrInitSeed(SEED_PATH);
    const b = loadOrInitSeed(SEED_PATH);
    expect(a.anonymizationSeed).toBe(b.anonymizationSeed);
    expect(a.generatedAt).toBe(b.generatedAt);
  });
});
