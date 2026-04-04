import React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import type { ProviderDescriptor } from '@/types/providers';

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.popover.border};
  flex-shrink: 0;
`;

const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.foreground};
  letter-spacing: 0.5px;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.muted.foreground};
  opacity: 0.75;
`;

interface LibraryDrawerHeaderProps {
  activeDescriptor: ProviderDescriptor | null;
}

const LibraryDrawerHeader = React.memo(function LibraryDrawerHeader({ activeDescriptor }: LibraryDrawerHeaderProps) {
  const providerName = activeDescriptor?.name ?? 'Library';

  return (
    <HeaderContainer>
      <HeaderContent>
        <Title>{providerName} Library</Title>
        <Subtitle>Browse and select</Subtitle>
      </HeaderContent>
    </HeaderContainer>
  );
});

export default LibraryDrawerHeader;
