import styled from 'styled-components';

export const FilterSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.popover.border};
  padding-top: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const SectionTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
`;

export const FilterGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const ProviderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
`;

export const ProviderName = styled.span`
  font-size: 0.8125rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
`;

export const ProviderStatusBadge = styled.span<{ $status: 'connected' | 'disabled' }>`
  font-size: 0.6875rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ $status, theme }) =>
    $status === 'connected'
      ? theme.colors.success
      : theme.colors.muted.foreground};
  flex: 1;
`;
