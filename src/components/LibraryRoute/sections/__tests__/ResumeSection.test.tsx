/**
 * Tests for ResumeSection — renders the ResumeHero card when a resumable session exists (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionSnapshot } from '@/services/sessionPersistence';

vi.mock('../../hooks', () => ({
  useResumeSection: vi.fn(),
}));

import { useResumeSection } from '../../hooks';
import ResumeSection from '../ResumeSection';

const mockUseResumeSection = vi.mocked(useResumeSection);

const makeSession = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  collectionId: 'pl1',
  collectionName: 'My Playlist',
  trackIndex: 0,
  trackTitle: 'Song Title',
  trackArtist: 'The Artist',
  trackImage: 'https://example.com/art.jpg',
  savedAt: Date.now(),
  ...overrides,
});

const baseProps = {
  lastSession: makeSession(),
  onResume: vi.fn(),
};

describe('ResumeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when hasResumable is false', () => {
    // #given
    mockUseResumeSection.mockReturnValue({ session: null, hasResumable: false });

    // #when
    const { container } = render(<ResumeSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when onResume is not provided', () => {
    // #given
    const session = makeSession();
    mockUseResumeSection.mockReturnValue({ session, hasResumable: true });

    // #when
    const { container } = render(<ResumeSection lastSession={session} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders ResumeHero when hasResumable is true', () => {
    // #given
    const session = makeSession({ trackTitle: 'Bohemian Rhapsody' });
    mockUseResumeSection.mockReturnValue({ session, hasResumable: true });

    // #when
    render(<ResumeSection {...baseProps} lastSession={session} />);

    // #then
    expect(screen.getByTestId('library-section-resume')).toBeInTheDocument();
  });

  it('displays the session track title in ResumeHero', () => {
    // #given
    const session = makeSession({ trackTitle: 'Hotel California' });
    mockUseResumeSection.mockReturnValue({ session, hasResumable: true });

    // #when
    render(<ResumeSection {...baseProps} lastSession={session} />);

    // #then
    expect(screen.getByText('Hotel California')).toBeInTheDocument();
  });

  it('calls onResume when the Resume button is clicked', () => {
    // #given
    const onResume = vi.fn();
    const session = makeSession();
    mockUseResumeSection.mockReturnValue({ session, hasResumable: true });

    // #when
    render(<ResumeSection lastSession={session} onResume={onResume} />);
    fireEvent.click(screen.getByTestId('library-resume-button'));

    // #then
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
