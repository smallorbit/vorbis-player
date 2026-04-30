export function shouldUseMockProvider(): boolean {
  if (import.meta.env.VITE_MOCK_PROVIDER === 'true') return true;
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('provider') === 'mock';
}
