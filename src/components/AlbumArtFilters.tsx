import React from 'react';
import styled from 'styled-components';

interface AlbumArtFiltersProps {
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    sepia: number;
  };
  backgroundImage?: string;
  className?: string;
  children?: React.ReactNode;
}

const FilterContainer = styled.div<{ $filters: string }>`
  filter: ${({ $filters }) => $filters};
  transition: filter 0.3s ease;
  width: 100%;
  height: 100%;
  position: relative;
  /* Clip children to the parent's rounded corners.
     CSS filter creates a new compositing context that can cause WebKit to
     ignore the ancestor overflow: hidden. The mask forces a proper compositing
     layer here (on the filter element itself) rather than on AlbumArtContainer,
     so the glow box-shadow on the outer container is not affected. */
  overflow: hidden;
  border-radius: inherit;
  -webkit-mask-image: -webkit-radial-gradient(white, black);
`;

const AlbumArtFilters: React.FC<AlbumArtFiltersProps> = ({
  filters,
  children,
  className
}) => {
  const filterString = [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `sepia(${filters.sepia}%)`
  ].join(' ');

  return (
    <FilterContainer
      $filters={filterString}
      className={className}
    >
      {children}
    </FilterContainer>
  );
};

export default AlbumArtFilters;