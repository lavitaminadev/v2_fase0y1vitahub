/**
 * @fileoverview Main application shell.
 *
 * Wires the React Query client, global error boundary, and auth bootstrap.
 */

import { useEffect, useState, type JSX } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './core/auth';
import { AppRouter } from './core/router';
import { ErrorBoundary } from './core/ErrorBoundary';

/**
 * Restores the persisted session on mount and renders the router.
 */
function AuthBootstrap() {
  const checkAuth = useAuth((s) => s.checkAuth);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  return <AppRouter />;
}

/**
 * Root application component.
 */
export default function App(): JSX.Element {
  // Create a fresh QueryClient per app instance so cache lifecycle aligns with mounts.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
