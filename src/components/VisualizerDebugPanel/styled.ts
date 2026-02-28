import styled from 'styled-components';

export const Panel = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  width: min(420px, calc(100vw - 2 * ${({ theme }) => theme.spacing.md}));
  max-height: calc(100dvh - 2 * ${({ theme }) => theme.spacing.md});
  overflow: auto;
  z-index: ${({ theme }) => theme.zIndex.uiOverlay};
  pointer-events: auto;
  background: ${({ theme }) => theme.colors.overlay.panel};
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.foreground};
  box-shadow: ${({ theme }) => theme.shadows.xl};
`;

export const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
`;

export const Section = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

export const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.foreground};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  cursor: pointer;
  text-align: left;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const ParamRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

export const ParamLabel = styled.label`
  flex: 0 0 140px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted.foreground};
`;

export const SliderInput = styled.input.attrs({ type: 'range' })`
  flex: 1;
  min-width: 0;
  height: 6px;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

export const NumberInput = styled.input.attrs({ type: 'number' })`
  width: 64px;
  padding: 2px 6px;
  font-size: 11px;
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  color: ${({ theme }) => theme.colors.foreground};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: 11px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  background: ${({ theme }) => theme.colors.control.background};
  color: ${({ theme }) => theme.colors.foreground};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }

  ${({ $variant, theme }) =>
    $variant === 'primary' &&
    `
    border-color: ${theme.colors.primary};
    background: ${theme.colors.primary};
    color: ${theme.colors.white};
    &:hover { filter: brightness(1.1); }
  `}
`;

export const JsonArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 10px;
  font-family: ui-monospace, monospace;
  background: ${({ theme }) => theme.colors.overlay.backdrop};
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  color: ${({ theme }) => theme.colors.foreground};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;
