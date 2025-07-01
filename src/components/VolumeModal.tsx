import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

interface VolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
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
  max-width: 400px;
  width: 100%;
  box-shadow: ${({ theme }) => theme.shadows.xl};
  position: relative;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    min-width: 400px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
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
  
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const VolumeContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const VolumeDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const VolumeIcon = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.gray[400]};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
  }
`;

const VolumeLevel = styled.span<{ accentColor: string }>`
  color: ${props => props.accentColor};
  font-weight: ${({ theme }) => theme.fontWeight.bold};
  font-size: ${({ theme }) => theme.fontSize.xl};
  min-width: 3rem;
  text-align: center;
`;

const VolumeSlider = styled.input<{ accentColor: string }>`
  width: 100%;
  height: 6px;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: ${props => props.accentColor};
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: ${props => props.accentColor};
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }
  }
  
  /* Progress fill effect */
  background: linear-gradient(
    to right,
    ${props => props.accentColor} 0%,
    ${props => props.accentColor} ${props => props.value}%,
    rgba(115, 115, 115, 0.3) ${props => props.value}%,
    rgba(115, 115, 115, 0.3) 100%
  );
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }
`;

const MobileVolumeControls = styled.div`
  display: none;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }
`;

const VolumeButtons = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const VolumeAdjustButton = styled.button<{ accentColor: string }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.accentColor}20;
    border-color: ${props => props.accentColor};
    color: ${props => props.accentColor};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const VolumeModal: React.FC<VolumeModalProps> = ({
  isOpen,
  onClose,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  accentColor
}) => {
  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  }, [onVolumeChange]);

  const handleVolumeUp = useCallback(() => {
    const newVolume = Math.min(100, localVolume + 10);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  }, [localVolume, onVolumeChange]);

  const handleVolumeDown = useCallback(() => {
    const newVolume = Math.max(0, localVolume - 10);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  }, [localVolume, onVolumeChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeUp();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeDown();
        break;
      case ' ':
        e.preventDefault();
        onMuteToggle();
        break;
    }
  }, [onClose, handleVolumeUp, handleVolumeDown, onMuteToggle]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const displayVolume = isMuted ? 0 : localVolume;

  return (
    <Overlay 
      isOpen={isOpen} 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <Modal role="dialog" aria-labelledby="volume-modal-title" aria-modal="true">
        <Header>
          <Title id="volume-modal-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            Volume
          </Title>
          <CloseButton onClick={onClose} aria-label="Close volume modal">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </Header>

        <VolumeContent>
          <VolumeDisplay>
            <VolumeIcon onClick={onMuteToggle} aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : displayVolume > 50 ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              ) : displayVolume > 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                </svg>
              )}
            </VolumeIcon>
            <VolumeLevel accentColor={accentColor}>
              {displayVolume}%
            </VolumeLevel>
          </VolumeDisplay>

          {/* Desktop Slider */}
          <VolumeSlider
            type="range"
            min="0"
            max="100"
            value={localVolume}
            accentColor={accentColor}
            onChange={handleSliderChange}
            aria-label="Volume level"
            disabled={isMuted}
          />

          {/* Mobile Controls */}
          <MobileVolumeControls>
            <VolumeButtons>
              <VolumeAdjustButton
                accentColor={accentColor}
                onClick={handleVolumeDown}
                disabled={isMuted || localVolume <= 0}
                aria-label="Decrease volume"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              </VolumeAdjustButton>
              <VolumeAdjustButton
                accentColor={accentColor}
                onClick={handleVolumeUp}
                disabled={isMuted || localVolume >= 100}
                aria-label="Increase volume"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </VolumeAdjustButton>
            </VolumeButtons>
          </MobileVolumeControls>
        </VolumeContent>
      </Modal>
    </Overlay>
  );
};

export default VolumeModal;