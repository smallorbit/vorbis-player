import React, { useEffect, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  accentColor: string;
}

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
  min-width: 320px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: ${({ theme }) => theme.shadows.xl};
  position: relative;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    min-width: 500px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  color: white;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.gray[400]};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }
`;

const SettingsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const SettingsSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
`;

const SectionTitle = styled.h3`
  color: rgba(255, 215, 0, 0.9);
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SettingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  &:last-child {
    border-bottom: none;
  }
`;

const SettingInfo = styled.div`
  flex: 1;
`;

const SettingLabel = styled.div`
  color: white;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  margin-bottom: 0.25rem;
`;

const SettingDescription = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: ${({ theme }) => theme.fontSize.sm};
  line-height: 1.4;
`;

const PlaceholderText = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  text-align: center;
  padding: 2rem;
`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  accentColor
}) => {
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay isOpen={isOpen} onClick={handleOverlayClick}>
      <Modal>
        <Header>
          <Title>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
            </svg>
            Settings
          </Title>
          <CloseButton onClick={onClose} aria-label="Close settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </Header>

        <SettingsContent>
          {/* Video Management Section */}
          <SettingsSection>
            <SectionTitle>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
              </svg>
              Video Management
            </SectionTitle>
            
            <PlaceholderText>
              Video management settings will be integrated here
            </PlaceholderText>
          </SettingsSection>

          {/* Playback Settings Section */}
          <SettingsSection>
            <SectionTitle>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
              </svg>
              Playback
            </SectionTitle>
            
            <SettingItem>
              <SettingInfo>
                <SettingLabel>Auto-advance tracks</SettingLabel>
                <SettingDescription>
                  Automatically play the next track when the current track ends
                </SettingDescription>
              </SettingInfo>
              <PlaceholderText>Coming soon</PlaceholderText>
            </SettingItem>

            <SettingItem>
              <SettingInfo>
                <SettingLabel>Default volume</SettingLabel>
                <SettingDescription>
                  Set the default volume level for new sessions
                </SettingDescription>
              </SettingInfo>
              <PlaceholderText>Coming soon</PlaceholderText>
            </SettingItem>
          </SettingsSection>

          {/* Interface Settings Section */}
          <SettingsSection>
            <SectionTitle>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,8.39C10.57,9.4 10.57,10.6 12,11.61C13.43,10.6 13.43,9.4 12,8.39M6.13,15.26C6.13,14.61 6.39,14.13 6.91,13.91C7.43,13.69 7.97,13.77 8.54,14.15C8.76,14.15 8.76,14.39 8.54,14.39C8.11,14.39 7.68,14.46 7.35,14.68C7.06,14.68 6.91,14.92 6.91,15.26C6.91,15.7 7.06,16.05 7.35,16.22C7.68,16.44 8.11,16.5 8.54,16.5C8.76,16.5 8.76,16.74 8.54,16.74C7.97,17.12 7.43,17.21 6.91,16.98C6.39,16.76 6.13,16.28 6.13,15.26M17.87,15.26C17.87,16.28 17.61,16.76 17.09,16.98C16.57,17.21 16.03,17.12 15.46,16.74C15.24,16.74 15.24,16.5 15.46,16.5C15.89,16.5 16.32,16.44 16.65,16.22C16.94,16.05 17.09,15.7 17.09,15.26C17.09,14.92 16.94,14.68 16.65,14.68C16.32,14.46 15.89,14.39 15.46,14.39C15.24,14.39 15.24,14.15 15.46,14.15C16.03,13.77 16.57,13.69 17.09,13.91C17.61,14.13 17.87,14.61 17.87,15.26Z" />
              </svg>
              Interface
            </SectionTitle>
            
            <SettingItem>
              <SettingInfo>
                <SettingLabel>Theme</SettingLabel>
                <SettingDescription>
                  Customize the app's appearance and color scheme
                </SettingDescription>
              </SettingInfo>
              <PlaceholderText>Coming soon</PlaceholderText>
            </SettingItem>
          </SettingsSection>
        </SettingsContent>
      </Modal>
    </Overlay>
  );
};

export default SettingsModal;