import { logQueue } from '@/lib/debugLog';

/** Compact track summary for queue debug logs. */
export function trkSummary(t: { id: string; name: string; provider?: string } | null | undefined): string {
  if (!t) return '(none)';
  return `[${t.provider ?? '?'}] "${t.name}" (${t.id.slice(0, 8)})`;
}

export function queueSnapshot(label: string, tracks: { id: string; name: string; provider?: string }[], mediaLen: number, idx: number) {
  logQueue(
    '%s — %d tracks, mediaTracksRef=%d, index=%d, current=%s',
    label,
    tracks.length,
    mediaLen,
    idx,
    trkSummary(tracks[idx]),
  );
  if (tracks.length <= 30) {
    logQueue('  trackIds: %s', tracks.map((t, i) => `${i}:${t.id.slice(0, 8)}`).join(' '));
  }
}
