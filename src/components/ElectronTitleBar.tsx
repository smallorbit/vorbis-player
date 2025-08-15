import React from 'react';
import styled from 'styled-components';
import { isElectron } from '../utils/environment';

const TitleBarContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: transparent;
  -webkit-app-region: drag;
  z-index: 100000;
  pointer-events: auto;
  
  /* Only show in Electron */
  display: ${() => isElectron() ? 'block' : 'none'};
`;

const TitleBarContent = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-weight: 500;
  -webkit-app-region: drag;
  
  &:hover {
    color: rgba(255, 255, 255, 0.5);
  }
`;

export const ElectronTitleBar: React.FC = () => {
    if (!isElectron()) {
        return null;
    }

    return (
        <TitleBarContainer>
            <TitleBarContent>
                ⋮⋮⋮ Drag to move window ⋮⋮⋮
            </TitleBarContent>
        </TitleBarContainer>
    );
};

export default ElectronTitleBar;
