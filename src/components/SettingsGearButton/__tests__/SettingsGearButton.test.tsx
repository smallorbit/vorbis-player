import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import SettingsGearButton from '../index';

const renderWithTheme = (ui: React.ReactElement) => render(
  <ThemeProvider theme={theme}>{ui}</ThemeProvider>
);

describe('SettingsGearButton', () => {
  it('renders a button with the "App settings" accessible label', () => {
    // #given
    const onClick = vi.fn();

    // #when
    renderWithTheme(<SettingsGearButton onClick={onClick} />);

    // #then
    expect(screen.getByRole('button', { name: /app settings/i })).toBeInTheDocument();
  });

  it('invokes the onClick handler when clicked', () => {
    // #given
    const onClick = vi.fn();
    renderWithTheme(<SettingsGearButton onClick={onClick} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: /app settings/i }));

    // #then
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
