import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIdbError, runWithDegradationPolicy } from '../degradation';

describe('classifyIdbError', () => {
  it('detects QuotaExceededError', () => {
    expect(classifyIdbError(new DOMException('boom', 'QuotaExceededError'))).toBe('quota');
  });

  it('detects corruption from corrupt messages / UnknownError+internal error', () => {
    expect(classifyIdbError(new DOMException('Internal error.', 'UnknownError'))).toBe('corruption');
    expect(classifyIdbError(new Error('database corrupted'))).toBe('corruption');
  });

  it('treats InvalidStateError as transient (closed handle), not corruption', () => {
    expect(classifyIdbError(new DOMException('closed', 'InvalidStateError'))).toBe('transient');
  });

  it('treats bare UnknownError without corrupt signals as unknown', () => {
    expect(classifyIdbError(new DOMException('something', 'UnknownError'))).toBe('unknown');
  });

  it('detects transient AbortError', () => {
    expect(classifyIdbError(new DOMException('aborted', 'AbortError'))).toBe('transient');
  });

  it('returns unknown for unrelated errors', () => {
    expect(classifyIdbError(new Error('nope'))).toBe('unknown');
  });
});

describe('runWithDegradationPolicy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the value on first success without calling recovery hooks', async () => {
    const evictForQuota = vi.fn();
    const recoverFromCorruption = vi.fn();

    const result = await runWithDegradationPolicy(
      { label: 'test.ok', evictForQuota, recoverFromCorruption },
      async () => 42,
    );

    expect(result).toEqual({ ok: true, value: 42 });
    expect(evictForQuota).not.toHaveBeenCalled();
    expect(recoverFromCorruption).not.toHaveBeenCalled();
  });

  it('retries once on a transient failure after reopenConnection', async () => {
    const reopenConnection = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('closed', 'InvalidStateError'))
      .mockResolvedValueOnce('recovered');

    const result = await runWithDegradationPolicy(
      {
        label: 'test.transient',
        evictForQuota: vi.fn(),
        recoverFromCorruption: vi.fn(),
        reopenConnection,
      },
      operation,
    );

    expect(reopenConnection).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, value: 'recovered' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('evicts then retries on quota', async () => {
    const evictForQuota = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('QuotaExceededError', 'QuotaExceededError'))
      .mockResolvedValueOnce('after-evict');

    const result = await runWithDegradationPolicy(
      {
        label: 'test.quota',
        evictForQuota,
        recoverFromCorruption: vi.fn(),
      },
      operation,
    );

    expect(evictForQuota).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, value: 'after-evict' });
  });

  it('deletes/reopens then retries on corruption', async () => {
    const recoverFromCorruption = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Internal error.', 'UnknownError'))
      .mockResolvedValueOnce('after-delete');

    const result = await runWithDegradationPolicy(
      {
        label: 'test.corruption',
        evictForQuota: vi.fn(),
        recoverFromCorruption,
      },
      operation,
    );

    expect(recoverFromCorruption).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, value: 'after-delete' });
  });

  it('does not call recoverFromCorruption for InvalidStateError', async () => {
    const recoverFromCorruption = vi.fn();
    const reopenConnection = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('closed', 'InvalidStateError'))
      .mockResolvedValueOnce('ok');

    await runWithDegradationPolicy(
      {
        label: 'test.no-wipe',
        evictForQuota: vi.fn(),
        recoverFromCorruption,
        reopenConnection,
      },
      operation,
    );

    expect(recoverFromCorruption).not.toHaveBeenCalled();
    expect(reopenConnection).toHaveBeenCalledTimes(1);
  });

  it('returns ok:false when the retry also fails', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new DOMException('QuotaExceededError', 'QuotaExceededError'));

    const result = await runWithDegradationPolicy(
      {
        label: 'test.exhausted',
        evictForQuota: vi.fn().mockResolvedValue(undefined),
        recoverFromCorruption: vi.fn(),
      },
      operation,
    );

    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
