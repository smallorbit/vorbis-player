import { logQueue } from '@/lib/debugLog';

/** Compact track summary for queue debug logs. */
export function trkSummary(t: { id: string; name: string; provider?: string } | null | undefined): string {
  if (!t) return '(none)';
  return `[${t.provider ?? '?'}] "${t.name}" (${t.id.slice(0, 8)})`;
}

export function queueSnapshot(label: string, tracks: { id: string; name: string; provider?: string }[], queueLen: number, idx: number) {
  logQueue(
    '%s — %d tracks, queueLen=%d, index=%d, current=%s',
    label,
    tracks.length,
    queueLen,
    idx,
    trkSummary(tracks[idx]),
  );
  if (tracks.length <= 30) {
    logQueue('  trackIds: %s', tracks.map((t, i) => `${i}:${t.id.slice(0, 8)}`).join(' '));
  }
}
