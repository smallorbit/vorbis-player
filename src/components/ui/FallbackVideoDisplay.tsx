import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { AspectRatio } from './aspect-ratio';
import type { Track } from '../../services/spotify';

export interface FallbackVideoDisplayProps {
  track?: Track | null;
  fallbackType?: 'album_art' | 'generated' | 'placeholder';
  onSearchRetry?: () => void;
  onManualSearch?: () => void;
  onSkip?: () => void;
  albumArtUrl?: string;
  className?: string;
}

const FallbackVideoDisplay: React.FC<FallbackVideoDisplayProps> = ({
  track,
  fallbackType = 'generated',
  onSearchRetry,
  onManualSearch,
  onSkip,
  albumArtUrl,
  className
}) => {
  const trackName = track?.name || 'Unknown Track';
  const artistName = track?.artists || 'Unknown Artist';
  const albumName = track?.album || '';

  const renderAlbumArtFallback = () => (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
      {albumArtUrl ? (
        <div className="relative w-full h-full">
          <img
            src={albumArtUrl}
            alt={`${trackName} - ${artistName}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to generated content if image fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="text-center text-white p-4">
              <div className="text-lg font-bold mb-1">{trackName}</div>
              <div className="text-sm opacity-90">{artistName}</div>
              {albumName && <div className="text-xs opacity-75 mt-1">{albumName}</div>}
            </div>
          </div>
          {/* Subtle animation overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse" />
        </div>
      ) : (
        renderGeneratedFallback()
      )}
    </div>
  );

  const renderGeneratedFallback = () => {
    // Create a deterministic color based on track name
    const getTrackColor = () => {
      if (!track?.name) return { primary: '#6366f1', secondary: '#8b5cf6' };
      
      const hash = track.name.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0);
      
      const colors = [
        { primary: '#6366f1', secondary: '#8b5cf6' }, // indigo-purple
        { primary: '#06b6d4', secondary: '#0891b2' }, // cyan
        { primary: '#10b981', secondary: '#059669' }, // emerald
        { primary: '#f59e0b', secondary: '#d97706' }, // amber
        { primary: '#ef4444', secondary: '#dc2626' }, // red
        { primary: '#8b5cf6', secondary: '#7c3aed' }, // violet
        { primary: '#06b6d4', secondary: '#0284c7' }, // sky
        { primary: '#84cc16', secondary: '#65a30d' }, // lime
      ];
      
      return colors[Math.abs(hash) % colors.length];
    };

    const colors = getTrackColor();

    return (
      <div 
        className="relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
        }}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse" />
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 2px, transparent 2px),
                               radial-gradient(circle at 75% 75%, white 2px, transparent 2px)`,
              backgroundSize: '50px 50px'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-white p-6">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <span className="text-2xl">🎵</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-lg font-bold leading-tight">{trackName}</div>
            <div className="text-sm opacity-90">{artistName}</div>
            {albumName && <div className="text-xs opacity-75">{albumName}</div>}
          </div>
          
          {/* Pulse animation */}
          <div className="mt-4 flex justify-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    );
  };

  const renderPlaceholderFallback = () => (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="text-center text-gray-500 dark:text-gray-400 p-6">
        <div className="text-4xl mb-3">📺</div>
        <div className="text-sm font-medium mb-2">No Video Available</div>
        <div className="text-xs">Video content could not be loaded</div>
      </div>
    </div>
  );

  const renderFallbackContent = () => {
    switch (fallbackType) {
      case 'album_art':
        return renderAlbumArtFallback();
      case 'generated':
        return renderGeneratedFallback();
      case 'placeholder':
        return renderPlaceholderFallback();
      default:
        return renderGeneratedFallback();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main fallback display */}
      <AspectRatio ratio={16 / 9}>
        {renderFallbackContent()}
      </AspectRatio>

      {/* Action card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200 text-base">
            <span>🔍</span>
            <span>Video Search Failed</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            {fallbackType === 'album_art' && albumArtUrl
              ? "Showing album artwork while video loads. You can search for a specific video or continue with this visual."
              : "No video was found for this track. You can retry the search, manually search for a video, or continue with this generated visual."
            }
          </div>

          {/* Track info */}
          {track && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
              <div><strong>Track:</strong> {trackName}</div>
              <div><strong>Artist:</strong> {artistName}</div>
              {albumName && <div><strong>Album:</strong> {albumName}</div>}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {onSearchRetry && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onSearchRetry}
                className="flex items-center space-x-1"
              >
                <span>🔄</span>
                <span>Retry Search</span>
              </Button>
            )}
            
            {onManualSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManualSearch}
                className="flex items-center space-x-1"
              >
                <span>🔍</span>
                <span>Manual Search</span>
              </Button>
            )}
            
            {onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="flex items-center space-x-1"
              >
                <span>⏭️</span>
                <span>Continue</span>
              </Button>
            )}
          </div>

          {/* Helpful tip */}
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            💡 <strong>Tip:</strong> This visual will update when you switch tracks or when a video becomes available.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export interface ManualSearchPromptProps {
  track?: Track | null;
  onSearch?: (query: string) => void;
  onCancel?: () => void;
  className?: string;
}

const ManualSearchPrompt: React.FC<ManualSearchPromptProps> = ({
  track,
  onSearch,
  onCancel,
  className
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions] = React.useState(() => {
    if (!track) return [];
    
    const base = track.name;
    const artist = track.artists;
    
    return [
      `${base} ${artist}`,
      `${base} ${artist} official`,
      `${base} ${artist} music video`,
      `${base} ${artist} live`,
      `${base} acoustic`,
      `${artist} ${base}`,
    ].filter(Boolean);
  });

  const handleSearch = () => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    if (onSearch) {
      onSearch(suggestion);
    }
  };

  return (
    <Card className={cn("border-green-200 bg-green-50 dark:bg-green-900/20", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
          <span>🔍</span>
          <span>Manual Video Search</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-green-700 dark:text-green-300">
          Enter a custom search query to find the perfect video for this track:
        </div>

        {track && (
          <div className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-2 rounded">
            <strong>Current Track:</strong> {track.name} - {track.artists}
          </div>
        )}

        {/* Search input */}
        <div className="space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter search terms..."
            className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-green-700 dark:text-green-300">
              Suggested searches:
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-800 dark:text-green-200 rounded text-xs transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSearch}
            disabled={!searchQuery.trim()}
            className="flex items-center space-x-1"
          >
            <span>🔍</span>
            <span>Search</span>
          </Button>
          
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="flex items-center space-x-1"
            >
              <span>✕</span>
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { FallbackVideoDisplay, ManualSearchPrompt };