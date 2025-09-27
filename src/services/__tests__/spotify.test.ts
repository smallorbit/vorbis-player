import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the entire spotify module
vi.mock('../spotify', () => {
  const mockSpotifyAuth = {
    ensureValidToken: vi.fn()
  };

  return {
    spotifyAuth: mockSpotifyAuth,
    checkTrackSaved: vi.fn(),
    saveTrack: vi.fn(),
    unsaveTrack: vi.fn()
  };
});

// Import mocked functions
import { checkTrackSaved, saveTrack, unsaveTrack } from '../spotify';

describe('Spotify API Functions', () => {
  const mockToken = 'mock-access-token';
  const mockTrackId = 'spotify-track-id-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ensureValidToken to return a mock token
    mockSpotifyAuth.ensureValidToken.mockResolvedValue(mockToken);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTrackSaved', () => {
    it('should return true when track is saved', async () => {
      // Mock successful API response indicating track is saved
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      const result = await checkTrackSaved(mockTrackId);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.spotify.com/v1/me/tracks/contains?ids=${mockTrackId}`,
        {
          headers: { 'Authorization': `Bearer ${mockToken}` }
        }
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should return false when track is not saved', async () => {
      // Mock successful API response indicating track is not saved
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([false])
      });

      const result = await checkTrackSaved(mockTrackId);

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.spotify.com/v1/me/tracks/contains?ids=${mockTrackId}`,
        {
          headers: { 'Authorization': `Bearer ${mockToken}` }
        }
      );
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(checkTrackSaved(mockTrackId)).rejects.toThrow(
        'Failed to check track saved status: 401'
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(checkTrackSaved(mockTrackId)).rejects.toThrow('Network error');
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle token refresh scenarios', async () => {
      // Mock token refresh scenario
      mockSpotifyAuth.ensureValidToken.mockResolvedValueOnce('refreshed-token');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      const result = await checkTrackSaved(mockTrackId);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.spotify.com/v1/me/tracks/contains?ids=${mockTrackId}`,
        {
          headers: { 'Authorization': 'Bearer refreshed-token' }
        }
      );
    });

    it('should handle empty or invalid track IDs', async () => {
      const emptyTrackId = '';
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      await expect(checkTrackSaved(emptyTrackId)).rejects.toThrow(
        'Failed to check track saved status: 400'
      );
    });
  });

  describe('saveTrack', () => {
    it('should successfully save a track', async () => {
      // Mock successful save response
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(saveTrack(mockTrackId)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/tracks',
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids: [mockTrackId] })
        }
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle save API errors', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      });

      await expect(saveTrack(mockTrackId)).rejects.toThrow(
        'Failed to save track: 403'
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle unauthorized errors', async () => {
      // Mock unauthorized response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(saveTrack(mockTrackId)).rejects.toThrow(
        'Failed to save track: 401'
      );
    });

    it('should handle network errors during save', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(saveTrack(mockTrackId)).rejects.toThrow('Connection failed');
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should send correct request format', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveTrack(mockTrackId);

      // Verify the request was made with correct body format
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options.method).toBe('PUT');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ ids: [mockTrackId] });
    });

    it('should handle token authentication flow', async () => {
      // Mock token retrieval
      mockSpotifyAuth.ensureValidToken.mockResolvedValueOnce('auth-token-123');
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveTrack(mockTrackId);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/tracks',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer auth-token-123'
          })
        })
      );
    });
  });

  describe('unsaveTrack', () => {
    it('should successfully remove a track', async () => {
      // Mock successful remove response
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(unsaveTrack(mockTrackId)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/tracks',
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids: [mockTrackId] })
        }
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle unsave API errors', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(unsaveTrack(mockTrackId)).rejects.toThrow(
        'Failed to unsave track: 404'
      );
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should handle forbidden errors', async () => {
      // Mock forbidden response (insufficient permissions)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      });

      await expect(unsaveTrack(mockTrackId)).rejects.toThrow(
        'Failed to unsave track: 403'
      );
    });

    it('should handle network errors during unsave', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(unsaveTrack(mockTrackId)).rejects.toThrow('Request timeout');
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledOnce();
    });

    it('should send correct DELETE request format', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await unsaveTrack(mockTrackId);

      // Verify the request was made with correct DELETE method and body
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options.method).toBe('DELETE');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ ids: [mockTrackId] });
    });

    it('should handle rate limiting scenarios', async () => {
      // Mock rate limited response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      });

      await expect(unsaveTrack(mockTrackId)).rejects.toThrow(
        'Failed to unsave track: 429'
      );
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed API responses', async () => {
      // Mock malformed JSON response for checkTrackSaved
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(checkTrackSaved(mockTrackId)).rejects.toThrow('Invalid JSON');
    });

    it('should handle token refresh failures', async () => {
      // Mock token refresh failure
      mockSpotifyAuth.ensureValidToken.mockRejectedValueOnce(
        new Error('Token refresh failed')
      );

      await expect(checkTrackSaved(mockTrackId)).rejects.toThrow('Token refresh failed');
      await expect(saveTrack(mockTrackId)).rejects.toThrow('Token refresh failed');
      await expect(unsaveTrack(mockTrackId)).rejects.toThrow('Token refresh failed');
    });

    it('should handle concurrent requests', async () => {
      // Mock multiple concurrent requests
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([true]) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const promises = [
        checkTrackSaved(mockTrackId),
        saveTrack('track-1'),
        unsaveTrack('track-2')
      ];

      await Promise.all(promises);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledTimes(3);
    });

    it('should handle empty responses', async () => {
      // Mock empty response for checkTrackSaved
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const result = await checkTrackSaved(mockTrackId);
      
      // Should handle empty array gracefully (returns undefined/falsy)
      expect(result).toBeFalsy();
    });
  });

  describe('Authentication integration', () => {
    it('should call ensureValidToken before each API call', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([true]) });

      await checkTrackSaved(mockTrackId);
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledTimes(1);

      mockFetch.mockResolvedValue({ ok: true });
      await saveTrack(mockTrackId);
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledTimes(2);

      await unsaveTrack(mockTrackId);
      expect(mockSpotifyAuth.ensureValidToken).toHaveBeenCalledTimes(3);
    });

    it('should use the token returned by ensureValidToken', async () => {
      const customToken = 'custom-token-value';
      mockSpotifyAuth.ensureValidToken.mockResolvedValue(customToken);
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([false]) });

      await checkTrackSaved(mockTrackId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${customToken}`
          })
        })
      );
    });
  });
});