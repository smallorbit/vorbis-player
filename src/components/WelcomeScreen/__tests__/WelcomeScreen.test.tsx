import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import WelcomeScreen from '../index';
import { WELCOME_SEEN_STORAGE_KEY } from '@/hooks/useWelcomeSeen';
import type { ProviderId } from '@/types/domain';

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: ({ provider }: { provider: string }) => (
    <span data-testid={`provider-icon-${provider}`} />
  ),
}));

import { useProviderContext } from '@/contexts/ProviderContext';

const mockUseProviderContext = vi.mocked(useProviderContext);

interface SetupOptions {
  enabled?: ProviderId[];
  connected?: ProviderId[];
}

function setupProviderContext({ enabled = [], connected = [] }: SetupOptions) {
  mockUseProviderContext.mockReturnValue({
    enabledProviderIds: enabled,
    connectedProviderIds: connected,
    getDescriptor: (id: ProviderId) => ({
      id,
      name: id === 'spotify' ? 'Spotify' : 'Dropbox',
    }),
  } as unknown as ReturnType<typeof useProviderContext>);
}

function renderWelcome(
  props: Partial<React.ComponentProps<typeof WelcomeScreen>> = {},
) {
  const onConnectProvider = props.onConnectProvider ?? vi.fn();
  const onBrowseLibrary = props.onBrowseLibrary ?? vi.fn();
  const onDismiss = props.onDismiss;

  const utils = render(
    <ThemeProvider theme={theme}>
      <WelcomeScreen
        onConnectProvider={onConnectProvider}
        onBrowseLibrary={onBrowseLibrary}
        onDismiss={onDismiss}
      />
    </ThemeProvider>,
  );

  return { ...utils, onConnectProvider, onBrowseLibrary, onDismiss };
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('renders the hero greeting', () => {
    // #given
    setupProviderContext({ enabled: ['spotify'], connected: [] });

    // #when
    renderWelcome();

    // #then
    expect(screen.getByText('Welcome to Vorbis Player')).toBeInTheDocument();
  });

  describe('primary CTA', () => {
    it('shows "Connect a provider" when no providers are connected', () => {
      // #given
      setupProviderContext({ enabled: ['spotify', 'dropbox'], connected: [] });

      // #when
      renderWelcome();

      // #then
      expect(screen.getByRole('button', { name: 'Connect a provider' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Browse your library' })).not.toBeInTheDocument();
    });

    it('shows "Browse your library" when at least one provider is connected', () => {
      // #given
      setupProviderContext({ enabled: ['spotify', 'dropbox'], connected: ['spotify'] });

      // #when
      renderWelcome();

      // #then
      expect(screen.getByRole('button', { name: 'Browse your library' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect a provider' })).not.toBeInTheDocument();
    });

    it('invokes onConnectProvider when clicked in the disconnected state', () => {
      // #given
      setupProviderContext({ enabled: ['spotify'], connected: [] });
      const { onConnectProvider, onBrowseLibrary } = renderWelcome();

      // #when
      fireEvent.click(screen.getByRole('button', { name: 'Connect a provider' }));

      // #then
      expect(onConnectProvider).toHaveBeenCalledTimes(1);
      expect(onBrowseLibrary).not.toHaveBeenCalled();
    });

    it('invokes onBrowseLibrary when clicked in the connected state', () => {
      // #given
      setupProviderContext({ enabled: ['spotify'], connected: ['spotify'] });
      const { onConnectProvider, onBrowseLibrary } = renderWelcome();

      // #when
      fireEvent.click(screen.getByRole('button', { name: 'Browse your library' }));

      // #then
      expect(onBrowseLibrary).toHaveBeenCalledTimes(1);
      expect(onConnectProvider).not.toHaveBeenCalled();
    });
  });

  describe('provider status block', () => {
    it('lists each enabled provider with its connection state', () => {
      // #given
      setupProviderContext({ enabled: ['spotify', 'dropbox'], connected: ['spotify'] });

      // #when
      renderWelcome();

      // #then
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });

    it('renders the empty hint when no providers are enabled', () => {
      // #given
      setupProviderContext({ enabled: [], connected: [] });

      // #when
      renderWelcome();

      // #then
      expect(
        screen.getByText(/No providers enabled yet/i),
      ).toBeInTheDocument();
    });
  });

  describe('dismiss-for-good control', () => {
    it('persists welcomeSeen=true via localStorage when clicked', () => {
      // #given
      setupProviderContext({ enabled: ['spotify'], connected: ['spotify'] });
      renderWelcome();

      // #when
      fireEvent.click(screen.getByRole('button', { name: /don't show this again/i }));

      // #then
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        WELCOME_SEEN_STORAGE_KEY,
        'true',
      );
    });

    it('invokes onDismiss callback when provided', () => {
      // #given
      setupProviderContext({ enabled: ['spotify'], connected: ['spotify'] });
      const onDismiss = vi.fn();
      renderWelcome({ onDismiss });

      // #when
      fireEvent.click(screen.getByRole('button', { name: /don't show this again/i }));

      // #then
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
