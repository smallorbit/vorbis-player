/**
 * Test utility: wraps components in ProviderProvider for tests that use
 * hooks depending on the provider context.
 */

import React from 'react';
import { ProviderProvider } from '@/contexts/ProviderContext';

/**
 * Wraps children in ProviderProvider. Use in renderHook's wrapper or render's wrapper.
 */
export function ProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ProviderProvider>{children}</ProviderProvider>;
}
