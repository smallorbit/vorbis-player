import React from 'react';
import styled, { keyframes } from 'styled-components';
import { cardBase } from '@/styles/utils';

const pulseWave = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

/** Full-bleed idle card chrome shared by loading and connect surfaces. */
export const PlayerStateIdleCardShell = styled.div`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.albumArt};
  background: ${({ theme }) => theme.colors.muted.background};
  backdrop-filter: blur(12px);
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  z-index: 2;
  position: relative;
`;

const MusicIcon = styled.div`
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.cta}, ${({ theme }) => theme.colors.ctaHover});
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  animation: ${pulseWave} 2s ease-in-out infinite;
  box-shadow: 0 8px 32px ${({ theme }) => theme.colors.cta}4d;

  &::before {
    content: '♪';
    color: ${({ theme }) => theme.colors.foregroundDark};
    font-size: ${({ theme }) => theme.fontSize['2xl']};
    font-weight: ${({ theme }) => theme.fontWeight.bold};
  }
`;

const LoadingText = styled.div`
  text-align: center;
  animation: ${fadeInUp} 0.6s ease-out;
`;

const LoadingTitle = styled.h3`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.muted.foreground},
    ${({ theme }) => theme.colors.white},
    ${({ theme }) => theme.colors.muted.foreground}
  );
  background-size: 200px 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 2s infinite linear;
`;

const LoadingSubtext = styled.p`
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin: 0;
  line-height: 1.4;
`;

const ProgressBar = styled.div`
  width: 200px;
  height: 3px;
  background: ${({ theme }) => theme.colors.control.background};
  border-radius: 1.5px;
  margin-top: 1.5rem;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, ${({ theme }) => theme.colors.cta}, transparent);
    animation: ${shimmer} 1.5s infinite linear;
  }
`;

export interface PlayerStateIdleLoadingCardProps {
  title: string;
  subtext: string;
}

export function PlayerStateIdleLoadingCard({
  title,
  subtext,
}: PlayerStateIdleLoadingCardProps): React.ReactElement {
  return (
    <PlayerStateIdleCardShell>
      <LoadingContainer>
        <MusicIcon />
        <LoadingText>
          <LoadingTitle>{title}</LoadingTitle>
          <LoadingSubtext>{subtext}</LoadingSubtext>
        </LoadingText>
        <ProgressBar />
      </LoadingContainer>
    </PlayerStateIdleCardShell>
  );
}
