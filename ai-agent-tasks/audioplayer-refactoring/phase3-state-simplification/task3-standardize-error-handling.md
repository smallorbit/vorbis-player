# Task 3: Standardize Error Handling

## Objective
Create consistent error handling patterns throughout the application, replacing scattered try-catch blocks and inconsistent error states with a unified error management system.

## Current Issues
- Inconsistent error handling across components
- Multiple error patterns: `console.error`, `setError`, silent failures
- No centralized error reporting or recovery
- Error states not consistently displayed to users
- Missing error boundaries for component-level failures

## Current Error Handling Examples
```typescript
// Pattern 1: Silent failure (line 263)
} catch {
  // Ignore polling errors
}

// Pattern 2: Console error only (line 165)
} catch (resumeError) {
  console.error('Failed to resume after playback attempt:', resumeError);
}

// Pattern 3: State error (line 212)
} catch (error) {
  setError(error instanceof Error ? error.message : 'Authentication failed');
}
```

## Files to Modify
- **Create**: `src/utils/errorHandling.ts`
- **Create**: `src/contexts/ErrorContext.tsx`
- **Create**: `src/components/ErrorBoundary.tsx`
- **Create**: `src/hooks/useErrorHandler.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (replace scattered error handling)
- **Modify**: All components with error handling

## Implementation Steps

### Step 1: Create Error Types and Utilities
Create `src/utils/errorHandling.ts`:

```typescript
// Define application error types
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  PLAYBACK = 'playback',
  SPOTIFY_API = 'spotify_api',
  COLOR_EXTRACTION = 'color_extraction',
  STORAGE = 'storage',
  UNKNOWN = 'unknown'
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
}

// Error factory functions
export const createAppError = (
  type: ErrorType,
  message: string,
  originalError?: Error,
  context?: Record<string, any>,
  recoverable = true
): AppError => ({
  type,
  message,
  originalError,
  timestamp: Date.now(),
  context,
  recoverable
});

// Specific error creators
export const createAuthError = (message: string, originalError?: Error) =>
  createAppError(ErrorType.AUTHENTICATION, message, originalError, undefined, true);

export const createPlaybackError = (message: string, originalError?: Error, context?: any) =>
  createAppError(ErrorType.PLAYBACK, message, originalError, context, true);

export const createNetworkError = (message: string, originalError?: Error) =>
  createAppError(ErrorType.NETWORK, message, originalError, undefined, true);

// Error classification
export const classifyError = (error: Error): ErrorType => {
  const message = error.message.toLowerCase();

  if (message.includes('auth') || message.includes('token') || message.includes('permission')) {
    return ErrorType.AUTHENTICATION;
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ErrorType.NETWORK;
  }
  if (message.includes('playback') || message.includes('spotify') || message.includes('track')) {
    return ErrorType.PLAYBACK;
  }

  return ErrorType.UNKNOWN;
};
```

### Step 2: Create Error Context
Create `src/contexts/ErrorContext.tsx`:

```typescript
import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { AppError, ErrorType } from '../utils/errorHandling';

interface ErrorState {
  errors: AppError[];
  currentError: AppError | null;
  isErrorModalOpen: boolean;
}

type ErrorAction =
  | { type: 'ADD_ERROR'; error: AppError }
  | { type: 'DISMISS_ERROR'; errorId: number }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_CURRENT_ERROR'; error: AppError | null }
  | { type: 'TOGGLE_ERROR_MODAL'; isOpen: boolean };

const errorReducer = (state: ErrorState, action: ErrorAction): ErrorState => {
  switch (action.type) {
    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.error],
        currentError: action.error
      };
    case 'DISMISS_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.timestamp !== action.errorId),
        currentError: state.currentError?.timestamp === action.errorId ? null : state.currentError
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
        currentError: null
      };
    case 'SET_CURRENT_ERROR':
      return {
        ...state,
        currentError: action.error
      };
    case 'TOGGLE_ERROR_MODAL':
      return {
        ...state,
        isErrorModalOpen: action.isOpen
      };
    default:
      return state;
  }
};

interface ErrorContextValue {
  state: ErrorState;
  addError: (error: AppError) => void;
  dismissError: (errorId: number) => void;
  clearErrors: () => void;
  showErrorModal: (error: AppError) => void;
  hideErrorModal: () => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, {
    errors: [],
    currentError: null,
    isErrorModalOpen: false
  });

  const addError = useCallback((error: AppError) => {
    dispatch({ type: 'ADD_ERROR', error });

    // Auto-dismiss non-critical errors after 5 seconds
    if (error.recoverable && error.type !== ErrorType.AUTHENTICATION) {
      setTimeout(() => {
        dispatch({ type: 'DISMISS_ERROR', errorId: error.timestamp });
      }, 5000);
    }
  }, []);

  const dismissError = useCallback((errorId: number) => {
    dispatch({ type: 'DISMISS_ERROR', errorId });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  const showErrorModal = useCallback((error: AppError) => {
    dispatch({ type: 'SET_CURRENT_ERROR', error });
    dispatch({ type: 'TOGGLE_ERROR_MODAL', isOpen: true });
  }, []);

  const hideErrorModal = useCallback(() => {
    dispatch({ type: 'TOGGLE_ERROR_MODAL', isOpen: false });
  }, []);

  const value: ErrorContextValue = {
    state,
    addError,
    dismissError,
    clearErrors,
    showErrorModal,
    hideErrorModal
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useErrorContext = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
};
```

### Step 3: Create Error Boundary Component
Create `src/components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ReactNode } from 'react';
import styled from 'styled-components';
import { createAppError, ErrorType } from '../utils/errorHandling';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const DefaultErrorFallback = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: 8px;
  color: #ff6b6b;
  text-align: center;
`;

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Report to error tracking service
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Here you would send to error tracking service like Sentry
    const appError = createAppError(
      ErrorType.UNKNOWN,
      'Component error boundary triggered',
      error,
      { errorInfo },
      false
    );

    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('App Error:', appError);
      console.groupEnd();
    }
  };

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;

      if (FallbackComponent && this.state.error) {
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <DefaultErrorFallback>
          <h3>Something went wrong</h3>
          <p>An unexpected error occurred in this component.</p>
          <button onClick={this.resetError}>Try Again</button>
        </DefaultErrorFallback>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Step 4: Create Error Handler Hook
Create `src/hooks/useErrorHandler.ts`:

```typescript
import { useCallback } from 'react';
import { useErrorContext } from '../contexts/ErrorContext';
import {
  createAppError,
  createAuthError,
  createPlaybackError,
  createNetworkError,
  classifyError,
  ErrorType
} from '../utils/errorHandling';

export const useErrorHandler = () => {
  const { addError, showErrorModal } = useErrorContext();

  const handleError = useCallback((
    error: Error | string,
    type?: ErrorType,
    context?: Record<string, any>,
    showModal = false
  ) => {
    let appError;

    if (typeof error === 'string') {
      appError = createAppError(type || ErrorType.UNKNOWN, error, undefined, context);
    } else {
      const errorType = type || classifyError(error);
      appError = createAppError(errorType, error.message, error, context);
    }

    addError(appError);

    if (showModal || !appError.recoverable) {
      showErrorModal(appError);
    }

    return appError;
  }, [addError, showErrorModal]);

  // Specific error handlers
  const handleAuthError = useCallback((error: Error | string, context?: any) => {
    const appError = typeof error === 'string'
      ? createAuthError(error)
      : createAuthError(error.message, error);

    addError(appError);
    showErrorModal(appError); // Auth errors should always show modal
    return appError;
  }, [addError, showErrorModal]);

  const handlePlaybackError = useCallback((error: Error | string, context?: any) => {
    const appError = typeof error === 'string'
      ? createPlaybackError(error, undefined, context)
      : createPlaybackError(error.message, error, context);

    addError(appError);
    return appError;
  }, [addError]);

  const handleNetworkError = useCallback((error: Error | string) => {
    const appError = typeof error === 'string'
      ? createNetworkError(error)
      : createNetworkError(error.message, error);

    addError(appError);
    return appError;
  }, [addError]);

  // Async error wrapper
  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorType?: ErrorType,
    context?: Record<string, any>
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args);
      } catch (error) {
        handleError(error as Error, errorType, context);
        return null;
      }
    };
  }, [handleError]);

  return {
    handleError,
    handleAuthError,
    handlePlaybackError,
    handleNetworkError,
    withErrorHandling
  };
};
```

### Step 5: Update AudioPlayer.tsx Error Handling
Replace scattered error handling with standardized approach:

```typescript
const AudioPlayerComponent = () => {
  const { handleAuthError, handlePlaybackError, withErrorHandling } = useErrorHandler();

  // Replace: setError(error instanceof Error ? error.message : 'Authentication failed');
  useEffect(() => {
    const handleAuthRedirect = withErrorHandling(async () => {
      await spotifyAuth.handleRedirect();
    }, ErrorType.AUTHENTICATION);

    handleAuthRedirect();
  }, [withErrorHandling]);

  // Replace scattered try-catch blocks
  const playTrack = useCallback(withErrorHandling(async (index: number) => {
    if (tracks[index]) {
      const isAuthenticated = spotifyAuth.isAuthenticated();

      if (!isAuthenticated) {
        handleAuthError('Spotify authentication required');
        return;
      }

      await spotifyPlayer.playTrack(tracks[index].uri);
      setCurrentTrackIndex(index);

      // ... rest of playback logic
    }
  }, ErrorType.PLAYBACK, { function: 'playTrack' }), [tracks, setCurrentTrackIndex, handleAuthError]);
};
```

### Step 6: Add Error Display Components
Create error display components:

```typescript
// Error Toast Component
const ErrorToast: React.FC<{ error: AppError; onDismiss: () => void }> = ({ error, onDismiss }) => (
  <ToastContainer type={error.type}>
    <ToastMessage>{error.message}</ToastMessage>
    <ToastDismiss onClick={onDismiss}>×</ToastDismiss>
  </ToastContainer>
);

// Error Modal Component
const ErrorModal: React.FC<{ error: AppError; isOpen: boolean; onClose: () => void }> = ({
  error,
  isOpen,
  onClose
}) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <ModalHeader>Error: {error.type}</ModalHeader>
    <ModalContent>
      <p>{error.message}</p>
      {error.context && (
        <details>
          <summary>Technical Details</summary>
          <pre>{JSON.stringify(error.context, null, 2)}</pre>
        </details>
      )}
    </ModalContent>
    <ModalActions>
      <Button onClick={onClose}>Close</Button>
      {error.recoverable && <Button variant="primary" onClick={/* retry logic */}>Retry</Button>}
    </ModalActions>
  </Modal>
);
```

## Testing Requirements

### Unit Tests
- [ ] Error utilities create correct AppError objects
- [ ] Error classification works correctly
- [ ] Error context manages state correctly
- [ ] Error boundary catches and handles errors
- [ ] Error handlers create and report errors properly

### Integration Tests
- [ ] Error handling integrates correctly with components
- [ ] Error display components render correctly
- [ ] Error recovery mechanisms work
- [ ] Error context propagates errors correctly

### Error Scenario Tests
- [ ] Network errors are handled and displayed
- [ ] Authentication errors trigger appropriate UI
- [ ] Playback errors don't crash the app
- [ ] Component errors are caught by boundaries
- [ ] Error recovery works for recoverable errors

### Manual Testing
- [ ] Error messages are user-friendly
- [ ] Error recovery mechanisms work
- [ ] Error reporting doesn't impact performance
- [ ] Error UI doesn't block critical functionality

## Dependencies
- **Optional**: Can be done independently of other tasks
- **Recommended**: Implement alongside other Phase 3 tasks for consistency

## Success Criteria
- [ ] Consistent error handling across all components
- [ ] User-friendly error messages and recovery options
- [ ] Error boundaries prevent app crashes
- [ ] Centralized error reporting and management
- [ ] All existing functionality preserved

## Implementation Benefits

### Before (Inconsistent)
```typescript
// Pattern 1: Silent failure
} catch {
  // Ignore polling errors
}

// Pattern 2: Console only
} catch (error) {
  console.error('Error:', error);
}

// Pattern 3: Direct state update
} catch (error) {
  setError(error.message);
}
```

### After (Standardized)
```typescript
// Consistent error handling
const playTrack = withErrorHandling(async (index: number) => {
  // Playback logic
}, ErrorType.PLAYBACK, { trackIndex: index });

// Authentication errors
const authenticate = async () => {
  try {
    await spotifyAuth.authenticate();
  } catch (error) {
    handleAuthError(error);
  }
};
```

## Advanced Features (Optional)
- **Error Analytics**: Track error patterns and frequency
- **Error Recovery Strategies**: Automatic retry mechanisms
- **Error Reporting**: Integration with external error tracking
- **Error Debugging**: Enhanced development error tools
- **Error Notifications**: Smart error notification system

## Notes
- Consider integration with external error tracking services (Sentry, LogRocket)
- Test error handling in production-like conditions
- Ensure error boundaries don't catch errors meant for testing
- Consider user experience during error states
- Add proper error logging for debugging