import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

export const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const stepEnter = keyframes`
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

export const swipeHint = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-18px);
  }
`;

export const barPulse = keyframes`
  0%, 100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
`;

export const OnboardingRoot = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid ${theme.colors.border};
  box-shadow: ${theme.shadows.albumArt};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding: ${theme.spacing['2xl']} ${theme.spacing.xl};
  animation: ${fadeInUp} 0.35s ease-out;
  container-type: inline-size;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 0.01ms;
  }
`;

export const OnboardingContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: ${theme.spacing.lg};
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  flex: 1;
`;

export const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.md};
  width: 100%;
  animation: ${stepEnter} 0.28s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 0.01ms;
  }
`;

export const StepTitle = styled.h2`
  font-size: ${theme.fontSize['2xl']};
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.white};
  margin: 0;
  letter-spacing: -0.02em;
`;

export const StepDescription = styled.p`
  font-size: ${theme.fontSize.base};
  color: ${theme.colors.muted.foreground};
  margin: 0;
  line-height: 1.5;
`;

export const StepIllustration = styled.div`
  width: 100%;
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.borderRadius.xl};
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid ${theme.colors.borderSubtle};
  overflow: hidden;
`;

export const DotsRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
`;

export const Dot = styled.div<{ $active: boolean }>`
  width: ${({ $active }) => ($active ? '20px' : '8px')};
  height: 8px;
  border-radius: ${theme.borderRadius.full};
  background: ${({ $active }) =>
    $active ? theme.colors.primary : theme.colors.borderSubtle};
  transition: width 0.2s ease, background 0.2s ease;
`;

export const NavRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: ${theme.spacing.sm};
`;

export const NavSpacer = styled.div`
  flex: 1;
`;

export const BackButton = styled.button`
  flex: 1;
  text-align: left;
  background: transparent;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  cursor: pointer;
  border-radius: ${theme.borderRadius.full};
  transition: color ${theme.transitions.fast}, background ${theme.transitions.fast};

  &:hover {
    color: ${theme.colors.foreground};
    background: rgba(255, 255, 255, 0.06);
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const SkipButton = styled.button`
  align-self: center;
  background: transparent;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  cursor: pointer;
  border-radius: ${theme.borderRadius.full};
  transition: color ${theme.transitions.fast}, background ${theme.transitions.fast};

  &:hover {
    color: ${theme.colors.foreground};
    background: rgba(255, 255, 255, 0.06);
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const NextButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  min-width: 120px;
  padding: ${theme.spacing.md} ${theme.spacing.xl};
  border-radius: ${theme.borderRadius.full};
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: ${theme.colors.accent};
  color: ${theme.colors.foregroundDark};
  font-size: ${theme.fontSize.base};
  font-weight: ${theme.fontWeight.semibold};
  cursor: pointer;
  transition: transform ${theme.transitions.fast}, background ${theme.transitions.fast};

  &:hover {
    background: ${theme.colors.accentHover};
  }

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const SwipeCardMock = styled.div`
  width: 120px;
  height: 72px;
  border-radius: ${theme.borderRadius.xl};
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid ${theme.colors.borderSubtle};
  animation: ${swipeHint} 2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const BarGroup = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 48px;
`;

export const Bar = styled.div<{ $delay: number }>`
  width: 4px;
  height: 100%;
  border-radius: 2px;
  background: ${theme.colors.primary};
  opacity: 0.7;
  transform-origin: bottom;
  animation: ${barPulse} 0.9s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}ms;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    height: 24px;
  }
`;

export const ZenMockScreen = styled.div`
  width: 80px;
  height: 56px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: ${theme.borderRadius.lg};
  position: relative;
`;

export const ZenMockAlbumArt = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const ZenKbdBadge = styled.span`
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.foreground};
  display: flex;
  align-items: center;
  justify-content: center;
`;
