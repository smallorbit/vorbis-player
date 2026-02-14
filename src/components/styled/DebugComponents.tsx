import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const DebugSection = styled.div<{ $withBorderBottom?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  margin-top: ${theme.spacing.xs};
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  ${({ $withBorderBottom }) => $withBorderBottom && 'border-bottom: 1px dashed rgba(255, 255, 255, 0.2);'}
  width: ${({ $withBorderBottom }) => $withBorderBottom ? 'auto' : '100%'};
`;

export const DebugLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;
