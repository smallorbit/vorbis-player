import React from 'react';
import styled from 'styled-components';

interface PaintbrushIconProps {
  onClick?: () => void;
  className?: string;
  size?: number;
  color?: string;
}

const IconButton = styled.button<{ $size: number; $color?: string }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  
  svg {
    width: ${({ $size }) => $size}rem;
    height: ${({ $size }) => $size}rem;
    color: ${({ $color }) => $color || 'rgba(255, 255, 255, 0.8)'};
    transition: color 0.2s ease;
  }
  
  &:hover svg {
    color: rgba(255, 255, 255, 1);
  }
`;

export const PaintbrushIcon: React.FC<PaintbrushIconProps> = ({
  onClick,
  className,
  size = 1.5,
  color
}) => {
  return (
    <IconButton
      onClick={onClick}
      className={className}
      $size={size}
      $color={color}
      title="Visual Effects"
      aria-label="Open visual effects menu"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/>
        <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>
        <path d="M14.5 17.5 4.5 15"/>
      </svg>
    </IconButton>
  );
};

export default PaintbrushIcon;