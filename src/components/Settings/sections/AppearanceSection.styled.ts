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

export const SubControlRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

export const SubControlLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-width: 64px;
`;

export const SwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

export const SwatchButton = styled.button<{ $color: string; $isActive: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: ${({ $isActive }) =>
    $isActive ? '2px solid hsl(var(--foreground))' : '1px solid hsl(var(--border))'};
  outline: ${({ $isActive }) => ($isActive ? '2px solid hsl(var(--ring))' : 'none')};
  outline-offset: 1px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border ${({ theme }) => theme.transitions.fast};

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

export const SwatchIconButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition:
    background ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;
