import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readLikedCountSnapshots,
  writeLikedCountSnapshot,
  clearLikedCountSnapshot,
} from '../likedCountSnapshot';
import { STORAGE_KEYS } from '@/constants/storage';

const STORAGE_KEY = STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS;

describe('likedCountSnapshot', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockReset();
  });

  describe('readLikedCountSnapshots', () => {
    it('returns empty object when no data exists', () => {
      // #given
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // #when
      const result = readLikedCountSnapshots();

      // #then
      expect(result).toEqual({});
    });

    it('handles malformed JSON gracefully', () => {
      // #given
      vi.mocked(localStorage.getItem).mockReturnValue('not-valid-json{{{');

      // #when
      const result = readLikedCountSnapshots();

      // #then
      expect(result).toEqual({});
    });
  });

  describe('writeLikedCountSnapshot', () => {
    it('persists a snapshot for a single provider', () => {
      // #given
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // #when
      writeLikedCountSnapshot('spotify', 42);

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ spotify: { count: 42, cachedAt: now } })
      );
    });

    it('preserves existing entries when writing a second provider', () => {
      // #given
      const existing = { spotify: { count: 10, cachedAt: 1000 } };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(existing));
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // #when
      writeLikedCountSnapshot('dropbox', 99);

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({
          spotify: { count: 10, cachedAt: 1000 },
          dropbox: { count: 99, cachedAt: now },
        })
      );
    });

    it('does not throw when localStorage quota is exceeded', () => {
      // #given
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      // #when / #then
      expect(() => writeLikedCountSnapshot('spotify', 5)).not.toThrow();
    });
  });

  describe('clearLikedCountSnapshot', () => {
    it('removes the specified provider without affecting others', () => {
      // #given
      const existing = {
        spotify: { count: 10, cachedAt: 1000 },
        dropbox: { count: 20, cachedAt: 2000 },
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(existing));

      // #when
      clearLikedCountSnapshot('spotify');

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ dropbox: { count: 20, cachedAt: 2000 } })
      );
    });
  });

  describe('writeLikedCountSnapshot + readLikedCountSnapshots round-trip', () => {
    it('reads back what was written for a single provider', () => {
      // #given
      const stored: Record<string, unknown> = {};
      vi.mocked(localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? (stored[key] as string ?? null) : null
      );
      vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
        stored[key] = value;
      });
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // #when
      writeLikedCountSnapshot('spotify', 77);
      const result = readLikedCountSnapshots();

      // #then
      expect(result).toEqual({ spotify: { count: 77, cachedAt: now } });
    });
  });
});
