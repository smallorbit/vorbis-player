import styled, { css } from 'styled-components';
import { theme } from '@/styles/theme';

export const SectionRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${theme.spacing.md};
  padding: 0 ${theme.spacing.md};
`;

export const Title = styled.h2`
  margin: 0;
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
`;

export const SeeAllButton = styled.button`
  appearance: none;
  background: transparent;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};

  &:hover {
    color: ${theme.colors.white};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const Body = styled.div<{ $layout: 'row' | 'grid' }>`
  ${({ $layout }) =>
    $layout === 'row'
      ? css`
          display: flex;
          flex-direction: row;
          gap: ${theme.spacing.md};
          padding: 0 ${theme.spacing.md};
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x proximity;
          scroll-padding-inline-start: ${theme.spacing.md};
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          &::-webkit-scrollbar {
            display: none;
          }
        `
      : css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
          gap: ${theme.spacing.md};
          padding: 0 ${theme.spacing.md};
        `}
`;
