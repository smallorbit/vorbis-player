import styled from 'styled-components';
import { Card } from '../styled';
import { theme } from '@/styles/theme';

export const PageContainer = styled.div<{ $overlay?: boolean }>`
  width: 100%;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: ${({ $overlay }) => ($overlay ? 'stretch' : 'center')};
  justify-content: center;
  padding: ${({ $overlay }) => ($overlay ? '0' : '1rem')};

  @media (max-width: ${theme.breakpoints.lg}) {
    padding: ${({ $overlay }) => ($overlay ? '0' : '0.5rem')};
  }
`;

export const PageSelectionCard = styled(Card)<{ $maxWidth: number; $overlay?: boolean }>`
  width: 100%;
  max-width: ${({ $maxWidth, $overlay }) => ($overlay ? '100%' : `${$maxWidth}px`)};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(12px);
  border: ${({ $overlay }) => ($overlay ? 'none' : `1px solid ${theme.colors.control.border}`)};
  border-radius: ${({ $overlay }) => ($overlay ? '0' : '1.25rem')};
  box-shadow: ${({ $overlay }) => ($overlay ? 'none' : theme.shadows.albumArt)};
  display: flex;
  flex-direction: column;
  max-height: ${({ $overlay }) => ($overlay ? '100dvh' : 'min(90dvh, 900px)')};
`;

export const DrawerContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
`;
