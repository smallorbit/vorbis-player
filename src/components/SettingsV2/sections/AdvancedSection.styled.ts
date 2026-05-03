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

export const CacheOptionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const CacheOptionItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const CacheCheckbox = styled.input`
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: hsl(var(--input));
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:checked {
    background: hsl(var(--primary));
    border-color: hsl(var(--primary));
  }

  &:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: 2px solid hsl(var(--primary-foreground));
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

export const CacheButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ShortcutHintList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const ShortcutHintRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
`;

export const Kbd = styled.kbd`
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--foreground));
`;
