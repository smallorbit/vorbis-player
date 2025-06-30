export interface TrackVideoAssociation {
  trackId: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail?: string;
  dateAssociated: string;
  isUserSet: boolean; // true if manually set by user, false if auto-discovered
}

export interface TrackVideoSettings {
  associations: { [trackId: string]: TrackVideoAssociation };
  preferences: {
    autoPlayNext: boolean;
    rememberVideoChoices: boolean;
    backupEnabled: boolean;
  };
  version: string;
}

class TrackVideoAssociationService {
  private static instance: TrackVideoAssociationService;
  private readonly STORAGE_KEY = 'vorbis-player-track-video-associations';
  private readonly SETTINGS_VERSION = '1.0.0';
  
  private settings: TrackVideoSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): TrackVideoAssociationService {
    if (!TrackVideoAssociationService.instance) {
      TrackVideoAssociationService.instance = new TrackVideoAssociationService();
    }
    return TrackVideoAssociationService.instance;
  }

  private getDefaultSettings(): TrackVideoSettings {
    return {
      associations: {},
      preferences: {
        autoPlayNext: true,
        rememberVideoChoices: true,
        backupEnabled: true,
      },
      version: this.SETTINGS_VERSION,
    };
  }

  private loadSettings(): TrackVideoSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultSettings();
      }

      const parsed = JSON.parse(stored) as TrackVideoSettings;
      
      // Version migration logic
      if (!parsed.version || parsed.version !== this.SETTINGS_VERSION) {
        return this.migrateSettings(parsed);
      }

      // Validate structure
      if (!parsed.associations || !parsed.preferences) {
        console.warn('Invalid settings structure, using defaults');
        return this.getDefaultSettings();
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load track-video settings:', error);
      return this.getDefaultSettings();
    }
  }

  private migrateSettings(oldSettings: any): TrackVideoSettings {
    const newSettings = this.getDefaultSettings();
    
    // Preserve associations if they exist
    if (oldSettings.associations && typeof oldSettings.associations === 'object') {
      newSettings.associations = oldSettings.associations;
    }
    
    // Preserve preferences if they exist
    if (oldSettings.preferences && typeof oldSettings.preferences === 'object') {
      newSettings.preferences = { ...newSettings.preferences, ...oldSettings.preferences };
    }

    this.saveSettings(newSettings);
    return newSettings;
  }

  private saveSettings(settings?: TrackVideoSettings): void {
    try {
      const toSave = settings || this.settings;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save track-video settings:', error);
    }
  }

  // Association Management
  public getVideoForTrack(trackId: string): TrackVideoAssociation | null {
    if (!this.settings.preferences.rememberVideoChoices) {
      return null;
    }
    return this.settings.associations[trackId] || null;
  }

  public setVideoForTrack(
    trackId: string, 
    videoId: string, 
    videoTitle: string, 
    videoThumbnail?: string,
    isUserSet: boolean = true
  ): void {
    this.settings.associations[trackId] = {
      trackId,
      videoId,
      videoTitle,
      videoThumbnail,
      dateAssociated: new Date().toISOString(),
      isUserSet,
    };
    this.saveSettings();
  }

  public removeVideoForTrack(trackId: string): void {
    delete this.settings.associations[trackId];
    this.saveSettings();
  }

  public getAllAssociations(): { [trackId: string]: TrackVideoAssociation } {
    return { ...this.settings.associations };
  }

  public clearAllAssociations(): void {
    this.settings.associations = {};
    this.saveSettings();
  }

  // Preferences Management
  public getPreferences(): TrackVideoSettings['preferences'] {
    return { ...this.settings.preferences };
  }

  public updatePreferences(updates: Partial<TrackVideoSettings['preferences']>): void {
    this.settings.preferences = { ...this.settings.preferences, ...updates };
    this.saveSettings();
  }

  // Backup/Restore Functionality
  public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  public importSettings(settingsJson: string): boolean {
    try {
      const importedSettings = JSON.parse(settingsJson) as TrackVideoSettings;
      
      // Validate required structure
      if (!importedSettings.associations || !importedSettings.preferences) {
        throw new Error('Invalid settings format');
      }

      // Merge with current settings to preserve any new fields
      this.settings = {
        ...this.getDefaultSettings(),
        ...importedSettings,
        version: this.SETTINGS_VERSION, // Always use current version
      };

      this.saveSettings();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  public resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
  }

  // Utility Methods
  public getAssociationCount(): number {
    return Object.keys(this.settings.associations).length;
  }

  public getAssociationsByType(): { userSet: number; autoDiscovered: number } {
    const associations = Object.values(this.settings.associations);
    return {
      userSet: associations.filter(a => a.isUserSet).length,
      autoDiscovered: associations.filter(a => !a.isUserSet).length,
    };
  }

  public hasAssociation(trackId: string): boolean {
    return trackId in this.settings.associations;
  }

  // Clean up old associations (optional maintenance)
  public cleanupOldAssociations(maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
    const cutoffDate = new Date(Date.now() - maxAge);
    const associations = this.settings.associations;
    let removedCount = 0;

    Object.keys(associations).forEach(trackId => {
      const association = associations[trackId];
      if (new Date(association.dateAssociated) < cutoffDate && !association.isUserSet) {
        delete associations[trackId];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      this.saveSettings();
    }

    return removedCount;
  }
}

export const trackVideoAssociationService = TrackVideoAssociationService.getInstance();