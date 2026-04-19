import styled from 'styled-components';
import { VisualEffectsIcon } from '../icons/QuickActionIcons';

interface SettingsGearButtonProps {
  onClick: () => void;
}

const GearButton = styled.button`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + ${({ theme }) => theme.spacing.md});
  right: calc(env(safe-area-inset-right, 0px) + ${({ theme }) => theme.spacing.md});
  z-index: ${({ theme }) => theme.zIndex.banner};
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-color, ${({ theme }) => theme.colors.accent}) 20%, transparent);
  color: ${({ theme }) => theme.colors.white};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  transition: background 0.2s ease, color 0.2s ease;

  svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: currentColor;
  }

  &:hover {
    background: color-mix(in srgb, var(--accent-color, ${({ theme }) => theme.colors.accent}) 30%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-color, ${({ theme }) => theme.colors.accent});
    outline-offset: 2px;
  }
`;

export function SettingsGearButton({ onClick }: SettingsGearButtonProps): JSX.Element {
  return (
    <GearButton
      type="button"
      onClick={onClick}
      aria-label="App settings"
      title="App settings"
      data-testid="settings-gear-button"
    >
      <VisualEffectsIcon />
    </GearButton>
  );
}

export default SettingsGearButton;
