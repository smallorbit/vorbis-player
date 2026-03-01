import { useState, useEffect, useCallback } from 'react';
import { useProfilingContext, type ProfilingSnapshot } from '@/contexts/ProfilingContext';

const btnStyle: React.CSSProperties = {
  color: '#ddd', background: 'rgba(80,80,80,0.8)', border: '1px solid #555',
  borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer',
};

const sectionHeader: React.CSSProperties = {
  color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1,
  margin: '6px 0 2px',
};

function heatColor(avgMs: number): string {
  if (avgMs < 4) return 'rgba(0,200,0,0.15)';
  if (avgMs < 16) return 'rgba(200,200,0,0.15)';
  return 'rgba(200,0,0,0.15)';
}

export function ProfilingOverlay(): React.ReactElement | null {
  const { enabled, collector } = useProfilingContext();
  const [snapshot, setSnapshot] = useState<ProfilingSnapshot | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!enabled || !collector) return;
    const id = setInterval(() => setSnapshot(collector.getSnapshot()), 500);
    return () => clearInterval(id);
  }, [enabled, collector]);

  const handleReset = useCallback(() => {
    collector?.reset();
    setSnapshot(null);
  }, [collector]);

  const handleExport = useCallback(() => {
    if (!collector) return;
    const blob = new Blob([collector.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profiling-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [collector]);

  const handleCopy = useCallback(() => {
    if (!collector) return;
    navigator.clipboard?.writeText(collector.exportJSON()).catch(() => {});
  }, [collector]);

  if (!enabled) return null;

  const totalRenders = snapshot
    ? Object.values(snapshot.components).reduce((s, c) => s + c.renderCount, 0)
    : 0;

  return (
    <div style={{
      position: 'fixed', top: 8, left: 8, zIndex: 999980,
      background: 'rgba(0,0,0,0.85)', color: '#fff', borderRadius: 8,
      padding: 8, fontSize: 11, fontFamily: 'monospace',
      maxWidth: 360, maxHeight: '80vh', overflow: 'auto', userSelect: 'none',
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{ ...btnStyle, width: '100%', textAlign: 'left' }}
      >
        {collapsed ? '▲' : '▼'} PROFILING{snapshot ? ` (${totalRenders} renders)` : ''}
      </button>

      {!collapsed && (
        snapshot === null ? (
          <div style={{ color: '#888', padding: '8px 0' }}>Collecting...</div>
        ) : (
          <>
            <div style={sectionHeader}>Render Heatmap</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ color: '#888' }}>
                  <td>Component</td><td>Renders</td><td>Avg ms</td><td>Max ms</td>
                </tr>
              </thead>
              <tbody>
                {Object.entries(snapshot.components)
                  .sort((a, b) => b[1].renderCount - a[1].renderCount)
                  .slice(0, 15)
                  .map(([name, s]) => (
                    <tr key={name} style={{ background: heatColor(s.avgDuration) }}>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</td>
                      <td>{s.renderCount}</td>
                      <td>{s.avgDuration.toFixed(1)}</td>
                      <td>{s.maxDuration.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div style={sectionHeader}>Context Updates</div>
            {Object.entries(snapshot.contexts).map(([name, s]) => (
              <div key={name} style={{ fontSize: 10 }}>{name}: {s.updateCount}</div>
            ))}

            <div style={{ ...sectionHeader, marginTop: 6 }}>Performance</div>
            <div style={{ fontSize: 10 }}>
              FPS: {snapshot.frameRate.current.toFixed(0)} (avg {snapshot.frameRate.avg.toFixed(0)}, min {snapshot.frameRate.min === Infinity ? '—' : snapshot.frameRate.min.toFixed(0)})
            </div>
            {snapshot.memory.current !== undefined && (
              <div style={{ fontSize: 10 }}>Heap: {snapshot.memory.current.toFixed(1)}MB</div>
            )}
            <div style={{ fontSize: 10 }}>
              Long tasks: {snapshot.longTasks.count} (max {snapshot.longTasks.maxDuration.toFixed(0)}ms)
            </div>

            <div style={sectionHeader}>Recent Events</div>
            <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 10 }}>
              {snapshot.recentEvents.slice(-20).map((e, i) => (
                <div key={i} style={{ color: '#aaa' }}>
                  [{e.phase}] {e.componentId} {e.actualDuration.toFixed(1)}ms
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button onClick={handleReset} style={btnStyle}>Reset</button>
              <button onClick={handleExport} style={btnStyle}>Export JSON</button>
              <button onClick={handleCopy} style={btnStyle}>Copy</button>
            </div>
          </>
        )
      )}
    </div>
  );
}
