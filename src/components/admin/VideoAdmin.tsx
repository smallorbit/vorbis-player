import { useState, useEffect, useCallback } from 'react';
import { youtubeService } from '../../services/youtube';
import { adminService } from '../../services/adminService';

type VideoMode = '80sTV' | '90sTV';

interface VideoItem {
  id: string;
  thumbnailUrl: string;
  embedUrl: string;
  title: string;
}

interface VideoAdminProps {
  onClose: () => void;
}

const VideoAdmin: React.FC<VideoAdminProps> = ({ onClose }) => {
  const [selectedMode, setSelectedMode] = useState<VideoMode>('80sTV');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async (mode: VideoMode) => {
    setLoading(true);
    setError(null);
    try {
      const videoIds = await youtubeService.loadVideoIdsFromCategory(mode);
      const videoItems: VideoItem[] = videoIds.map(id => ({
        id,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        embedUrl: youtubeService.createEmbedUrl(id, { controls: true }),
        title: `${getModeTitle(mode)} Video ${id}`
      }));
      setVideos(videoItems);
      setSelectedVideos(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos(selectedMode);
  }, [selectedMode, loadVideos]);

  const handleModeChange = (mode: VideoMode) => {
    setSelectedMode(mode);
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const selectAllVideos = () => {
    setSelectedVideos(new Set(videos.map(v => v.id)));
  };

  const deselectAllVideos = () => {
    setSelectedVideos(new Set());
  };

  const deleteSelectedVideos = async () => {
    if (selectedVideos.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedVideos.size} video(s) from the ${selectedMode} collection?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const remainingVideoIds = videos
        .filter(video => !selectedVideos.has(video.id))
        .map(video => video.id);
      
      // Use admin service to download updated file
      adminService.downloadUpdatedVideoIds(selectedMode, remainingVideoIds);

      alert(`Downloaded updated ${selectedMode}-videoIds.json file. Please replace the file in src/assets/ and refresh the page.`);
      
      // Reload videos to reflect changes (assuming user will replace file)
      setTimeout(() => {
        loadVideos(selectedMode);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete videos');
    }
  };

  const exportBackup = async () => {
    try {
      const videoIds = videos.map(v => v.id);
      await adminService.exportVideoCollection(selectedMode, videoIds);
      alert(`Backup exported for ${selectedMode} mode.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export backup');
    }
  };

  const generateHealthReport = async () => {
    try {
      const videoIds = videos.map(v => v.id);
      const report = await adminService.generateHealthReport(selectedMode, videoIds);
      
      // Download report as text file
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedMode}-health-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Health report downloaded successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate health report');
    }
  };

  const getModeEmoji = (mode: VideoMode) => {
    switch (mode) {
      case '90sTV': return '⓽⓪s';
      case '80sTV': return '8️⃣0️⃣s';
      default: return '8️⃣0️⃣s';
    }
  };

  const getModeTitle = (mode: VideoMode) => {
    switch (mode) {
      case '80sTV': return "80's TV";
      case '90sTV': return "90's TV";
      default: return "80's TV";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 rounded-lg w-full max-w-7xl h-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Video Management Admin</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Mode Selection */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-white/80">Mode:</span>
            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
              {(['80sTV', '90sTV'] as VideoMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    selectedMode === mode
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {getModeEmoji(mode)} {getModeTitle(mode)}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-white/60">
              {videos.length} total videos, {selectedVideos.size} selected
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={selectAllVideos}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                Select All
              </button>
              <button
                onClick={deselectAllVideos}
                className="px-3 py-1 bg-neutral-600 hover:bg-neutral-700 text-white rounded text-sm"
              >
                Deselect All
              </button>
              <button
                onClick={deleteSelectedVideos}
                disabled={selectedVideos.size === 0}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded text-sm"
              >
                Delete Selected ({selectedVideos.size})
              </button>
              <div className="border-l border-white/20 pl-2 flex gap-2">
                <button
                  onClick={exportBackup}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  Export Backup
                </button>
                <button
                  onClick={generateHealthReport}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                >
                  Health Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isSelected={selectedVideos.has(video.id)}
                  onToggleSelect={() => toggleVideoSelection(video.id)}
                />
              ))}
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="text-center text-white/60 py-12">
              <p>No videos found for {selectedMode} mode.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface VideoCardProps {
  video: VideoItem;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, isSelected, onToggleSelect }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  return (
    <div className={`relative bg-neutral-700 rounded-lg overflow-hidden transition-all duration-200 ${
      isSelected ? 'ring-2 ring-blue-500 bg-blue-900/20' : 'hover:bg-neutral-600'
    }`}>
      {/* Selection Checkbox */}
      <div className="absolute top-2 left-2 z-20">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
          />
        </label>
      </div>

      {/* Video ID Badge */}
      <div className="absolute top-2 right-2 z-10 bg-black/80 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-3rem)]">
        <div className="truncate">{video.id}</div>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-video bg-neutral-800">
        {isPlaying ? (
          <iframe
            src={video.embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div 
            className="relative w-full h-full cursor-pointer group"
            onClick={() => setIsPlaying(true)}
          >
            {!thumbnailError ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
                onError={() => setThumbnailError(true)}
              />
            ) : (
              <div className="w-full h-full bg-neutral-600 flex items-center justify-center text-white/60">
                No Thumbnail
              </div>
            )}
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center group-hover:bg-white/90 transition-colors">
                <svg className="w-6 h-6 ml-1 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-3">
        <div className="text-sm text-white/80 truncate" title={video.title}>
          {video.title}
        </div>
        {isPlaying && (
          <button
            onClick={() => setIsPlaying(false)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Stop Preview
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoAdmin;