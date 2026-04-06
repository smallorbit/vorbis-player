import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Category, SelectedElement, ConsoleEntry } from '@/types/devbug';

const PANEL_STYLES = `
  :host {
    all: initial;
    display: block;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100dvh;
    background: #1a1a1a;
    color: #e8e8e8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .panel.open {
    transform: translateX(0);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
    background: #141414;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffa000;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .close-btn:hover {
    color: #e8e8e8;
    background: rgba(255, 255, 255, 0.08);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .panel-body::-webkit-scrollbar {
    width: 6px;
  }

  .panel-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-body::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin: 0 0 6px 0;
  }

  .screenshot-placeholder {
    width: 100%;
    height: 140px;
    background: #252525;
    border: 1px dashed #444;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    color: #555;
  }

  .screenshot-placeholder-icon {
    font-size: 28px;
    line-height: 1;
  }

  .screenshot-placeholder-text {
    font-size: 11px;
  }

  .metadata-grid {
    background: #252525;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metadata-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    min-width: 0;
  }

  .metadata-key {
    font-size: 11px;
    color: #666;
    flex-shrink: 0;
    min-width: 80px;
    padding-top: 1px;
  }

  .metadata-value {
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #b8b8b8;
    word-break: break-all;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .console-list {
    background: #252525;
    border-radius: 6px;
    max-height: 140px;
    overflow-y: auto;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
  }

  .console-list::-webkit-scrollbar {
    width: 4px;
  }

  .console-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }

  .console-entry {
    display: flex;
    gap: 6px;
    padding: 4px 10px;
    border-bottom: 1px solid #1e1e1e;
    align-items: flex-start;
  }

  .console-entry:last-child {
    border-bottom: none;
  }

  .console-level {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    min-width: 32px;
    padding-top: 1px;
  }

  .console-level.log { color: #888; }
  .console-level.info { color: #4a9eff; }
  .console-level.warn { color: #ffa000; }
  .console-level.error { color: #ff5252; }
  .console-level.debug { color: #666; }

  .console-text {
    color: #b8b8b8;
    word-break: break-all;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .console-empty {
    padding: 12px;
    color: #555;
    font-size: 11px;
    text-align: center;
  }

  .categories-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 20px;
    border: 1px solid #444;
    background: #252525;
    color: #b8b8b8;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .chip:hover {
    border-color: #666;
    color: #e8e8e8;
  }

  .chip.selected {
    border-color: #ffa000;
    background: rgba(255, 160, 0, 0.12);
    color: #ffa000;
  }

  .comment-field {
    width: 100%;
    background: #252525;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e8e8e8;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 10px;
    resize: vertical;
    min-height: 72px;
    transition: border-color 0.15s;
    outline: none;
  }

  .comment-field::placeholder {
    color: #555;
  }

  .comment-field:focus {
    border-color: #ffa000;
  }

  .panel-footer {
    padding: 12px 16px;
    border-top: 1px solid #333;
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    background: #141414;
  }

  .btn {
    flex: 1;
    padding: 9px 16px;
    border-radius: 6px;
    border: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-cancel {
    background: #2a2a2a;
    color: #b8b8b8;
    border: 1px solid #444;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #333;
  }

  .btn-submit {
    background: #ffa000;
    color: #111;
  }

  .btn-submit:hover:not(:disabled) {
    background: #ffb300;
  }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 336px;
    padding: 10px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    z-index: 2147483647;
    animation: toast-in 0.2s ease-out;
    max-width: 260px;
  }

  .toast.success {
    background: #1b4332;
    color: #6fcf97;
    border: 1px solid #2d6a4f;
  }

  .toast.error {
    background: #3d1a1a;
    color: #ff5252;
    border: 1px solid #6b2d2d;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const CATEGORY_CONFIG: { id: Category; label: string; emoji: string }[] = [
  { id: 'faster', label: 'Faster', emoji: '🏎️' },
  { id: 'slower', label: 'Slower', emoji: '🐌' },
  { id: 'bigger', label: 'Bigger', emoji: '🔍' },
  { id: 'smaller', label: 'Smaller', emoji: '🤏' },
  { id: 'broken', label: 'Not working as expected', emoji: '⚠️' },
];

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export interface FeedbackPanelProps {
  isOpen: boolean;
  selectedElement: SelectedElement | null;
  screenshotDataUrl: string | null;
  categories: Category[];
  comment: string;
  onToggleCategory: (category: Category) => void;
  onCommentChange: (comment: string) => void;
  onCancel: () => void;
}

interface PanelContentProps extends FeedbackPanelProps {
  consoleEntries: ConsoleEntry[];
  toast: ToastState | null;
  submitting: boolean;
  onSubmitClick: () => void;
}

function PanelContent({
  isOpen,
  selectedElement,
  screenshotDataUrl,
  categories,
  comment,
  consoleEntries,
  onToggleCategory,
  onCommentChange,
  onCancel,
  toast,
  submitting,
  onSubmitClick,
}: PanelContentProps) {
  const dims = selectedElement
    ? `${Math.round(selectedElement.boundingRect.width)} × ${Math.round(selectedElement.boundingRect.height)}px`
    : null;

  return (
    <>
      <style>{PANEL_STYLES}</style>
      <div className={`panel${isOpen ? ' open' : ''}`}>
        <div className="panel-header">
          <h2 className="panel-title">🐛 Report Bug</h2>
          <button className="close-btn" onClick={onCancel} aria-label="Close panel">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <div>
            <p className="section-label">Screenshot</p>
            {screenshotDataUrl ? (
              <img
                src={screenshotDataUrl}
                alt="Screenshot"
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #333' }}
              />
            ) : (
              <div className="screenshot-placeholder">
                <span className="screenshot-placeholder-icon">📸</span>
                <span className="screenshot-placeholder-text">No screenshot captured</span>
              </div>
            )}
          </div>

          {selectedElement && (
            <div>
              <p className="section-label">Element</p>
              <div className="metadata-grid">
                <div className="metadata-row">
                  <span className="metadata-key">Selector</span>
                  <span className="metadata-value">{selectedElement.cssSelector}</span>
                </div>
                {selectedElement.reactComponentName && (
                  <div className="metadata-row">
                    <span className="metadata-key">Component</span>
                    <span className="metadata-value">{selectedElement.reactComponentName}</span>
                  </div>
                )}
                {dims && (
                  <div className="metadata-row">
                    <span className="metadata-key">Dimensions</span>
                    <span className="metadata-value">{dims}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="section-label">Console ({consoleEntries.length})</p>
            <div className="console-list">
              {consoleEntries.length === 0 ? (
                <div className="console-empty">No console entries captured</div>
              ) : (
                consoleEntries.map((entry, i) => (
                  <div key={i} className="console-entry">
                    <span className={`console-level ${entry.level}`}>{entry.level}</span>
                    <span className="console-text">{entry.args.join(' ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="section-label">Category</p>
            <div className="categories-row">
              {CATEGORY_CONFIG.map(({ id, label, emoji }) => (
                <button
                  key={id}
                  className={`chip${categories.includes(id) ? ' selected' : ''}`}
                  onClick={() => onToggleCategory(id)}
                  type="button"
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label">What&apos;s wrong?</p>
            <textarea
              className="comment-field"
              placeholder="Describe the issue..."
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
            />
          </div>
        </div>
        <div className="panel-footer">
          <button className="btn btn-cancel" onClick={onCancel} disabled={submitting} type="button">
            Cancel
          </button>
          <button
            className="btn btn-submit"
            onClick={onSubmitClick}
            disabled={submitting}
            type="button"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}

export function FeedbackPanel(props: FeedbackPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483646;pointer-events:none;';
    host.setAttribute('data-devbug', '');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    hostRef.current = host;
    shadowRef.current = shadow;
    setMounted(true);
    return () => {
      document.body.removeChild(host);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.pointerEvents = props.isOpen ? 'auto' : 'none';
  }, [props.isOpen]);

  useEffect(() => {
    if (props.isOpen) {
      import('@/services/devbug/consoleCapture').then(({ getEntries }) => {
        setConsoleEntries(getEntries().slice(-10));
      });
    }
  }, [props.isOpen]);

  const handleSubmitClick = useCallback(async () => {
    setSubmitting(true);
    try {
      const [{ buildBugReport }, { collectPerfData }, { getEntries }, { createDefaultGitHubService }] =
        await Promise.all([
          import('@/services/devbug/reportBuilder'),
          import('@/services/devbug/perfCapture'),
          import('@/services/devbug/consoleCapture'),
          import('@/services/devbug/githubService'),
        ]);

      const entries = getEntries().slice(-10);
      const perfData = collectPerfData();

      const report = buildBugReport({
        selectionMode: 'click',
        elements: props.selectedElement ? [props.selectedElement] : [],
        screenshotDataUrl: props.screenshotDataUrl ?? undefined,
        comment: props.comment,
        categories: props.categories,
        consoleLogs: entries,
        performanceMetrics: perfData,
      });

      const service = createDefaultGitHubService();

      if (!service.isConfigured()) {
        setToast({
          message: 'GitHub token not configured. Set VITE_DEVBUG_GITHUB_TOKEN.',
          type: 'error',
        });
        setTimeout(() => setToast(null), 4000);
        return;
      }

      const result = await service.createIssue(report);
      setToast({ message: `Issue #${result.number} created!`, type: 'success' });
      setTimeout(() => {
        setToast(null);
        props.onCancel();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit report';
      setToast({ message, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }, [props]);

  if (!mounted || !shadowRef.current) return null;

  return createPortal(
    <PanelContent
      {...props}
      consoleEntries={consoleEntries}
      toast={toast}
      submitting={submitting}
      onSubmitClick={handleSubmitClick}
    />,
    shadowRef.current as unknown as Element,
  );
}
