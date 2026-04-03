import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { makeProviderDescriptor } from '@/test/fixtures';
import type { ProviderDescriptor } from '@/types/providers';

const mockSetActiveProviderId = vi.fn();
const mockToggleProvider = vi.fn();
let mockProviderContextValue: Record<string, unknown>;

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => mockProviderContextValue),
}));

import ProviderSetupScreen from '../ProviderSetupScreen';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

function buildProviderContext(overrides: Record<string, unknown> = {}) {
  const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
  const dropboxDesc = makeProviderDescriptor({
    id: 'dropbox' as 'spotify',
    name: 'Dropbox',
    capabilities: { hasSaveTrack: true, hasExternalLink: false, hasLikedCollection: true },
  });

  return {
    chosenProviderId: null,
    activeDescriptor: spotifyDesc,
    setActiveProviderId: mockSetActiveProviderId,
    registry: { getAll: () => [spotifyDesc, dropboxDesc] },
    enabledProviderIds: ['spotify', 'dropbox'],
    toggleProvider: mockToggleProvider,
    ...overrides,
  };
}

describe('ProviderSetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProviderContextValue = buildProviderContext();
  });

  describe('first visit (chosenProviderId is null)', () => {
    it('renders welcome title', () => {
      // #given
      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Welcome to Vorbis Player')).toBeInTheDocument();
    });

    it('renders all registered providers', () => {
      // #given
      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
    });

    it('shows Connect buttons for unauthenticated providers', () => {
      // #given
      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      const connectButtons = screen.getAllByText('Connect');
      expect(connectButtons).toHaveLength(2);
    });

    it('shows Connected badge for authenticated providers', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      vi.mocked(spotifyDesc.auth.isAuthenticated).mockReturnValue(true);
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });

      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc, dropboxDesc] },
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getAllByText('Connect')).toHaveLength(1);
    });

    it('shows Continue button when at least one provider is authenticated', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      vi.mocked(spotifyDesc.auth.isAuthenticated).mockReturnValue(true);
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });

      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc, dropboxDesc] },
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('does not show Continue button when no providers are authenticated', () => {
      // #given
      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
    });

    it('shows simplified subtitle for single provider', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc] },
        enabledProviderIds: ['spotify'],
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Connect your music provider to get started')).toBeInTheDocument();
    });

    it('does not render provider toggle switches for a single provider', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc] },
        enabledProviderIds: ['spotify'],
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('renders provider toggle switches for multiple providers', () => {
      // #given
      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(2);
    });
  });

  describe('interactions', () => {
    it('calls beginLogin when Connect is clicked', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });
      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc, dropboxDesc] },
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #when
      fireEvent.click(screen.getAllByText('Connect')[0]);

      // #then
      expect(spotifyDesc.auth.beginLogin).toHaveBeenCalledWith({ popup: true });
    });

    it('calls setActiveProviderId when Continue is clicked', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      vi.mocked(spotifyDesc.auth.isAuthenticated).mockReturnValue(true);
      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc] },
        enabledProviderIds: ['spotify'],
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #when
      fireEvent.click(screen.getByText('Continue'));

      // #then
      expect(mockSetActiveProviderId).toHaveBeenCalledWith('spotify');
    });

    it('renders settings gear button when onOpenSettings is provided', () => {
      // #given
      const onOpenSettings = vi.fn();
      render(<Wrapper><ProviderSetupScreen onOpenSettings={onOpenSettings} /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Open settings'));

      // #then
      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('renders Browse Library link when authenticated and onOpenLibrary is provided', () => {
      // #given
      const onOpenLibrary = vi.fn();
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      vi.mocked(spotifyDesc.auth.isAuthenticated).mockReturnValue(true);
      mockProviderContextValue = buildProviderContext({
        registry: { getAll: () => [spotifyDesc] },
        enabledProviderIds: ['spotify'],
      });

      render(<Wrapper><ProviderSetupScreen onOpenLibrary={onOpenLibrary} /></Wrapper>);

      // #when
      fireEvent.click(screen.getByText('Browse Library'));

      // #then
      expect(onOpenLibrary).toHaveBeenCalled();
    });
  });

  describe('expired session (chosenProviderId is set)', () => {
    it('renders Session Expired title', () => {
      // #given
      mockProviderContextValue = buildProviderContext({
        chosenProviderId: 'spotify',
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Session Expired')).toBeInTheDocument();
    });

    it('shows Expired badge and Reconnect button for expired providers', () => {
      // #given
      mockProviderContextValue = buildProviderContext({
        chosenProviderId: 'spotify',
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getAllByText('Expired')).toHaveLength(2);
      expect(screen.getAllByText('Reconnect')).toHaveLength(2);
    });

    it('shows Connected badge for still-authenticated providers in expired view', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      vi.mocked(spotifyDesc.auth.isAuthenticated).mockReturnValue(true);
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });

      mockProviderContextValue = buildProviderContext({
        chosenProviderId: 'spotify',
        registry: { getAll: () => [spotifyDesc, dropboxDesc] },
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getAllByText('Reconnect')).toHaveLength(1);
    });

    it('calls beginLogin when Reconnect is clicked on expired view', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });

      mockProviderContextValue = buildProviderContext({
        chosenProviderId: 'spotify',
        registry: { getAll: () => [spotifyDesc, dropboxDesc] },
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #when
      fireEvent.click(screen.getAllByText('Reconnect')[0]);

      // #then
      expect(mockSetActiveProviderId).toHaveBeenCalled();
      expect(spotifyDesc.auth.beginLogin).toHaveBeenCalledWith({ popup: true });
    });

    it('shows singular subtitle for single expired provider', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      mockProviderContextValue = buildProviderContext({
        chosenProviderId: 'spotify',
        activeDescriptor: spotifyDesc,
        registry: { getAll: () => [spotifyDesc] },
        enabledProviderIds: ['spotify'],
      });

      render(<Wrapper><ProviderSetupScreen /></Wrapper>);

      // #then
      expect(
        screen.getByText(/Your Spotify session has expired/)
      ).toBeInTheDocument();
    });
  });
});
