import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropboxAuthAdapter } from '../dropboxAuthAdapter';

vi.mock('../dropboxSyncFolder', () => ({
  ensureVorbisFolder: vi.fn(),
}));

import { ensureVorbisFolder } from '../dropboxSyncFolder';
import {
  RemoteJsonFileStore,
  downloadRemoteJson,
  uploadRemoteJson,
  jsonToHttpHeader,
  type VersionedJson,
} from '../remoteJsonFileStore';

interface SampleFile extends VersionedJson {
  version: 1;
  updatedAt: string;
  value: string;
}

/** Public methods RemoteJsonFileStore actually uses on the auth adapter. */
type DropboxAuthPublic = Pick<
  DropboxAuthAdapter,
  | 'providerId'
  | 'isAuthenticated'
  | 'getAccessToken'
  | 'beginLogin'
  | 'handleCallback'
  | 'logout'
  | 'ensureValidToken'
  | 'refreshAccessToken'
  | 'reportUnauthorized'
>;

function createMockAuth(token = 'test-token'): DropboxAuthAdapter {
  const methods = {
    providerId: 'dropbox' as const,
    isAuthenticated: vi.fn<() => boolean>().mockReturnValue(true),
    getAccessToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(token),
    beginLogin: vi.fn<() => Promise<void>>(),
    handleCallback: vi.fn<(url: URL) => Promise<boolean>>(),
    logout: vi.fn<() => Promise<void>>(),
    ensureValidToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(token),
    refreshAccessToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(token),
    reportUnauthorized: vi.fn<() => void>(),
  } satisfies DropboxAuthPublic;
  const auth = new DropboxAuthAdapter();
  auth.isAuthenticated = methods.isAuthenticated;
  auth.getAccessToken = methods.getAccessToken;
  auth.beginLogin = methods.beginLogin;
  auth.handleCallback = methods.handleCallback;
  auth.logout = methods.logout;
  auth.ensureValidToken = methods.ensureValidToken;
  auth.refreshAccessToken = methods.refreshAccessToken;
  auth.reportUnauthorized = methods.reportUnauthorized;
  return Object.assign(auth, methods);
}

function makeSample(value = 'x'): SampleFile {
  return { version: 1, updatedAt: '2025-01-01T00:00:00.000Z', value };
}

describe('jsonToHttpHeader', () => {
  it('escapes non-ASCII characters', () => {
    expect(jsonToHttpHeader('café')).toBe('caf\\u00e9');
  });

  it('leaves ASCII unchanged', () => {
    expect(jsonToHttpHeader('/.vorbis/likes.json')).toBe('/.vorbis/likes.json');
  });
});

describe('downloadRemoteJson / uploadRemoteJson', () => {
  let mockAuth: DropboxAuthAdapter;

  beforeEach(() => {
    mockAuth = createMockAuth();
    vi.mocked(ensureVorbisFolder).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const transport = () => ({
    auth: mockAuth,
    path: '/.vorbis/sample.json',
    expectedVersion: 1,
    logLabel: 'SampleStore',
  });

  it('download returns null when unauthenticated', async () => {
    vi.mocked(mockAuth.ensureValidToken).mockResolvedValue(null);
    expect(await downloadRemoteJson(transport())).toBeNull();
  });

  it('download returns null on 409', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 409, ok: false }));
    expect(await downloadRemoteJson(transport())).toBeNull();
  });

  it('download returns null on version mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ version: 99, value: 'x' }),
    }));
    expect(await downloadRemoteJson(transport())).toBeNull();
  });

  it('download parses a valid file', async () => {
    const remote = makeSample('hello');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(remote),
    }));
    expect(await downloadRemoteJson<SampleFile>(transport())).toEqual(remote);
  });

  it('upload ensures folder then uploads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));
    expect(await uploadRemoteJson(transport(), makeSample())).toBe(true);
    expect(ensureVorbisFolder).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('upload returns false when folder ensure fails', async () => {
    vi.mocked(ensureVorbisFolder).mockResolvedValueOnce(false);
    expect(await uploadRemoteJson(transport(), makeSample())).toBe(false);
  });

  it('upload uses custom encodeApiArg', async () => {
    const encode = vi.fn((s: string) => `ENC:${s}`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));
    await uploadRemoteJson({ ...transport(), encodeApiArg: encode }, makeSample());
    expect(encode).toHaveBeenCalled();
    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Dropbox-API-Arg']).toMatch(/^ENC:/);
  });
});

describe('RemoteJsonFileStore', () => {
  let mockAuth: DropboxAuthAdapter;
  let buildPayload: ReturnType<typeof vi.fn<() => Promise<SampleFile>>>;
  let onUploadSuccess: ReturnType<typeof vi.fn<(data: SampleFile) => void>>;
  let store: RemoteJsonFileStore<SampleFile>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAuth = createMockAuth();
    vi.mocked(ensureVorbisFolder).mockResolvedValue(true);
    buildPayload = vi.fn(async () => makeSample('built'));
    onUploadSuccess = vi.fn();
    store = new RemoteJsonFileStore({
      auth: mockAuth,
      path: '/.vorbis/sample.json',
      expectedVersion: 1,
      logLabel: 'SampleStore',
      buildPayload,
      onUploadSuccess,
    });
  });

  afterEach(() => {
    store.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('schedulePush debounces to a single upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));

    store.schedulePush();
    store.schedulePush();
    store.schedulePush();
    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2500);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(buildPayload).toHaveBeenCalledTimes(1);
    expect(onUploadSuccess).toHaveBeenCalledWith(expect.objectContaining({ value: 'built' }));
  });

  it('pushNow single-flights overlapping calls', async () => {
    let resolveFetch!: (value: { status: number; ok: boolean }) => void;
    const fetchPromise = new Promise<{ status: number; ok: boolean }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    const first = store.pushNow();
    const second = store.pushNow();

    resolveFetch({ status: 200, ok: true });
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe(true);
    expect(b).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
