import { useState, useEffect, useCallback, useRef } from 'react';
import { getLogs, clearLogs, exportLogs } from '../services/errorLogger';
import type { ErrorLogEntry } from '../services/errorLogger';

const MAX_DISPLAY = 500;
const POLL_INTERVAL_MS = 3000;

export default function ErrorLogViewer({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshLogs = useCallback(async () => {
    const entries = await getLogs(MAX_DISPLAY);
    setLogs(entries);
  }, []);

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshLogs]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleClear = useCallback(async () => {
    await clearLogs();
    setLogs([]);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportLogs();
    } finally {
      setIsExporting(false);
    }
  }, []);

  const filtered = filter
    ? logs.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999998,
      background: 'rgba(0,0,0,0.96)', color: '#ccc',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 10, overflow: 'auto',
      padding: '52px 8px 8px', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Toolbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
        display: 'flex', gap: 6, padding: '8px',
        background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #333', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={btnStyle}>Close</button>
        <button onClick={handleClear} style={btnStyle}>Clear</button>
        <button onClick={handleExport} style={btnStyle} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Export error.log'}
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'rgba(60,60,60,0.8)', color: '#ddd',
            border: '1px solid #555', borderRadius: 6,
            padding: '4px 8px', fontSize: 11, outline: 'none',
            flex: '1 1 100px', minWidth: 80,
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <span style={{ color: '#666', fontSize: 10, whiteSpace: 'nowrap' }}>
          {filtered.length} / {logs.length} entries
        </span>
      </div>

      {/* Log entries (oldest first = reversed from getLogs which returns newest first) */}
      {[...filtered].reverse().map((entry, i) => {
        const isWarn = entry.level === 'WARN';
        return (
          <div key={entry.id ?? i} style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '3px 0', color: isWarn ? '#fa3' : '#f55',
          }}>
            <span style={{ color: '#888', fontSize: 9 }}>[{entry.timestamp}]</span>{' '}
            <span style={{ color: isWarn ? '#c90' : '#c44', fontSize: 9 }}>{entry.level}</span>{' '}
            <span style={{ wordBreak: 'break-all' }}>{entry.message}</span>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', marginTop: 40, fontSize: 12 }}>
          {logs.length === 0 ? 'No log entries yet.' : 'No entries match filter.'}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  color: '#ddd', background: 'rgba(80,80,80,0.8)', border: '1px solid #555',
  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
