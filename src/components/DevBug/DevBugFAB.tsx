import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { useDevBug } from '@/contexts/DevBugContext';
import type { SelectedElement } from '@/types/devbug';
import { DevBugTopBar } from './DevBugTopBar';
import { InspectOverlay } from './InspectOverlay';
import { AreaSelectOverlay } from './AreaSelectOverlay';
import { AnnotationOverlay } from './AnnotationOverlay';
import { FeedbackPanel } from './FeedbackPanel';
import { useFeedbackPanel } from './useFeedbackPanel';

type ActiveMode = 'inspect' | 'area' | 'annotate';

const MODES: { id: ActiveMode; icon: string; label: string }[] = [
  { id: 'inspect', icon: '🎯', label: 'Click to inspect' },
  { id: 'area', icon: '▭', label: 'Area select' },
  { id: 'annotate', icon: '📸', label: 'Screenshot annotate' },
];

const LONG_PRESS_MS = 500;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 160, 0, 0.7); }
  50% { box-shadow: 0 0 0 8px rgba(255, 160, 0, 0); }
`;

const dialItemIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.8); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
`;

const FABContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const FABButton = styled.button<{ $active: boolean }>`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid ${({ $active }) => ($active ? 'rgba(255, 160, 0, 0.9)' : 'rgba(255, 255, 255, 0.2)')};
  background: ${({ $active }) => ($active ? 'rgba(40, 20, 0, 0.95)' : 'rgba(20, 20, 20, 0.9)')};
  color: ${({ $active }) => ($active ? 'rgba(255, 160, 0, 0.95)' : 'rgba(255, 255, 255, 0.8)')};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
  backdrop-filter: blur(8px);

  &:hover {
    transform: scale(1.08);
    background: ${({ $active }) => ($active ? 'rgba(60, 30, 0, 0.95)' : 'rgba(40, 40, 40, 0.95)')};
  }

  &:active {
    transform: scale(0.96);
  }

  ${({ $active }) =>
    $active &&
    css`
      animation: ${pulse} 1.8s ease-in-out infinite;
    `}
`;

const SpeedDialList = styled.div`
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 8px;
`;

const SpeedDialItem = styled.button<{ $selected: boolean; $index: number }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid
    ${({ $selected }) => ($selected ? 'rgba(255, 160, 0, 0.9)' : 'rgba(255, 255, 255, 0.25)')};
  background: ${({ $selected }) =>
    $selected ? 'rgba(255, 160, 0, 0.18)' : 'rgba(20, 20, 20, 0.92)'};
  color: ${({ $selected }) => ($selected ? 'rgba(255, 160, 0, 0.95)' : 'rgba(255, 255, 255, 0.8)')};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  backdrop-filter: blur(8px);
  position: relative;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  animation: ${dialItemIn} 0.2s ease both;
  animation-delay: ${({ $index }) => $index * 60}ms;

  &:hover {
    transform: scale(1.12);
    background: ${({ $selected }) =>
      $selected ? 'rgba(255, 160, 0, 0.28)' : 'rgba(50, 50, 50, 0.95)'};
  }

  &:active {
    transform: scale(0.94);
  }
`;

const Tooltip = styled.span`
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  background: rgba(20, 20, 20, 0.95);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-family: system-ui, sans-serif;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;

  ${SpeedDialItem}:hover & {
    opacity: 1;
  }
`;

const BugIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M20 8h-2.81A5.985 5.985 0 0 0 13 5.07V5a1 1 0 0 0-2 0v.07A5.985 5.985 0 0 0 6.81 8H4a1 1 0 0 0 0 2h2.09A6.011 6.011 0 0 0 6 11v1H4a1 1 0 0 0 0 2h2v1a6.011 6.011 0 0 0 .09 1H4a1 1 0 0 0 0 2h2.81A6 6 0 0 0 18 17v-1h2a1 1 0 0 0 0-2h-2v-1h2a1 1 0 0 0 0-2h-2v-1a6.011 6.011 0 0 0-.09-1H20a1 1 0 0 0 0-2zm-8 9a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
  </svg>
);

function modeIcon(mode: ActiveMode): string {
  return MODES.find((m) => m.id === mode)?.icon ?? '🐛';
}

export function DevBugFAB() {
  const { isActive, toggle, deactivate } = useDevBug();
  const panel = useFeedbackPanel();

  const [activeMode, setActiveMode] = useState<ActiveMode>('inspect');
  const [dialOpen, setDialOpen] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDial = useCallback(() => setDialOpen(true), []);
  const closeDial = useCallback(() => setDialOpen(false), []);

  const handleFABClick = useCallback(() => {
    if (isActive && dialOpen) {
      closeDial();
      return;
    }
    if (isActive) {
      toggle();
      return;
    }
    toggle();
  }, [isActive, dialOpen, closeDial, toggle]);

  const handleFABMouseDown = useCallback(() => {
    if (!isActive) return;
    longPressTimer.current = setTimeout(openDial, LONG_PRESS_MS);
  }, [isActive, openDial]);

  const handleFABMouseUp = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleFABMouseEnter = useCallback(() => {
    if (isActive && !dialOpen) {
      openDial();
    }
  }, [isActive, dialOpen, openDial]);

  const handleFABMouseLeave = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const selectMode = useCallback(
    (mode: ActiveMode) => {
      setActiveMode(mode);
      closeDial();
    },
    [closeDial],
  );

  const handleElementSelected = useCallback(
    (_element: Element, info: SelectedElement) => {
      panel.open(info);
    },
    [panel],
  );

  const handleAreaSelected = useCallback(
    (_elements: Element[], infos: SelectedElement[]) => {
      if (infos.length > 0) {
        panel.open(infos[0]);
      }
    },
    [panel],
  );

  const handleAnnotationComplete = useCallback(
    (_annotatedDataUrl: string) => {
      const syntheticInfo: SelectedElement = {
        cssSelector: 'screenshot',
        xpath: '/screenshot',
        reactComponentName: null,
        boundingRect: { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0 },
        computedStyles: {},
        textContent: '',
      };
      panel.open(syntheticInfo);
    },
    [panel],
  );

  const handleOverlayCancel = useCallback(() => {
    deactivate();
  }, [deactivate]);

  const handlePanelCancel = useCallback(() => {
    panel.close();
    deactivate();
  }, [panel, deactivate]);

  useEffect(() => {
    if (isActive) {
      import('@/services/devbug/consoleCapture').then(({ startCapture }) => startCapture());
      import('@/services/devbug/perfCapture').then(({ startPerfCapture }) => startPerfCapture());
    } else {
      import('@/services/devbug/consoleCapture').then(({ stopCapture }) => stopCapture());
      import('@/services/devbug/perfCapture').then(({ stopPerfCapture }) => stopPerfCapture());
      setDialOpen(false);
    }
  }, [isActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    document.body.style.cursor = isActive ? 'crosshair' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return createPortal(
    <>
      <FABContainer data-devbug="">
        {isActive && dialOpen && (
          <SpeedDialList>
            {MODES.map((mode, index) => (
              <SpeedDialItem
                key={mode.id}
                $selected={activeMode === mode.id}
                $index={index}
                onClick={() => selectMode(mode.id)}
                aria-label={mode.label}
                aria-pressed={activeMode === mode.id}
              >
                {mode.icon}
                <Tooltip>{mode.label}</Tooltip>
              </SpeedDialItem>
            ))}
          </SpeedDialList>
        )}
        <FABButton
          $active={isActive}
          onClick={handleFABClick}
          onMouseDown={handleFABMouseDown}
          onMouseUp={handleFABMouseUp}
          onMouseEnter={handleFABMouseEnter}
          onMouseLeave={handleFABMouseLeave}
          aria-label={isActive ? 'Deactivate DevBug preview mode' : 'Activate DevBug preview mode'}
          title="DevBug (Ctrl+Shift+D)"
        >
          {isActive ? modeIcon(activeMode) : <BugIcon />}
        </FABButton>
      </FABContainer>

      {isActive && <DevBugTopBar />}

      {isActive && activeMode === 'inspect' && (
        <InspectOverlay onElementSelected={handleElementSelected} />
      )}
      {isActive && activeMode === 'area' && (
        <AreaSelectOverlay onAreaSelected={handleAreaSelected} onCancel={handleOverlayCancel} />
      )}
      {isActive && activeMode === 'annotate' && (
        <AnnotationOverlay onComplete={handleAnnotationComplete} onCancel={handleOverlayCancel} />
      )}

      <FeedbackPanel
        isOpen={panel.isOpen}
        selectedElement={panel.selectedElement}
        categories={panel.categories}
        comment={panel.comment}
        onToggleCategory={panel.toggleCategory}
        onCommentChange={panel.setComment}
        onCancel={handlePanelCancel}
      />
    </>,
    document.body,
  );
}
