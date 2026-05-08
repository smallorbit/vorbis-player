import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logCaughtError } from '../logCaughtError';

describe('logCaughtError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with the contextual tag in dev', () => {
    // #given
    const err = new Error('boom');

    // #when
    logCaughtError('test.context', err);

    // #then — vitest runs with import.meta.env.DEV === true
    expect(warnSpy).toHaveBeenCalledWith('[test.context]', err);
  });

  it('forwards the error value verbatim', () => {
    // #given
    const err = { code: 42, message: 'kapow' };

    // #when
    logCaughtError('another.context', err);

    // #then
    expect(warnSpy).toHaveBeenCalledWith('[another.context]', err);
  });
});
