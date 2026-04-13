import styled from 'styled-components';
import { Card } from '../styled';
import { theme } from '@/styles/theme';

export const PageContainer = styled.div`
  width: 100%;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 1rem;

  @media (max-width: ${theme.breakpoints.lg}) {
    padding: 0.5rem;
  }
`;

export const PageSelectionCard = styled(Card)<{ $maxWidth: number }>`
  width: 100%;
  max-width: ${({ $maxWidth }) => `${$maxWidth}px`};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(12px);
  border: 1px solid ${theme.colors.control.border};
  border-radius: 1.25rem;
  box-shadow: ${theme.shadows.albumArt};
  display: flex;
  flex-direction: column;
  max-height: min(90dvh, 900px);
`;

export const DrawerContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 ${theme.spacing.md};
  overflow: hidden;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
`;
