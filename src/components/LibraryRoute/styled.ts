import styled from 'styled-components';

export const LibraryRouteRoot = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
`;

export const MobileLayout = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
`;

export const DesktopLayout = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
`;
