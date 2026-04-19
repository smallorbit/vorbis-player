import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const WelcomeRoot = styled.div`
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
`;

export const WelcomeContent = styled.div`
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

export const HeroTitle = styled.h1`
  color: ${theme.colors.white};
  font-size: ${theme.fontSize['3xl']};
  font-weight: ${theme.fontWeight.bold};
  margin: 0;
  letter-spacing: -0.02em;
  text-shadow: ${theme.shadows.textMd};

  @container (min-width: 600px) {
    font-size: ${theme.fontSize['4xl']};
  }
`;

export const HeroSubtitle = styled.p`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.base};
  margin: 0;
  line-height: 1.5;
`;

export const ProviderStatusBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  width: 100%;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border: 1px solid ${theme.colors.borderSubtle};
  border-radius: ${theme.borderRadius.xl};
  background: rgba(255, 255, 255, 0.04);
`;

export const ProviderStatusHeading = styled.div`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

export const ProviderStatusList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

export const ProviderStatusItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.foreground};
`;

export const ProviderStatusLabel = styled.span`
  flex: 1;
  text-align: left;
`;

export const ProviderStatusPill = styled.span<{ $connected: boolean }>`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  padding: 2px ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.full};
  color: ${({ $connected }) => ($connected ? theme.colors.success : theme.colors.muted.foreground)};
  background: ${({ $connected }) =>
    $connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.06)'};
  border: 1px solid
    ${({ $connected }) =>
      $connected ? 'rgba(16, 185, 129, 0.35)' : theme.colors.borderSubtle};
`;

export const ProviderStatusEmpty = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.muted.foreground};
  line-height: 1.4;
  text-align: left;
`;

export const CtaRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${theme.spacing.sm};
  width: 100%;
`;

export const PrimaryCta = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  width: 100%;
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

export const DismissButton = styled.button`
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
