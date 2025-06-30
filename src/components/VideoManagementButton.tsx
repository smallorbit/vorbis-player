import { useState, memo } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import VideoManagementModal from './VideoManagementModal';
import type { TrackVideoAssociation } from '../services/trackVideoAssociationService';

interface VideoManagementButtonProps {
  currentTrack: Track | null;
  onVideoChanged?: (association: TrackVideoAssociation | null) => void;
  variant?: 'overlay' | 'inline';
  className?: string;
}

const Button = styled.button<{ variant?: 'overlay' | 'inline' }>`
  background: ${props => props.variant === 'overlay' 
    ? 'rgba(0, 0, 0, 0.7)' 
    : 'rgba(255, 255, 255, 0.1)'
  };
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.variant === 'overlay' ? '50%' : '0.5rem'};
  color: white;
  cursor: pointer;
  padding: ${props => props.variant === 'overlay' ? '0.75rem' : '0.5rem 1rem'};
  font-size: ${props => props.variant === 'overlay' ? '1.2rem' : '0.9rem'};
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: ${props => props.variant === 'overlay' ? '48px' : 'auto'};
  height: ${props => props.variant === 'overlay' ? '48px' : 'auto'};

  &:hover {
    background: ${props => props.variant === 'overlay' 
      ? 'rgba(255, 215, 0, 0.8)' 
      : 'rgba(255, 255, 255, 0.2)'
    };
    color: ${props => props.variant === 'overlay' ? 'black' : 'white'};
    transform: ${props => props.variant === 'overlay' ? 'scale(1.05)' : 'none'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: ${props => props.variant === 'overlay' ? '20px' : '16px'};
    height: ${props => props.variant === 'overlay' ? '20px' : '16px'};
    flex-shrink: 0;
  }
`;

const VideoManagementButton = memo(({ 
  currentTrack, 
  onVideoChanged, 
  variant = 'overlay',
  className 
}: VideoManagementButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (currentTrack) {
      setIsModalOpen(true);
    }
  };

  const handleVideoChanged = (association: TrackVideoAssociation | null) => {
    onVideoChanged?.(association);
  };

  return (
    <>
      <Button
        variant={variant}
        onClick={handleClick}
        disabled={!currentTrack}
        className={className}
        title={currentTrack ? "Manage video for this track" : "No track selected"}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
        </svg>
        {variant === 'inline' && (
          <span>Manage Video</span>
        )}
      </Button>

      <VideoManagementModal
        currentTrack={currentTrack}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onVideoChanged={handleVideoChanged}
      />
    </>
  );
});

VideoManagementButton.displayName = 'VideoManagementButton';

export default VideoManagementButton;