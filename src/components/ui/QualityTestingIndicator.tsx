import React from 'react';
import { cn } from '../../lib/utils';

export interface QualityLevel {
  resolution: string;
  label: string;
  score: number;
  tested: boolean;
  available: boolean;
}

export interface QualityTestingIndicatorProps {
  isActive: boolean;
  currentVideo?: string;
  totalVideos?: number;
  currentProgress?: number;
  qualityLevels?: QualityLevel[];
  bestQuality?: QualityLevel;
  phase?: 'testing' | 'comparing' | 'complete';
  className?: string;
}

const QualityTestingIndicator: React.FC<QualityTestingIndicatorProps> = ({
  isActive,
  currentVideo,
  totalVideos = 1,
  currentProgress = 0,
  qualityLevels = [],
  bestQuality,
  phase = 'testing',
  className
}) => {
  if (!isActive) return null;

  const getPhaseMessage = () => {
    switch (phase) {
      case 'testing':
        return 'Testing video quality...';
      case 'comparing':
        return 'Comparing quality levels...';
      case 'complete':
        return 'Quality testing complete';
      default:
        return 'Processing video quality...';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const progressPercentage = Math.min((currentProgress / totalVideos) * 100, 100);

  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {getPhaseMessage()}
          </span>
        </div>
        
        {phase === 'complete' && bestQuality && (
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">Best:</span>
            <div className={cn("px-2 py-1 rounded text-xs font-medium", getQualityColor(bestQuality.score))}>
              {bestQuality.resolution}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">
            {currentVideo && `Testing: ${currentVideo}`}
          </span>
          <span className="text-xs text-gray-500">
            {currentProgress}/{totalVideos}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              phase === 'complete' ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Quality Levels Grid */}
      {qualityLevels.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quality Analysis
          </div>
          <div className="grid grid-cols-2 gap-2">
            {qualityLevels.map((level, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-2 rounded border text-xs",
                  level.tested 
                    ? level.available 
                      ? "border-green-200 bg-green-50 dark:bg-green-900/20" 
                      : "border-red-200 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-200 bg-gray-50 dark:bg-gray-700",
                  bestQuality?.resolution === level.resolution && "ring-2 ring-blue-500"
                )}
              >
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    level.tested
                      ? level.available
                        ? "bg-green-500"
                        : "bg-red-500"
                      : "bg-gray-300 animate-pulse"
                  )} />
                  <span className="font-medium">{level.resolution}</span>
                </div>
                
                {level.tested && level.available && (
                  <div className={cn("px-1.5 py-0.5 rounded text-xs font-medium", getQualityColor(level.score))}>
                    {level.score}
                  </div>
                )}
                
                {level.tested && !level.available && (
                  <span className="text-red-500 text-xs">N/A</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testing Multiple Videos Indicator */}
      {totalVideos > 1 && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-700 dark:text-blue-300">
              Testing {totalVideos} videos for best quality match
            </span>
          </div>
        </div>
      )}

      {/* Resolution Level Display */}
      {bestQuality && phase === 'complete' && (
        <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                Best Quality Found
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {bestQuality.label} - Score: {bestQuality.score}/100
              </div>
            </div>
            <div className="text-2xl">
              {bestQuality.score >= 80 ? '🏆' : bestQuality.score >= 60 ? '🥈' : '🥉'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface MultiVideoQualityIndicatorProps {
  videos: Array<{
    id: string;
    title: string;
    status: 'pending' | 'testing' | 'complete' | 'error';
    qualities?: QualityLevel[];
    bestQuality?: QualityLevel;
  }>;
  className?: string;
}

const MultiVideoQualityIndicator: React.FC<MultiVideoQualityIndicatorProps> = ({
  videos,
  className
}) => {
  const completedCount = videos.filter(v => v.status === 'complete').length;
  const totalCount = videos.length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Quality Testing Progress
        </span>
        <span className="text-xs text-gray-500">
          {completedCount}/{totalCount} complete
        </span>
      </div>

      <div className="space-y-2">
        {videos.map((video) => (
          <div
            key={video.id}
            className={cn(
              "flex items-center justify-between p-2 rounded border text-xs",
              video.status === 'complete' ? "border-green-200 bg-green-50 dark:bg-green-900/20" :
              video.status === 'testing' ? "border-blue-200 bg-blue-50 dark:bg-blue-900/20" :
              video.status === 'error' ? "border-red-200 bg-red-50 dark:bg-red-900/20" :
              "border-gray-200 bg-gray-50 dark:bg-gray-700"
            )}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                video.status === 'complete' ? "bg-green-500" :
                video.status === 'testing' ? "bg-blue-500 animate-pulse" :
                video.status === 'error' ? "bg-red-500" :
                "bg-gray-300"
              )} />
              <span className="truncate font-medium">{video.title}</span>
            </div>
            
            {video.bestQuality && (
              <div className={cn("px-1.5 py-0.5 rounded text-xs font-medium ml-2", getQualityColor(video.bestQuality.score))}>
                {video.bestQuality.resolution}
              </div>
            )}
            
            {video.status === 'testing' && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const getQualityColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-100';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100';
  if (score >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
};

export { QualityTestingIndicator, MultiVideoQualityIndicator };