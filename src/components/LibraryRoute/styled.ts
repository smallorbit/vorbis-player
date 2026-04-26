import styled from 'styled-components';

export const LibraryRouteRoot = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
`;

export const MobileLayout = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
`;

export const DesktopLayout = styled.div`
  display: grid;
  grid-template-columns: 280px 1fr;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
`;
