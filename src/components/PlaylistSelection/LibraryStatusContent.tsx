import type * as React from 'react';
import { Button, Skeleton, Alert, AlertDescription } from '../styled';
import { theme } from '@/styles/theme';
import type { ProviderDescriptor } from '@/types/providers';
import { LoadingState } from './styled';

interface LibraryStatusContentProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  activeDescriptor: ProviderDescriptor | null | undefined;
  setError: (error: string | null) => void;
}

export function LibraryStatusContent({
  isLoading,
  isAuthenticated,
  error,
  activeDescriptor,
  setError,
}: LibraryStatusContentProps): React.JSX.Element {
  return (
    <>
      {isLoading && (
        <LoadingState>
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <p style={{ textAlign: 'center', color: 'white' }}>Loading your library...</p>
        </LoadingState>
      )}

      {!isLoading && !isAuthenticated && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: theme.colors.muted.foreground, marginBottom: theme.spacing.lg, fontSize: theme.fontSize.lg }}>
            Connect your {activeDescriptor?.name ?? 'music provider'} account to access your playlists
          </p>
          <Button
            onClick={async () => {
              try {
                await activeDescriptor?.auth.beginLogin();
              } catch (err) {
                console.error('Failed to redirect to auth:', err);
                setError('Failed to redirect to login');
              }
            }}
            style={{
              background: theme.colors.spotify,
              color: theme.colors.white,
              border: 'none',
              padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
              fontSize: theme.fontSize.base,
              borderRadius: theme.borderRadius.lg,
              cursor: 'pointer',
              transition: `background ${theme.transitions.fast} ease`
            }}
          >
            Connect {activeDescriptor?.name ?? 'account'}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription style={{ color: theme.colors.errorText }}>
            {error}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
