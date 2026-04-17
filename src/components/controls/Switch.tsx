import styled from 'styled-components';
import { theme } from '@/styles/theme';

type SwitchVariant = 'accent' | 'neutral';

interface SwitchProps {
  on: boolean;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
  variant?: SwitchVariant;
}

const NEUTRAL_ON = '#4ade80';
const NEUTRAL_OFF = 'rgba(255, 255, 255, 0.25)';

function trackBackground(on: boolean, variant: SwitchVariant): string {
  if (variant === 'neutral') return on ? NEUTRAL_ON : NEUTRAL_OFF;
  return on ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.15)';
}

const SwitchTrack = styled.button<{ $on: boolean; $disabled?: boolean; $variant: SwitchVariant }>`
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: ${({ theme }) => theme.borderRadius.flat};
  border: none;
  padding: 0;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  background: ${({ $on, $variant }) => trackBackground($on, $variant)};
  opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
  transition: background 0.2s ease, opacity 0.2s ease;
  flex-shrink: 0;
`;

const SwitchKnob = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? '18px' : '2px')};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${theme.colors.white};
  transition: left 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
`;

export default function Switch({ on, onToggle, ariaLabel, disabled = false, variant = 'accent' }: SwitchProps) {
  return (
    <SwitchTrack
      $on={on}
      $disabled={disabled}
      $variant={variant}
      onClick={disabled ? undefined : onToggle}
      aria-label={ariaLabel}
      role="switch"
      aria-checked={on}
      disabled={disabled}
    >
      <SwitchKnob $on={on} />
    </SwitchTrack>
  );
}
