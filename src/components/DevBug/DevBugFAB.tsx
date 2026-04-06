import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { useDevBug } from '@/contexts/DevBugContext';
import type { SelectedElement } from '@/types/devbug';
import { DevBugTopBar } from './DevBugTopBar';
import { InspectOverlay } from './InspectOverlay';
import { FeedbackPanel } from './FeedbackPanel';
import { useFeedbackPanel } from './useFeedbackPanel';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 160, 0, 0.7); }
  50% { box-shadow: 0 0 0 8px rgba(255, 160, 0, 0); }
`;

const FABButton = styled.button<{ $active: boolean }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
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

export function DevBugFAB() {
  const { isActive, toggle, deactivate } = useDevBug();
  const panel = useFeedbackPanel();

  const handleElementSelected = useCallback(
    (_element: Element, info: SelectedElement) => {
      panel.open(info);
    },
    [panel],
  );

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

  return createPortal(
    <>
      <FABButton
        $active={isActive}
        onClick={toggle}
        aria-label={isActive ? 'Deactivate DevBug preview mode' : 'Activate DevBug preview mode'}
        title="DevBug (Ctrl+Shift+D)"
      >
        <BugIcon />
      </FABButton>
      {isActive && <DevBugTopBar />}
      <InspectOverlay onElementSelected={handleElementSelected} />
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
