import { spotifyPlayer } from './spotifyPlayer';

class GlobalShortcutsService {
  private listeners: Map<string, () => void> = new Map();
  private isInitialized = false;

  constructor() {
    this.handleGlobalShortcut = this.handleGlobalShortcut.bind(this);
  }

  initialize() {
    if (this.isInitialized) return;

    // Listen for global shortcuts from Electron
    window.addEventListener('global-shortcut', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleGlobalShortcut(customEvent.detail);
    });

    // Listen for media key events (if supported by browser)
    this.setupMediaKeyListeners();

    this.isInitialized = true;
  }

  private setupMediaKeyListeners() {
    // Media Session API for media key support
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.handleGlobalShortcut('play-pause');
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.handleGlobalShortcut('play-pause');
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.handleGlobalShortcut('previous-track');
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.handleGlobalShortcut('next-track');
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.handleGlobalShortcut('seek-backward');
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.handleGlobalShortcut('seek-forward');
      });
    }

    // Keyboard event listeners for custom shortcuts
    document.addEventListener('keydown', (event) => {
      // Only handle shortcuts when not in input fields
      if (this.isInputElement(event.target as HTMLElement)) {
        return;
      }

      const shortcut = this.getShortcutFromEvent(event);
      if (shortcut) {
        event.preventDefault();
        this.handleGlobalShortcut(shortcut);
      }
    });
  }

  private isInputElement(element: HTMLElement): boolean {
    const inputTypes = ['input', 'textarea', 'select'];
    const contentEditable = element.contentEditable === 'true';
    const isInput = inputTypes.includes(element.tagName.toLowerCase());
    const hasRole = element.getAttribute('role') === 'textbox';
    
    return isInput || contentEditable || hasRole;
  }

  private getShortcutFromEvent(event: KeyboardEvent): string | null {
    const { key, ctrlKey, shiftKey, altKey, metaKey } = event;
    
    // Media key shortcuts
    if (key === 'MediaPlayPause') return 'play-pause';
    if (key === 'MediaNextTrack') return 'next-track';
    if (key === 'MediaPreviousTrack') return 'previous-track';
    
    // Custom shortcuts
    if (key === ' ' && !ctrlKey && !shiftKey && !altKey && !metaKey) {
      return 'play-pause';
    }
    
    if (key === 'ArrowRight' && !ctrlKey && !shiftKey && !altKey && !metaKey) {
      return 'next-track';
    }
    
    if (key === 'ArrowLeft' && !ctrlKey && !shiftKey && !altKey && !metaKey) {
      return 'previous-track';
    }
    
    // Show/hide window (Ctrl/Cmd + Shift + V)
    if (key === 'V' && (ctrlKey || metaKey) && shiftKey && !altKey) {
      return 'toggle-window';
    }
    
    // Toggle always on top (Ctrl/Cmd + Shift + T)
    if (key === 'T' && (ctrlKey || metaKey) && shiftKey && !altKey) {
      return 'toggle-always-on-top';
    }
    
    return null;
  }

  private async handleGlobalShortcut(shortcut: string) {
    try {
      switch (shortcut) {
        case 'play-pause':
          await this.togglePlayPause();
          break;
        case 'next-track':
          await this.nextTrack();
          break;
        case 'previous-track':
          await this.previousTrack();
          break;
        case 'toggle-window':
          this.toggleWindow();
          break;
        case 'toggle-always-on-top':
          this.toggleAlwaysOnTop();
          break;
        default:
          console.log('Unknown shortcut:', shortcut);
      }
    } catch (error) {
      console.error('Error handling global shortcut:', error);
    }
  }

  private async togglePlayPause() {
    try {
      const state = await spotifyPlayer.getCurrentState();
      if (state?.paused) {
        await spotifyPlayer.resume();
      } else {
        await spotifyPlayer.pause();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }

  private async nextTrack() {
    try {
      await spotifyPlayer.nextTrack();
    } catch (error) {
      console.error('Error skipping to next track:', error);
    }
  }

  private async previousTrack() {
    try {
      await spotifyPlayer.previousTrack();
    } catch (error) {
      console.error('Error skipping to previous track:', error);
    }
  }

  private toggleWindow() {
    // This will be handled by the desktop integration hook
    const event = new CustomEvent('toggle-window');
    window.dispatchEvent(event);
  }

  private toggleAlwaysOnTop() {
    // This will be handled by the desktop integration hook
    const event = new CustomEvent('toggle-always-on-top');
    window.dispatchEvent(event);
  }

  // Update media session metadata
  updateMediaSessionMetadata(track: any) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artists?.map((artist: any) => artist.name).join(', ') || '',
        album: track.album?.name || '',
        artwork: track.album?.images?.map((image: any) => ({
          src: image.url,
          sizes: `${image.width}x${image.height}`,
          type: 'image/jpeg'
        })) || []
      });
    }
  }

  // Update media session playback state
  updateMediaSessionPlaybackState(state: any) {
    if ('mediaSession' in navigator && state) {
      navigator.mediaSession.playbackState = state.paused ? 'paused' : 'playing';
    }
  }

  destroy() {
    this.listeners.clear();
    this.isInitialized = false;
  }
}

export const globalShortcuts = new GlobalShortcutsService();