import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeProviderDescriptor, makeMediaTrack } from '@/test/fixtures';
import type { ProviderDescriptor } from '@/types/providers';

// ── Context mocks ──────────────────────────────────────────────────────────

const mockToggleProvider = vi.fn();
const mockSetTracks = vi.fn();
const mockSetOriginalTracks = vi.fn();
const mockSetCurrentTrackIndex = vi.fn();

const mockRegistry = {
  getAll: vi.fn<[], ProviderDescriptor[]>(() => []),
  get: vi.fn<[string], ProviderDescriptor | undefined>(() => undefined),
  has: vi.fn(() => true),
};

let mockEnabledProviderIds: string[] = ['spotify', 'dropbox'];
let mockTracks: ReturnType<typeof makeMediaTrack>[] = [];
let mockCurrentTrackIndex = 0;

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    registry: mockRegistry,
    enabledProviderIds: mockEnabledProviderIds,
    toggleProvider: mockToggleProvider,
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    tracks: mockTracks,
    setTracks: mockSetTracks,
    setOriginalTracks: mockSetOriginalTracks,
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrackIndex: mockCurrentTrackIndex,
    setCurrentTrackIndex: mockSetCurrentTrackIndex,
  })),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => [defaultValue, vi.fn()]),
}));

// Import after mocks are set up
import { MusicSourcesSection } from '../SourcesSections';
import { Toaster } from '@/components/ui/sonner';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Toaster />
    {children}
  </ThemeProvider>
);

function makeSpotifyDescriptor(authOverrides?: Partial<ProviderDescriptor['auth']>): ProviderDescriptor {
  return makeProviderDescriptor({
    id: 'spotify',
    name: 'Spotify',
    auth: {
      ...makeProviderDescriptor().auth,
      isAuthenticated: vi.fn().mockReturnValue(true),
      ...authOverrides,
    },
  });
}

function makeDropboxDescriptor(authOverrides?: Partial<ProviderDescriptor['auth']>): ProviderDescriptor {
  return makeProviderDescriptor({
    id: 'dropbox' as 'spotify',
    name: 'Dropbox',
    auth: {
      ...makeProviderDescriptor().auth,
      isAuthenticated: vi.fn().mockReturnValue(true),
      ...authOverrides,
    },
  });
}

describe('MusicSourcesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabledProviderIds = ['spotify', 'dropbox'];
    mockTracks = [];
    mockCurrentTrackIndex = 0;
    mockRegistry.getAll.mockReturnValue([]);
    mockRegistry.get.mockReturnValue(undefined);
  });

  describe('toggle-off: disconnect dialog flow', () => {
    it('opens ProviderDisconnectDialog when an enabled provider with queued tracks is toggled off', () => {
      // #given
      mockTracks = [makeMediaTrack({ id: 'track-1', provider: 'spotify' })];
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      const spotifyToggle = screen.getByLabelText('Disable Spotify');
      fireEvent.click(spotifyToggle);

      // #then
      expect(screen.getByText('Disconnect Spotify')).toBeInTheDocument();
    });

    it('calls descriptor.auth.logout() and toggleProvider when dialog is confirmed', () => {
      // #given
      mockTracks = [makeMediaTrack({ id: 'track-1', provider: 'spotify' })];
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      render(<Wrapper><MusicSourcesSection /></Wrapper>);
      fireEvent.click(screen.getByLabelText('Disable Spotify'));
      expect(screen.getByText('Disconnect Spotify')).toBeInTheDocument();

      // #when
      fireEvent.click(screen.getByText('Disconnect'));

      // #then
      expect(spotifyDesc.auth.logout).toHaveBeenCalledOnce();
      expect(mockToggleProvider).toHaveBeenCalledWith('spotify');
    });

    it('closes the dialog and leaves state unchanged when Cancel is clicked', () => {
      // #given
      mockTracks = [makeMediaTrack({ id: 'track-1', provider: 'spotify' })];
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockReturnValue(spotifyDesc);
      render(<Wrapper><MusicSourcesSection /></Wrapper>);
      fireEvent.click(screen.getByLabelText('Disable Spotify'));

      // #when
      fireEvent.click(screen.getByText('Cancel'));

      // #then
      expect(screen.queryByText('Disconnect Spotify')).not.toBeInTheDocument();
      expect(spotifyDesc.auth.logout).not.toHaveBeenCalled();
      expect(mockToggleProvider).not.toHaveBeenCalled();
    });

    it('performs logout and toggleProvider immediately without opening the dialog when the provider has no queued tracks', () => {
      // #given — only dropbox has queued tracks; toggling off spotify should skip the prompt
      mockTracks = [makeMediaTrack({ id: 'track-1', provider: 'dropbox' as 'spotify' })];
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Disable Spotify'));

      // #then
      expect(screen.queryByText('Disconnect Spotify')).not.toBeInTheDocument();
      expect(spotifyDesc.auth.logout).toHaveBeenCalledOnce();
      expect(mockToggleProvider).toHaveBeenCalledWith('spotify');
    });

    it('shows affected-track count in disconnect dialog when provider has queued tracks', () => {
      // #given
      const spotifyTrack1 = makeMediaTrack({ id: 'track-1', provider: 'spotify' });
      const spotifyTrack2 = makeMediaTrack({ id: 'track-2', provider: 'spotify' });
      const dropboxTrack = makeMediaTrack({ id: 'track-3', provider: 'dropbox' as 'spotify' });
      mockTracks = [spotifyTrack1, spotifyTrack2, dropboxTrack];

      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Disable Spotify'));

      // #then
      expect(screen.getByText(/remove 2 queued tracks/i)).toBeInTheDocument();
    });
  });

  describe('toggle-on: silent enable when authenticated', () => {
    it('calls toggleProvider directly without opening a popup when provider is already authenticated', () => {
      // #given
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(true) });
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Enable Spotify'));

      // #then
      expect(mockToggleProvider).toHaveBeenCalledWith('spotify');
      expect(spotifyDesc.auth.beginLogin).not.toHaveBeenCalled();
    });
  });

  describe('toggle-on: unauthenticated provider login', () => {
    it('calls descriptor.auth.beginLogin when provider is not authenticated', async () => {
      // #given
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(false) });
      vi.mocked(spotifyDesc.auth.beginLogin).mockResolvedValue(undefined);
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );

      // Stub window.open to simulate a popup that never closes
      const mockPopup = { closed: false } as Window;
      vi.spyOn(window, 'open').mockReturnValue(mockPopup);

      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Enable Spotify'));

      // #then
      await waitFor(() => {
        expect(spotifyDesc.auth.beginLogin).toHaveBeenCalledWith({ popup: true });
      });
    });
  });

  describe('toggle-on: OAuth cancellation/failure', () => {
    it('shows error toast when beginLogin promise rejects', async () => {
      // #given
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(false) });
      vi.mocked(spotifyDesc.auth.beginLogin).mockRejectedValue(new Error('popup blocked'));
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );

      // window.open returns null to simulate blocked popup, triggering the error path
      vi.spyOn(window, 'open').mockReturnValue(null);

      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Enable Spotify'));

      // #then — toast appears with the correct copy
      await waitFor(() => {
        expect(screen.getByText(/Couldn't connect to Spotify/i)).toBeInTheDocument();
      });
      expect(mockToggleProvider).not.toHaveBeenCalled();
    });

    it('shows error toast and does not enable the provider when the popup is dismissed (closed without completing OAuth)', async () => {
      // #given — provider not yet authenticated, beginLogin opens a popup that closes immediately
      const isAuthenticated = vi.fn().mockReturnValue(false);
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated });
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );

      // The popup window is immediately closed (user dismissed the OAuth popup)
      const mockPopupObj = { closed: true };
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'open');
      Object.defineProperty(window, 'open', {
        value: () => mockPopupObj,
        writable: true,
        configurable: true,
      });
      vi.mocked(spotifyDesc.auth.beginLogin).mockImplementation(async () => {
        window.open('https://accounts.spotify.com/authorize', '_blank');
      });

      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Enable Spotify'));
      await waitFor(() => expect(spotifyDesc.auth.beginLogin).toHaveBeenCalled());

      // #then — poll detects closed popup within 500ms and shows the error toast
      await waitFor(
        () => {
          expect(screen.getByText(/Couldn't connect to Spotify/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
      expect(mockToggleProvider).not.toHaveBeenCalled();

      // Restore original window.open property descriptor
      if (originalDescriptor) {
        Object.defineProperty(window, 'open', originalDescriptor);
      }
    });
  });

  describe('last-enabled guard', () => {
    it('disables the toggle for the sole remaining enabled provider', () => {
      // #given — only one provider is enabled
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['spotify'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );

      // #when
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #then
      expect(screen.getByLabelText('Disable Spotify')).toBeDisabled();
    });

    it('does not disable the toggle when multiple providers are enabled', () => {
      // #given
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['spotify', 'dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);

      // #when
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #then
      expect(screen.getByLabelText('Disable Spotify')).not.toBeDisabled();
    });
  });

  describe('Reconnect button', () => {
    it('has no Reconnect button in the rendered DOM', () => {
      // #given
      const spotifyDesc = makeSpotifyDescriptor();
      const dropboxDesc = makeDropboxDescriptor();
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);

      // #when
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #then
      expect(screen.queryByRole('button', { name: /reconnect/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/reconnect/i)).not.toBeInTheDocument();
    });
  });

  describe('session-expired: provider toggles off (no reconnect affordance)', () => {
    it('does not render a "Reconnect needed" badge when a provider is enabled but auth has expired', () => {
      // #given — Spotify is enabled but its auth token has expired
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(false) });
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['spotify', 'dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);

      // #when
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #then — the third "reconnect" state is gone
      expect(screen.queryByText('Reconnect needed')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Reconnect Spotify')).not.toBeInTheDocument();
    });

    it('shows Spotify toggle as unchecked once SESSION_EXPIRED has removed it from enabledProviderIds', () => {
      // #given — SESSION_EXPIRED handler in ProviderContext has already removed Spotify
      // from the enabled set; Dropbox stays enabled+connected
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(false) });
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);

      // #when
      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #then — Spotify toggle reads "Enable Spotify" (i.e. off) and is unchecked
      const spotifyToggle = screen.getByLabelText('Enable Spotify');
      expect(spotifyToggle).toHaveAttribute('aria-checked', 'false');
      // Dropbox toggle stays on
      const dropboxToggle = screen.getByLabelText('Disable Dropbox');
      expect(dropboxToggle).toHaveAttribute('aria-checked', 'true');
    });

    it('routes a re-enable click on the expired provider through the standard OAuth flow', async () => {
      // #given — Spotify has been toggled off (session expired); user is about to flip it back on
      const spotifyDesc = makeSpotifyDescriptor({ isAuthenticated: vi.fn().mockReturnValue(false) });
      vi.mocked(spotifyDesc.auth.beginLogin).mockResolvedValue(undefined);
      const dropboxDesc = makeDropboxDescriptor();
      mockEnabledProviderIds = ['dropbox'];
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);
      mockRegistry.get.mockImplementation((id: string) =>
        id === 'spotify' ? spotifyDesc : dropboxDesc,
      );
      const mockPopup = { closed: false } as Window;
      vi.spyOn(window, 'open').mockReturnValue(mockPopup);

      render(<Wrapper><MusicSourcesSection /></Wrapper>);

      // #when — user flips the off toggle back on
      fireEvent.click(screen.getByLabelText('Enable Spotify'));

      // #then — standard "toggle on while not authenticated" flow kicks off OAuth
      await waitFor(() => {
        expect(spotifyDesc.auth.beginLogin).toHaveBeenCalledWith({ popup: true });
      });
    });
  });
});
