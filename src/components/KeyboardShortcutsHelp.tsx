import React, { memo } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.overlay.light};
  z-index: ${theme.zIndex.overlay};
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: opacity 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Modal = styled.div<{ $isOpen: boolean }>`
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.lg};
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  transform: scale(${({ $isOpen }) => ($isOpen ? '1' : '0.95')});
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  transition: transform 200ms ease, opacity 200ms ease;
  z-index: ${theme.zIndex.modal};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
`;

const Content = styled.div`
  padding: 0.75rem 1.25rem 1rem;
`;

const ShortcutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ShortcutItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0;
`;

const ShortcutDescription = styled.span`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8125rem;
`;

const ShortcutKey = styled.kbd`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
  min-width: 1.75rem;
  text-align: center;
`;

const shortcuts = [
  { key: 'Space', description: 'Play / Pause' },
  { key: '←', description: 'Previous track' },
  { key: '→', description: 'Next track' },
  { key: '↑', description: 'Toggle playlist' },
  { key: '↓', description: 'Toggle library' },
  { key: 'L', description: 'Like / Unlike track' },
  { key: 'M', description: 'Mute / Unmute' },
  { key: 'G', description: 'Toggle glow effect' },
  { key: 'V', description: 'Toggle background visualizations' },
  { key: 'O', description: 'Open visual effects menu' },
  { key: 'Esc', description: 'Close menus' },
  { key: '/', description: 'Show this help' },
];

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = memo(({ isOpen, onClose }) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Overlay $isOpen={isOpen} onClick={handleOverlayClick}>
      <Modal $isOpen={isOpen}>
        <Header>
          <Title>Keyboard Shortcuts</Title>
          <CloseButton onClick={onClose} aria-label="Close help">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </CloseButton>
        </Header>
        <Content>
          <ShortcutList>
            {shortcuts.map(({ key, description }) => (
              <ShortcutItem key={key}>
                <ShortcutDescription>{description}</ShortcutDescription>
                <ShortcutKey>{key}</ShortcutKey>
              </ShortcutItem>
            ))}
          </ShortcutList>
        </Content>
      </Modal>
    </Overlay>
  );
});

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;
