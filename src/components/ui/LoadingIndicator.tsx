import React from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from './skeleton';

export interface LoadingIndicatorProps {
  variant?: 'search' | 'quality' | 'general';
  message?: string;
  progress?: number;
  phase?: string;
  className?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  variant = 'general',
  message,
  progress,
  phase,
  className
}) => {
  const getDefaultMessage = () => {
    switch (variant) {
      case 'search':
        return 'Searching...';
      case 'quality':
        return 'Testing quality...';
      default:
        return 'Loading...';
    }
  };

  const displayMessage = message || getDefaultMessage();

  return (
    <div className={cn("flex flex-col items-center justify-center p-6 space-y-4", className)}>
      {/* Animated spinner */}
      <div className="relative">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        {variant === 'search' && (
          <div className="absolute -inset-2 border-2 border-gray-100 border-b-blue-300 rounded-full animate-spin-slow opacity-50"></div>
        )}
      </div>

      {/* Main message */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {displayMessage}
        </p>

        {/* Phase indicator for multi-step processes */}
        {phase && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {phase}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {typeof progress === 'number' && progress >= 0 && progress <= 100 && (
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 dark:bg-gray-700">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Search-specific indicators */}
      {variant === 'search' && (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
    </div>
  );
};

export interface SearchPhaseIndicatorProps {
  currentPhase: 'searching' | 'filtering' | 'scoring' | 'selecting';
  className?: string;
}

const SearchPhaseIndicator: React.FC<SearchPhaseIndicatorProps> = ({
  currentPhase,
  className
}) => {
  const phases = [
    { key: 'searching', label: 'Searching', icon: '🔍' },
    { key: 'filtering', label: 'Filtering content', icon: '🔧' },
    { key: 'scoring', label: 'Scoring results', icon: '⭐' },
    { key: 'selecting', label: 'Selecting best', icon: '✨' }
  ];

  const currentIndex = phases.findIndex(p => p.key === currentPhase);

  return (
    <div className={cn("flex items-center justify-center space-x-4", className)}>
      {phases.map((phase, index) => (
        <div key={phase.key} className="flex flex-col items-center space-y-1">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2",
              index <= currentIndex
                ? "bg-blue-500 border-blue-500 text-white"
                : "bg-gray-100 border-gray-300 text-gray-400"
            )}
          >
            {index === currentIndex ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : index < currentIndex ? (
              '✓'
            ) : (
              phase.icon
            )}
          </div>
          <span className={cn(
            "text-xs",
            index <= currentIndex ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
          )}>
            {phase.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export interface VideoSkeletonProps {
  count?: number;
  className?: string;
}

const VideoSkeleton: React.FC<VideoSkeletonProps> = ({ count = 1, className }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          {/* Video player skeleton */}
          <Skeleton className="w-full aspect-video rounded-lg" />

          {/* Video title and info skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export { LoadingIndicator, SearchPhaseIndicator, VideoSkeleton };