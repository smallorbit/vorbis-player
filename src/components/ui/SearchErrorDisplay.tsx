import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

export type SearchErrorType = 
  | 'network_error'
  | 'rate_limit'
  | 'no_results'
  | 'parsing_error'
  | 'timeout'
  | 'api_error'
  | 'unknown_error';

export interface SearchError {
  type: SearchErrorType;
  message: string;
  details?: string;
  retryable?: boolean;
  retryAfter?: number; // seconds
}

export interface SearchErrorDisplayProps {
  error: SearchError;
  onRetry?: () => void;
  onSkip?: () => void;
  onDismiss?: () => void;
  searchQuery?: string;
  className?: string;
}

const SearchErrorDisplay: React.FC<SearchErrorDisplayProps> = ({
  error,
  onRetry,
  onSkip,
  onDismiss,
  searchQuery,
  className
}) => {
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  useEffect(() => {
    if (error.retryAfter && error.retryAfter > 0) {
      setRetryCountdown(error.retryAfter);
      const interval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [error.retryAfter]);

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network_error':
      case 'timeout':
        return '🌐';
      case 'rate_limit':
        return '⏰';
      case 'no_results':
        return '🔍';
      case 'parsing_error':
        return '⚠️';
      case 'api_error':
        return '🔧';
      default:
        return '❌';
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network_error':
        return 'Network Connection Error';
      case 'timeout':
        return 'Request Timeout';
      case 'rate_limit':
        return 'Rate Limit Exceeded';
      case 'no_results':
        return 'No Videos Found';
      case 'parsing_error':
        return 'Search Parsing Error';
      case 'api_error':
        return 'API Error';
      default:
        return 'Search Error';
    }
  };

  const getErrorDescription = () => {
    switch (error.type) {
      case 'network_error':
        return 'Unable to connect to YouTube. Please check your internet connection and try again.';
      case 'timeout':
        return 'The search request took too long to complete. This might be due to network issues or server load.';
      case 'rate_limit':
        return 'Too many requests have been made. Please wait before trying again.';
      case 'no_results':
        return searchQuery 
          ? `No videos were found for "${searchQuery}". Try a different search term or skip to use fallback content.`
          : 'No videos were found for this track. Try skipping to use fallback content.';
      case 'parsing_error':
        return 'There was an issue processing the search results. This might be due to changes in YouTube\'s format.';
      case 'api_error':
        return 'YouTube API encountered an error. This is usually temporary.';
      default:
        return error.message || 'An unexpected error occurred during the search.';
    }
  };

  const canRetryNow = () => {
    return error.retryable !== false && retryCountdown === 0;
  };

  const shouldShowCountdown = () => {
    return error.type === 'rate_limit' && retryCountdown > 0;
  };

  return (
    <Card className={cn("border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-red-800 dark:text-red-200">
          <span className="text-2xl">{getErrorIcon()}</span>
          <span className="text-lg font-semibold">{getErrorTitle()}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error description */}
        <div className="text-sm text-red-700 dark:text-red-300">
          {getErrorDescription()}
        </div>

        {/* Error details */}
        {error.details && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded">
            <span className="font-medium">Details:</span> {error.details}
          </div>
        )}

        {/* Search query context */}
        {searchQuery && error.type !== 'no_results' && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            <span className="font-medium">Search Query:</span> {searchQuery}
          </div>
        )}

        {/* Rate limit countdown */}
        {shouldShowCountdown() && (
          <div className="flex items-center justify-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                {retryCountdown}
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                seconds until retry available
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {onRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              disabled={!canRetryNow()}
              className="flex items-center space-x-1"
            >
              <span>🔄</span>
              <span>
                {shouldShowCountdown() ? `Retry in ${retryCountdown}s` : 'Retry Search'}
              </span>
            </Button>
          )}
          
          {onSkip && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSkip}
              className="flex items-center space-x-1"
            >
              <span>⏭️</span>
              <span>Skip & Use Fallback</span>
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="flex items-center space-x-1"
            >
              <span>✕</span>
              <span>Dismiss</span>
            </Button>
          )}
        </div>

        {/* Helpful tips */}
        {error.type === 'network_error' && (
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            💡 <strong>Tip:</strong> Check your internet connection, try disabling VPN, or wait a moment before retrying.
          </div>
        )}
        
        {error.type === 'no_results' && (
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            💡 <strong>Tip:</strong> Try using just the song title or artist name instead of the full search query.
          </div>
        )}
        
        {error.type === 'rate_limit' && (
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            💡 <strong>Tip:</strong> Rate limits are temporary. The app will automatically retry when the limit resets.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export interface NetworkErrorProps {
  onRetry?: () => void;
  onSkip?: () => void;
  details?: string;
  className?: string;
}

const NetworkErrorDisplay: React.FC<NetworkErrorProps> = ({
  onRetry,
  onSkip,
  details,
  className
}) => {
  const error: SearchError = {
    type: 'network_error',
    message: 'Network connection failed',
    details,
    retryable: true
  };

  return (
    <SearchErrorDisplay
      error={error}
      onRetry={onRetry}
      onSkip={onSkip}
      className={className}
    />
  );
};

export interface RateLimitErrorProps {
  retryAfter: number;
  onRetry?: () => void;
  onSkip?: () => void;
  className?: string;
}

const RateLimitErrorDisplay: React.FC<RateLimitErrorProps> = ({
  retryAfter,
  onRetry,
  onSkip,
  className
}) => {
  const error: SearchError = {
    type: 'rate_limit',
    message: 'Rate limit exceeded',
    retryAfter,
    retryable: true
  };

  return (
    <SearchErrorDisplay
      error={error}
      onRetry={onRetry}
      onSkip={onSkip}
      className={className}
    />
  );
};

export interface NoResultsErrorProps {
  searchQuery?: string;
  onRetry?: () => void;
  onSkip?: () => void;
  suggestions?: string[];
  className?: string;
}

const NoResultsErrorDisplay: React.FC<NoResultsErrorProps> = ({
  searchQuery,
  onRetry,
  onSkip,
  suggestions = [],
  className
}) => {
  const error: SearchError = {
    type: 'no_results',
    message: 'No videos found',
    retryable: true
  };

  return (
    <div className={cn("space-y-3", className)}>
      <SearchErrorDisplay
        error={error}
        searchQuery={searchQuery}
        onRetry={onRetry}
        onSkip={onSkip}
      />
      
      {suggestions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-3">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Try these search alternatives:
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  {suggestion}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { 
  SearchErrorDisplay, 
  NetworkErrorDisplay, 
  RateLimitErrorDisplay, 
  NoResultsErrorDisplay 
};