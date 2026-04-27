import React from 'react';
import { SectionRoot, Header, Title, SeeAllButton, Body } from './Section.styled';

export interface SectionProps {
  title: string;
  onSeeAll?: () => void;
  hidden?: boolean;
  layout: 'row' | 'grid';
  children: React.ReactNode;
  id: string;
}

const Section: React.FC<SectionProps> = ({ title, onSeeAll, hidden, layout, children, id }) => {
  if (hidden) return null;
  return (
    <SectionRoot data-testid={`library-section-${id}`} aria-label={title}>
      <Header>
        <Title>{title}</Title>
        {onSeeAll && (
          <SeeAllButton type="button" onClick={onSeeAll} data-testid={`library-section-${id}-see-all`}>
            See all
          </SeeAllButton>
        )}
      </Header>
      <Body $layout={layout}>{children}</Body>
    </SectionRoot>
  );
};

Section.displayName = 'Section';
export default Section;
