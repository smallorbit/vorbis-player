import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

export const Skeleton = styled.div`
  height: 1rem;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.gray[700]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
`;