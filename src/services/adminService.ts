type VideoMode = 'pandas' | 'puppies' | 'kitties';

interface VideoMetadata {
  id: string;
  title?: string;
  description?: string;
  duration?: string;
  uploadDate?: string;
  viewCount?: string;
}

class AdminService {
  /**
   * Downloads an updated video IDs JSON file with selected videos removed
   */
  downloadUpdatedVideoIds(mode: VideoMode, remainingVideoIds: string[]): void {
    const content = JSON.stringify(remainingVideoIds, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-videoIds.json`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Validates if a YouTube video ID is properly formatted
   */
  validateVideoId(videoId: string): boolean {
    // YouTube video IDs are typically 11 characters long and contain alphanumeric characters, hyphens, and underscores
    const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
    return youtubeIdPattern.test(videoId);
  }

  /**
   * Attempts to fetch video metadata from YouTube (requires API key)
   */
  async fetchVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    // This would require YouTube Data API v3 key
    // For now, return basic info based on video ID
    try {
      // Could implement API call here if VITE_YOUTUBE_API_KEY is available
      return {
        id: videoId,
        title: `Video ${videoId}`,
        description: 'No description available',
        duration: 'Unknown',
        uploadDate: 'Unknown',
        viewCount: 'Unknown'
      };
    } catch (error) {
      console.error(`Failed to fetch metadata for video ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Batch validates video IDs to check if they're still accessible
   */
  async validateVideoBatch(videoIds: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const videoId of videoIds) {
      if (this.validateVideoId(videoId)) {
        // Additional check: try to load thumbnail to verify video exists
        try {
          await this.checkVideoExists(videoId);
          valid.push(videoId);
        } catch {
          invalid.push(videoId);
        }
      } else {
        invalid.push(videoId);
      }
    }

    return { valid, invalid };
  }

  /**
   * Checks if a video exists by attempting to load its thumbnail
   */
  private checkVideoExists(videoId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    });
  }

  /**
   * Exports current video collection as backup
   */
  async exportVideoCollection(mode: VideoMode, videoIds: string[]): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportData = {
      mode,
      exportDate: new Date().toISOString(),
      totalVideos: videoIds.length,
      videoIds
    };

    const content = JSON.stringify(exportData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-backup-${timestamp}.json`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Analyzes video collection for potential issues
   */
  async analyzeVideoCollection(videoIds: string[]): Promise<{
    totalCount: number;
    duplicates: string[];
    invalidFormats: string[];
    suspiciousIds: string[];
  }> {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const invalidFormats: string[] = [];
    const suspiciousIds: string[] = [];

    for (const videoId of videoIds) {
      // Check for duplicates
      if (seen.has(videoId)) {
        duplicates.push(videoId);
      } else {
        seen.add(videoId);
      }

      // Check format
      if (!this.validateVideoId(videoId)) {
        invalidFormats.push(videoId);
      }

      // Check for suspicious patterns (common placeholder IDs)
      if (videoId.startsWith('sample-') || videoId.includes('test') || videoId.includes('placeholder')) {
        suspiciousIds.push(videoId);
      }
    }

    return {
      totalCount: videoIds.length,
      duplicates,
      invalidFormats,
      suspiciousIds
    };
  }

  /**
   * Generates a report of video collection health
   */
  async generateHealthReport(mode: VideoMode, videoIds: string[]): Promise<string> {
    const analysis = await this.analyzeVideoCollection(videoIds);
    const validation = await this.validateVideoBatch(videoIds);

    const report = `
VIDEO COLLECTION HEALTH REPORT
===============================
Mode: ${mode.toUpperCase()}
Generated: ${new Date().toLocaleString()}

COLLECTION STATS:
- Total Videos: ${analysis.totalCount}
- Valid Videos: ${validation.valid.length}
- Invalid Videos: ${validation.invalid.length}

ISSUES FOUND:
- Duplicates: ${analysis.duplicates.length}
- Invalid Formats: ${analysis.invalidFormats.length}
- Suspicious IDs: ${analysis.suspiciousIds.length}

${analysis.duplicates.length > 0 ? `
DUPLICATE VIDEO IDs:
${analysis.duplicates.map(id => `- ${id}`).join('\n')}
` : ''}

${analysis.invalidFormats.length > 0 ? `
INVALID FORMAT VIDEO IDs:
${analysis.invalidFormats.map(id => `- ${id}`).join('\n')}
` : ''}

${analysis.suspiciousIds.length > 0 ? `
SUSPICIOUS VIDEO IDs:
${analysis.suspiciousIds.map(id => `- ${id}`).join('\n')}
` : ''}

${validation.invalid.length > 0 ? `
INACCESSIBLE VIDEO IDs:
${validation.invalid.map(id => `- ${id}`).join('\n')}
` : ''}

RECOMMENDATIONS:
${analysis.duplicates.length > 0 ? '- Remove duplicate video IDs\n' : ''}
${analysis.invalidFormats.length > 0 ? '- Fix or remove invalid format video IDs\n' : ''}
${analysis.suspiciousIds.length > 0 ? '- Review and replace suspicious placeholder IDs\n' : ''}
${validation.invalid.length > 0 ? '- Remove inaccessible video IDs\n' : ''}
${analysis.totalCount < 10 ? '- Consider adding more videos for better variety\n' : ''}
${analysis.totalCount > 100 ? '- Consider curating collection to maintain quality\n' : ''}
`;

    return report.trim();
  }
}

export const adminService = new AdminService();