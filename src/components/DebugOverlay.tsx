import { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  time: string;
  level: 'warn' | 'error' | 'log';
  msg: string;
}

const MAX_LOGS = 200;
const STORAGE_KEY = 'vorbis-player-debug-overlay';
const TAP_COUNT_TO_ACTIVATE = 5;
const TAP_WINDOW_MS = 2000;

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('debug') === 'true') return true;
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}

function setDebugEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* noop */ }
}

export function useDebugActivator() {
  const tapsRef = useRef<number[]>([]);
  const [active, setActive] = useState(isDebugEnabled);

  const handleActivatorTap = useCallback(() => {
    const now = Date.now();
    tapsRef.current = tapsRef.current.filter(t => now - t < TAP_WINDOW_MS);
    tapsRef.current.push(now);
    if (tapsRef.current.length >= TAP_COUNT_TO_ACTIVATE) {
      tapsRef.current = [];
      setActive(prev => {
        const next = !prev;
        setDebugEnabled(next);
        return next;
      });
    }
  }, []);

  return { debugActive: active, handleActivatorTap };
}

export default function DebugOverlay({ active }: { active: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    const push = (level: LogEntry['level'], args: unknown[]) => {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
      setLogs(prev => {
        const next = [...prev, { time, level, msg }];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    };

    console.warn = (...args: unknown[]) => { origWarn(...args); push('warn', args); };
    console.error = (...args: unknown[]) => { origError(...args); push('error', args); };

    return () => {
      console.warn = origWarn;
      console.error = origError;
    };
  }, [active]);

  useEffect(() => {
    if (visible && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, visible]);

  const clear = useCallback(() => setLogs([]), []);

  const copyAll = useCallback(() => {
    const text = logs.map(l => `${l.time} [${l.level}] ${l.msg}`).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  }, [logs]);

  if (!active) return null;

  const errorCount = logs.filter(l => l.level === 'error').length;

  return (
    <>
      <div
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'fixed', bottom: 8, left: 8, zIndex: 999999,
          background: errorCount > 0 ? 'rgba(220,40,40,0.9)' : 'rgba(50,50,50,0.85)',
          color: '#0f0', borderRadius: '50%', width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold',
          border: `1.5px solid ${errorCount > 0 ? '#f44' : '#555'}`,
          backdropFilter: 'blur(8px)', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {logs.length}
      </div>

      {visible && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999998,
          background: 'rgba(0,0,0,0.94)', color: '#ccc',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10, overflow: 'auto',
          padding: '44px 8px 8px', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
            display: 'flex', gap: 8, padding: '8px',
            background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #333',
          }}>
            <button onClick={() => setVisible(false)} style={btnStyle}>Close</button>
            <button onClick={clear} style={btnStyle}>Clear</button>
            <button onClick={copyAll} style={btnStyle}>Copy</button>
            <span style={{ marginLeft: 'auto', color: '#666', fontSize: 10, alignSelf: 'center' }}>
              {logs.length} entries
            </span>
          </div>
          {logs.map((l, i) => (
            <div key={i} style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '3px 0',
              color: l.level === 'error' ? '#f55' : '#ccc',
            }}>
              <span style={{ color: '#666' }}>{l.time}</span>{' '}
              <span style={{ color: l.level === 'error' ? '#f77' : '#888', fontSize: 9 }}>[{l.level}]</span>{' '}
              <span style={{ wordBreak: 'break-all' }}>{l.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </>
  );
}

const btnStyle: React.CSSProperties = {
  color: '#ddd', background: 'rgba(80,80,80,0.8)', border: '1px solid #555',
  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
