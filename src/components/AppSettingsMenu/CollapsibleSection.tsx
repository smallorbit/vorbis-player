import React, { memo, useState } from 'react';

import {
  FilterSection,
  CollapsibleHeader,
  CollapsibleTitle,
  CollapsibleChevron,
  CollapsibleBody,
  CollapsibleInner,
} from './styled';

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <CollapsibleChevron $isOpen={isOpen} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
  </CollapsibleChevron>
);

export const CollapsibleSection = memo(({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <FilterSection>
      <CollapsibleHeader
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        <CollapsibleTitle>{title}</CollapsibleTitle>
        <ChevronIcon isOpen={isOpen} />
      </CollapsibleHeader>
      <CollapsibleBody $isOpen={isOpen}>
        <CollapsibleInner>
          {children}
        </CollapsibleInner>
      </CollapsibleBody>
    </FilterSection>
  );
});
CollapsibleSection.displayName = 'CollapsibleSection';
