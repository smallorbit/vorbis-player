import { trackVideoAssociationService } from './trackVideoAssociationService';
import type { TrackVideoAssociation } from './trackVideoAssociationService';
import { videoSearchOrchestrator } from './videoSearchOrchestrator';
import type { Track } from './spotify';

export interface VideoOption {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  isAssociated?: boolean;
}

export interface VideoManagementResult {
  success: boolean;
  message: string;
  video?: TrackVideoAssociation;
}

class VideoManagementService {
  private static instance: VideoManagementService;

  private constructor() {}

  public static getInstance(): VideoManagementService {
    if (!VideoManagementService.instance) {
      VideoManagementService.instance = new VideoManagementService();
    }
    return VideoManagementService.instance;
  }

  // Get video for track (checks associations first, then auto-discovers)
  public async getVideoForTrack(track: Track): Promise<TrackVideoAssociation | null> {
    // First check if we have a stored association
    const storedAssociation = trackVideoAssociationService.getVideoForTrack(track.id);
    if (storedAssociation) {
      return storedAssociation;
    }

    // If no stored association and preferences allow, auto-discover
    const preferences = trackVideoAssociationService.getPreferences();
    if (!preferences.rememberVideoChoices) {
      return null;
    }

    try {
      // Use existing video search orchestrator to find videos
      const searchResults = await videoSearchOrchestrator.findAlternativeVideos(track);
      
      if (searchResults.length > 0) {
        const bestVideo = searchResults[0];
        
        // Store as auto-discovered association
        trackVideoAssociationService.setVideoForTrack(
          track.id,
          bestVideo.id,
          bestVideo.title,
          bestVideo.thumbnailUrl,
          false // isUserSet = false for auto-discovered
        );

        return trackVideoAssociationService.getVideoForTrack(track.id);
      }
    } catch (error) {
      console.error('Failed to auto-discover video for track:', error);
    }

    return null;
  }

  // Search for alternative videos for a track
  public async searchVideosForTrack(track: Track, limit: number = 10): Promise<VideoOption[]> {
    try {
      const searchResults = await videoSearchOrchestrator.findAlternativeVideos(track);
      const currentAssociation = trackVideoAssociationService.getVideoForTrack(track.id);
      
      return searchResults.slice(0, limit).map(result => ({
        id: result.id,
        title: result.title,
        thumbnail: result.thumbnailUrl,
        duration: result.duration || '',
        views: result.view_count || '',
        isAssociated: currentAssociation?.videoId === result.id,
      }));
    } catch (error) {
      console.error('Failed to search videos for track:', error);
      return [];
    }
  }

  // Manually set video for track
  public async setVideoForTrack(
    track: Track, 
    videoId: string, 
    videoTitle?: string,
    videoThumbnail?: string
  ): Promise<VideoManagementResult> {
    try {
      // If title/thumbnail not provided, try to get from search results
      if (!videoTitle || !videoThumbnail) {
        const searchResults = await this.searchVideosForTrack(track, 20);
        const matchingVideo = searchResults.find(v => v.id === videoId);
        
        if (matchingVideo) {
          videoTitle = matchingVideo.title;
          videoThumbnail = matchingVideo.thumbnail;
        }
      }

      trackVideoAssociationService.setVideoForTrack(
        track.id,
        videoId,
        videoTitle || `Video for ${track.name}`,
        videoThumbnail,
        true // isUserSet = true for manual assignments
      );

      const association = trackVideoAssociationService.getVideoForTrack(track.id);
      
      return {
        success: true,
        message: 'Video successfully associated with track',
        video: association || undefined,
      };
    } catch (error) {
      console.error('Failed to set video for track:', error);
      return {
        success: false,
        message: 'Failed to associate video with track',
      };
    }
  }

  // Remove video association for track
  public removeVideoForTrack(track: Track): VideoManagementResult {
    try {
      const hadAssociation = trackVideoAssociationService.hasAssociation(track.id);
      
      if (!hadAssociation) {
        return {
          success: false,
          message: 'No video association found for this track',
        };
      }

      trackVideoAssociationService.removeVideoForTrack(track.id);
      
      return {
        success: true,
        message: 'Video association removed successfully',
      };
    } catch (error) {
      console.error('Failed to remove video for track:', error);
      return {
        success: false,
        message: 'Failed to remove video association',
      };
    }
  }

  // Get all associations for display/management
  public getAllAssociationsWithTrackInfo(tracks: Track[]): Array<{
    track: Track;
    association: TrackVideoAssociation;
  }> {
    const associations = trackVideoAssociationService.getAllAssociations();
    const result: Array<{ track: Track; association: TrackVideoAssociation }> = [];

    tracks.forEach(track => {
      const association = associations[track.id];
      if (association) {
        result.push({ track, association });
      }
    });

    return result;
  }

  // Bulk operations
  public async refreshAllAssociations(tracks: Track[]): Promise<{
    updated: number;
    failed: number;
  }> {
    let updated = 0;
    let failed = 0;

    for (const track of tracks) {
      try {
        const currentAssociation = trackVideoAssociationService.getVideoForTrack(track.id);
        
        // Only refresh auto-discovered associations
        if (currentAssociation && !currentAssociation.isUserSet) {
          const searchResults = await videoSearchOrchestrator.findAlternativeVideos(track);
          
          if (searchResults.length > 0 && searchResults[0].id !== currentAssociation.videoId) {
            trackVideoAssociationService.setVideoForTrack(
              track.id,
              searchResults[0].id,
              searchResults[0].title,
              searchResults[0].thumbnailUrl,
              false
            );
            updated++;
          }
        }
      } catch (error) {
        console.error(`Failed to refresh association for track ${track.id}:`, error);
        failed++;
      }
    }

    return { updated, failed };
  }

  public clearAllAssociations(): VideoManagementResult {
    try {
      const count = trackVideoAssociationService.getAssociationCount();
      trackVideoAssociationService.clearAllAssociations();
      
      return {
        success: true,
        message: `Successfully cleared ${count} video associations`,
      };
    } catch (error) {
      console.error('Failed to clear all associations:', error);
      return {
        success: false,
        message: 'Failed to clear video associations',
      };
    }
  }

  // Validation helpers
  public validateYouTubeUrl(url: string): { valid: boolean; videoId?: string } {
    try {
      const videoIdRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
      const match = url.match(videoIdRegex);
      
      if (match && match[1]) {
        return { valid: true, videoId: match[1] };
      }
      
      // Check if it's just a video ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return { valid: true, videoId: url };
      }
      
      return { valid: false };
    } catch (error) {
      return { valid: false };
    }
  }

  // Statistics and insights
  public getManagementStats(): {
    totalAssociations: number;
    userSetCount: number;
    autoDiscoveredCount: number;
    oldestAssociation?: string;
    newestAssociation?: string;
  } {
    const count = trackVideoAssociationService.getAssociationCount();
    const byType = trackVideoAssociationService.getAssociationsByType();
    const associations = Object.values(trackVideoAssociationService.getAllAssociations());
    
    let oldestDate: string | undefined;
    let newestDate: string | undefined;
    
    if (associations.length > 0) {
      const dates = associations.map(a => a.dateAssociated).sort();
      oldestDate = dates[0];
      newestDate = dates[dates.length - 1];
    }

    return {
      totalAssociations: count,
      userSetCount: byType.userSet,
      autoDiscoveredCount: byType.autoDiscovered,
      oldestAssociation: oldestDate,
      newestAssociation: newestDate,
    };
  }

  // Preferences management
  public getPreferences() {
    return trackVideoAssociationService.getPreferences();
  }

  public updatePreferences(updates: Partial<ReturnType<typeof trackVideoAssociationService.getPreferences>>) {
    trackVideoAssociationService.updatePreferences(updates);
  }

  // Backup/restore
  public exportData(): string {
    return trackVideoAssociationService.exportSettings();
  }

  public importData(data: string): VideoManagementResult {
    const success = trackVideoAssociationService.importSettings(data);
    return {
      success,
      message: success ? 'Settings imported successfully' : 'Failed to import settings',
    };
  }
}

export const videoManagementService = VideoManagementService.getInstance();