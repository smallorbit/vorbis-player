import type { Track } from '@/services/spotify';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';

/** Convert MediaTrack to Track for UI; Dropbox tracks use empty uri (playback via ref). */
export function mediaTrackToTrack(m: MediaTrack): Track {
  return {
    id: m.id,
    provider: m.provider,
    name: m.name,
    artists: m.artists,
    artistsData: m.artistsData?.map((a) => ({ name: a.name, url: a.url ?? '' })),
    album: m.album,
    album_id: m.albumId,
    track_number: m.trackNumber,
    duration_ms: m.durationMs,
    uri: m.playbackRef.ref,
    image: m.image,
  };
}

/** Build MediaTrack from Track (e.g. when only UI track is available, e.g. Spotify context playback). */
export function trackToMediaTrack(t: Track): MediaTrack {
  const provider = (t.provider ?? providerRegistry.getAll()[0]?.id ?? 'unknown') as ProviderId;
  return {
    id: t.id,
    provider,
    playbackRef: { provider, ref: t.uri },
    name: t.name,
    artists: t.artists,
    artistsData: t.artistsData?.map((a) => ({ name: a.name, url: a.url })),
    album: t.album,
    albumId: t.album_id,
    trackNumber: t.track_number,
    durationMs: t.duration_ms,
    image: t.image,
  };
}

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
