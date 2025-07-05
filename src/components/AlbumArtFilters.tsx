import React from 'react';
import styled from 'styled-components';

interface AlbumArtFiltersProps {
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    blur: number;
    sepia: number;
    grayscale: number;
    invert: boolean;
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
`;

export const AlbumArtFilters: React.FC<AlbumArtFiltersProps> = ({
  filters,
  children,
  className
}) => {
  // Build CSS filter string from filter values
  const filterString = [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `hue-rotate(${filters.hue}deg)`,
    `blur(${filters.blur}px)`,
    `sepia(${filters.sepia}%)`,
    `grayscale(${filters.grayscale}%)`,
    `invert(${filters.invert ? 100 : 0}%)`
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