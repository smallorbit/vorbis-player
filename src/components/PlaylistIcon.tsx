import React from 'react';
import styled from 'styled-components';

interface PlaylistIconProps {
  onClick: () => void;
  trackCount: number;
  className?: string;
}

const PlaylistButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover svg {
    transform: scale(1.1);
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
    
    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }

  /* Touch devices */
  @media (hover: none) and (pointer: coarse) {
    &:hover {
      transform: none;
      box-shadow: none;
    }
    
    &:active {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(0.98);
    }
  }
`;

const Tooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 0.5rem;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid rgba(0, 0, 0, 0.9);
  }

  ${PlaylistButton}:hover & {
    opacity: 1;
    visibility: visible;
  }

  ${PlaylistButton}:focus & {
    opacity: 1;
    visibility: visible;
  }

  /* Hide tooltip on mobile to avoid conflicts with touch */
  @media (hover: none) and (pointer: coarse) {
    display: none;
  }

  /* Responsive positioning on smaller screens */
  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.375rem 0.5rem;
    
    /* Position tooltip above viewport edge if needed */
    bottom: auto;
    top: 100%;
    margin-bottom: 0;
    margin-top: 0.5rem;
    
    &::after {
      top: auto;
      bottom: 100%;
      border-top: none;
      border-bottom: 4px solid rgba(0, 0, 0, 0.9);
    }
  }
`;

export const PlaylistIcon: React.FC<PlaylistIconProps> = ({ 
  onClick, 
  trackCount, 
  className 
}) => {
  return (
    <PlaylistButton 
      onClick={onClick}
      className={className}
      aria-label={`View playlist (${trackCount} tracks)`}
      title={`View playlist (${trackCount} tracks)`}
    >
      <Tooltip>
        View playlist ({trackCount} tracks)
      </Tooltip>
      
      {/* Spotify-inspired queue icon - three horizontal lines of decreasing length */}
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
      </svg>
    </PlaylistButton>
  );
};

export default PlaylistIcon;