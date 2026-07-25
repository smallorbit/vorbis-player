import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
`;

export const ControlBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ControlRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ControlLabelText = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: hsl(var(--foreground));
  font-weight: ${({ theme }) => theme.fontWeight.medium};
`;

export const ControlHelp = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
`;

export const SectionGroupTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: hsl(var(--foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const Divider = styled.div`
  border-top: 1px solid hsl(var(--border));
`;

export const SliderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const SliderValue = styled.span`
  font-variant-numeric: tabular-nums;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
  min-width: 40px;
  text-align: right;
`;
