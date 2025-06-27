import styled from 'styled-components';
import { customScrollbar } from '../../styles/utils';

interface ScrollAreaProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const ScrollArea = styled.div<ScrollAreaProps>`
  overflow: auto;
  ${customScrollbar}
`;