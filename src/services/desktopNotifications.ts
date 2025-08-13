interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  tag?: string;
  requireInteraction?: boolean;
}

class DesktopNotificationService {
  private isSupported: boolean;
  private permission: NotificationPermission = 'default';
  private isElectron: boolean;

  constructor() {
    this.isSupported = 'Notification' in window;
    this.isElectron = !!(window as any).electronAPI?.isElectron;
    this.permission = this.isSupported ? Notification.permission : 'denied';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    // In Electron, use the main process for notifications
    if (this.isElectron && (window as any).electronAPI) {
      try {
        await (window as any).electronAPI.showNotification(options);
        return;
      } catch (error) {
        console.warn('Failed to show Electron notification, falling back to browser notifications:', error);
      }
    }

    // Fallback to browser notifications
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return;
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false
      });

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      // Handle notification clicks
      notification.onclick = () => {
        // Focus the window if it's an Electron app
        if (this.isElectron && (window as any).electronAPI) {
          window.focus();
        }
        notification.close();
      };

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async showTrackChangeNotification(track: any, isPlaying: boolean): Promise<void> {
    if (!track) return;

    const title = isPlaying ? 'Now Playing' : 'Paused';
    const body = `${track.name} - ${track.artists?.map((artist: any) => artist.name).join(', ') || 'Unknown Artist'}`;
    const icon = track.album?.images?.[0]?.url;

    await this.showNotification({
      title,
      body,
      icon,
      tag: 'track-change',
      requireInteraction: false
    });
  }

  async showPlaylistNotification(playlistName: string, trackCount: number): Promise<void> {
    await this.showNotification({
      title: 'Playlist Loaded',
      body: `${playlistName} (${trackCount} tracks)`,
      tag: 'playlist-load'
    });
  }

  async showErrorNotification(error: string): Promise<void> {
    await this.showNotification({
      title: 'Error',
      body: error,
      tag: 'error',
      requireInteraction: true
    });
  }

  async showConnectionNotification(isConnected: boolean): Promise<void> {
    const title = isConnected ? 'Connected to Spotify' : 'Disconnected from Spotify';
    const body = isConnected 
      ? 'You can now control playback from your desktop'
      : 'Please check your internet connection and try again';

    await this.showNotification({
      title,
      body,
      tag: 'connection-status',
      requireInteraction: false
    });
  }

  // Check if notifications are supported and permitted
  isNotificationSupported(): boolean {
    return this.isSupported && this.permission === 'granted';
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  // Clear all notifications (useful for cleanup)
  clearAllNotifications(): void {
    if (this.isSupported && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.getNotifications().then(notifications => {
            notifications.forEach(notification => notification.close());
          });
        });
      });
    }
  }
}

export const desktopNotifications = new DesktopNotificationService();