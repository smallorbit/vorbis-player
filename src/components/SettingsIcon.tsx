import React from 'react';
import styled from 'styled-components';

interface SettingsIconProps {
  onClick: () => void;
  className?: string;
}

const SettingsButton = styled.button`
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
    transform: scale(1.1) rotate(15deg);
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
    
    &:hover svg {
      transform: none;
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

  ${SettingsButton}:hover & {
    opacity: 1;
    visibility: visible;
  }

  ${SettingsButton}:focus & {
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

export const SettingsIcon: React.FC<SettingsIconProps> = ({ 
  onClick, 
  className 
}) => {
  return (
    <SettingsButton 
      onClick={onClick}
      className={className}
      aria-label="Open settings"
      title="Open settings"
    >
      <Tooltip>
        Settings
      </Tooltip>
      
      {/* Settings gear icon */}
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
      </svg>
    </SettingsButton>
  );
};

export default SettingsIcon;