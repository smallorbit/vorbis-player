import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const Root = styled.section`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  margin: 0 ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  background: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.borderSubtle};
`;

export const Art = styled.div`
  width: 120px;
  height: 120px;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  background: ${theme.colors.muted.background};
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

export const TextStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  flex: 1;
  min-width: 0;
`;

export const TrackName = styled.div`
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ArtistName = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CollectionName = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResumeButton = styled.button`
  appearance: none;
  background: ${theme.colors.primary};
  color: ${theme.colors.white};
  border: none;
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.full};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.primaryHover};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`;
